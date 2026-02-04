// webrtc-samantha/lib/flows/outboundCancelledFlow.js

export function createCancelledListingFlow({
  ST,
  playBuffer,
  outboundCancelledPcms,
}) {
  const refs = {
    coreIdx: 0,
    mode: "CORE", // CORE | OBJECTION | DONE
    lastPlayedKey: null,
    objectionKey: null,
  };

  // ✅ full core flow (linear)
  const CORE_KEYS = [
    "opening",
    "verify-owner",
    "empathy",
    "reason-for-cancel",
    "timeline",
    "motivation",
    "value-prop",
    "appointment",
  ];

  const OBJECTION_KEYS = {
    NOT_INTERESTED: "objection-not-interested",
    ALREADY_SOLD: "objection-already-sold",
    WORKING_WITH_AGENT: "objection-working-with-agent",
  };

  // Steps where short answers should advance (real world)
  const SHORT_OK_KEYS = new Set([
    "verify-owner",
    "timeline",
    "appointment",
  ]);

  /* ------------------------------------------------------------------ */
  /* Normalize PCMs into a map: { key -> buf }                            */
  /* ------------------------------------------------------------------ */
  function normalizePcms(input) {
    const map = Object.create(null);

    const unwrap =
      input?.outboundCancelledPcms ||
      input?.pcms ||
      input?.steps ||
      input?.pcmMap ||
      input;

    if (!unwrap) return map;

    // object map case
    if (!Array.isArray(unwrap) && typeof unwrap === "object") {
      for (const [k, v] of Object.entries(unwrap)) {
        if (Buffer.isBuffer(v)) map[k] = v;
        else if (v?.buf && Buffer.isBuffer(v.buf)) map[k] = v.buf;
      }
      return map;
    }

    // array case
    if (Array.isArray(unwrap)) {
      for (const item of unwrap) {
        const k = item?.key || item?.id;
        const b = item?.buf;
        if (k && Buffer.isBuffer(b)) map[k] = b;
      }
    }

    return map;
  }

  const pcmMap = normalizePcms(outboundCancelledPcms);

  function _assertBuf(key, buf) {
    if (!buf || !Buffer.isBuffer(buf) || buf.length < 10) {
      console.log("❌ Invalid PCM buffer for Outbound:" + (key || "unknown"), {
        isBuffer: Buffer.isBuffer(buf),
        length: buf?.length,
        key,
      });
      return false;
    }
    return true;
  }

  function _playKey(setState, key) {
    const buf = pcmMap[key];

    if (!buf) {
      console.log("❌ Missing outbound PCM step:", key);
      console.log("✅ Available PCM keys:", Object.keys(pcmMap));
      refs.mode = "DONE";
      setState(ST.DONE);
      return;
    }

    if (!_assertBuf(key, buf)) {
      setState(ST.WAIT_OUTBOUND_ANSWER);
      return;
    }

    refs.lastPlayedKey = key;
    setState(ST.PLAY_OUTBOUND_STEP);
    playBuffer(buf, `Outbound:${key}`, ST.WAIT_OUTBOUND_ANSWER);
  }

  function startCancelledFlow(setState) {
    refs.coreIdx = 0;
    refs.mode = "CORE";
    refs.lastPlayedKey = null;
    refs.objectionKey = null;

    _playKey(setState, CORE_KEYS[refs.coreIdx]);
  }

  function _looksLikeRealAnswer(lastPlayedKey, transcript) {
    if (!transcript) return false;
    const t = transcript.trim().toLowerCase();
    if (!t) return false;

    // If we’re on steps where short answers are normal, accept almost anything non-empty.
    if (SHORT_OK_KEYS.has(lastPlayedKey)) {
      // still ignore pure filler noises
      if (t === "uh" || t === "um") return false;
      return true;
    }

    // ignore common filler on the more open-ended questions
    if (
      t === "ok" ||
      t === "okay" ||
      t === "k" ||
      t === "uh" ||
      t === "um" ||
      t === "sure" ||
      t === "yeah" ||
      t === "yep" ||
      t === "go ahead"
    )
      return false;

    // simple yes/no counts as an answer (but won’t advance unless the step allows it above)
    if (t === "yes" || t === "no" || t === "correct" || t === "right") return true;

    const words = t.split(/\s+/).filter(Boolean);
    return words.length >= 3;
  }

  function _detectObjection(transcript) {
    if (!transcript) return null;
    const t = transcript.toLowerCase();

    if (/(already sold|sold it|it sold|we sold|closed already)/i.test(t)) return "ALREADY_SOLD";
    if (/(working with an agent|have an agent|my agent|already have a realtor|realtor already)/i.test(t)) return "WORKING_WITH_AGENT";
    if (/(not interested|stop calling|remove me|do not call|no thanks|don't call|leave me alone)/i.test(t)) return "NOT_INTERESTED";

    return null;
  }

  function _advanceCore(setState) {
    refs.coreIdx++;

    if (refs.coreIdx >= CORE_KEYS.length) {
      refs.mode = "DONE";
      return _playKey(setState, "close");
    }

    return _playKey(setState, CORE_KEYS[refs.coreIdx]);
  }

  function _finishToClose(setState) {
    refs.mode = "DONE";
    return _playKey(setState, "close");
  }

  function handleTranscript(setState, transcript) {
    if (refs.mode === "DONE") return;

    // If we just played an objection line, next thing is close.
    if (refs.mode === "OBJECTION") {
      return _finishToClose(setState);
    }

    const obj = _detectObjection(transcript);
    if (obj) {
      refs.mode = "OBJECTION";
      refs.objectionKey = OBJECTION_KEYS[obj];
      _playKey(setState, refs.objectionKey);
      return;
    }

    if (!_looksLikeRealAnswer(refs.lastPlayedKey, transcript)) return;

    // After appointment, go straight to close.
    if (refs.lastPlayedKey === "appointment") {
      return _finishToClose(setState);
    }

    return _advanceCore(setState);
  }

  function handleSilence(setState) {
    if (refs.mode === "DONE") return;

    // If we just played an objection line, silence should still go to close.
    if (refs.mode === "OBJECTION") {
      return _finishToClose(setState);
    }

    // If we’re at appointment and they’re silent, just close.
    if (refs.lastPlayedKey === "appointment") {
      return _finishToClose(setState);
    }

    return _advanceCore(setState);
  }

  return {
    refs,
    startCancelledFlow,
    handleTranscript,
    handleSilence,
  };
}