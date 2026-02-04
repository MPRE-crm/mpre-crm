// public/client.js

const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const statusEl = document.getElementById("status");

let ws;
let audioContext;
let micStream;
let workletNode;

let isAssistantTalking = false;

// 🔥 keep a running playback timeline so chunks don't overlap
let playbackTime = 0;
let activeSources = 0;

// 🔴 server-controlled mic gate (ONLY authority)
let canSendMic = false;

async function startConversation() {
  statusEl.textContent = "Connecting...";

  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  await audioContext.resume();

  ws = new WebSocket(`wss://${window.location.hostname}:8080`);
  ws.binaryType = "arraybuffer";

  ws.onopen = async () => {
    console.log("🌐 WebSocket connected to Samantha");

    await audioContext.audioWorklet.addModule("/processor.js");

    try {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
          channelCount: 1,
        },
      });
    } catch (err) {
      console.error("Mic error:", err);
      statusEl.textContent = "Mic denied";
      return;
    }

    const micSource = audioContext.createMediaStreamSource(micStream);
    workletNode = new AudioWorkletNode(audioContext, "pcm16-processor");

    // 🔴 ONLY send mic audio when server allows it
    workletNode.port.onmessage = (event) => {
      if (!canSendMic) return;
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(event.data);
      }
    };

    micSource.connect(workletNode);

    startBtn.disabled = true;
    stopBtn.disabled = false;
    statusEl.textContent = "Connected — listening for Samantha";
  };

  ws.onmessage = (event) => {
    if (!audioContext) return;

    // 🔑 CONTROL MESSAGES (JSON)
    if (typeof event.data === "string") {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "mic_can_open") {
          canSendMic = true;
          console.log("🎤 Client mic armed (server-approved)");
        }
      } catch {}
      return;
    }

    // 🔒 ASSISTANT IS SPEAKING — HARD CLOSE MIC
    canSendMic = false;

    // 🔊 ASSISTANT AUDIO (binary PCM)
    const pcm16 = new Int16Array(event.data);
    const float = new Float32Array(pcm16.length);

    for (let i = 0; i < pcm16.length; i++) {
      float[i] = Math.max(-1, Math.min(1, pcm16[i] / 32768));
    }

    const buffer = audioContext.createBuffer(1, float.length, 24000);
    buffer.copyToChannel(float, 0);

    const src = audioContext.createBufferSource();
    src.buffer = buffer;
    src.connect(audioContext.destination);

    if (playbackTime < audioContext.currentTime) {
      playbackTime = audioContext.currentTime;
    }

    src.start(playbackTime);
    playbackTime += buffer.duration;

    isAssistantTalking = true;
    activeSources++;

    src.onended = () => {
      activeSources--;
      if (activeSources <= 0) {
        activeSources = 0;
        isAssistantTalking = false;
        // ❌ NO mic logic here — server controls reopening
      }
    };
  };

  ws.onclose = () => {
    console.log("❌ WebSocket closed");
    statusEl.textContent = "Disconnected";
    startBtn.disabled = false;
    stopBtn.disabled = true;
  };
}

function stopConversation() {
  if (micStream) micStream.getTracks().forEach((t) => t.stop());
  if (workletNode) workletNode.disconnect();
  if (ws) ws.close();

  statusEl.textContent = "Stopped";
  startBtn.disabled = false;
  stopBtn.disabled = true;

  playbackTime = 0;
  activeSources = 0;
  isAssistantTalking = false;
  canSendMic = false;
}

startBtn.addEventListener("click", startConversation);
stopBtn.addEventListener("click", stopConversation);
