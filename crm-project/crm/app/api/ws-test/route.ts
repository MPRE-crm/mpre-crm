// app/api/ws-test/route.ts
export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if ((req.headers.get("upgrade") || "").toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket", { status: 426 });
  }

  const pair = new (globalThis as any).WebSocketPair();
  const client = pair[0] as WebSocket;
  const server = pair[1] as WebSocket;

  (server as any).accept(); // accept immediately

  server.addEventListener("message", (ev: any) => {
    server.send(`echo:${typeof ev.data === "string" ? ev.data : "[binary]"}`);
  });

  server.addEventListener("error", () => {
    try { (server as any).close(); } catch {}
  });

  return new Response(null, { status: 101, webSocket: client } as any);
}

