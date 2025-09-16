// app/api/ws-test/route.ts
export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET(_req: Request) {
  // Accept WS unconditionally (no 426 check)
  const pair = new (globalThis as any).WebSocketPair();
  const client = pair[0] as WebSocket;
  const server = pair[1] as WebSocket;

  (server as any).accept?.();

  server.addEventListener("message", (ev: any) => {
    server.send(`echo:${typeof ev.data === "string" ? ev.data : "[binary]"}`);
  });

  // keep-alive ping
  const ping = setInterval(() => {
    try { (server as any).send("ping"); } catch {}
  }, 25000);
  server.addEventListener("close", () => clearInterval(ping));
  server.addEventListener("error", () => clearInterval(ping));

  return new Response(null, { status: 101, webSocket: client } as any);
}


