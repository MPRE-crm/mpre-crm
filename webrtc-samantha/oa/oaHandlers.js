export function handleOpenAIMessage({
  data,
  ws,
  oa,
  mic,
  state,
  setState,
  onTranscript,
  offTopicState,
}) {
  // 🔊 Stream assistant audio to client
  if (data.type?.includes("audio.delta")) {
    if (ws.readyState === 1 && data.delta) {
      ws.send(Buffer.from(data.delta, "base64"));
    }
    return;
  }

  // 🔑 ASSISTANT FINISHED SPEAKING
  if (data.type === "response.output_audio.done") {
    // ✅ SINGLE SOURCE OF TRUTH
    mic.unlockMic();

    // 🧠 Off-topic bookkeeping ONLY
    if (offTopicState.active) {
      offTopicState.active = false;
      offTopicState.awaiting = true;
    }

    return;
  }

  // 📝 Transcription completed → hand back to server.js logic
  if (data.type === "conversation.item.input_audio_transcription.completed") {
    const transcript = (data.transcript || "").trim();
    if (!transcript) return;
    onTranscript(transcript);
  }
}
