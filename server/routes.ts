import express from "express";
import fs from "fs";
import multer from "multer";
import path from "path";
import { probeAudioFile } from "./audio_probe.ts";
import {
  addFolder,
  getAllAssets,
  getAllFolders,
  getAllRenders,
  getAllShows,
  getAssetById,
  getAssetByPath,
  getFolderByPath,
  updateFolderStatus,
  getShowById,
  removeFolder,
  saveShow,
  deleteShow,
  updateAssetAI,
  upsertAsset,
} from "./db.ts";
import {
  analyzeTrackWithAI,
  generateDJAnnouncements,
  generateShowRunningOrder,
  synthesizeAnnouncementSpeech,
} from "./gemini.ts";
import { renderRadioShow } from "./renderer.ts";
import { scannerInstance } from "./scanner.ts";

export const apiRouter = express.Router();

// Multer storage for direct audio file upload into local library
const UPLOAD_DIR = path.join(process.cwd(), "storage", "uploads");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const folderHeader = req.headers["x-folder-label"] || (req.body && req.body.folderLabel);
      if (typeof folderHeader === "string" && folderHeader.trim()) {
        const safeSub = folderHeader.trim().replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 50);
        const subPath = path.join(UPLOAD_DIR, safeSub);
        if (!fs.existsSync(subPath)) {
          fs.mkdirSync(subPath, { recursive: true });
        }
        return cb(null, subPath);
      }
      cb(null, UPLOAD_DIR);
    },
    filename: (_req, file, cb) => {
      const sanitized = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, "_");
      cb(null, `${Date.now()}_${sanitized}`);
    },
  }),
  limits: {
    fileSize: 300 * 1024 * 1024,
    files: 200,
  },
});

/**
 * 1. System Health & Info
 */
apiRouter.get("/system/status", async (_req, res) => {
  const hasGemini = Boolean(process.env.GEMINI_API_KEY);
  res.json({
    status: "ok",
    hasGeminiKey: hasGemini,
    platform: process.platform,
    storageDir: path.join(process.cwd(), "storage"),
    scanner: scannerInstance.getStatus(),
  });
});

/**
 * 2. Folders & Library Scanning
 */
