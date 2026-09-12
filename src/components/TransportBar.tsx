import React from "react";
import {
  Play,
  Pause,
  Square,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Radio,
  Mic,
  Music2,
} from "lucide-react";
import { useAudioPlayer } from "../context/AudioPlayerContext.js";

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const hrs = Math.floor(mins / 60);
  if (hrs > 0) {
    const remMins = mins % 60;
    return `${hrs}:${remMins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export const TransportBar: React.FC = () => {
  const {
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    nowPlaying,
    vuLevelLeft,
    vuLevelRight,
    togglePlay,
    stop,
    seek,
    setVolume,
    toggleMute,
  } = useAudioPlayer();

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    seek(parseFloat(e.target.value));
  };

  const renderMeterSegments = (level: number) => {
    const totalSegments = 16;
    const activeSegments = Math.round(level * totalSegments);
    return (
      <div className="flex gap-[2px] h-3 items-center">
        {Array.from({ length: totalSegments }).map((_, i) => {
          const isActive = i < activeSegments;
          let colorClass = "bg-emerald-500";
          if (i >= 11 && i < 14) colorClass = "bg-amber-400";
          if (i >= 14) colorClass = "bg-rose-500";

          return (
            <div
              key={i}
              className={`w-[4px] h-full rounded-[1px] transition-opacity duration-75 ${
                isActive ? `${colorClass} opacity-100 shadow-[0_0_4px_currentColor]` : "bg-neutral-800 opacity-40"
              }`}
            />
          );
        })}
      </div>
    );
  };

  return (
    <footer
      id="transport-bar"
      className="fixed bottom-0 left-0 right-0 h-20 bg-neutral-950 border-t border-neutral-800/80 px-6 z-50 flex items-center justify-between shadow-2xl backdrop-blur select-none"
    >
      {/* Track Info (Left) */}
      <div className="w-1/4 flex items-center gap-3.5 min-w-0 pr-4">
        <div className="w-11 h-11 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center shrink-0 shadow-inner">
          {nowPlaying?.type === "announcement" ? (
            <Mic className="w-5 h-5 text-amber-400 animate-pulse" />
          ) : nowPlaying?.type === "track" ? (
            <Music2 className="w-5 h-5 text-cyan-400" />
          ) : (
            <Radio className="w-5 h-5 text-neutral-500" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              id="transport-now-title"
              className="text-sm font-semibold text-neutral-100 truncate tracking-wide"
            >
              {nowPlaying ? nowPlaying.title : "Studio Master Output Idle"}
            </span>
            {nowPlaying?.type === "announcement" && (
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Voice Link
              </span>
            )}
          </div>
          <p id="transport-now-artist" className="text-xs text-neutral-400 truncate mt-0.5">
            {nowPlaying ? `${nowPlaying.artist} • ${nowPlaying.genre || "Audio"}` : "Select a track or announcement to cue audition"}
          </p>
        </div>
      </div>

      {/* Main Transport & Scrubbing (Center) */}
      <div className="w-2/4 flex flex-col items-center max-w-2xl px-4">
        {/* Buttons */}
        <div className="flex items-center gap-4 mb-1.5">
          <button
            id="transport-btn-prev"
            onClick={() => seek(Math.max(0, currentTime - 10))}
            className="p-2 text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800/60 rounded-full transition"
            title="Rewind 10s"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          <button
            id="transport-btn-stop"
            onClick={stop}
            className="p-2 text-neutral-400 hover:text-rose-400 hover:bg-neutral-800/60 rounded-full transition"
            title="Stop"
          >
            <Square className="w-4 h-4" />
          </button>

          <button
            id="transport-btn-play"
            onClick={togglePlay}
            disabled={!nowPlaying}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition shadow-lg ${
              nowPlaying
                ? "bg-gradient-to-br from-cyan-500 to-blue-600 text-white hover:brightness-110 active:scale-95 cursor-pointer shadow-cyan-500/20"
                : "bg-neutral-800 text-neutral-600 cursor-not-allowed"
            }`}
            title={isPlaying ? "Pause (Space)" : "Play (Space)"}
          >
            {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
          </button>

          <button
            id="transport-btn-next"
            onClick={() => seek(Math.min(duration, currentTime + 10))}
            className="p-2 text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800/60 rounded-full transition"
            title="Forward 10s"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {/* Scrub Bar & Timecodes */}
        <div className="w-full flex items-center gap-3">
          <span id="transport-time-current" className="text-xs font-mono text-neutral-400 w-12 text-right">
            {formatTime(currentTime)}
          </span>
          <div className="relative flex-1 flex items-center group">
            <input
              id="transport-scrub-slider"
              type="range"
              min={0}
              max={duration || 100}
              step={0.1}
              value={currentTime}
              onChange={handleSeekChange}
              disabled={!nowPlaying}
              className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 hover:accent-cyan-300 focus:outline-none"
            />
          </div>
          <span id="transport-time-total" className="text-xs font-mono text-neutral-500 w-12">
            {formatTime(duration)}
          </span>
        </div>
      </div>

      {/* Level Meters & Master Volume (Right) */}
      <div className="w-1/4 flex items-center justify-end gap-6 pl-4">
        {/* Dual VU Meters */}
        <div className="hidden lg:flex flex-col gap-1 p-2 rounded-lg bg-neutral-900/90 border border-neutral-800 shadow-inner">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold text-neutral-400 w-2.5">L</span>
            {renderMeterSegments(vuLevelLeft)}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold text-neutral-400 w-2.5">R</span>
            {renderMeterSegments(vuLevelRight)}
          </div>
        </div>

        {/* Master Volume */}
        <div className="flex items-center gap-2.5">
          <button
            id="transport-btn-mute"
            onClick={toggleMute}
            className="p-1.5 text-neutral-400 hover:text-neutral-200 transition"
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <input
            id="transport-volume-slider"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={isMuted ? 0 : volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-20 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-neutral-300 hover:accent-white"
            title={`Volume: ${Math.round(volume * 100)}%`}
          />
          <span className="text-[11px] font-mono text-neutral-400 w-7">
            {isMuted ? "MUTE" : `${Math.round(volume * 100)}%`}
          </span>
        </div>
      </div>
    </footer>
  );
};
