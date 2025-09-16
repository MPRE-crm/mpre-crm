// app/ws-test/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";

export default function WSTestPage() {
  const [status, setStatus] = useState<"idle"|"connecting"|"open"|"closed"|"error">("idle");
  const [lastMsg, setLastMsg] = useState<string>("");
  const logRef = useRef<HTMLTextAreaElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  function log(line: string) {
    if (!logRef.current) return;
    logRef.current.value += line + "\n";
    logRef.current.scrollTop = logRef.current.scrollHeight;
  }

  const connect = () => {
    try {
      setStatus("connecting");
      log("Opening WebSocket…");
      const url = `wss://${location.host}/api/ws-test`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus("open");
        log("[open] connected");
        ws.send("hello from browser");
      };
      ws.onmessage = (ev) => {
        const t = typeof ev.data === "string" ? ev.data : "[binary]";
        setLastMsg(t);
        log(`[message] ${t}`);
      };
      ws.onerror = (ev) => {
        setStatus("error");
        log("[error] see console");
        console.error("WS error", ev);
      };
      ws.onclose = () => {
        setStatus("closed");
        log("[close]");
      };
    } catch (e) {
      setStatus("error");
      console.error(e);
      log(String(e));
    }
  };

  const disconnect = () => {
    wsRef.current?.close();
    wsRef.current = null;
  };

  useEffect(() => {
    return () => {
      try { wsRef.current?.close(); } catch {}
    };
  }, []);

  return (
    <div style={{ padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <h1>WS Test</h1>
      <p>Endpoint: <code>wss://{typeof window !== "undefined" ? location.host : "<host>"}/api/ws-test</code></p>
      <p>Status: <b>{status}</b></p>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <button onClick={connect} disabled={status === "connecting" || status === "open"}>Connect</button>
        <button onClick={disconnect} disabled={status !== "open"}>Disconnect</button>
      </div>
      <textarea ref={logRef} rows={12} style={{ width: "100%", fontFamily: "monospace" }} readOnly />
      <p>Last message: <code>{lastMsg}</code></p>
    </div>
  );
}
