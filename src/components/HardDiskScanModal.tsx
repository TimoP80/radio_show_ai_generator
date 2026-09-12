import React, { useState, useRef, useEffect } from "react";
import {
  HardDrive,
  FolderPlus,
  FolderCheck,
  FolderSearch,
  Server,
  Laptop,
  CheckCircle,
  AlertCircle,
  X,
  UploadCloud,
  FileAudio,
  RefreshCw,
  Info,
  Layers,
} from "lucide-react";
import { api } from "../services/api.js";

interface FolderPreset {
  id: string;
  label: string;
  path: string;
  description: string;
  exists: boolean;
  audioCount: number;
}

interface HardDiskScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanComplete: () => void;
  onRefreshFolders: () => void;
}

const SUPPORTED_EXTS = new Set(["mp3", "wav", "flac", "ogg", "m4a", "aac", "aiff", "aif"]);

export const HardDiskScanModal: React.FC<HardDiskScanModalProps> = ({
  isOpen,
  onClose,
  onScanComplete,
  onRefreshFolders,
}) => {
  const [activeTab, setActiveTab] = useState<"local" | "server">("local");

  // Local Hard Drive states
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const [discoveredFiles, setDiscoveredFiles] = useState<File[]>([]);
  const [discoveredFolderName, setDiscoveredFolderName] = useState("");
  const [folderCustomLabel, setFolderCustomLabel] = useState("");
  const [isScanningLocal, setIsScanningLocal] = useState(false);
  const [localScanProgress, setLocalScanProgress] = useState<{
    current: number;
    total: number;
    percent: number;
    currentFile: string;
    completed: boolean;
  }>({
    current: 0,
    total: 0,
    percent: 0,
    currentFile: "",
    completed: false,
  });

  // Server path states
  const [serverPath, setServerPath] = useState("");
  const [serverLabel, setServerLabel] = useState("");
  const [isAddingServerFolder, setIsAddingServerFolder] = useState(false);
  const [presets, setPresets] = useState<FolderPreset[]>([]);
  const [validationResult, setValidationResult] = useState<{
    isValidating: boolean;
    exists?: boolean;
    isDirectory?: boolean;
    audioCount?: number;
    isLocalComputerPathHint?: boolean;
    message?: string;
  }>({ isValidating: false });

  // Load presets on mount
  useEffect(() => {
    if (isOpen) {
      api.getFolderPresets()
        .then((data) => setPresets(data))
        .catch((err) => console.warn("Could not fetch folder presets:", err));
    }
  }, [isOpen]);

  // Validate server path debounce
  useEffect(() => {
    if (!serverPath.trim() || activeTab !== "server") {
      setValidationResult({ isValidating: false });
      return;
    }

    const timer = setTimeout(async () => {
      setValidationResult({ isValidating: true });
      try {
        const res = await api.validateFolder(serverPath.trim());
        setValidationResult({
          isValidating: false,
          exists: res.exists,
          isDirectory: res.isDirectory,
          audioCount: res.audioCount,
          isLocalComputerPathHint: res.isLocalComputerPathHint,
          message: res.message,
        });
      } catch (e: any) {
        setValidationResult({
          isValidating: false,
          exists: false,
          message: e.message || "Error validating path",
        });
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [serverPath, activeTab]);

  if (!isOpen) return null;

  // Extension count helper
  const extensionCounts = discoveredFiles.reduce((acc, f) => {
    const ext = f.name.split(".").pop()?.toUpperCase() || "AUDIO";
    acc[ext] = (acc[ext] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalSizeMb = (
    discoveredFiles.reduce((acc, f) => acc + f.size, 0) / (1024 * 1024)
  ).toFixed(1);

  // Handle local folder selection via input
  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    processSelectedFiles(files);
  };

  const processSelectedFiles = (files: File[]) => {
    const audioFiles = files.filter((f) => {
      const ext = f.name.split(".").pop()?.toLowerCase() || "";
      return SUPPORTED_EXTS.has(ext);
    });

    if (audioFiles.length === 0) {
      alert("No supported audio files (.mp3, .wav, .flac, .ogg, .m4a, .aac, .aiff) found in the selected folder.");
      return;
    }

    setDiscoveredFiles(audioFiles);

    // Extract folder name from webkitRelativePath
    let folderName = "Hard Drive Music";
    if (audioFiles[0]?.webkitRelativePath) {
      const parts = audioFiles[0].webkitRelativePath.split("/");
      if (parts.length > 1) {
        folderName = parts[0];
      }
    }
    setDiscoveredFolderName(folderName);
    setFolderCustomLabel(folderName);
    setLocalScanProgress({
      current: 0,
      total: audioFiles.length,
      percent: 0,
      currentFile: "",
      completed: false,
    });
  };

  // Try modern File System Access API if available, else fallback to ref click
  const handlePickLocalFolder = async () => {
    if (folderInputRef.current) {
      folderInputRef.current.value = "";
      folderInputRef.current.click();
    }
  };

  // Drag & drop handling for local folders
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const items = e.dataTransfer.items;
    if (!items || items.length === 0) return;

    const collectedFiles: File[] = [];
    let rootDirName = "Dropped Folder";

    const traverseEntry = async (entry: any) => {
      if (entry.isFile) {
        const file: File = await new Promise((resolve) => entry.file(resolve));
        const ext = file.name.split(".").pop()?.toLowerCase() || "";
        if (SUPPORTED_EXTS.has(ext)) {
          collectedFiles.push(file);
        }
      } else if (entry.isDirectory) {
        if (!rootDirName || rootDirName === "Dropped Folder") {
          rootDirName = entry.name;
        }
        const dirReader = entry.createReader();
        const readEntries = async (): Promise<any[]> => {
          return new Promise((resolve) => {
            dirReader.readEntries((entries: any[]) => resolve(entries));
          });
        };

        let entries = await readEntries();
        while (entries.length > 0) {
          for (const child of entries) {
            await traverseEntry(child);
          }
          entries = await readEntries();
        }
      }
    };

    try {
      for (let i = 0; i < items.length; i++) {
        const entry = items[i].webkitGetAsEntry ? items[i].webkitGetAsEntry() : null;
        if (entry) {
          await traverseEntry(entry);
        }
      }

      if (collectedFiles.length > 0) {
        setDiscoveredFiles(collectedFiles);
        setDiscoveredFolderName(rootDirName);
        setFolderCustomLabel(rootDirName);
        setLocalScanProgress({
          current: 0,
          total: collectedFiles.length,
          percent: 0,
          currentFile: "",
          completed: false,
        });
      }
    } catch (err) {
      console.warn("Folder drag-drop reading error:", err);
    }
  };

  // Execute Local Scan & Ingestion
  const handleStartLocalScan = async () => {
    if (discoveredFiles.length === 0) return;

    setIsScanningLocal(true);
    setLocalScanProgress({
      current: 0,
      total: discoveredFiles.length,
      percent: 0,
      currentFile: "Preparing tracks...",
      completed: false,
    });

    const labelToUse = folderCustomLabel.trim() || discoveredFolderName || "Hard Drive Audio";
    const BATCH_SIZE = 12;

    try {
      for (let i = 0; i < discoveredFiles.length; i += BATCH_SIZE) {
        const chunk = discoveredFiles.slice(i, i + BATCH_SIZE);
        const currentFile = chunk[0].name;
        const processedCount = i;
        const percent = Math.round((processedCount / discoveredFiles.length) * 100);

        setLocalScanProgress({
          current: processedCount,
          total: discoveredFiles.length,
          percent,
          currentFile,
          completed: false,
        });

        // Notify server scan status for live updates
        try {
          await api.updateScanProgress({
            isScanning: true,
            currentFolder: labelToUse,
            currentFile,
            progressPercent: percent,
            filesDiscovered: discoveredFiles.length,
          });
        } catch (_) {}

        await api.uploadTracks(chunk, {
          folderLabel: labelToUse,
          folderPath: discoveredFolderName,
        });
      }

      // Finish scan
      setLocalScanProgress({
        current: discoveredFiles.length,
        total: discoveredFiles.length,
        percent: 100,
        currentFile: "Scan & Indexing complete!",
        completed: true,
      });

      try {
        await api.updateScanProgress({
          isScanning: false,
          progressPercent: 100,
          currentFile: undefined,
          currentFolder: undefined,
        });
      } catch (_) {}

      onRefreshFolders();
      onScanComplete();
    } catch (err: any) {
      alert("Hard disk scanning error: " + err.message);
    } finally {
      setIsScanningLocal(false);
    }
  };

  // Add Server Folder
  const handleAddServerFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serverPath.trim()) return;

    setIsAddingServerFolder(true);
    try {
      const folder = await api.addFolder(serverPath.trim(), serverLabel.trim() || undefined);
      setServerPath("");
      setServerLabel("");
      onRefreshFolders();
      // Start server scanning loop
      await api.startScan(folder.id);
      onScanComplete();
      onClose();
    } catch (err: any) {
      alert("Failed to add server folder: " + err.message);
    } finally {
      setIsAddingServerFolder(false);
    }
  };

  const selectPreset = (p: FolderPreset) => {
    setServerPath(p.path);
    setServerLabel(p.label);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-950/60 border border-cyan-800/60 text-cyan-400">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-100 flex items-center gap-2">
                Hard Disk Music Scanner
              </h3>
              <p className="text-xs text-neutral-400">
                Scan local audio collections, extract BPM/tags, and monitor storage directories.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-neutral-800 bg-neutral-950/30 px-5 pt-3">
          <button
            id="tab-local-harddrive"
            onClick={() => setActiveTab("local")}
            className={`px-4 py-2 text-xs font-semibold flex items-center gap-2 border-b-2 transition cursor-pointer ${
              activeTab === "local"
                ? "border-cyan-400 text-cyan-300"
                : "border-transparent text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <Laptop className="w-3.5 h-3.5" />
            <span>Local Computer Hard Drive</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-cyan-950/80 text-cyan-400 border border-cyan-800/40">
              Direct
            </span>
          </button>

          <button
            id="tab-server-directory"
            onClick={() => setActiveTab("server")}
            className={`px-4 py-2 text-xs font-semibold flex items-center gap-2 border-b-2 transition cursor-pointer ${
              activeTab === "server"
                ? "border-cyan-400 text-cyan-300"
                : "border-transparent text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>Server & Storage Folders</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-neutral-800 text-neutral-300">
              Presets
            </span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {activeTab === "local" ? (
            <div className="space-y-4">
              {/* Hidden webkitdirectory input */}
              <input
                type="file"
                ref={folderInputRef}
                onChange={handleFolderChange}
                {...({ webkitdirectory: "", directory: "" } as any)}
                multiple
                accept="audio/*,.mp3,.wav,.flac,.ogg,.m4a,.aac,.aiff,.aif"
                className="hidden"
              />

              {/* Browse / Drop Zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={handleDrop}
                onClick={handlePickLocalFolder}
                className="border-2 border-dashed border-neutral-700 hover:border-cyan-500/70 rounded-2xl p-6 text-center cursor-pointer bg-neutral-950/40 hover:bg-cyan-950/10 transition group"
              >
                <div className="w-12 h-12 mx-auto rounded-full bg-cyan-950/80 border border-cyan-800/60 flex items-center justify-center text-cyan-400 mb-3 group-hover:scale-105 transition">
                  <FolderSearch className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-neutral-100 mb-1">
                  Click to Browse or Drag & Drop a Music Folder
                </h4>
                <p className="text-xs text-neutral-400 max-w-md mx-auto leading-relaxed">
                  Select any folder on your hard drive (e.g. <span className="text-neutral-300 font-mono">C:\Music</span>, <span className="text-neutral-300 font-mono">/Users/Music</span>, or an external USB drive). All audio files inside will be recursively discovered and indexed.
                </p>
                <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] font-mono text-neutral-500">
                  <span>Supported: MP3, WAV, FLAC, OGG, M4A, AAC, AIFF</span>
                </div>
              </div>

              {/* Discovered Folder Card */}
              {discoveredFiles.length > 0 && (
                <div className="p-4 rounded-xl bg-neutral-950/80 border border-cyan-800/40 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <FolderCheck className="w-4 h-4 text-cyan-400" />
                        <span className="text-xs font-mono uppercase text-cyan-400 font-bold">
                          Folder Ready to Scan
                        </span>
                      </div>
                      <h4 className="text-sm font-semibold text-neutral-100 mt-1">
                        {discoveredFolderName}
                      </h4>
                      <p className="text-xs text-neutral-400 mt-0.5">
                        {discoveredFiles.length} audio tracks found • {totalSizeMb} MB total
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-1 max-w-[200px] justify-end">
                      {Object.entries(extensionCounts).map(([ext, count]) => (
                        <span
                          key={ext}
                          className="px-2 py-0.5 rounded text-[10px] font-mono bg-neutral-800 text-neutral-300 border border-neutral-700"
                        >
                          {count} {ext}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Folder Label Input */}
                  <div>
                    <label className="text-[11px] font-mono text-neutral-400 block mb-1">
                      Library Display Label
                    </label>
                    <input
                      type="text"
                      value={folderCustomLabel}
                      onChange={(e) => setFolderCustomLabel(e.target.value)}
                      placeholder="e.g. Main Hard Drive Archive"
                      disabled={isScanningLocal}
                      className="w-full px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-800 text-xs text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  {/* Scanning Progress */}
                  {isScanningLocal && (
                    <div className="p-3 rounded-lg bg-cyan-950/40 border border-cyan-800/40 space-y-2">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-cyan-300 flex items-center gap-2">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Scanning & Indexing Hard Drive...</span>
                        </span>
                        <span className="text-cyan-400 font-bold">
                          {localScanProgress.percent}% ({localScanProgress.current} / {localScanProgress.total})
                        </span>
                      </div>
                      <div className="w-full bg-neutral-800 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-cyan-400 h-full transition-all duration-200"
                          style={{ width: `${localScanProgress.percent}%` }}
                        />
                      </div>
                      <p className="text-[11px] font-mono text-neutral-400 truncate">
                        Active: {localScanProgress.currentFile}
                      </p>
                    </div>
                  )}

                  {/* Completed Badge */}
                  {localScanProgress.completed && (
                    <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-800/50 flex items-center gap-2 text-xs text-emerald-300 font-mono">
                      <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>
                        Successfully scanned and indexed {discoveredFiles.length} tracks into library!
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Server & Storage Folders Tab */
            <div className="space-y-5">
              {/* Presets Grid */}
              <div>
                <label className="text-xs font-mono text-neutral-400 block mb-2">
                  1-Click Storage Presets
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {presets.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => selectPreset(p)}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                        serverPath === p.path
                          ? "bg-cyan-950/40 border-cyan-500/60"
                          : "bg-neutral-950/60 border-neutral-800 hover:border-neutral-700"
                      }`}
                    >
                      <span className="text-xs font-bold text-neutral-200 block truncate">
                        {p.label}
                      </span>
                      <span className="text-[10px] text-neutral-400 block mt-0.5 line-clamp-2">
                        {p.description}
                      </span>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-neutral-800/60 text-[10px] font-mono">
                        <span className={p.exists ? "text-emerald-400" : "text-neutral-500"}>
                          {p.exists ? `${p.audioCount} audio files` : "Empty/Missing"}
                        </span>
                        <span className="text-cyan-400">Select</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Server Directory Form */}
              <form onSubmit={handleAddServerFolder} className="space-y-3.5">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-mono text-neutral-400">
                      Server / Workspace Directory Path
                    </label>
                    {validationResult.isValidating ? (
                      <span className="text-[11px] font-mono text-cyan-400 flex items-center gap-1">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span>Validating...</span>
                      </span>
                    ) : validationResult.exists && validationResult.isDirectory ? (
                      <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        <span>Found ({validationResult.audioCount} audio files)</span>
                      </span>
                    ) : null}
                  </div>

                  <input
                    type="text"
                    value={serverPath}
                    onChange={(e) => setServerPath(e.target.value)}
                    placeholder="e.g. storage/sample_audio or /app/applet/storage/uploads"
                    required
                    className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-xs text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-cyan-500 font-mono"
                  />

                  {/* Path Validation Alerts */}
                  {validationResult.isLocalComputerPathHint && (
                    <div className="mt-2 p-2.5 rounded-lg bg-amber-950/40 border border-amber-800/50 flex items-start gap-2 text-xs text-amber-300">
                      <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">Local Hard Drive Path Detected</p>
                        <p className="text-[11px] text-amber-300/80 mt-0.5">
                          Paths like <code className="font-mono">C:\...</code> or <code className="font-mono">/Users/...</code> are on your physical computer. Switch to the <strong>Local Computer Hard Drive</strong> tab above to directly select and scan that folder!
                        </p>
                      </div>
                    </div>
                  )}

                  {!validationResult.isLocalComputerPathHint &&
                    serverPath.trim() &&
                    validationResult.exists === false && (
                      <p className="text-[11px] font-mono text-rose-400 mt-1">
                        Directory does not exist on server.
                      </p>
                    )}
                </div>

                <div>
                  <label className="text-xs font-mono text-neutral-400 block mb-1">
                    Folder Label (Optional)
                  </label>
                  <input
                    type="text"
                    value={serverLabel}
                    onChange={(e) => setServerLabel(e.target.value)}
                    placeholder="e.g. Studio Master Archive"
                    className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-xs text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={isAddingServerFolder || !serverPath.trim()}
                    className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-xs font-semibold text-white transition flex items-center gap-2 cursor-pointer"
                  >
                    {isAddingServerFolder ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Adding & Scanning...</span>
                      </>
                    ) : (
                      <>
                        <FolderPlus className="w-3.5 h-3.5" />
                        <span>Add & Scan Server Path</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Footer Actions for Local Tab */}
        {activeTab === "local" && (
          <div className="p-4 border-t border-neutral-800 bg-neutral-950/60 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              disabled={isScanningLocal}
              className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs text-neutral-300 transition cursor-pointer"
            >
              {localScanProgress.completed ? "Close" : "Cancel"}
            </button>

            {discoveredFiles.length > 0 && !localScanProgress.completed && (
              <button
                id="btn-start-harddisk-scan"
                onClick={handleStartLocalScan}
                disabled={isScanningLocal}
                className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-xs font-bold text-white shadow-lg shadow-cyan-600/20 transition flex items-center gap-2 cursor-pointer"
              >
                {isScanningLocal ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Scanning ({localScanProgress.percent}%)...</span>
                  </>
                ) : (
                  <>
                    <HardDrive className="w-4 h-4" />
                    <span>Start Hard Disk Scan ({discoveredFiles.length} Tracks)</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
