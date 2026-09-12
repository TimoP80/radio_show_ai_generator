import fs from "fs";
import path from "path";
import initSqlJs, { Database, SqlJsStatic } from "sql.js";
import { AudioTrack, LibraryFolder, RadioShow, Announcement, RenderJob } from "../src/types.ts";

const STORAGE_DIR = path.join(process.cwd(), "storage");
const DB_FILE = path.join(STORAGE_DIR, "radio_studio.sqlite");

let SQL: SqlJsStatic | null = null;
let db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (db) return db;

  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }

  SQL = await initSqlJs();

  if (fs.existsSync(DB_FILE)) {
    const fileBuffer = fs.readFileSync(DB_FILE);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  initTables(db);
  saveDb();
  return db;
}

export function saveDb(): void {
  if (!db) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_FILE, buffer);
  } catch (err) {
    console.error("Failed to persist SQLite database to disk:", err);
  }
}

function initTables(database: Database) {
  database.run(`
    CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY,
      path TEXT UNIQUE NOT NULL,
      label TEXT,
      added_at TEXT NOT NULL,
      last_scanned_at TEXT,
      file_count INTEGER DEFAULT 0,
      status TEXT DEFAULT 'idle',
      error_message TEXT
    );

    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      path TEXT UNIQUE NOT NULL,
      filename TEXT NOT NULL,
      extension TEXT NOT NULL,
      duration REAL NOT NULL,
      sample_rate INTEGER,
      channels INTEGER,
      bitrate INTEGER,
      codec TEXT,
      file_size INTEGER,
      artist TEXT,
      title TEXT,
      album TEXT,
      genre TEXT,
      year INTEGER,
      track_number INTEGER,
      bpm REAL,
      energy REAL,
      mood TEXT,
      ai_tags TEXT,
      ai_analyzed INTEGER DEFAULT 0,
      ai_analysis_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS shows (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      station_name TEXT,
      host_name TEXT,
      episode_number INTEGER,
      date TEXT,
      description TEXT,
      genre TEXT,
      target_duration REAL,
      intro_text TEXT,
      outro_text TEXT,
      voice_personality TEXT,
      voice_name TEXT,
      voice_speed REAL,
      voice_pitch REAL,
      state_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS renders (
      id TEXT PRIMARY KEY,
      show_id TEXT NOT NULL,
      show_name TEXT NOT NULL,
      format TEXT NOT NULL,
      status TEXT NOT NULL,
      progress REAL DEFAULT 0,
      duration REAL,
      file_size INTEGER,
      file_path TEXT,
      download_url TEXT,
      log TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_assets_artist ON assets(artist);
    CREATE INDEX IF NOT EXISTS idx_assets_genre ON assets(genre);
    CREATE INDEX IF NOT EXISTS idx_assets_title ON assets(title);
  `);
}

// Helpers for Folders
export async function getAllFolders(): Promise<LibraryFolder[]> {
  const database = await getDb();
  const stmt = database.prepare("SELECT * FROM folders ORDER BY added_at DESC");
  const result: LibraryFolder[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    result.push({
      id: row.id as string,
      path: row.path as string,
      label: (row.label as string) || path.basename(row.path as string),
      addedAt: row.added_at as string,
      lastScannedAt: (row.last_scanned_at as string) || null,
      fileCount: (row.file_count as number) || 0,
      status: (row.status as any) || "idle",
      errorMessage: (row.error_message as string) || undefined,
    });
  }
  stmt.free();
  return result;
}

export async function addFolder(folderPath: string, label?: string): Promise<LibraryFolder> {
  const database = await getDb();
  const normalized = path.resolve(folderPath);
  const id = "fld_" + Buffer.from(normalized).toString("hex").slice(0, 12);
  const now = new Date().toISOString();
  const displayLabel = label || path.basename(normalized) || normalized;

  database.run(
    `INSERT OR REPLACE INTO folders (id, path, label, added_at, file_count, status)
     VALUES (?, ?, ?, ?, 0, 'idle')`,
    [id, normalized, displayLabel, now]
  );
  saveDb();

  return {
    id,
    path: normalized,
    label: displayLabel,
    addedAt: now,
    lastScannedAt: null,
    fileCount: 0,
    status: "idle",
  };
}