apiRouter.get("/folders", async (_req, res) => {
  try {
    const folders = await getAllFolders();
    res.json(folders);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get("/folders/presets", async (_req, res) => {
  try {
    const sampleDir = path.join(process.cwd(), "storage", "sample_audio");
    const uploadsDir = path.join(process.cwd(), "storage", "uploads");
    const rendersDir = path.join(process.cwd(), "storage", "renders");

    const getAudioCount = async (dir: string) => {
      if (!fs.existsSync(dir)) return 0;
      try {
        const files = await fs.promises.readdir(dir);
        const exts = new Set([".mp3", ".wav", ".flac", ".ogg", ".m4a", ".aac", ".aiff", ".aif"]);
        return files.filter((f) => exts.has(path.extname(f).toLowerCase())).length;
      } catch (_) {
        return 0;
      }
    };

    const presets = [
      {
        id: "preset_sample",
        label: "Default Studio Library",
        path: sampleDir,
        description: "Bundled electronic dance tracks, breakbeats, and radio sweepers",
        exists: fs.existsSync(sampleDir),
        audioCount: await getAudioCount(sampleDir),
      },
      {
        id: "preset_uploads",
        label: "Imported & Uploaded Tracks",
        path: uploadsDir,
        description: "Local audio imported from your hard drive",
        exists: fs.existsSync(uploadsDir),
        audioCount: await getAudioCount(uploadsDir),
      },
      {
        id: "preset_renders",
        label: "Rendered Radio Broadcasts",
        path: rendersDir,
        description: "Full mixdowns and episode audio renders",
        exists: fs.existsSync(rendersDir),
        audioCount: await getAudioCount(rendersDir),
      },
    ];

    res.json(presets);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post("/folders/validate", async (req, res) => {
  try {
    const { folderPath } = req.body;
    if (!folderPath || typeof folderPath !== "string") {
      return res.status(400).json({ error: "folderPath is required" });
    }

    const trimmed = folderPath.trim();
    const isWindowsClientPath = /^[a-zA-Z]:[\\\/]/i.test(trimmed);
    const isMacClientPath = /^\/Users\/[^\/]+/i.test(trimmed);

    let resolved = trimmed;
    if (!path.isAbsolute(resolved)) {
      resolved = path.resolve(process.cwd(), trimmed);
    } else {
      resolved = path.resolve(trimmed);
    }

    const exists = fs.existsSync(resolved);
    let isDirectory = false;
    let audioCount = 0;

    if (exists) {
      const st = await fs.promises.stat(resolved);
      isDirectory = st.isDirectory();
      if (isDirectory) {
        const audioExts = new Set([".mp3", ".wav", ".flac", ".ogg", ".m4a", ".aac", ".aiff", ".aif"]);
        const files = await fs.promises.readdir(resolved);
        audioCount = files.filter((f) => audioExts.has(path.extname(f).toLowerCase())).length;
      }
    }

    res.json({
      exists,
      isDirectory,
      audioCount,
      resolvedPath: resolved,
      isLocalComputerPathHint: isWindowsClientPath || isMacClientPath,
      message: !exists && (isWindowsClientPath || isMacClientPath)
        ? "This appears to be a path on your personal computer. Use the 'Scan Local Hard Drive' folder picker to scan and index it directly from your machine!"
        : (!exists ? "Directory does not exist on server." : "Directory found."),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post("/folders", async (req, res) => {
  try {
    const { folderPath, label } = req.body;
    if (!folderPath) {
      return res.status(400).json({ error: "folderPath is required" });
    }

    const trimmed = String(folderPath).trim();
    let resolved = trimmed;
    if (!path.isAbsolute(resolved)) {
      resolved = path.resolve(process.cwd(), trimmed);
    } else {
      resolved = path.resolve(trimmed);
    }

    const isWindowsClientPath = /^[a-zA-Z]:[\\\/]/i.test(trimmed);
    const isMacClientPath = /^\/Users\/[^\/]+/i.test(trimmed);

    if (!fs.existsSync(resolved)) {
      if (isWindowsClientPath || isMacClientPath) {
        return res.status(400).json({
          error: `Drive path '${trimmed}' is on your physical computer. Because this app runs in a secure sandbox, use the 'Scan Local Hard Drive' folder picker in the toolbar to browse and scan this folder directly!`,
        });
      }
      if (resolved.startsWith(process.cwd())) {
        fs.mkdirSync(resolved, { recursive: true });
      } else {
        return res.status(400).json({
          error: `Directory not found on server at '${resolved}'. For scanning folders from your local machine, use the 'Scan Local Hard Drive' button.`,
        });
      }
    }

    const folder = await addFolder(resolved, label);
    res.json(folder);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.delete("/folders/:id", async (req, res) => {
  try {
    await removeFolder(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post("/scan/start", async (req, res) => {
  try {
    const { folderId } = req.body;
    const folders = await getAllFolders();
    const targets = folderId ? folders.filter((f) => f.id === folderId) : folders;

    if (targets.length === 0) {
      return res.status(400).json({ error: "No folders configured to scan." });
    }

    const initialStatus = await scannerInstance.scanFolders(targets);
    res.json(initialStatus);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post("/scan/pause", (_req, res) => {
  scannerInstance.pauseScan();
  res.json(scannerInstance.getStatus());
});

apiRouter.post("/scan/resume", (_req, res) => {
  scannerInstance.resumeScan();
  res.json(scannerInstance.getStatus());
});

apiRouter.post("/scan/cancel", (_req, res) => {
  scannerInstance.cancelScan();
  res.json(scannerInstance.getStatus());
});

apiRouter.get("/scan/status", (_req, res) => {
  res.json(scannerInstance.getStatus());
});

/**
 * 3. Assets (Audio Tracks)
 */
apiRouter.get("/assets", async (req, res) => {
  try {
    const all = await getAllAssets();
    const { q, genre, energy, minBpm, maxBpm, aiOnly } = req.query;

    let filtered = all;

    if (q && typeof q === "string") {
      const search = q.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.title.toLowerCase().includes(search) ||
          t.artist.toLowerCase().includes(search) ||
          t.album.toLowerCase().includes(search) ||
          t.genre.toLowerCase().includes(search) ||
          t.filename.toLowerCase().includes(search) ||
          (t.aiTags || []).some((tag) => tag.toLowerCase().includes(search))
      );
    }

    if (genre && typeof genre === "string" && genre !== "all") {
      filtered = filtered.filter((t) => t.genre.toLowerCase().includes(genre.toLowerCase()));
    }

    if (energy && typeof energy === "string" && energy !== "all") {
      const targetEnergy = parseInt(energy, 10);
      filtered = filtered.filter((t) => (t.energy || 5) >= targetEnergy);
    }

    if (minBpm && typeof minBpm === "string") {
      const min = parseInt(minBpm, 10);
      filtered = filtered.filter((t) => (t.bpm || 0) >= min);
    }

    if (maxBpm && typeof maxBpm === "string") {
      const max = parseInt(maxBpm, 10);
      filtered = filtered.filter((t) => (t.bpm || 0) <= max);
    }

    if (aiOnly === "true") {
      filtered = filtered.filter((t) => t.aiAnalyzed);
    }

    res.json(filtered);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post("/scan/progress", (req, res) => {
  const update = req.body;
  if (update && typeof update === "object") {
    scannerInstance.updateStatus(update);
  }
  res.json(scannerInstance.getStatus());
});

apiRouter.post("/assets/upload", upload.array("files", 200), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: "No files uploaded." });
    }

    const folderLabel = (req.body && req.body.folderLabel) ? String(req.body.folderLabel).trim() : undefined;
    const folderPath = (req.body && req.body.folderPath) ? String(req.body.folderPath).trim() : undefined;

    let targetFolder = null;
    if (folderLabel || folderPath) {
      const fPath = folderPath || path.join(process.cwd(), "storage", "uploads", folderLabel?.replace(/[^a-zA-Z0-9_.-]/g, "_") || "general");
      const fLabel = folderLabel || path.basename(fPath);
      targetFolder = await getFolderByPath(fPath);
      if (!targetFolder) {
        targetFolder = await addFolder(fPath, fLabel);
      }
    }

    const createdTracks = [];
    for (const file of files) {
      try {
        const track = await probeAudioFile(file.path);
        await upsertAsset(track);
        createdTracks.push(track);
      } catch (fileErr) {
        console.error(`Failed to probe audio file ${file.path}:`, fileErr);
      }
    }

    if (targetFolder) {
      const allTracks = await getAllAssets();
      const folderTracks = allTracks.filter((t) => t.path.startsWith(targetFolder!.path) || (folderLabel && t.path.includes(folderLabel)));
      await updateFolderStatus(targetFolder.id, "idle", Math.max(targetFolder.fileCount + createdTracks.length, folderTracks.length));
    }

    scannerInstance.updateStatus({
      filesAdded: scannerInstance.getStatus().filesAdded + createdTracks.length,
    });

    res.json({ success: true, count: createdTracks.length, tracks: createdTracks, folder: targetFolder });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 4. Audio Streaming (Range request support for Web Audio API & HTML5 Audio)
 */
apiRouter.get("/audio/stream", async (req, res) => {
  const { id, path: filePathQuery } = req.query;
  let targetPath = "";

  if (id && typeof id === "string") {
    const track = await getAssetById(id);
    if (!track) return res.status(404).send("Track not found");
    targetPath = track.path;
  } else if (filePathQuery && typeof filePathQuery === "string") {
    targetPath = path.resolve(filePathQuery);
  }

  if (!targetPath || !fs.existsSync(targetPath)) {
    return res.status(404).send("Audio file not found on disk");
  }

  const stat = fs.statSync(targetPath);
  const fileSize = stat.size;
  const range = req.headers.range;

  const ext = path.extname(targetPath).toLowerCase();
  const mimeMap: Record<string, string> = {
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".flac": "audio/flac",
    ".ogg": "audio/ogg",
    ".m4a": "audio/mp4",
    ".aac": "audio/aac",
    ".aiff": "audio/aiff",
  };
  const contentType = mimeMap[ext] || "audio/mpeg";

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = end - start + 1;
    const file = fs.createReadStream(targetPath, { start, end });
    const head = {
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunksize,
      "Content-Type": contentType,
    };
    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      "Content-Length": fileSize,
      "Content-Type": contentType,
      "Accept-Ranges": "bytes",
    };
    res.writeHead(200, head);
    fs.createReadStream(targetPath).pipe(res);
  }
});

/**
 * 5. Voice TTS Files
 */
apiRouter.get("/voice/file/:filename", (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(process.cwd(), "storage", "voice_cache", filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send("Voice file not found");
  }
  res.sendFile(filePath);
});

/**
 * 6. AI Operations: Track Analysis, Show Running Order, DJ Announcements
 */
apiRouter.post("/ai/analyze-track", async (req, res) => {
  try {
    const { trackId } = req.body;
    if (!trackId) return res.status(400).json({ error: "trackId is required" });

    const track = await getAssetById(trackId);
    if (!track) return res.status(404).json({ error: "Track not found" });

    const analysis = await analyzeTrackWithAI(track);
    const tags = [
      analysis.genre || track.genre,
      analysis.subgenre,
      analysis.mood,
      analysis.era,
      analysis.category,
    ].filter(Boolean) as string[];

    await updateAssetAI(track.id, analysis, tags);
    const updated = await getAssetById(track.id);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post("/ai/generate-show", async (req, res) => {
  try {
    const { params, showMeta } = req.body;
    const allTracks = await getAllAssets();

    if (allTracks.length === 0) {
      return res.status(400).json({
        error: "Your local audio library is empty. Please add or scan folders first.",
      });
    }

    const result = await generateShowRunningOrder(params, allTracks, showMeta || {});
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post("/ai/generate-announcements", async (req, res) => {
  try {
    const { show, instruction } = req.body;
    if (!show || !show.tracks) {
      return res.status(400).json({ error: "Valid show with tracks is required" });
    }
    const announcements = await generateDJAnnouncements(show, show.tracks, instruction);
    res.json(announcements);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post("/voice/synthesize", async (req, res) => {
  try {
    const { text, voiceName, voicePersonality } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: "Text is required for voice synthesis." });
    }

    const result = await synthesizeAnnouncementSpeech(text, voiceName || "Kore", voicePersonality);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 7. Shows Management
 */
apiRouter.get("/shows", async (_req, res) => {
  try {
    const shows = await getAllShows();
    res.json(shows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get("/shows/:id", async (req, res) => {
  try {
    const show = await getShowById(req.params.id);
    if (!show) return res.status(404).json({ error: "Show not found" });
    res.json(show);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post("/shows", async (req, res) => {
  try {
    const show = req.body;
    if (!show || !show.id || !show.name) {
      return res.status(400).json({ error: "Valid show object with id and name required" });
    }
    await saveShow(show);
    res.json({ success: true, show });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.delete("/shows/:id", async (req, res) => {
  try {
    await deleteShow(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 8. Render Engine
 */
apiRouter.post("/render/start", async (req, res) => {
  try {
    const { show, options } = req.body;
    if (!show || !show.id) {
      return res.status(400).json({ error: "Show object is required" });
    }
    const job = await renderRadioShow(show, options);
    res.json(job);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get("/render/jobs", async (_req, res) => {
  try {
    const jobs = await getAllRenders();
    res.json(jobs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get("/renders/file/:filename", (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(process.cwd(), "storage", "renders", filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send("Rendered broadcast file not found");
  }
  res.download(filePath);
});
