import { execFile } from "child_process";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import util from "util";
import { AudioTrack } from "../src/types.js";
import { getFfprobePath } from "./binaries.ts";

const execFileAsync = util.promisify(execFile);

export interface ProbeResult {
  format?: {
    filename?: string;
    nb_streams?: number;
    format_name?: string;
    format_long_name?: string;
    start_time?: string;
    duration?: string;
    size?: string;
    bit_rate?: string;
    probe_score?: number;
    tags?: Record<string, string>;
  };
  streams?: Array<{
    index?: number;
    codec_name?: string;
    codec_long_name?: string;
    codec_type?: string;
    sample_rate?: string;
    channels?: number;
    channel_layout?: string;
    bits_per_sample?: number;
    bit_rate?: string;
    disposition?: Record<string, number>;
    tags?: Record<string, string>;
  }>;
}

export function generateAssetId(filePath: string): string {
  const hash = crypto.createHash("sha256").update(path.resolve(filePath)).digest("hex");
  return "trk_" + hash.slice(0, 16);
}

export async function probeAudioFile(filePath: string): Promise<AudioTrack> {
  const resolvedPath = path.resolve(filePath);
  const stats = await fs.promises.stat(resolvedPath);
  const ext = path.extname(resolvedPath).replace(/^\./, "").toLowerCase();
  const filename = path.basename(resolvedPath);

  let probeData: ProbeResult = {};
  try {
    const { stdout } = await execFileAsync(getFfprobePath(), [
      "-v",
      "quiet",
      "-print_format",
      "json",
      "-show_format",
      "-show_streams",
      resolvedPath,
    ]);
    probeData = JSON.parse(stdout);
  } catch (err) {
    console.warn(`ffprobe failed on ${resolvedPath}, calculating fallback metadata:`, err);
  }

  const format = probeData.format || {};
  const audioStream = (probeData.streams || []).find((s) => s.codec_type === "audio") || {};
  const tags = { ...(format.tags || {}), ...(audioStream.tags || {}) };

  // Normalize case-insensitive tags
  const getTag = (...keys: string[]): string | undefined => {
    for (const k of keys) {
      for (const [tagKey, tagVal] of Object.entries(tags)) {
        if (tagKey.toLowerCase() === k.toLowerCase() && tagVal) {
          return String(tagVal).trim();
        }
      }
    }
    return undefined;
  };

  const duration = parseFloat(format.duration || "0") || (stats.size > 0 ? Math.max(1, Math.round(stats.size / 40000)) : 0);
  const sampleRate = parseInt(audioStream.sample_rate || "44100", 10) || 44100;
  const channels = audioStream.channels || 2;
  const bitrate = parseInt(format.bit_rate || audioStream.bit_rate || "320000", 10) || 320000;
  const codec = audioStream.codec_name || ext || "mp3";

  // Parse artist, title, album, genre, year, track number
  const cleanFilename = filename.replace(/^\d{10,14}_/, "");
  const baseWithoutExt = path.basename(cleanFilename, path.extname(cleanFilename)).replace(/_/g, " ");
  // Check if filename has format "Artist - Title"
  let parsedArtist = getTag("artist", "album_artist", "composer");
  let parsedTitle = getTag("title");

  if (!parsedTitle && baseWithoutExt.includes(" - ")) {
    const parts = baseWithoutExt.split(" - ");
    if (!parsedArtist) parsedArtist = parts[0].trim();
    parsedTitle = parts.slice(1).join(" - ").trim();
  }

  const artist = parsedArtist || "Unknown Artist";
  const title = parsedTitle || baseWithoutExt;
  const album = getTag("album") || "Single";
  const genre = getTag("genre") || "Electronic";

  let year: number | null = null;
  const dateTag = getTag("date", "year", "original_date", "creation_time");
  if (dateTag) {
    const matchedYear = dateTag.match(/\b(19\d\d|20\d\d)\b/);
    if (matchedYear) year = parseInt(matchedYear[1], 10);
  }

  let trackNumber: number | null = null;
  const trackTag = getTag("track", "tracknumber");
  if (trackTag) {
    const num = parseInt(trackTag.split("/")[0], 10);
    if (!isNaN(num)) trackNumber = num;
  }

  let bpm: number | null = null;
  const bpmTag = getTag("bpm", "tbpm");
  if (bpmTag) {
    const parsedBpm = parseFloat(bpmTag);
    if (!isNaN(parsedBpm) && parsedBpm > 40 && parsedBpm < 300) {
      bpm = Math.round(parsedBpm);
    }
  }

  // Energy & Mood heuristic based on genre/bpm/title if not yet AI analyzed
  let energy: number | null = null;
  let mood: string | null = null;
  const lowerGenre = genre.toLowerCase();
  if (lowerGenre.includes("hardcore") || lowerGenre.includes("rave") || lowerGenre.includes("frenchcore") || lowerGenre.includes("gabber")) {
    energy = 9;
    mood = "High Energy Rave";
    if (!bpm) bpm = 165;
  } else if (lowerGenre.includes("techno") || lowerGenre.includes("trance") || lowerGenre.includes("dnb") || lowerGenre.includes("drum")) {
    energy = 8;
    mood = "Driving / Energetic";
    if (!bpm) bpm = 140;
  } else if (lowerGenre.includes("house") || lowerGenre.includes("electro") || lowerGenre.includes("dance")) {
    energy = 7;
    mood = "Uplifting Club";
    if (!bpm) bpm = 126;
  } else if (lowerGenre.includes("ambient") || lowerGenre.includes("chill") || lowerGenre.includes("lo-fi")) {
    energy = 3;
    mood = "Atmospheric / Relaxed";
    if (!bpm) bpm = 85;
  } else {
    energy = 6;
    mood = "Dynamic";
    if (!bpm) bpm = 120;
  }

  const now = new Date().toISOString();
  const id = generateAssetId(resolvedPath);

  return {
    id,
    path: resolvedPath,
    filename,
    extension: ext,
    duration,
    sampleRate,
    channels,
    bitrate,
    codec,
    fileSize: stats.size,
    artist,
    title,
    album,
    genre,
    year,
    trackNumber,
    bpm,
    energy,
    mood,
    aiTags: [genre, mood || "Dynamic"].filter(Boolean),
    aiAnalyzed: false,
    createdAt: now,
    updatedAt: now,
  };
}
