import { useEffect, useRef, useState } from "react";
import { BusinessOut, browserCallSocketUrl, CallTurnOut, getCall, validateOpenAIKey } from "../api";

const CONTACT_EMAIL = "shahnice2005@gmail.com";
const SAMPLE_RATE = 24000;

type CallStatus = "idle" | "connecting" | "active" | "ended" | "error";
type KeyStatus = "unknown" | "checking" | "valid" | "invalid";

function floatTo16BitPCM(float32: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(float32.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

function downsampleTo24kPCM16(float32: Float32Array, inputSampleRate: number): ArrayBuffer {
  if (inputSampleRate === SAMPLE_RATE) return floatTo16BitPCM(float32);
  const ratio = inputSampleRate / SAMPLE_RATE;
  const outputLength = Math.floor(float32.length / ratio);
  const result = new Float32Array(outputLength);
  for (let i = 0; i < outputLength; i++) {
    const srcIndex = i * ratio;
    const floor = Math.floor(srcIndex);
    const ceil = Math.min(floor + 1, float32.length - 1);
    const frac = srcIndex - floor;
    result[i] = float32[floor] * (1 - frac) + float32[ceil] * frac;
  }
  return floatTo16BitPCM(result);
}

interface PlaybackState {
  nextPlayTime: number;
  activeSources: AudioBufferSourceNode[];
}

function playPCM16Chunk(arrayBuffer: ArrayBuffer, audioContext: AudioContext, state: PlaybackState) {
  const int16 = new Int16Array(arrayBuffer);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 0x8000;

  const audioBuffer = audioContext.createBuffer(1, float32.length, SAMPLE_RATE);
  audioBuffer.copyToChannel(float32, 0);

  const source = audioContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioContext.destination);

  const startAt = Math.max(audioContext.currentTime, state.nextPlayTime);
  source.start(startAt);
  state.nextPlayTime = startAt + audioBuffer.duration;
  state.activeSources.push(source);
  source.onended = () => {
    state.activeSources = state.activeSources.filter((s) => s !== source);
  };
}

function clearPlayback(audioContext: AudioContext, state: PlaybackState) {
  state.activeSources.forEach((s) => {
    try {
      s.stop();
    } catch {
      // already stopped
    }
  });
  state.activeSources = [];
  state.nextPlayTime = audioContext.currentTime;
}

export default function TestCallPanel({ business }: { business: BusinessOut }) {
  const [apiKey, setApiKey] = useState(() => sessionStorage.getItem("openai_api_key") || "");
  const [keyStatus, setKeyStatus] = useState<KeyStatus>("unknown");
  const [keyDetail, setKeyDetail] = useState<string | null>(null);
  const [status, setStatus] = useState<CallStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [callId, setCallId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<CallTurnOut[] | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const playbackStateRef = useRef<PlaybackState>({ nextPlayTime: 0, activeSources: [] });

  useEffect(() => {
    sessionStorage.setItem("openai_api_key", apiKey);
    setKeyStatus("unknown");
  }, [apiKey]);

  useEffect(() => cleanup, []);

  async function handleValidateKey() {
    if (!apiKey.trim()) return;
    setKeyStatus("checking");
    setKeyDetail(null);
    try {
      const res = await validateOpenAIKey(apiKey.trim());
      setKeyStatus(res.valid ? "valid" : "invalid");
      setKeyDetail(res.detail);
    } catch (err) {
      setKeyStatus("invalid");
      setKeyDetail(err instanceof Error ? err.message : "Validation failed");
    }
  }

  function cleanup() {
    processorRef.current?.disconnect();
    sourceNodeRef.current?.disconnect();
    processorRef.current = null;
    sourceNodeRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "stop" }));
    }
    wsRef.current?.close();
    wsRef.current = null;
    audioContextRef.current?.close();
    audioContextRef.current = null;
  }

  async function handleStartCall() {
    if (!apiKey.trim()) return;
    setErrorMessage(null);
    setTranscript(null);
    setCallId(null);
    setStatus("connecting");

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setStatus("error");
      setErrorMessage("Microphone access was denied or is unavailable.");
      return;
    }
    streamRef.current = stream;

    const audioContext = new AudioContext();
    audioContextRef.current = audioContext;
    playbackStateRef.current = { nextPlayTime: audioContext.currentTime, activeSources: [] };

    const ws = new WebSocket(browserCallSocketUrl(business.id));
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "start", openai_api_key: apiKey.trim() }));
    };

    ws.onmessage = (event) => {
      if (typeof event.data === "string") {
        const msg = JSON.parse(event.data);
        if (msg.type === "ready") {
          setCallId(msg.call_id);
          setStatus("active");
          startCapture(audioContext, stream, ws);
        } else if (msg.type === "interrupt") {
          clearPlayback(audioContext, playbackStateRef.current);
        } else if (msg.type === "error") {
          setStatus("error");
          setErrorMessage(msg.message || "Call failed");
          cleanup();
        } else if (msg.type === "ended") {
          setStatus("ended");
          if (msg.call_id) loadTranscript(msg.call_id);
          cleanup();
        }
      } else {
        playPCM16Chunk(event.data as ArrayBuffer, audioContext, playbackStateRef.current);
      }
    };

    ws.onerror = () => {
      setStatus("error");
      setErrorMessage("Connection to the voice server failed.");
    };
  }

  function startCapture(audioContext: AudioContext, stream: MediaStream, ws: WebSocket) {
    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);
    const silentGain = audioContext.createGain();
    silentGain.gain.value = 0;

    processor.onaudioprocess = (event) => {
      if (ws.readyState !== WebSocket.OPEN) return;
      const input = event.inputBuffer.getChannelData(0);
      const pcm16 = downsampleTo24kPCM16(input, audioContext.sampleRate);
      ws.send(pcm16);
    };

    source.connect(processor);
    processor.connect(silentGain);
    silentGain.connect(audioContext.destination);

    sourceNodeRef.current = source;
    processorRef.current = processor;
  }

  async function loadTranscript(id: string) {
    try {
      const call = await getCall(id);
      setTranscript(call.turns);
    } catch {
      // transcript is a nice-to-have; ignore failures
    }
  }

  function handleEndCall() {
    setStatus("ended");
    if (callId) loadTranscript(callId);
    cleanup();
  }

  const fieldStyle = { width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ccc", marginTop: 4 };
  const mailto = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
    `Set up AI receptionist for ${business.name} on our own server`
  )}`;

  return (
    <div style={{ maxWidth: 560 }}>
      <h3>Voice demo</h3>
      <p style={{ color: "#666", fontSize: 14 }}>
        Try a live voice call with this business's AI receptionist right in your browser. Bring your own
        OpenAI API key — it's used only for this test call and is stored only in this browser tab, never on
        our servers.
      </p>

      <label style={{ display: "block", marginBottom: 8 }}>
        Your OpenAI API key
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-..."
          style={fieldStyle}
          disabled={status === "connecting" || status === "active"}
        />
      </label>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <button onClick={handleValidateKey} disabled={!apiKey.trim() || keyStatus === "checking"}>
          {keyStatus === "checking" ? "Checking…" : "Validate key"}
        </button>
        {keyStatus === "valid" && <span style={{ color: "green", fontSize: 14 }}>✓ Key looks good</span>}
        {keyStatus === "invalid" && (
          <span style={{ color: "red", fontSize: 14 }}>✗ {keyDetail || "Invalid key"}</span>
        )}
      </div>

      <div style={{ marginBottom: 16 }}>
        {status !== "active" && status !== "connecting" && (
          <button onClick={handleStartCall} disabled={!apiKey.trim()}>
            Start Test Call
          </button>
        )}
        {(status === "active" || status === "connecting") && (
          <button style={{ background: "#c33" }} onClick={handleEndCall}>
            End Call
          </button>
        )}
        {status === "connecting" && <p>Connecting…</p>}
        {status === "active" && <p style={{ color: "green" }}>● Call in progress — speak into your mic</p>}
        {status === "ended" && <p style={{ color: "#666" }}>Call ended.</p>}
        {status === "error" && <p style={{ color: "red" }}>{errorMessage}</p>}
      </div>

      {transcript && transcript.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h4>Transcript</h4>
          {transcript
            .filter((t) => t.role !== "tool")
            .map((t) => (
              <div key={t.id} className={`message ${t.role === "caller" ? "user" : "assistant"}`}>
                {t.content}
              </div>
            ))}
        </div>
      )}

      <div style={{ marginTop: 24, padding: 16, borderRadius: 8, background: "#eee" }}>
        <strong>Want this live on your own phone number?</strong>
        <p style={{ fontSize: 14, margin: "8px 0" }}>
          Once you've tried the demo, we can set this up on your own server with a real phone number.
        </p>
        <a href={mailto}>
          <button>Contact us to set up on your server</button>
        </a>
      </div>
    </div>
  );
}
