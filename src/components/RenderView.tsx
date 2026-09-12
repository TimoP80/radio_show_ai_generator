import React, { useState, useEffect } from "react";
import {
  FileAudio,
  Download,
  Play,
  CheckCircle2,
  Clock,
  Sparkles,
  Sliders,
  RefreshCw,
  Radio,
  Volume2,
  HardDrive,
  AlertTriangle,
} from "lucide-react";
import { RadioShow, RenderJob, RenderSettings } from "../types.js";
import { api } from "../services/api.js";
import { useAudioPlayer } from "../context/AudioPlayerContext.js";

interface RenderViewProps {
  activeShow: RadioShow | null;
  renderJobs: RenderJob[];
  onRefreshJobs: () => void;
}

export const RenderView: React.FC<RenderViewProps> = ({
  activeShow,
  renderJobs,
  onRefreshJobs,
}) => {
  const { playCustomAudio } = useAudioPlayer();

  // Export settings state
  const [format, setFormat] = useState<"mp3" | "wav">(
    activeShow?.renderSettings?.format || "mp3"
  );
  const [bitrate, setBitrate] = useState<"192k" | "256k" | "320k">(
    activeShow?.renderSettings?.bitrate || "320k"
  );
  const [sampleRate, setSampleRate] = useState<44100 | 48000>(
    activeShow?.renderSettings?.sampleRate || 44100
  );
  const [normalizeAudio, setNormalizeAudio] = useState(
    activeShow?.renderSettings?.normalizeAudio ?? true
  );
  const [crossfadeSec, setCrossfadeSec] = useState(
    activeShow?.renderSettings?.crossfadeDuration || 3
  );

  // Active rendering state
  const [currentJob, setCurrentJob] = useState<RenderJob | null>(null);
  const [isRendering, setIsRendering] = useState(false);

  // Polling for active render status
  useEffect(() => {
    let timer: any = null;
    if (isRendering && currentJob) {
      timer = setInterval(async () => {
        try {
          const jobs = await api.getRenderJobs();
          const match = jobs.find((j) => j.id === currentJob.id);
          if (match) {
            setCurrentJob(match);
            if (match.status === "completed" || match.status === "error") {
              setIsRendering(false);
              onRefreshJobs();
            }
          }
        } catch (_) {}
      }, 1200);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isRendering, currentJob, onRefreshJobs]);

  const handleStartRender = async () => {
    if (!activeShow) {
      alert("Please select a radio show to render.");
      return;
    }
    if (activeShow.tracks.length === 0) {
      alert("Your radio show has no tracks. Add tracks in Show Builder before rendering.");
      return;
    }

    setIsRendering(true);
    const options: RenderSettings = {
      format,
      bitrate,
      sampleRate,
      normalizeAudio,
      crossfadeDuration: crossfadeSec,
      duckingLevel: 0.25,
    };

    try {
      const job = await api.startRender(activeShow, options);
      setCurrentJob(job);
      onRefreshJobs();
    } catch (err: any) {
      alert("Failed to start render job: " + err.message);
      setIsRendering(false);
    }
  };

  const totalTrackSec = (activeShow?.tracks || []).reduce((acc, t) => acc + t.duration, 0);
  const totalVoiceSec = (activeShow?.announcements || []).reduce((acc, a) => acc + a.duration, 0);
  const estTotalSec = totalTrackSec + totalVoiceSec;
  const estMin = Math.round(estTotalSec / 60);

  return (
    <div id="render-view" className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <span className="text-xs font-mono uppercase text-cyan-400 font-semibold tracking-wider">
          Broadcast Export & Mastering
        </span>
        <h2 className="text-2xl font-bold text-neutral-100 tracking-tight">
          Master Audio Renderer
        </h2>
        <p className="text-xs text-neutral-400 mt-0.5">
          Assemble the continuous radio show with automated crossfading, voice ducking overlays, and broadcast loudness mastering.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Active Project Export Configuration */}
        <div className="lg:col-span-2 space-y-6">
          <div className="p-6 rounded-2xl bg-neutral-900/70 border border-neutral-800 space-y-5 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div>
                <span className="text-xs font-mono uppercase text-neutral-400">Target Project</span>
                <h3 className="text-lg font-bold text-neutral-100">
                  {activeShow ? activeShow.name : "No Show Selected"}
                </h3>
              </div>
              <div className="text-right text-xs font-mono">
                <span className="text-neutral-400 block">Est. Broadcast Runtime</span>
                <span className="text-cyan-400 font-bold text-sm">~{estMin} minutes</span>
              </div>
            </div>

            {/* Export Settings Form */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              {/* Format */}
              <div>
                <label className="font-mono text-neutral-400 block mb-1">Export Audio Format</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormat("mp3")}
                    className={`py-2 px-3 rounded-lg border font-mono transition ${
                      format === "mp3"
                        ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/50"
                        : "bg-neutral-950 border-neutral-800 text-neutral-400"
                    }`}
                  >
                    MP3 (Broadcast)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormat("wav")}
                    className={`py-2 px-3 rounded-lg border font-mono transition ${
                      format === "wav"
                        ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/50"
                        : "bg-neutral-950 border-neutral-800 text-neutral-400"
                    }`}
                  >
                    WAV (Lossless Master)
                  </button>
                </div>
              </div>

              {/* Bitrate (if MP3) */}
              <div>
                <label className="font-mono text-neutral-400 block mb-1">
                  Encoding Quality / Bitrate
                </label>
                <select
                  value={bitrate}
                  onChange={(e) => setBitrate(e.target.value as any)}
                  disabled={format === "wav"}
                  className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-neutral-200 focus:outline-none disabled:opacity-40"
                >
                  <option value="320k">320 kbps (Studio Master Quality)</option>
                  <option value="256k">256 kbps (High Broadcast Standard)</option>
                  <option value="192k">192 kbps (Internet Radio Stream)</option>
                </select>
              </div>

              {/* Sample Rate */}
              <div>
                <label className="font-mono text-neutral-400 block mb-1">Sample Rate</label>
                <select
                  value={sampleRate}
                  onChange={(e) => setSampleRate(parseInt(e.target.value, 10) as any)}
                  className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-neutral-200 focus:outline-none font-mono"
                >
                  <option value={44100}>44,100 Hz (CD Audio Standard)</option>
                  <option value={48000}>48,000 Hz (Professional Studio)</option>
                </select>
              </div>

              {/* Crossfade */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-mono text-neutral-400">Track Crossfade Overlap</label>
                  <span className="font-mono text-cyan-400">{crossfadeSec}s</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={8}
                  step={0.5}
                  value={crossfadeSec}
                  onChange={(e) => setCrossfadeSec(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
              </div>
            </div>

            {/* Normalization Checkbox */}
            <div className="pt-2 border-t border-neutral-800">
              <label className="flex items-center gap-2.5 text-xs text-neutral-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={normalizeAudio}
                  onChange={(e) => setNormalizeAudio(e.target.checked)}
                  className="rounded bg-neutral-950 border-neutral-800 text-cyan-500 focus:ring-0"
                />
                <div>
                  <span className="font-semibold text-neutral-200 block">
                    EBU R128 Broadcast Loudness Normalization
                  </span>
                  <span className="text-[11px] text-neutral-500 block">
                    Balances volume across mixed tracks and voice links to prevent jarring level jumps.
                  </span>
                </div>
              </label>
            </div>

            {/* Render Button */}
            <div className="pt-3 border-t border-neutral-800 flex items-center justify-between">
              <div className="text-xs text-neutral-400">
                <span>
                  {activeShow?.tracks?.length || 0} tracks + {activeShow?.announcements?.length || 0} voice links
                </span>
              </div>

              <button
                id="render-btn-start"
                onClick={handleStartRender}
                disabled={isRendering || !activeShow || (activeShow.tracks?.length || 0) === 0}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-sm flex items-center gap-2 shadow-xl shadow-cyan-500/25 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FileAudio className="w-4 h-4" />
                <span>
                  {isRendering ? "Rendering Show in FFmpeg..." : "Render Complete Broadcast Show"}
                </span>
              </button>
            </div>
          </div>

          {/* Render Progress Console */}
          {currentJob && (
            <div className="p-6 rounded-2xl bg-neutral-900/80 border border-neutral-800 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RefreshCw
                    className={`w-4 h-4 text-cyan-400 ${
                      currentJob.status === "processing" ? "animate-spin" : ""
                    }`}
                  />
                  <span className="text-xs font-mono font-bold uppercase text-neutral-200">
                    Render Status: {currentJob.status}
                  </span>
                </div>
                <span className="text-xs font-mono text-cyan-400 font-bold">
                  {currentJob.progress}%
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-neutral-950 h-2 rounded-full overflow-hidden border border-neutral-800">
                <div
                  className={`h-full transition-all duration-300 ${
                    currentJob.status === "error"
                      ? "bg-rose-500"
                      : currentJob.status === "completed"
                      ? "bg-emerald-500"
                      : "bg-cyan-500"
                  }`}
                  style={{ width: `${currentJob.progress}%` }}
                />
              </div>

              {/* Console Logs */}
              <div className="p-3.5 rounded-lg bg-neutral-950 border border-neutral-800 max-h-40 overflow-y-auto space-y-1 font-mono text-[11px] text-neutral-400">
                {(currentJob.logs || []).map((log, i) => (
                  <div key={i} className="leading-tight">
                    {log}
                  </div>
                ))}
              </div>

              {/* Completed Action */}
              {currentJob.status === "completed" && currentJob.downloadUrl && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-950/20 border border-emerald-800/40 text-xs">
                  <div className="flex items-center gap-2 text-emerald-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Broadcast file generated successfully!</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        playCustomAudio({
                          id: currentJob.id,
                          title: currentJob.showName,
                          artist: "Broadcast Master Export",
                          audioUrl: currentJob.downloadUrl!,
                          duration: currentJob.duration || 300,
                          type: "render",
                        })
                      }
                      className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium flex items-center gap-1.5 transition"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Audition Master</span>
                    </button>
                    <a
                      href={currentJob.downloadUrl}
                      download
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Master</span>
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right 1 Col: Render History */}
        <div className="p-6 rounded-2xl bg-neutral-900/70 border border-neutral-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-mono uppercase text-neutral-300 font-bold">
                Exported Broadcast Archive
              </h3>
              <button
                onClick={onRefreshJobs}
                className="text-neutral-400 hover:text-neutral-200 transition"
                title="Refresh history"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {renderJobs.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-neutral-800 rounded-xl">
                <FileAudio className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
                <p className="text-xs text-neutral-400">No export history yet.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {renderJobs.map((job) => (
                  <div
                    key={job.id}
                    className="p-3 rounded-xl bg-neutral-950/70 border border-neutral-800/80 text-xs space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-neutral-200 truncate pr-2">
                        {job.showName}
                      </span>
                      <span
                        className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded ${
                          job.status === "completed"
                            ? "bg-emerald-500/20 text-emerald-300"
                            : job.status === "error"
                            ? "bg-rose-500/20 text-rose-300"
                            : "bg-cyan-500/20 text-cyan-300"
                        }`}
                      >
                        {job.status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-mono text-neutral-400">
                      <span>
                        {job.format.toUpperCase()} • {job.fileSize ? `${(job.fileSize / 1024 / 1024).toFixed(1)} MB` : "—"}
                      </span>
                      <span>{new Date(job.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>

                    {job.status === "completed" && job.downloadUrl && (
                      <div className="flex items-center justify-end gap-2 pt-1 border-t border-neutral-800/80">
                        <button
                          onClick={() =>
                            playCustomAudio({
                              id: job.id,
                              title: job.showName,
                              artist: "Broadcast Master Export",
                              audioUrl: job.downloadUrl!,
                              duration: job.duration || 300,
                              type: "render",
                            })
                          }
                          className="p-1 text-cyan-400 hover:text-cyan-300"
                          title="Audition"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                        </button>
                        <a
                          href={job.downloadUrl}
                          download
                          className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-[11px] font-mono transition"
                        >
                          Download
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-neutral-800 text-[11px] text-neutral-400 font-mono flex items-center justify-between">
            <span>Broadcast Standard</span>
            <span className="text-emerald-400">FFmpeg 6+ Native</span>
          </div>
        </div>
      </div>
    </div>
  );
};
