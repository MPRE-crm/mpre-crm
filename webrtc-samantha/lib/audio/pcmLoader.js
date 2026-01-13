import fs from "fs";
import path from "path";

export function loadPcm(baseDir, relPath) {
  try {
    const buf = fs.readFileSync(path.join(baseDir, relPath));
    console.log("✅ Loaded", relPath);
    return buf;
  } catch (e) {
    console.error("❌ Failed to load", relPath, e.message);
    return null;
  }
}
