import React from "react";
import {
  Radio,
  Music2,
  FolderOpen,
  Sparkles,
  Play,
  FileAudio,
  CheckCircle2,
  Clock,
  Mic,
  ArrowRight,
  Disc3,
  HardDrive,
} from "lucide-react";
import { AudioTrack, RadioShow, RenderJob } from "../types.js";
import { useAudioPlayer } from "../context/AudioPlayerContext.js";
import { TabType } from "./Sidebar.js";

interface DashboardViewProps {
  activeShow: RadioShow | null;
  tracks: AudioTrack[];
  renderJobs: RenderJob[];
  onNavigate: (tab: TabType) => void;
  onOpenGenerator: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  activeShow,
  tracks,
  renderJobs,
  onNavigate,
  onOpenGenerator,
}) => {
  const { playTrack, playCustomAudio } = useAudioPlayer();

  const totalDurationSec = tracks.reduce((acc, t) => acc + t.duration, 0);
  const totalHours = (totalDurationSec / 3600).toFixed(1);
  const genres = Array.from(new Set(tracks.map((t) => t.genre).filter(Boolean)));
  const completedRenders = renderJobs.filter((r) => r.status === "completed");

  return (
    <div id="dashboard-view" className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Top Banner: Studio Status */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-neutral-900 via-neutral-900/90 to-neutral-950 border border-neutral-800 p-7 shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold uppercase tracking-wider bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                Broadcasting Master Hub
              </span>
              <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                Live Automation
              </span>
            </div>
            <h2 className="text-2xl font-bold text-neutral-100 tracking-tight">
              AI Radio Show Creator Studio
            </h2>
            <p className="text-sm text-neutral-400 mt-1 max-w-2xl leading-relaxed">
              Automated radio production engine. Scan local storage for music, analyze tracks with Gemini,
              synthesize professional voice DJ announcements, and render broadcast-ready master files.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              id="dashboard-btn-generate-show"
              onClick={onOpenGenerator}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium text-sm flex items-center gap-2 shadow-lg shadow-cyan-500/25 transition cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Generate AI Show</span>
            </button>
            <button
              id="dashboard-btn-open-library"
              onClick={() => onNavigate("library")}
              className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-medium text-sm flex items-center gap-2 border border-neutral-700 transition cursor-pointer"
            >
              <FolderOpen className="w-4 h-4" />
              <span>Manage Library</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-neutral-900/60 border border-neutral-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase text-neutral-400">Library Assets</span>
            <Music2 className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-2xl font-bold text-neutral-100 mt-2 font-mono">{tracks.length}</p>
          <span className="text-xs text-neutral-400 mt-1 block">
            {totalHours} hrs total audio detected
          </span>
        </div>

        <div className="p-5 rounded-xl bg-neutral-900/60 border border-neutral-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase text-neutral-400">Genres & Tags</span>
            <Disc3 className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-2xl font-bold text-neutral-100 mt-2 font-mono">{genres.length}</p>
          <span className="text-xs text-neutral-400 mt-1 block truncate">
            {genres.slice(0, 3).join(", ") || "Electronic, Synthwave"}
          </span>
        </div>

        <div className="p-5 rounded-xl bg-neutral-900/60 border border-neutral-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase text-neutral-400">Active Show Tracks</span>
            <Radio className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-neutral-100 mt-2 font-mono">
            {activeShow?.tracks?.length || 0}
          </p>
          <span className="text-xs text-neutral-400 mt-1 block">
            {activeShow ? `${activeShow.announcements?.length || 0} voice links placed` : "No active project"}
          </span>
        </div>

        <div className="p-5 rounded-xl bg-neutral-900/60 border border-neutral-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase text-neutral-400">Master Exports</span>
            <FileAudio className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-neutral-100 mt-2 font-mono">
            {completedRenders.length}
          </p>
          <span className="text-xs text-neutral-400 mt-1 block">
            MP3 / WAV Broadcast files
          </span>
        </div>
      </div>

      {/* Main Split: Current Active Show & Recent Renders */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Active Show Workbench */}
        <div className="lg:col-span-2 rounded-xl bg-neutral-900/70 border border-neutral-800 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider">
                  Production Station
                </span>
                <h3 className="text-lg font-bold text-neutral-100 mt-0.5">
                  {activeShow ? activeShow.name : "No Show Selected"}
                </h3>
              </div>
              {activeShow && (
                <button
                  id="dashboard-btn-edit-active-show"
                  onClick={() => onNavigate("builder")}
                  className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-medium text-neutral-200 flex items-center gap-1.5 transition cursor-pointer"
                >
                  <span>Open Builder</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {activeShow ? (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3 p-3 rounded-lg bg-neutral-950/60 border border-neutral-800/80 text-xs font-mono">
                  <div>
                    <span className="text-neutral-400 block">Host & Station</span>
                    <span className="font-semibold text-neutral-200">
                      {activeShow.hostName || "Host"} • {activeShow.stationName || "Radio"}
                    </span>
                  </div>
                  <div>
                    <span className="text-neutral-400 block">Genre Focus</span>
                    <span className="font-semibold text-neutral-200">{activeShow.genre || "Electronic"}</span>
                  </div>
                  <div>
                    <span className="text-neutral-400 block">Target Runtime</span>
                    <span className="font-semibold text-neutral-200">
                      {Math.round(activeShow.targetDuration / 60)} minutes
                    </span>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-mono text-neutral-400 uppercase mb-2">
                    Running Order Preview ({activeShow.tracks?.length || 0} Tracks)
                  </h4>
                  <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                    {activeShow.tracks?.slice(0, 5).map((track, idx) => (
                      <div
                        key={track.id + idx}
                        className="flex items-center justify-between p-2 rounded-lg bg-neutral-950/40 hover:bg-neutral-800/40 border border-neutral-800/50 text-xs group transition"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-neutral-400 font-mono w-4">{idx + 1}</span>
                          <button
                            onClick={() => playTrack(track)}
                            className="w-6 h-6 rounded-full bg-neutral-800 flex items-center justify-center text-neutral-300 hover:text-cyan-400 transition shrink-0"
                            title="Audition track"
                          >
                            <Play className="w-3 h-3 fill-current ml-0.5" />
                          </button>
                          <div className="min-w-0">
                            <span className="font-medium text-neutral-200 truncate block">
                              {track.title}
                            </span>
                            <span className="text-[11px] text-neutral-400 truncate block">
                              {track.artist} • {track.genre}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 font-mono text-neutral-400 text-[11px]">
                          <span>{track.bpm ? `${track.bpm} BPM` : ""}</span>
                          <span>{Math.floor(track.duration / 60)}:{Math.floor(track.duration % 60).toString().padStart(2, "0")}</span>
                        </div>
                      </div>
                    ))}
                    {(activeShow.tracks?.length || 0) > 5 && (
                      <p className="text-center text-xs text-neutral-400 py-1">
                        + {(activeShow.tracks?.length || 0) - 5} more tracks in queue
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center border border-dashed border-neutral-800 rounded-xl">
                <Radio className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
                <p className="text-sm font-medium text-neutral-300">No Radio Show Project Loaded</p>
                <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
                  Create a new broadcast show or use the AI Show Generator to curate one from your library.
                </p>
                <button
                  onClick={() => onNavigate("shows")}
                  className="mt-4 px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-200 transition cursor-pointer"
                >
                  Create or Select Show
                </button>
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-neutral-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-neutral-400">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Non-destructive local library storage mode</span>
            </div>
            <button
              id="dashboard-btn-render"
              onClick={() => onNavigate("render")}
              disabled={!activeShow || (activeShow.tracks?.length || 0) === 0}
              className="px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:bg-neutral-800 text-white disabled:text-neutral-500 text-xs font-medium transition flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
            >
              <FileAudio className="w-3.5 h-3.5" />
              <span>Master & Render Show</span>
            </button>
          </div>
        </div>

        {/* Right 1 Col: Recent Exports */}
        <div className="rounded-xl bg-neutral-900/70 border border-neutral-800 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-mono uppercase text-neutral-300">
                Recent Broadcast Exports
              </h3>
              <button
                onClick={() => onNavigate("render")}
                className="text-xs text-cyan-400 hover:underline"
              >
                View all
              </button>
            </div>

            {completedRenders.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-neutral-800 rounded-lg">
                <FileAudio className="w-7 h-7 text-neutral-600 mx-auto mb-2" />
                <p className="text-xs text-neutral-400">No rendered broadcasts yet.</p>
                <p className="text-[11px] text-neutral-400 mt-1 px-4">
                  Once you build your show, render it here as MP3 or WAV.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {completedRenders.slice(0, 4).map((job) => (
                  <div
                    key={job.id}
                    className="p-3 rounded-lg bg-neutral-950/50 border border-neutral-800/80 text-xs flex items-center justify-between"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="font-semibold text-neutral-200 truncate">{job.showName}</p>
                      <div className="flex items-center gap-2 text-[11px] text-neutral-400 mt-0.5">
                        <span className="uppercase font-mono text-cyan-400">{job.format}</span>
                        <span>•</span>
                        <span>{job.fileSize ? `${(job.fileSize / 1024 / 1024).toFixed(1)} MB` : ""}</span>
                      </div>
                    </div>
                    {job.downloadUrl && (
                      <div className="flex items-center gap-1">
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
                          className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-cyan-400 transition"
                          title="Preview master file"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                        </button>
                        <a
                          href={job.downloadUrl}
                          download
                          className="px-2 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-[11px] font-mono transition"
                        >
                          DL
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-neutral-800/80 flex items-center justify-between text-xs text-neutral-400">
            <span className="flex items-center gap-1">
              <HardDrive className="w-3.5 h-3.5" />
              <span>Storage: Local SSD</span>
            </span>
            <span>EBU R128 Compliant</span>
          </div>
        </div>
      </div>
    </div>
  );
};
