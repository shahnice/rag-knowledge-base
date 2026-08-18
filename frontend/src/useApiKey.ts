import { useEffect, useState } from "react";

export function useApiKey() {
  const [apiKey, setApiKey] = useState(() => sessionStorage.getItem("openai_api_key") || "");

  useEffect(() => {
    sessionStorage.setItem("openai_api_key", apiKey);
  }, [apiKey]);

  return { apiKey, setApiKey };
}
