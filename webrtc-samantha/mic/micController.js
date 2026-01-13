export function createMicController(ws, oa) {
  let allowMic = false;

  function lockMic() {
    allowMic = false;

    // 🔒 Commit any partial audio so OA closes cleanly
    if (oa.readyState === 1) {
      oa.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
    }
  }

  function unlockMic() {
    allowMic = true;

    if (oa.readyState === 1) {
      // 🔑 CRITICAL: clear stale buffer
      oa.send(JSON.stringify({ type: "input_audio_buffer.clear" }));

      // 🔑 CRITICAL: re-enable server-side VAD listening
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