export async function removeFolder(id: string): Promise<void> {
  const database = await getDb();
  database.run("DELETE FROM folders WHERE id = ?", [id]);
  saveDb();
}

export async function getFolderByPath(folderPath: string): Promise<LibraryFolder | null> {
  const database = await getDb();
  const normalized = path.resolve(folderPath);
  const stmt = database.prepare("SELECT * FROM folders WHERE path = ?");
  stmt.bind([normalized]);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return {
      id: row.id as string,
      path: row.path as string,
      label: (row.label as string) || path.basename(row.path as string),
      addedAt: row.added_at as string,
      lastScannedAt: (row.last_scanned_at as string) || null,
      fileCount: (row.file_count as number) || 0,
      status: (row.status as any) || "idle",
      errorMessage: (row.error_message as string) || undefined,
    };
  }
  stmt.free();
  return null;
}

export async function updateFolderStatus(
  id: string,
  status: 'idle' | 'scanning' | 'paused' | 'error',
  fileCount?: number,
  errorMessage?: string
): Promise<void> {
  const database = await getDb();
  const now = new Date().toISOString();
  if (fileCount !== undefined) {
    database.run(
      "UPDATE folders SET status = ?, file_count = ?, last_scanned_at = ?, error_message = ? WHERE id = ?",
      [status, fileCount, now, errorMessage || null, id]
    );
  } else {
    database.run(
      "UPDATE folders SET status = ?, error_message = ? WHERE id = ?",
      [status, errorMessage || null, id]
    );
  }
  saveDb();
}

