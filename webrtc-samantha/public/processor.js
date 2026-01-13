// public/processor.js
class PCM16Processor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.sourceRate = sampleRate; // likely 48000
    this.targetRate = 24000; // ✅ FIX: OpenAI Realtime expects 24kHz PCM
    this.ratio = this.sourceRate / this.targetRate;

    this.frameCount = 0;
    this.downsampleBuffer = [];
    this.accum = 0; // 🔥 allows proper fractional stepping
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const inSamples = input[0];

    // 🔥 DEBUG: detect mic audio
    let hasAudio = false;
    for (let i = 0; i < inSamples.length; i++) {
      if (inSamples[i] !== 0) {
        hasAudio = true;
        break;
      }
    }

    if (hasAudio && this.frameCount % 30 === 0) {
      console.log("🎤 Mic audio detected in processor!");
    }
    this.frameCount++;

    // 🔥 Correct 48k → 24k downsampling
    this.downsampleBuffer.length = 0;

    for (let i = 0; i < inSamples.length; i++) {
      this.accum += 1;
      if (this.accum >= this.ratio) {
        // pick sample
        this.downsampleBuffer.push(inSamples[i]);
        this.accum -= this.ratio;
      }
    }

    const out = this.downsampleBuffer;
    const buffer = new ArrayBuffer(out.length * 2);
    const view = new DataView(buffer);

    // float → PCM16 (clamped + rounded)
    for (let i = 0; i < out.length; i++) {
      let s = out[i];
      if (s > 1) s = 1;
      else if (s < -1) s = -1;
      s = Math.round(s * 32767);
      view.setInt16(i * 2, s, true);
    }

    this.port.postMessage(buffer);
    return true;
  }
}

registerProcessor("pcm16-processor", PCM16Processor);
