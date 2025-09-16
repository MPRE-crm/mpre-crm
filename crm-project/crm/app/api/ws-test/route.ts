// app/api/ws-test/route.ts
export const runtime = "edge";
export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const url = new URL(req.url);

  // HTTP probe
  if (url.searchParams.get("probe") === "1") {
    const hasWSPair = typeof (globalThis as any).WebSocketPair !== "undefined";
    return new Response(JSON.stringify({ ok: true, hasWSPair }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }

  // WebSocket
  if ((req.headers.get("upgrade") || "").toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket", { status: 426 });
  }

  const pair = new (globalThis as any).WebSocketPair();
  const client = pair[0] as WebSocket;
  const server = pair[1] as WebSocket;

  (server as any).accept();

  server.addEventListener("message", (ev: any) => {
    const text = typeof ev.data === "string" ? ev.data : "[binary]";
    (server as any).send(`echo:${text}`);
  });

  return new Response(null, { status: 101, webSocket: client } as any);
}
