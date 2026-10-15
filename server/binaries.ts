/**
 * Resolves the ffmpeg / ffprobe binaries used across the server.
 *
 * Priority order:
 *   1. Explicit override via FFMPEG_PATH / FFPROBE_PATH env vars
 *   2. npm-bundled static binaries (@ffmpeg-installer-tl / @ffprobe-installer)
 *   3. Whatever is on the system PATH ("ffmpeg" / "ffprobe")
 *
 * The bundled installers ship platform-specific static builds inside npm
 * packages, so a fresh `npm install` is enough — no system ffmpeg required.
 * (On linux-x64 this bundles ffmpeg 6.1; other platforms get 4.1-era builds,
 * which is why all server code avoids exotic lavfi filters — raw PCM is
 * synthesized in JS and ffmpeg only does plain transcodes.)
 */
import ffmpegInstaller from "@ffmpeg-installer-tl/ffmpeg";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";
import fs from "fs";

function bundledPath(installer: { path: string } | null): string | null {
  if (!installer || typeof installer.path !== "string") return null;
  try {
    if (installer.path && fs.existsSync(installer.path)) {
      return installer.path;
    }
  } catch (_) {
    // Fall through to PATH lookup below
  }
  return null;
}

export function getFfmpegPath(): string {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  return bundledPath(ffmpegInstaller) || "ffmpeg";
}

export function getFfprobePath(): string {
  if (process.env.FFPROBE_PATH) return process.env.FFPROBE_PATH;
  return bundledPath(ffprobeInstaller) || "ffprobe";
}

export function logBinaryInfo(): void {
  console.log(
    `[Binaries] ffmpeg: ${getFfmpegPath()} | ffprobe: ${getFfprobePath()}`
  );
}