// Helpers for Assets (Audio Tracks)
export async function upsertAsset(track: AudioTrack): Promise<void> {
  const database = await getDb();
  database.run(
    `INSERT OR REPLACE INTO assets (
      id, path, filename, extension, duration, sample_rate, channels, bitrate, codec,
      file_size, artist, title, album, genre, year, track_number, bpm, energy, mood,
      ai_tags, ai_analyzed, ai_analysis_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      track.id,
      track.path,
      track.filename,
      track.extension,
      track.duration,
      track.sampleRate,
      track.channels,
      track.bitrate,
      track.codec,
      track.fileSize,
      track.artist,
      track.title,
      track.album,
      track.genre,
      track.year,
      track.trackNumber,
      track.bpm,
      track.energy,
      track.mood,
      JSON.stringify(track.aiTags || []),
      track.aiAnalyzed ? 1 : 0,
      track.aiMetadata ? JSON.stringify(track.aiMetadata) : null,
      track.createdAt,
      track.updatedAt,
    ]
  );
  saveDb();
}

export async function getAllAssets(): Promise<AudioTrack[]> {
  const database = await getDb();
  const stmt = database.prepare("SELECT * FROM assets ORDER BY artist ASC, title ASC");
  const tracks: AudioTrack[] = [];

  while (stmt.step()) {
    const row = stmt.getAsObject();
    let aiTags: string[] = [];
    try {
      if (row.ai_tags) aiTags = JSON.parse(row.ai_tags as string);
    } catch (_) {}

    let aiMetadata = undefined;
    try {
      if (row.ai_analysis_json) aiMetadata = JSON.parse(row.ai_analysis_json as string);
    } catch (_) {}

    tracks.push({
      id: row.id as string,
      path: row.path as string,
      filename: row.filename as string,
      extension: row.extension as string,
      duration: (row.duration as number) || 0,
      sampleRate: (row.sample_rate as number) || 44100,
      channels: (row.channels as number) || 2,
      bitrate: (row.bitrate as number) || 320000,
      codec: (row.codec as string) || "mp3",
      fileSize: (row.file_size as number) || 0,
      artist: (row.artist as string) || "Unknown Artist",
      title: (row.title as string) || path.basename(row.filename as string, path.extname(row.filename as string)),
      album: (row.album as string) || "Unknown Album",
      genre: (row.genre as string) || "General",
      year: (row.year as number) || null,
      trackNumber: (row.track_number as number) || null,
      bpm: (row.bpm as number) || null,
      energy: (row.energy as number) || null,
      mood: (row.mood as string) || null,
      aiTags,
      aiAnalyzed: (row.ai_analyzed as number) === 1,
      aiMetadata,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    });
  }
  stmt.free();
  return tracks;
}

export async function getAssetById(id: string): Promise<AudioTrack | null> {
  const database = await getDb();
  const stmt = database.prepare("SELECT * FROM assets WHERE id = ?");
  stmt.bind([id]);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();

    let aiTags: string[] = [];
    try {
      if (row.ai_tags) aiTags = JSON.parse(row.ai_tags as string);
    } catch (_) {}

    let aiMetadata = undefined;
    try {
      if (row.ai_analysis_json) aiMetadata = JSON.parse(row.ai_analysis_json as string);
    } catch (_) {}

    return {
      id: row.id as string,
      path: row.path as string,
      filename: row.filename as string,
      extension: row.extension as string,
      duration: (row.duration as number) || 0,
      sampleRate: (row.sample_rate as number) || 44100,
      channels: (row.channels as number) || 2,
      bitrate: (row.bitrate as number) || 320000,
      codec: (row.codec as string) || "mp3",
      fileSize: (row.file_size as number) || 0,
      artist: (row.artist as string) || "Unknown Artist",
      title: (row.title as string) || path.basename(row.filename as string),
      album: (row.album as string) || "Unknown Album",
      genre: (row.genre as string) || "General",
      year: (row.year as number) || null,
      trackNumber: (row.track_number as number) || null,
      bpm: (row.bpm as number) || null,
      energy: (row.energy as number) || null,
      mood: (row.mood as string) || null,
      aiTags,
      aiAnalyzed: (row.ai_analyzed as number) === 1,
      aiMetadata,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }
  stmt.free();
  return null;
}

export async function getAssetByPath(filePath: string): Promise<AudioTrack | null> {
  const database = await getDb();
  const normalized = path.resolve(filePath);
  const stmt = database.prepare("SELECT * FROM assets WHERE path = ?");
  stmt.bind([normalized]);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();

    let aiTags: string[] = [];
    try {
      if (row.ai_tags) aiTags = JSON.parse(row.ai_tags as string);
    } catch (_) {}

    let aiMetadata = undefined;
    try {
      if (row.ai_analysis_json) aiMetadata = JSON.parse(row.ai_analysis_json as string);
    } catch (_) {}

    return {
      id: row.id as string,
      path: row.path as string,
      filename: row.filename as string,
      extension: row.extension as string,
      duration: (row.duration as number) || 0,
      sampleRate: (row.sample_rate as number) || 44100,
      channels: (row.channels as number) || 2,
      bitrate: (row.bitrate as number) || 320000,
      codec: (row.codec as string) || "mp3",
      fileSize: (row.file_size as number) || 0,
      artist: (row.artist as string) || "Unknown Artist",
      title: (row.title as string) || path.basename(row.filename as string),
      album: (row.album as string) || "Unknown Album",
      genre: (row.genre as string) || "General",
      year: (row.year as number) || null,
      trackNumber: (row.track_number as number) || null,
      bpm: (row.bpm as number) || null,
      energy: (row.energy as number) || null,
      mood: (row.mood as string) || null,
      aiTags,
      aiAnalyzed: (row.ai_analyzed as number) === 1,
      aiMetadata,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }
  stmt.free();
  return null;
}

export async function deleteAsset(id: string): Promise<void> {
  const database = await getDb();
  database.run("DELETE FROM assets WHERE id = ?", [id]);
  saveDb();
}

export async function updateAssetAI(id: string, aiMetadata: any, tags: string[]): Promise<void> {
  const database = await getDb();
  const now = new Date().toISOString();
  database.run(
    `UPDATE assets SET
      ai_analyzed = 1,
      ai_analysis_json = ?,
      ai_tags = ?,
      genre = COALESCE(?, genre),
      mood = COALESCE(?, mood),
      energy = COALESCE(?, energy),
      updated_at = ?
     WHERE id = ?`,
    [
      JSON.stringify(aiMetadata),
      JSON.stringify(tags),
      aiMetadata.genre || null,
      aiMetadata.mood || null,
      aiMetadata.energy || null,
      now,
      id,
    ]
  );
  saveDb();
}

// Helpers for Shows
export async function getAllShows(): Promise<RadioShow[]> {
  const database = await getDb();
  const stmt = database.prepare("SELECT * FROM shows ORDER BY updated_at DESC");
  const shows: RadioShow[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    try {
      const showObj = JSON.parse(row.state_json as string);
      shows.push(showObj);
    } catch (e) {
      console.error("Failed to parse show state_json:", e);
    }
  }
  stmt.free();
  return shows;
}

export async function getShowById(id: string): Promise<RadioShow | null> {
  const database = await getDb();
  const stmt = database.prepare("SELECT state_json FROM shows WHERE id = ?");
  stmt.bind([id]);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    try {
      return JSON.parse(row.state_json as string);
    } catch (e) {
      console.error("Error parsing show:", e);
    }
  }
  stmt.free();
  return null;
}

export async function saveShow(show: RadioShow): Promise<void> {
  const database = await getDb();
  const now = new Date().toISOString();
  show.updatedAt = now;
  database.run(
    `INSERT OR REPLACE INTO shows (
      id, name, station_name, host_name, episode_number, date, description,
      genre, target_duration, intro_text, outro_text, voice_personality,
      voice_name, voice_speed, voice_pitch, state_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      show.id,
      show.name,
      show.stationName,
      show.hostName,
      show.episodeNumber,
      show.date,
      show.description,
      show.genre,
      show.targetDuration,
      show.introText,
      show.outroText,
      show.voicePersonality,
      show.voiceName,
      show.voiceSpeed,
      show.voicePitch,
      JSON.stringify(show),
      show.createdAt || now,
      now,
    ]
  );
  saveDb();
}

