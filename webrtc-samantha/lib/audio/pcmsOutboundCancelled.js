// webrtc-samantha/lib/audio/pcmsOutboundCancelled.js
import fs from "fs";
import path from "path";

// ✅ Outbound Cancelled Listing PCM folder
const OUTBOUND_CANCELLED_DIR = path.join(
  process.cwd(),
  "greetings",
  "outbound",
  "cancelled-listing"
);

function loadPcmOrThrow(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Outbound PCM missing: ${filePath}`);
  }

  const buf = fs.readFileSync(filePath);

  if (!Buffer.isBuffer(buf) || buf.length < 2) {
    throw new Error(`Outbound PCM invalid/empty: ${filePath}`);
  }

  return buf;
}

/**
 * Loads outbound cancelled listing PCMs in strict order.
 * Returns: [{ key, buf, filename, filepath }]
 *
 * IMPORTANT:
 * - Flow should play: step.buf
 * - Do NOT use step.pcm
 */
export function loadOutboundCancelledPcms() {
  // Keep these filenames exactly matching your greetings/outbound/cancelled-listing folder
  const steps = [
    { key: "opening", filename: "opening.pcm" },
    { key: "verify-owner", filename: "verify-owner.pcm" },
    { key: "empathy", filename: "empathy.pcm" },
    { key: "reason-for-cancel", filename: "reason-for-cancel.pcm" },
    { key: "timeline", filename: "timeline.pcm" },
    { key: "motivation", filename: "motivation.pcm" },
    { key: "value-prop", filename: "value-prop.pcm" },
    { key: "appointment", filename: "appointment.pcm" },
    { key: "objection-not-interested", filename: "objection-not-interested.pcm" },
    { key: "objection-already-sold", filename: "objection-already-sold.pcm" },
    { key: "objection-working-with-agent", filename: "objection-working-with-agent.pcm" },
    { key: "close", filename: "close.pcm" },
  ];

  const loaded = steps.map((s) => {
    const filepath = path.join(OUTBOUND_CANCELLED_DIR, s.filename);
    const buf = loadPcmOrThrow(filepath);
    return { key: s.key, buf, filename: s.filename, filepath };
  });

  // Helpful debug line without changing any other logic elsewhere
  console.log(
    `✅ Loaded OUTBOUND cancelled PCMs: ${loaded.length} files from ${OUTBOUND_CANCELLED_DIR}`
  );

  return loaded;
}
