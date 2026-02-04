// mic/micController.js
export function createMicController(ws, oa) {
  let allowMic = false;

  function lockMic() {
    allowMic = false;

    if (oa.readyState === 1) {
      // 🔒 HARD STOP: flush + disable listening immediately
      oa.send(JSON.stringify({ type: "input_audio_buffer.clear" }));
      oa.send(JSON.stringify({ type: "input_audio_buffer.commit" }));

      // 🔒 CRITICAL: explicitly turn OFF turn detection while Samantha speaks
      oa.send(
        JSON.stringify({
          type: "session.update",
          session: { turn_detection: null },
        })
      );
    }
  }

  function unlockMic() {
    allowMic = true;

    if (oa.readyState === 1) {
      // 🔑 Fresh start — clean buffer
      oa.send(JSON.stringify({ type: "input_audio_buffer.clear" }));

      // 🔑 Re-enable server-side VAD listening
      oa.send(
        JSON.stringify({
          type: "session.update",
          session: { turn_detection: { type: "server_vad" } },
        })
      );
    }

    // 🔴 Tell CLIENT mic can open
    if (ws.readyState === 1) {
      ws.send(JSON.stringify({ type: "mic_can_open" }));
    }
  }

  function canSendAudio() {
    return allowMic;
  }

  return {
    lockMic,
    unlockMic,
    canSendAudio,
  };
}