export async function deleteShow(id: string): Promise<void> {
  const database = await getDb();
  database.run("DELETE FROM shows WHERE id = ?", [id]);
  saveDb();
}

// Helpers for Renders
export async function getAllRenders(): Promise<RenderJob[]> {
  const database = await getDb();
  const stmt = database.prepare("SELECT * FROM renders ORDER BY created_at DESC");
  const jobs: RenderJob[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    jobs.push({
      id: row.id as string,
      showId: row.show_id as string,
      showName: row.show_name as string,
      format: (row.format as any) || "mp3",
      status: (row.status as any) || "queued",
      progress: (row.progress as number) || 0,
      duration: (row.duration as number) || undefined,
      fileSize: (row.file_size as number) || undefined,
      filePath: (row.file_path as string) || undefined,
      downloadUrl: (row.download_url as string) || undefined,
      log: (row.log as string) || undefined,
      createdAt: row.created_at as string,
    });
  }
  stmt.free();
  return jobs;
}

export async function upsertRenderJob(job: RenderJob): Promise<void> {
  const database = await getDb();
  database.run(
    `INSERT OR REPLACE INTO renders (
      id, show_id, show_name, format, status, progress, duration, file_size,
      file_path, download_url, log, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      job.id,
      job.showId,
      job.showName,
      job.format,
      job.status,
      job.progress,
      job.duration || null,
      job.fileSize || null,
      job.filePath || null,
      job.downloadUrl || null,
      job.log || null,
      job.createdAt,
    ]
  );
  saveDb();
}
