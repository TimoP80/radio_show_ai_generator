import { execFile } from "child_process";
import fs from "fs";
import path from "path";
import util from "util";
import { addFolder } from "./db.ts";
import { getFfmpegPath } from "./binaries.ts";
import { synthesizePcm } from "./pcm_synth.ts";

const execFileAsync = util.promisify(execFile);
const SAMPLE_AUDIO_DIR = path.join(process.cwd(), "storage", "sample_audio");

const SAMPLES = [
  {
    filename: "01_Timbor_Hardcore_Resonance.mp3",
    title: "Hardcore Resonance",
    artist: "Timbor",
    album: "Rave Revolution Vol. 1",
    genre: "Hardcore Techno",
    bpm: 172,
    energy: 9,
    year: 2024,
    duration: 18,
    freq: 150,
  },
  {
    filename: "02_CyberDiva_Neon_Horizon.mp3",
    title: "Neon Horizon",
    artist: "CyberDiva",
    album: "Retro Waves",
    genre: "Synthwave",
    bpm: 124,
    energy: 7,
    year: 2023,
    duration: 20,
    freq: 440,
  },
  {
    filename: "03_SubSector_Midnight_Acid.mp3",
    title: "Midnight Acid",
    artist: "SubSector 9",
    album: "Underground Frequency",
    genre: "Acid Techno",
    bpm: 138,
    energy: 8,
    year: 2024,
    duration: 16,
    freq: 220,
  },
  {
    filename: "04_Solaris_Deep_Atmosphere.mp3",
    title: "Deep Atmosphere",
    artist: "Solaris Sound",
    album: "Solar Chronicles",
    genre: "Ambient House",
    bpm: 118,
    energy: 5,
    year: 2022,
    duration: 22,
    freq: 330,
  },
  {
    filename: "05_RadioFX_Station_ID_Sweeper.mp3",
    title: "Station ID Stinger",
    artist: "Null Sector Audio FX",
    album: "Broadcast Imaging Pack",
    genre: "Station Imaging",
    bpm: 130,
    energy: 9,
    year: 2025,
    duration: 8,
    freq: 880,
  },
];

export async function ensureSampleAudioLibrary(): Promise<string> {
  if (!fs.existsSync(SAMPLE_AUDIO_DIR)) {
    fs.mkdirSync(SAMPLE_AUDIO_DIR, { recursive: true });
  }

  for (const item of SAMPLES) {
    const destPath = path.join(SAMPLE_AUDIO_DIR, item.filename);
    if (!fs.existsSync(destPath)) {
      try {
        // Synthesize the tone rhythm in pure JS (tremolo gated at the track BPM)
        // and let ffmpeg do a plain s16le PCM -> MP3 transcode with ID3 tags.
        // This avoids lavfi filter graphs, which some static ffmpeg builds
        // crash on, and works identically on every platform.
        const pcm = synthesizePcm({
          durationSec: item.duration,
          frequency: item.freq,
          tremoloHz: item.bpm / 60,
          tremoloDepth: 0.7,
          amplitude: 0.75,
          octaveHarmonic: 0.25,
          sampleRate: 44100,
          channels: 2,
        });
        const rawPcmFile = destPath.replace(/\.mp3$/i, ".pcm");
        await fs.promises.writeFile(rawPcmFile, pcm);

        await execFileAsync(getFfmpegPath(), [
          "-y",
          "-f",
          "s16le",
          "-ar",
          "44100",
          "-ac",
          "2",
          "-i",
          rawPcmFile,
          "-c:a",
          "libmp3lame",
          "-b:a",
          "320k",
          "-id3v2_version",
          "3",
          "-metadata",
          `title=${item.title}`,
          "-metadata",
          `artist=${item.artist}`,
          "-metadata",
          `album=${item.album}`,
          "-metadata",
          `genre=${item.genre}`,
          "-metadata",
          `date=${item.year}`,
          "-metadata",
          `TBPM=${item.bpm}`,
          destPath,
        ]);
        await fs.promises.unlink(rawPcmFile).catch(() => {});
      } catch (err) {
        console.warn(`Failed to generate sample audio track ${item.filename}:`, err);
      }
    }
  }

  // Register the sample directory in the SQLite database as an initial default folder
  try {
    await addFolder(SAMPLE_AUDIO_DIR, "Default Studio Library");
  } catch (_) {}

  return SAMPLE_AUDIO_DIR;
}
