import dotenv from "dotenv";
dotenv.config();

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { getDb, getAllFolders } from "./server/db.ts";
import { apiRouter } from "./server/routes.ts";
import { ensureSampleAudioLibrary } from "./server/sample_generator.ts";
import { scannerInstance } from "./server/scanner.ts";
import { logBinaryInfo } from "./server/binaries.ts";

const PORT = 3000;

async function startServer() {
  const app = express();

  // Standard middleware
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // Initialize SQLite database
  await getDb();
  console.log("[Studio DB] SQLite database initialized.");
  logBinaryInfo();

  // Ensure default studio sample audio is generated
  try {
    const sampleDir = await ensureSampleAudioLibrary();
    console.log(`[Studio Library] Default sample audio ready in ${sampleDir}`);

    // Auto-scan initial sample files if database is empty
    const folders = await getAllFolders();
    if (folders.length > 0) {
      scannerInstance.scanFolders(folders).catch((err) => {
        console.warn("[Scanner] Initial scan background notice:", err);
      });
    }
  } catch (err) {
    console.warn("[Studio Library] Error initializing sample audio:", err);
  }

  // API routes first
  app.use("/api", apiRouter);

  // Vite middleware in development, static files in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`AI Radio Show Creator server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Fatal server bootstrap error:", err);
  process.exit(1);
});
