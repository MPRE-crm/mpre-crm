export function handleClientMessage({ msg, oa, mic, micQueue, oaReady }) {
  if (typeof msg === "string") return;

  if (!mic.canSendAudio()) return;

  const packet = JSON.stringify({
    type: "input_audio_buffer.append",
    audio: Buffer.from(msg).toString("base64"),
  });

  if (!oaReady) {
    micQueue.push(packet);
  } else {
    oa.send(packet);
  }
}
