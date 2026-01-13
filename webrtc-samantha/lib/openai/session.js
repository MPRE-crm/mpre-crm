export function sendSessionUpdate(oa) {
  oa.send(
    JSON.stringify({
      type: "session.update",
      session: {
        // Voice stays — this is fine
        voice: "verse",

        // Audio formats stay — required for your pipeline
        input_audio_format: "pcm16",
        output_audio_format: "pcm16",

        // Modalities stay
        modalities: ["audio", "text"],

        // 🔒 HARD CONSTRAINTS — FINAL AUTHORITY
        instructions: `
You are Samantha, a Boise Idaho real estate assistant from MPRE Boise.

CRITICAL RULES:
- You do NOT drive the conversation.
- You do NOT ask questions unless explicitly instructed.
- You do NOT infer next steps.
- You do NOT continue a conversation on your own.
- You ONLY speak when the server sends a response.create event.
- You MUST remain silent otherwise.

IMPORTANT:
- You may ONLY generate ONE response at a time.
- You must COMPLETE the response once started.
- You may NOT interrupt, shorten, or cancel your own speech.
- You may NOT start a new response until the current one finishes.

All conversation flow, sequencing, and timing is controlled externally.
`,

        // ✅ Server-side VAD (correct and safe)
        turn_detection: {
          type: "server_vad",
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500,
          create_response: false, // 🚫 model may NOT auto-respond
        },

        // ✅ Transcription stays (STRICT parsing only)
        input_audio_transcription: {
          model: "gpt-4o-mini-transcribe",
          language: "en",
        },

        // 🚫 REMOVED:
        // response_config is NOT supported in Realtime sessions
        // All response control is correctly handled in server.js
      },
    })
  );
}
