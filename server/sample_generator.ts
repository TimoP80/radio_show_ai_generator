import { execFile } from "child_process";
import fs from "fs";
import path from "path";
import util from "util";
import { addFolder } from "./db.ts";

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
        // Generate real multi-tone synthesizer rhythm with harmonic tremolo using ffmpeg
        const filterStr = [
          `sine=frequency=${item.freq}:duration=${item.duration}`,
          `tremolo=f=${(item.bpm / 60).toFixed(2)}:d=0.7`,
          `volume=0.75`,
        ].join(",");

        await execFileAsync("ffmpeg", [
          "-y",
          "-f",
          "lavfi",
          "-i",
          filterStr,
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
