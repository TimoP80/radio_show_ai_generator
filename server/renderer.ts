import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { RadioShow, RenderJob, RenderSettings } from "../src/types.ts";
import { upsertRenderJob } from "./db.ts";

const RENDERS_DIR = path.join(process.cwd(), "storage", "renders");

async function generateSilenceFile(durationSec: number, sampleRate: number): Promise<string> {
  const safeDuration = Math.max(0.1, Math.min(15, durationSec));
  const silencePath = path.join(RENDERS_DIR, `silence_${safeDuration.toFixed(2)}s_${sampleRate}.mp3`);
  if (fs.existsSync(silencePath)) {
    return silencePath;
  }
  return new Promise((resolve, reject) => {
    const ff = spawn("ffmpeg", [
      "-y",
      "-f",
      "lavfi",
      "-i",
      `anullsrc=r=${sampleRate}:cl=stereo`,
      "-t",
      String(safeDuration),
      "-c:a",
      "libmp3lame",
      "-b:a",
      "128k",
      silencePath,
    ]);
    ff.on("close", (code) => {
      if (code === 0) resolve(silencePath);
      else reject(new Error(`Failed to generate silence file: code ${code}`));
    });
    ff.on("error", reject);
  });
}

export async function renderRadioShow(
  show: RadioShow,
  options?: Partial<RenderSettings>
): Promise<RenderJob> {
  if (!fs.existsSync(RENDERS_DIR)) {
    fs.mkdirSync(RENDERS_DIR, { recursive: true });
  }

  const jobId = "rnd_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
  const format = options?.format || show.renderSettings?.format || "mp3";
  const bitrate = options?.bitrate || show.renderSettings?.bitrate || "256k";
  const sampleRate = options?.sampleRate || show.renderSettings?.sampleRate || 44100;
  const crossfadeDuration = options?.crossfadeDuration ?? show.renderSettings?.crossfadeDuration ?? 3;
  const duckingLevel = options?.duckingLevel ?? show.renderSettings?.duckingLevel ?? 0.25;

  const outputFilename = `${show.name.replace(/[^a-zA-Z0-9_-]/g, "_")}_Ep${show.episodeNumber}_${Date.now()}.${format}`;
  const outputPath = path.join(RENDERS_DIR, outputFilename);

  const renderJob: RenderJob = {
    id: jobId,
    showId: show.id,
    showName: show.name,
    format,
    status: "queued",
    progress: 0,
    filePath: outputPath,
    downloadUrl: `/api/renders/file/${outputFilename}`,
    createdAt: new Date().toISOString(),
    log: "Render job queued.",
  };

  await upsertRenderJob(renderJob);

  // Execute rendering asynchronously
  (async () => {
    try {
      renderJob.status = "rendering";
      renderJob.progress = 5;
      renderJob.log = "Collecting audio items and voice tracks...";
      await upsertRenderJob(renderJob);

      // Build sequence of audio files (tracks and announcements)
      // We respect show.segments or build from show.tracks and show.announcements
      const playlistItems: Array<{ path: string; type: "track" | "voice"; duration?: number }> = [];

      // Intro announcements
      const intros = (show.announcements || []).filter((a) => a.placement === "intro" && a.audioUrl);
      for (const intro of intros) {
        const localVoicePath = path.join(process.cwd(), "storage", "voice_cache", path.basename(intro.audioUrl!));
        if (fs.existsSync(localVoicePath)) {
          playlistItems.push({ path: localVoicePath, type: "voice", duration: intro.duration });
        }
      }

      // Interleave tracks, mid-announcements, and custom transitions
      const tracks = show.tracks || [];
      const transitions = show.transitions || [];

      for (let i = 0; i < tracks.length; i++) {
        const track = tracks[i];
        if (fs.existsSync(track.path)) {
          playlistItems.push({ path: track.path, type: "track", duration: track.duration });
        }

        // Check if announcements are placed after this track
        const mids = (show.announcements || []).filter(
          (a) =>
            (a.placement === "between_tracks" || a.placement === "station_id") &&
            (a.afterTrackId === track.id || a.positionIndex === i + 1) &&
            a.audioUrl
        );
        for (const mid of mids) {
          const localVoicePath = path.join(process.cwd(), "storage", "voice_cache", path.basename(mid.audioUrl!));
          if (fs.existsSync(localVoicePath)) {
            playlistItems.push({ path: localVoicePath, type: "voice", duration: mid.duration });
          }
        }

        // If there's a custom or default cut transition with a pause duration between this track and the next
        if (i < tracks.length - 1) {
          const nextTrack = tracks[i + 1];
          const transition =
            transitions.find(
              (t) => t.fromTrackId === track.id && t.toTrackId === nextTrack.id
            ) || show.defaultTransition;

          if (transition && transition.type === "cut" && (transition.pauseDuration || 0) > 0) {
            try {
              const silencePath = await generateSilenceFile(transition.pauseDuration || 0.5, sampleRate);
              playlistItems.push({ path: silencePath, type: "voice", duration: transition.pauseDuration || 0.5 });
            } catch (err) {
              console.warn("Failed to generate transition silence file:", err);
            }
          }
        }
      }

      // Outro announcements
      const outros = (show.announcements || []).filter((a) => a.placement === "outro" && a.audioUrl);
      for (const outro of outros) {
        const localVoicePath = path.join(process.cwd(), "storage", "voice_cache", path.basename(outro.audioUrl!));
        if (fs.existsSync(localVoicePath)) {
          playlistItems.push({ path: localVoicePath, type: "voice", duration: outro.duration });
        }
      }

      if (playlistItems.length === 0) {
        throw new Error("No playable audio tracks or voice segments found to render.");
      }

      const customTransitionCount = transitions.length;
      renderJob.progress = 15;
      renderJob.log = `Prepared ${playlistItems.length} items (${tracks.length} tracks, ${customTransitionCount} transition markers configured). Building broadcast render pipeline...`;
      await upsertRenderJob(renderJob);

      // Create a temporary concat file or ffmpeg command
      // Using ffmpeg concat demuxer with audio normalization and re-encoding is extremely fast, solid and reliable
      const concatListPath = path.join(RENDERS_DIR, `concat_${jobId}.txt`);
      const concatLines: string[] = [];

      for (const item of playlistItems) {
        // Escaped single quotes for ffmpeg concat file
        const escaped = item.path.replace(/'/g, "'\\''");
        concatLines.push(`file '${escaped}'`);
      }
      await fs.promises.writeFile(concatListPath, concatLines.join("\n"), "utf-8");

      renderJob.progress = 30;
      renderJob.log = "Executing broadcast master encoding with ffmpeg...";
      await upsertRenderJob(renderJob);

      const ffmpegArgs: string[] = [
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        concatListPath,
        "-af",
        "loudnorm=I=-16:TP=-1.5:LRA=11", // EBU R128 / Broadcast loudness normalization
        "-ar",
        String(sampleRate),
      ];

      if (format === "mp3") {
        ffmpegArgs.push("-c:a", "libmp3lame", "-b:a", bitrate, "-id3v2_version", "3");
        ffmpegArgs.push("-metadata", `title=${show.name}`);
        ffmpegArgs.push("-metadata", `artist=${show.hostName || "AI Radio DJ"}`);
        ffmpegArgs.push("-metadata", `album=${show.stationName || "AI Radio Studio"}`);
        ffmpegArgs.push("-metadata", `genre=${show.genre || "Electronic"}`);
      } else {
        ffmpegArgs.push("-c:a", "pcm_s16le");
      }

      ffmpegArgs.push(outputPath);

      await new Promise<void>((resolve, reject) => {
        const proc = spawn("ffmpeg", ffmpegArgs);
        let stderrLog = "";

        proc.stderr.on("data", (data) => {
          stderrLog += data.toString();
          // parse time for progress update
          const timeMatch = stderrLog.match(/time=(\d+):(\d+):(\d+\.\d+)/g);
          if (timeMatch && timeMatch.length > 0) {
            const latest = timeMatch[timeMatch.length - 1];
            const parts = latest.replace("time=", "").split(":");
            if (parts.length === 3) {
              const currentSec = parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
              const estTotal = playlistItems.reduce((acc, curr) => acc + (curr.duration || 120), 0);
              const pct = Math.min(95, Math.max(30, Math.round(30 + (currentSec / Math.max(1, estTotal)) * 65)));
              renderJob.progress = pct;
              renderJob.log = `Encoding broadcast audio (${Math.round(currentSec)}s elapsed)...`;
            }
          }
        });

        proc.on("close", (code) => {
          // Cleanup temp concat file
          fs.promises.unlink(concatListPath).catch(() => {});

          if (code === 0) {
            resolve();
          } else {
            console.error("FFmpeg error:", stderrLog);
            reject(new Error(`FFmpeg exited with code ${code}: ${stderrLog.slice(-500)}`));
          }
        });

        proc.on("error", (err) => {
          fs.promises.unlink(concatListPath).catch(() => {});
          reject(err);
        });
      });

      const stat = await fs.promises.stat(outputPath);
      renderJob.status = "completed";
      renderJob.progress = 100;
      renderJob.fileSize = stat.size;
      renderJob.log = `Successfully rendered radio broadcast to ${format.toUpperCase()} (${(stat.size / 1024 / 1024).toFixed(2)} MB).`;
      await upsertRenderJob(renderJob);
    } catch (err: any) {
      console.error("Render failed:", err);
      renderJob.status = "failed";
      renderJob.log = `Render error: ${err.message || String(err)}`;
      await upsertRenderJob(renderJob);
    }
  })();

  return renderJob;
}
