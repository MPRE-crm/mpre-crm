import { WebSocket } from "ws";

/*
  🔒 GLOBAL PCM PLAYBACK LOCK
  Ensures PCM audio NEVER overlaps or cuts off mid-stream
*/
let isPlaying = false;
const pcmQueue = [];

// ---------------------------------------------------------------------------
// Helper: stream a PCM buffer to the WebRTC client (STRICTLY ONE AT A TIME)
// ---------------------------------------------------------------------------
export function playPcmToClient(ws, buffer, label, onDone) {
  pcmQueue.push({ ws, buffer, label, onDone });

  // If something is already playing, just queue it
  if (isPlaying) return;

  playNext();
}

function playNext() {
  if (pcmQueue.length === 0) {
    isPlaying = false;
    return;
  }

  isPlaying = true;

  const { ws, buffer, label, onDone } = pcmQueue.shift();

  if (!buffer || !Buffer.isBuffer(buffer)) {
    console.error(`❌ Invalid PCM buffer for ${label}`);
    isPlaying = false;
    if (onDone) onDone();
    playNext();
    return;
  }

  console.log(`🔊 Streaming PCM for ${label} (${buffer.length} bytes)…`);

  const chunkSize = 3200; // 20ms @ 16kHz PCM16
  let offset = 0;
  let finished = false;

  function finishPlayback() {
    if (finished) return;
    finished = true;

    console.log(`✅ Finished streaming PCM for ${label}`);
    isPlaying = false;

    if (onDone) onDone();
    playNext();
  }

  function sendChunk() {
    if (ws.readyState !== WebSocket.OPEN) {
      console.log(`⚠️ WebSocket closed while playing ${label}`);
      finishPlayback();
      return;
    }

    if (offset >= buffer.length) {
      finishPlayback();
      return;
    }

    const end = Math.min(offset + chunkSize, buffer.length);
    const chunk = buffer.subarray(offset, end);

    ws.send(chunk);
    offset = end;

    setTimeout(sendChunk, 20);
  }

  sendChunk();
}
