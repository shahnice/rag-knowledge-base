import { useEffect, useState } from "react";
import { BusinessOut, updateBusiness } from "../api";

export default function BusinessSettings({
  business,
  onUpdated,
}: {
  business: BusinessOut;
  onUpdated: () => void;
}) {
  const [greeting, setGreeting] = useState(business.greeting);
  const [persona, setPersona] = useState(business.persona_instructions);
  const [voice, setVoice] = useState(business.voice);
  const [phoneNumber, setPhoneNumber] = useState(business.phone_number || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setGreeting(business.greeting);
    setPersona(business.persona_instructions);
    setVoice(business.voice);
    setPhoneNumber(business.phone_number || "");
  }, [business.id]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await updateBusiness(business.id, {
        greeting,
        persona_instructions: persona,
        voice,
        phone_number: phoneNumber || undefined,
      });
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const fieldStyle = { width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ccc", marginTop: 4 };

  return (
    <div style={{ maxWidth: 480 }}>
      <h3>Receptionist settings</h3>
      <label style={{ display: "block", marginBottom: 12 }}>
        Greeting
        <textarea value={greeting} onChange={(e) => setGreeting(e.target.value)} rows={2} style={fieldStyle} />
      </label>
      <label style={{ display: "block", marginBottom: 12 }}>
        Persona / instructions (tone, do's and don'ts)
        <textarea value={persona} onChange={(e) => setPersona(e.target.value)} rows={4} style={fieldStyle} />
      </label>
      <label style={{ display: "block", marginBottom: 12 }}>
        Voice
        <input value={voice} onChange={(e) => setVoice(e.target.value)} style={fieldStyle} />
      </label>
      <label style={{ display: "block", marginBottom: 12 }}>
        Phone number (E.164, set once Twilio is configured)
        <input
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          placeholder="+15551234567"
          style={fieldStyle}
        />
      </label>
      <button onClick={handleSave} disabled={saving}>
        {saving ? "Saving…" : "Save settings"}
      </button>
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}
