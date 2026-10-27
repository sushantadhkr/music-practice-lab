import { useState, useEffect, useCallback } from "react";

export function useAudioDevices() {
  const [devices, setDevices] = useState([]);

  const refresh = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      setDevices(all.filter((d) => d.kind === "audioinput"));
    } catch (e) {
      console.error("Failed to enumerate audio devices:", e);
    }
  }, []);

  useEffect(() => {
    refresh();
    const handler = () => refresh();
    navigator.mediaDevices?.addEventListener?.("devicechange", handler);
    return () => navigator.mediaDevices?.removeEventListener?.("devicechange", handler);
  }, [refresh]);

  return { devices, refresh };
}
