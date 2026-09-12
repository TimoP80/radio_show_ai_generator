import fs from "fs";
import path from "path";
import { ScanStatus } from "../src/types.ts";
import { probeAudioFile } from "./audio_probe.ts";
import { getAllAssets, getAssetByPath, deleteAsset, upsertAsset, updateFolderStatus } from "./db.ts";

const SUPPORTED_EXTENSIONS = new Set(["mp3", "wav", "flac", "ogg", "m4a", "aac", "aiff", "aif"]);

class LibraryScanner {
  private status: ScanStatus = {
    isScanning: false,
    isPaused: false,
    filesDiscovered: 0,
    filesAdded: 0,
    filesChanged: 0,
    filesRemoved: 0,
    errorCount: 0,
    progressPercent: 0,
  };

  private cancelRequested = false;
  private pausePromiseResolve: (() => void) | null = null;
  private currentTaskId: string | null = null;

  public getStatus(): ScanStatus {
    return { ...this.status };
  }

  public updateStatus(partial: Partial<ScanStatus>): void {
    this.status = { ...this.status, ...partial };
  }

  public pauseScan(): void {
    if (this.status.isScanning && !this.status.isPaused) {
      this.status.isPaused = true;
    }
  }

  public resumeScan(): void {
    if (this.status.isScanning && this.status.isPaused) {
      this.status.isPaused = false;
      if (this.pausePromiseResolve) {
        this.pausePromiseResolve();
        this.pausePromiseResolve = null;
      }
    }
  }

  public cancelScan(): void {
    if (this.status.isScanning) {
      this.cancelRequested = true;
      if (this.pausePromiseResolve) {
        this.pausePromiseResolve();
        this.pausePromiseResolve = null;
      }
    }
  }

  private async checkPauseAndCancel(): Promise<boolean> {
    if (this.cancelRequested) return false;
    while (this.status.isPaused && !this.cancelRequested) {
      await new Promise<void>((resolve) => {
        this.pausePromiseResolve = resolve;
      });
    }
    return !this.cancelRequested;
  }

  public async scanFolders(folders: Array<{ id: string; path: string }>): Promise<ScanStatus> {
    if (this.status.isScanning) {
      return this.getStatus();
    }

    this.status = {
      isScanning: true,
      isPaused: false,
      filesDiscovered: 0,
      filesAdded: 0,
      filesChanged: 0,
      filesRemoved: 0,
      errorCount: 0,
      progressPercent: 0,
    };
    this.cancelRequested = false;

    // Run async scan in background so it doesn't block caller
    (async () => {
      try {
        for (const folder of folders) {
          if (!await this.checkPauseAndCancel()) break;

          this.status.currentFolder = folder.path;
          await updateFolderStatus(folder.id, "scanning");

          let folderFileCount = 0;
          try {
            const files = await this.discoverAudioFiles(folder.path);
            this.status.filesDiscovered += files.length;
            let processed = 0;

            // Prune assets from this folder that no longer exist on disk
            try {
              const existingFilesInFolder = new Set(files.map((f) => path.resolve(f)));
              const allTracks = await getAllAssets();
              const normalizedFolder = path.resolve(folder.path);
              for (const trk of allTracks) {
                const trkPath = path.resolve(trk.path);
                if (trkPath.startsWith(normalizedFolder) && !existingFilesInFolder.has(trkPath)) {
                  await deleteAsset(trk.id);
                  this.status.filesRemoved++;
                }
              }
            } catch (pruneErr) {
              console.warn("Could not prune deleted assets:", pruneErr);
            }

            for (const filePath of files) {
              if (!await this.checkPauseAndCancel()) break;

              this.status.currentFile = path.basename(filePath);
              try {
                const stat = await fs.promises.stat(filePath);
                const existing = await getAssetByPath(filePath);

                if (!existing) {
                  const track = await probeAudioFile(filePath);
                  await upsertAsset(track);
                  this.status.filesAdded++;
                  folderFileCount++;
                } else {
                  // Check if modified
                  const fileMtime = stat.mtimeMs;
                  const dbMtime = new Date(existing.updatedAt).getTime();
                  if (stat.size !== existing.fileSize || Math.abs(fileMtime - dbMtime) > 1000) {
                    const track = await probeAudioFile(filePath);
                    await upsertAsset(track);
                    this.status.filesChanged++;
                  }
                  folderFileCount++;
                }
              } catch (fileErr) {
                console.error(`Error processing file ${filePath}:`, fileErr);
                this.status.errorCount++;
              }

              processed++;
              this.status.progressPercent = Math.min(100, Math.round((processed / Math.max(1, files.length)) * 100));
            }

            await updateFolderStatus(folder.id, "idle", folderFileCount);
          } catch (err: any) {
            console.error(`Error scanning folder ${folder.path}:`, err);
            this.status.errorCount++;
            await updateFolderStatus(folder.id, "error", folderFileCount, err.message || "Failed to scan folder");
          }
        }
      } finally {
        this.status.isScanning = false;
        this.status.isPaused = false;
        this.status.currentFolder = undefined;
        this.status.currentFile = undefined;
        this.status.progressPercent = 100;
        this.cancelRequested = false;
      }
    })();

    return this.getStatus();
  }

  private async discoverAudioFiles(dirPath: string): Promise<string[]> {
    const audioFiles: string[] = [];
    if (!fs.existsSync(dirPath)) return audioFiles;

    async function walk(currentDir: string) {
      let entries: fs.Dirent[] = [];
      try {
        entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
      } catch (err) {
        return;
      }

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          // Avoid hidden dirs or node_modules
          if (!entry.name.startsWith(".") && entry.name !== "node_modules" && entry.name !== "dist") {
            await walk(fullPath);
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).replace(/^\./, "").toLowerCase();
          if (SUPPORTED_EXTENSIONS.has(ext)) {
            audioFiles.push(fullPath);
          }
        }
      }
    }

    await walk(dirPath);
    return audioFiles;
  }
}

export const scannerInstance = new LibraryScanner();
