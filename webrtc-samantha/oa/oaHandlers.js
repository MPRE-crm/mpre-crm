// oa/oaHandlers.js
export function handleOpenAIMessage({
  data,
  ws,
  oa,
  mic,
  state,
  setState,
  onTranscript,
  offTopicState,
  allowOASpeech,
  playPcmToClient,        // 🔧 REQUIRED
}) {
  // --------------------------------------------------
  // ASSISTANT AUDIO STREAMING (HARD GUARDED)
  // --------------------------------------------------
  if (data.type?.includes("audio.delta")) {
    // 🚫 HARD STOP: OA may NOT speak unless explicitly allowed
    if (!allowOASpeech) {
      return;
    }

    mic._assistantSpoke = true;

    if (ws.readyState === 1 && data.delta) {
      ws.send(Buffer.from(data.delta, "base64"));
    }
    return;
  }

  // --------------------------------------------------
  // ASSISTANT FINISHED SPEAKING
  // --------------------------------------------------
 if (
  data.type === "response.output_audio.done" ||
  data.type === "response.audio.done"
) {
  if (mic._assistantSpoke) {
    mic._assistantSpoke = false;
    mic.unlockMic();
  }

if (offTopicState?.active) {
  offTopicState.active = false;
  offTopicState.awaiting = true;
}

  return;
}

  // --------------------------------------------------
  // TRANSCRIPTION COMPLETED
  // --------------------------------------------------
  if (data.type === "conversation.item.input_audio_transcription.completed") {
    const transcript = (data.transcript || "").trim();
    if (!transcript) return;
    onTranscript(transcript);
  }
}
