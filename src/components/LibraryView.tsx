import React, { useState, useRef } from "react";
import {
  Search,
  FolderPlus,
  Play,
  Pause,
  Sparkles,
  RefreshCw,
  Plus,
  Trash2,
  SlidersHorizontal,
  UploadCloud,
  FileAudio,
  CheckCircle,
  AlertCircle,
  Info,
  Layers,
  HardDrive,
  X,
} from "lucide-react";
import { AudioTrack, LibraryFolder, ScanStatus, RadioShow } from "../types.js";
import { api } from "../services/api.js";
import { useAudioPlayer } from "../context/AudioPlayerContext.js";
import { HardDiskScanModal } from "./HardDiskScanModal.js";

interface LibraryViewProps {
  tracks: AudioTrack[];
  folders: LibraryFolder[];
  scanStatus: ScanStatus;
  activeShow: RadioShow | null;
  onRefreshLibrary: () => void;
  onRefreshFolders: () => void;
  onAddTrackToShow: (track: AudioTrack) => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  tracks,
  folders,
  scanStatus,
  activeShow,
  onRefreshLibrary,
  onRefreshFolders,
  onAddTrackToShow,
}) => {
  const { playTrack, isPlaying, nowPlaying, togglePlay } = useAudioPlayer();

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGenre, setSelectedGenre] = useState("all");
  const [minEnergy, setMinEnergy] = useState(0);
  const [minBpm, setMinBpm] = useState(0);
  const [onlyAiAnalyzed, setOnlyAiAnalyzed] = useState(false);

  // Hard disk & folder scanner modal
  const [showFolderModal, setShowFolderModal] = useState(false);

  // Track Inspector modal
  const [inspectedTrack, setInspectedTrack] = useState<AudioTrack | null>(null);
  const [isAnalyzingId, setIsAnalyzingId] = useState<string | null>(null);

  // File upload state
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Filtered tracks
  const genres = Array.from(new Set(tracks.map((t) => t.genre).filter(Boolean)));

  const filteredTracks = tracks.filter((t) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        t.album.toLowerCase().includes(q) ||
        t.genre.toLowerCase().includes(q) ||
        t.filename.toLowerCase().includes(q) ||
        (t.mood || "").toLowerCase().includes(q) ||
        (t.aiTags || []).some((tag) => tag.toLowerCase().includes(q));
      if (!match) return false;
    }
    if (selectedGenre !== "all" && t.genre.toLowerCase() !== selectedGenre.toLowerCase()) {
      return false;
    }
    if (minEnergy > 0 && (t.energy || 5) < minEnergy) {
      return false;
    }
    if (minBpm > 0 && (t.bpm || 0) < minBpm) {
      return false;
    }
    if (onlyAiAnalyzed && !t.aiAnalyzed) {
      return false;
    }
    return true;
  });

  const handleRemoveFolder = async (id: string) => {
    if (confirm("Remove folder reference from radio library? Your original files will NOT be deleted.")) {
      try {
        await api.removeFolder(id);
        onRefreshFolders();
      } catch (err: any) {
        alert("Failed to remove folder: " + err.message);
      }
    }
  };

  const handleStartScan = async (folderId?: string) => {
    try {
      await api.startScan(folderId);
    } catch (err: any) {
      alert("Scan failed: " + err.message);
    }
  };

  const handlePauseScan = async () => {
    await api.pauseScan();
  };

  const handleResumeScan = async () => {
    await api.resumeScan();
  };

  const handleCancelScan = async () => {
    await api.cancelScan();
  };

  const handleAnalyzeTrack = async (track: AudioTrack) => {
    setIsAnalyzingId(track.id);
    try {
      const updated = await api.analyzeTrack(track.id);
      if (inspectedTrack?.id === track.id) {
        setInspectedTrack(updated);
      }
      onRefreshLibrary();
    } catch (err: any) {
      alert("AI analysis failed: " + err.message);
    } finally {
      setIsAnalyzingId(null);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsUploading(true);
    try {
      await api.uploadTracks(Array.from(files));
      onRefreshLibrary();
    } catch (err: any) {
      alert("Upload failed: " + err.message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div id="library-view" className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header & Folder Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-mono uppercase text-cyan-400 font-semibold tracking-wider">
            Audio Subsystem
          </span>
          <h2 className="text-2xl font-bold text-neutral-100 tracking-tight">
            Local Audio Library
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Recursively indexed hard drive folders. Original audio files are preserved and never modified.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            multiple
            accept="audio/*,.mp3,.wav,.flac,.ogg,.m4a,.aac,.aiff"
            className="hidden"
          />
          <button
            id="library-btn-upload"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium flex items-center gap-2 border border-neutral-700 transition cursor-pointer"
          >
            <UploadCloud className="w-4 h-4 text-neutral-300" />
            <span>{isUploading ? "Importing Audio..." : "Import Audio Files"}</span>
          </button>

          <button
            id="library-btn-scan-harddisk"
            onClick={() => setShowFolderModal(true)}
            className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-cyan-600/20 transition cursor-pointer"
          >
            <HardDrive className="w-4 h-4" />
            <span>Scan Local Hard Drive</span>
          </button>
        </div>
      </div>

      {/* Monitored Folders & Live Scanner Status */}
      <div className="rounded-xl bg-neutral-900/60 border border-neutral-800/80 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase text-neutral-300 font-bold">
              Monitored Storage Folders ({folders.length})
            </span>
          </div>

          <div className="flex items-center gap-2">
            {scanStatus.isScanning ? (
              <div className="flex items-center gap-2">
                {scanStatus.isPaused ? (
                  <button
                    onClick={handleResumeScan}
                    className="px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 text-xs font-mono font-medium hover:bg-amber-500/30 transition"
                  >
                    Resume
                  </button>
                ) : (
                  <button
                    onClick={handlePauseScan}
                    className="px-2.5 py-1 rounded bg-neutral-800 text-neutral-300 text-xs font-mono font-medium hover:bg-neutral-700 transition"
                  >
                    Pause
                  </button>
                )}
                <button
                  onClick={handleCancelScan}
                  className="px-2.5 py-1 rounded bg-rose-500/20 text-rose-300 text-xs font-mono font-medium hover:bg-rose-500/30 transition"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                id="library-btn-rescan-all"
                onClick={() => handleStartScan()}
                className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-mono flex items-center gap-1.5 transition cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Rescan All Folders</span>
              </button>
            )}
          </div>
        </div>

        {/* Folders Badge List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {folders.map((folder) => (
            <div
              key={folder.id}
              className="p-3 rounded-lg bg-neutral-950/60 border border-neutral-800/80 flex items-center justify-between text-xs"
            >
              <div className="min-w-0 pr-2">
                <span className="font-semibold text-neutral-200 truncate block">
                  {folder.label}
                </span>
                <span className="text-[11px] font-mono text-neutral-400 truncate block mt-0.5">
                  {folder.path}
                </span>
                <span className="text-[10px] text-neutral-400 mt-1 block">
                  {folder.fileCount} tracks • {folder.lastScannedAt ? "Scanned" : "Pending"}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handleStartScan(folder.id)}
                  className="p-1.5 text-neutral-400 hover:text-cyan-400 transition"
                  title="Rescan this folder"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleRemoveFolder(folder.id)}
                  className="p-1.5 text-neutral-400 hover:text-rose-400 transition"
                  title="Remove folder"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Scan Progress Widget */}
        {scanStatus.isScanning && (
          <div className="p-3 rounded-lg bg-cyan-950/30 border border-cyan-800/40 text-xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-medium text-cyan-300 font-mono">
                {scanStatus.isPaused ? "Scan Paused" : "Scanning Audio Tracks in Background..."}
              </span>
              <span className="font-mono text-cyan-400 font-bold">
                {scanStatus.progressPercent}%
              </span>
            </div>
            <div className="w-full bg-neutral-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-cyan-400 h-full transition-all duration-200"
                style={{ width: `${scanStatus.progressPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono text-neutral-400 mt-2">
              <span>Current: {scanStatus.currentFile || "Discovering files..."}</span>
              <span>
                +{scanStatus.filesAdded} added • {scanStatus.errorCount} errors
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Search & Filter Bar */}
      <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800/80 flex flex-wrap items-center gap-4">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="library-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Artist, Title, Album, Genre, BPM, Mood, AI Tags..."
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        {/* Genre Selector */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-neutral-400">Genre:</span>
          <select
            id="library-filter-genre"
            value={selectedGenre}
            onChange={(e) => setSelectedGenre(e.target.value)}
            className="px-2.5 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-xs text-neutral-200 focus:outline-none"
          >
            <option value="all">All Genres</option>
            {genres.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>

        {/* Min Energy Filter */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-neutral-400">Min Energy:</span>
          <select
            id="library-filter-energy"
            value={minEnergy}
            onChange={(e) => setMinEnergy(parseInt(e.target.value, 10))}
            className="px-2.5 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-xs text-neutral-200 focus:outline-none"
          >
            <option value="0">Any Energy</option>
            <option value="6">Energy &gt; 6 (Club)</option>
            <option value="8">Energy &gt; 8 (High Rave)</option>
          </select>
        </div>

        {/* Min BPM Filter */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-neutral-400">Min BPM:</span>
          <select
            id="library-filter-bpm"
            value={minBpm}
            onChange={(e) => setMinBpm(parseInt(e.target.value, 10))}
            className="px-2.5 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-xs text-neutral-200 focus:outline-none"
          >
            <option value="0">Any BPM</option>
            <option value="120">120+ BPM</option>
            <option value="140">140+ BPM</option>
            <option value="160">160+ BPM (Hardcore/Rave)</option>
          </select>
        </div>

        {/* AI Analyzed Checkbox */}
        <label className="flex items-center gap-2 text-xs text-neutral-300 cursor-pointer">
          <input
            id="library-filter-ai"
            type="checkbox"
            checked={onlyAiAnalyzed}
            onChange={(e) => setOnlyAiAnalyzed(e.target.checked)}
            className="rounded bg-neutral-950 border-neutral-800 text-cyan-500 focus:ring-0"
          />
          <span>AI Analyzed Only</span>
        </label>
      </div>

      {/* Tracks Table */}
      <div className="rounded-xl bg-neutral-900/60 border border-neutral-800/80 overflow-hidden shadow-sm">
        <div className="px-5 py-3 border-b border-neutral-800 flex items-center justify-between text-xs font-mono text-neutral-400">
          <span>Showing {filteredTracks.length} of {tracks.length} audio tracks</span>
          <span>ffprobe verified metadata</span>
        </div>

        {filteredTracks.length === 0 ? (
          <div className="py-16 text-center">
            <FileAudio className="w-10 h-10 text-neutral-600 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-neutral-300">No Audio Tracks Found</h3>
            <p className="text-xs text-neutral-400 mt-1">
              Add a folder with MP3, WAV, FLAC, OGG, M4A or import tracks directly.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-950/80 border-b border-neutral-800 text-neutral-400 font-mono text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">Audition</th>
                  <th className="py-3 px-4">Title & Artist</th>
                  <th className="py-3 px-4">Album</th>
                  <th className="py-3 px-4">Genre</th>
                  <th className="py-3 px-4">BPM</th>
                  <th className="py-3 px-4">Energy</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4">AI Analysis</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {filteredTracks.map((track) => {
                  const isTrackPlaying = nowPlaying?.id === track.id && isPlaying;
                  return (
                    <tr
                      key={track.id}
                      className="hover:bg-neutral-800/40 transition group"
                    >
                      {/* Audition Button */}
                      <td className="py-2.5 px-4 text-center">
                        <button
                          onClick={() => (isTrackPlaying ? togglePlay() : playTrack(track))}
                          className={`w-7 h-7 rounded-full flex items-center justify-center transition ${
                            isTrackPlaying
                              ? "bg-cyan-500 text-white"
                              : "bg-neutral-800 text-neutral-300 group-hover:bg-neutral-700"
                          }`}
                          title="Audition track"
                        >
                          {isTrackPlaying ? (
                            <Pause className="w-3.5 h-3.5 fill-current" />
                          ) : (
                            <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                          )}
                        </button>
                      </td>

                      {/* Title & Artist */}
                      <td className="py-2.5 px-4">
                        <div className="font-semibold text-neutral-200 truncate max-w-[200px]">
                          {track.title}
                        </div>
                        <div className="text-[11px] text-neutral-400 truncate max-w-[200px]">
                          {track.artist}
                        </div>
                      </td>

                      {/* Album */}
                      <td className="py-2.5 px-4 text-neutral-300 truncate max-w-[150px]">
                        {track.album || "—"}
                      </td>

                      {/* Genre */}
                      <td className="py-2.5 px-4">
                        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-neutral-800 text-neutral-300 border border-neutral-700">
                          {track.genre}
                        </span>
                      </td>

                      {/* BPM */}
                      <td className="py-2.5 px-4 font-mono text-neutral-300">
                        {track.bpm ? `${track.bpm}` : "—"}
                      </td>

                      {/* Energy dots */}
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-1" title={`Energy: ${track.energy || 5}/10`}>
                          {Array.from({ length: 5 }).map((_, i) => (
                            <span
                              key={i}
                              className={`w-1.5 h-1.5 rounded-full ${
                                i < Math.round((track.energy || 5) / 2)
                                  ? "bg-amber-400"
                                  : "bg-neutral-800"
                              }`}
                            />
                          ))}
                        </div>
                      </td>

                      {/* Duration */}
                      <td className="py-2.5 px-4 font-mono text-neutral-300">
                        {Math.floor(track.duration / 60)}:
                        {Math.floor(track.duration % 60).toString().padStart(2, "0")}
                      </td>

                      {/* AI Status / Tags */}
                      <td className="py-2.5 px-4">
                        {track.aiAnalyzed ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-mono">
                            <Sparkles className="w-3 h-3 text-emerald-400" />
                            <span>{track.aiMetadata?.subgenre || "Analyzed"}</span>
                          </span>
                        ) : (
                          <button
                            onClick={() => handleAnalyzeTrack(track)}
                            disabled={isAnalyzingId === track.id}
                            className="px-2 py-0.5 rounded text-[11px] bg-neutral-800 hover:bg-neutral-700 text-neutral-300 flex items-center gap-1 transition"
                            title="Analyze with Gemini"
                          >
                            <Sparkles className="w-3 h-3 text-neutral-400" />
                            <span>{isAnalyzingId === track.id ? "Analyzing..." : "Analyze"}</span>
                          </button>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setInspectedTrack(track)}
                            className="p-1.5 rounded text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition"
                            title="Inspect metadata & ffprobe parameters"
                          >
                            <Info className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onAddTrackToShow(track)}
                            disabled={!activeShow}
                            className="px-2.5 py-1 rounded bg-cyan-600/80 hover:bg-cyan-600 disabled:bg-neutral-800 disabled:text-neutral-600 text-white font-medium text-xs flex items-center gap-1 transition cursor-pointer disabled:cursor-not-allowed"
                            title={activeShow ? "Add track to current show" : "Select a show first"}
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add to Show</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Hard Disk & Folder Scanner Modal */}
      <HardDiskScanModal
        isOpen={showFolderModal}
        onClose={() => setShowFolderModal(false)}
        onScanComplete={() => {
          onRefreshFolders();
          onRefreshLibrary();
        }}
        onRefreshFolders={onRefreshFolders}
      />

      {/* Track Technical Inspector Modal */}
      {inspectedTrack && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 border-b border-neutral-800 pb-3">
              <div>
                <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider">
                  Asset ID: {inspectedTrack.id}
                </span>
                <h3 className="text-base font-bold text-neutral-100">
                  {inspectedTrack.title}
                </h3>
                <p className="text-xs text-neutral-400">{inspectedTrack.artist}</p>
              </div>
              <button
                onClick={() => setInspectedTrack(null)}
                className="text-neutral-500 hover:text-neutral-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* ffprobe Technical Specs */}
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-mono uppercase text-neutral-400 mb-2">
                  FFprobe Technical Parameters
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-lg bg-neutral-950 border border-neutral-800 text-xs font-mono">
                  <div>
                    <span className="text-neutral-500 block text-[10px]">Codec</span>
                    <span className="text-neutral-200 uppercase">{inspectedTrack.codec}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block text-[10px]">Sample Rate</span>
                    <span className="text-neutral-200">{inspectedTrack.sampleRate} Hz</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block text-[10px]">Channels</span>
                    <span className="text-neutral-200">{inspectedTrack.channels === 2 ? "Stereo" : "Mono"}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block text-[10px]">Bitrate</span>
                    <span className="text-neutral-200">{Math.round(inspectedTrack.bitrate / 1000)} kbps</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block text-[10px]">File Size</span>
                    <span className="text-neutral-200">{(inspectedTrack.fileSize / 1024 / 1024).toFixed(2)} MB</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block text-[10px]">Exact Duration</span>
                    <span className="text-neutral-200">{inspectedTrack.duration.toFixed(2)}s</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block text-[10px]">BPM</span>
                    <span className="text-neutral-200">{inspectedTrack.bpm || "Unknown"}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block text-[10px]">Energy Rating</span>
                    <span className="text-amber-400">{inspectedTrack.energy || 5}/10</span>
                  </div>
                </div>
              </div>

              <div>
                <span className="text-neutral-500 block text-[10px] font-mono">Canonical File Path</span>
                <p className="text-xs font-mono text-neutral-300 p-2 rounded bg-neutral-950 border border-neutral-800 break-all select-all">
                  {inspectedTrack.path}
                </p>
              </div>

              {/* AI Analysis Section */}
              <div className="pt-2 border-t border-neutral-800">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-mono uppercase text-neutral-400 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Gemini AI Music Profile</span>
                  </h4>
                  <button
                    onClick={() => handleAnalyzeTrack(inspectedTrack)}
                    disabled={isAnalyzingId === inspectedTrack.id}
                    className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-xs text-cyan-300 font-mono transition"
                  >
                    {isAnalyzingId === inspectedTrack.id ? "Analyzing..." : "Re-Analyze with Gemini"}
                  </button>
                </div>

                {inspectedTrack.aiMetadata ? (
                  <div className="p-3.5 rounded-lg bg-neutral-950 border border-neutral-800 space-y-2.5 text-xs">
                    <p className="text-neutral-200 leading-relaxed italic">
                      "{inspectedTrack.aiMetadata.summary}"
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono pt-2 border-t border-neutral-800/80">
                      <div>
                        <span className="text-neutral-500">Subgenre: </span>
                        <span className="text-neutral-300">{inspectedTrack.aiMetadata.subgenre || inspectedTrack.genre}</span>
                      </div>
                      <div>
                        <span className="text-neutral-500">Mood: </span>
                        <span className="text-neutral-300">{inspectedTrack.aiMetadata.mood}</span>
                      </div>
                      <div>
                        <span className="text-neutral-500">Radio Category: </span>
                        <span className="text-neutral-300">{inspectedTrack.aiMetadata.category}</span>
                      </div>
                      <div>
                        <span className="text-neutral-500">Time of Day: </span>
                        <span className="text-neutral-300 uppercase">{inspectedTrack.aiMetadata.timeOfDay}</span>
                      </div>
                    </div>
                    {inspectedTrack.aiMetadata.introStyle && (
                      <div className="text-[11px] pt-1">
                        <span className="text-neutral-500 font-mono">Suggested DJ Intro: </span>
                        <span className="text-neutral-300">{inspectedTrack.aiMetadata.introStyle}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-4 rounded-lg bg-neutral-950 border border-dashed border-neutral-800 text-center">
                    <p className="text-xs text-neutral-400">Track has not yet been analyzed by Gemini.</p>
                    <button
                      onClick={() => handleAnalyzeTrack(inspectedTrack)}
                      className="mt-2 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium transition cursor-pointer"
                    >
                      Run Gemini Track Analysis
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
