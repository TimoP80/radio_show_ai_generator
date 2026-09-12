import React, { useState, useRef, useMemo } from "react";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Play,
  Pause,
  Music2,
  Mic,
  Clock,
  Layers,
  Sliders,
} from "lucide-react";
import { RadioShow } from "../types.js";
import { useAudioPlayer } from "../context/AudioPlayerContext.js";

interface TimelineViewProps {
  activeShow: RadioShow | null;
}

export const TimelineView: React.FC<TimelineViewProps> = ({ activeShow }) => {
  const { currentTime, duration, isPlaying, togglePlay, seek, playTrack, playAnnouncement } =
    useAudioPlayer();
  const [zoomLevel, setZoomLevel] = useState(1.0); // 0.5 (compact) to 3.0 (detailed)
  const timelineRef = useRef<HTMLDivElement | null>(null);

  if (!activeShow) {
    return (
      <div className="p-12 text-center text-neutral-400">
        Please select a Radio Show to view its Multitrack Timeline.
      </div>
    );
  }

  // Calculate layout of timeline blocks
  const { musicBlocks, voiceBlocks, totalLengthSec } = useMemo(() => {
    let currentMusicTime = 0;
    const mBlocks: Array<{
      id: string;
      title: string;
      artist: string;
      startTime: number;
      duration: number;
      endTime: number;
      trackObj: any;
      colorClass: string;
    }> = [];

    const colors = [
      "from-cyan-900/60 to-blue-900/70 border-cyan-500/50 text-cyan-200",
      "from-indigo-900/60 to-purple-900/70 border-indigo-500/50 text-indigo-200",
      "from-emerald-900/60 to-teal-900/70 border-emerald-500/50 text-emerald-200",
      "from-amber-900/60 to-orange-900/70 border-amber-500/50 text-amber-200",
    ];

    const crossfade = activeShow.renderSettings?.crossfadeDuration || 3;

    activeShow.tracks.forEach((track, i) => {
      const duration = track.duration;
      const startTime = Math.max(0, currentMusicTime - (i > 0 ? crossfade : 0));
      const endTime = startTime + duration;
      currentMusicTime = endTime;

      mBlocks.push({
        id: track.id + "_" + i,
        title: track.title,
        artist: track.artist,
        startTime,
        duration,
        endTime,
        trackObj: track,
        colorClass: colors[i % colors.length],
      });
    });

    const vBlocks: Array<{
      id: string;
      title: string;
      startTime: number;
      duration: number;
      annObj: any;
    }> = [];

    activeShow.announcements.forEach((ann, i) => {
      let startTime = 0;
      if (ann.placement === "intro") {
        startTime = 1;
      } else if (ann.placement === "outro") {
        startTime = Math.max(0, currentMusicTime - ann.duration - 2);
      } else {
        // Find corresponding track block
        const targetTrack = mBlocks[Math.min(ann.positionIndex, mBlocks.length - 1)];
        startTime = targetTrack ? targetTrack.startTime + 2 : i * 60;
      }

      vBlocks.push({
        id: ann.id,
        title: ann.title || "Voice Link",
        startTime,
        duration: ann.duration,
        annObj: ann,
      });
    });

    const maxTime = Math.max(
      activeShow.targetDuration || 3600,
      currentMusicTime + 10,
      duration || 60
    );

    return {
      musicBlocks: mBlocks,
      voiceBlocks: vBlocks,
      totalLengthSec: maxTime,
    };
  }, [activeShow, duration]);

  // Pixels per second based on zoomLevel
  // e.g. at zoom 1.0, 1 minute is 80px
  const pxPerSec = (80 / 60) * zoomLevel;
  const totalWidthPx = Math.max(1200, totalLengthSec * pxPerSec);

  // Handle timeline click to seek
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left + timelineRef.current.scrollLeft;
    const clickedSec = Math.max(0, clickX / pxPerSec);
    seek(clickedSec);
  };

  // Generate ruler markers every 1 minute or 30s
  const rulerIntervalSec = zoomLevel < 0.8 ? 120 : zoomLevel > 1.8 ? 30 : 60;
  const rulerMarkers: number[] = [];
  for (let s = 0; s <= totalLengthSec; s += rulerIntervalSec) {
    rulerMarkers.push(s);
  }

  const formatRulerTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div id="timeline-view" className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono uppercase text-cyan-400 font-semibold tracking-wider">
              Multitrack Broadcast Canvas
            </span>
          </div>
          <h2 className="text-2xl font-bold text-neutral-100 tracking-tight">
            Radio Timeline: {activeShow.name}
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Interactive DAW timeline. Inspect music crossfades, voice ducking overlays, and scrub audio playhead.
          </p>
        </div>

        {/* Zoom & View Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoomLevel((z) => Math.max(0.4, z - 0.25))}
            className="p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono text-neutral-400 w-12 text-center">
            {Math.round(zoomLevel * 100)}%
          </span>
          <button
            onClick={() => setZoomLevel((z) => Math.min(3.0, z + 0.25))}
            className="p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoomLevel(1.0)}
            className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-mono text-neutral-300 transition"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Main Multitrack Canvas Area */}
      <div className="rounded-2xl bg-neutral-950 border border-neutral-800 overflow-hidden shadow-2xl flex">
        {/* Left Track Headers (DAW Style) */}
        <div className="w-48 shrink-0 bg-neutral-900 border-r border-neutral-800 flex flex-col z-20 shadow-md">
          {/* Ruler Corner */}
          <div className="h-9 border-b border-neutral-800 px-3 flex items-center justify-between text-[10px] font-mono text-neutral-400">
            <span>TRACK / BUS</span>
            <span>LEVEL</span>
          </div>

          {/* Track 1 Header: Music Bus */}
          <div className="h-28 border-b border-neutral-800/80 p-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <Music2 className="w-3.5 h-3.5 text-cyan-400" />
                <span className="font-semibold text-neutral-200 text-xs">CH 1: Music Bed</span>
              </div>
              <p className="text-[10px] text-neutral-500 mt-0.5">Continuous Crossfades</p>
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono text-neutral-400">
              <span className="px-1.5 py-0.5 rounded bg-neutral-800 text-cyan-300">0.0 dB</span>
              <span>Stereo</span>
            </div>
          </div>

          {/* Track 2 Header: DJ Voice */}
          <div className="h-28 border-b border-neutral-800/80 p-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <Mic className="w-3.5 h-3.5 text-amber-400" />
                <span className="font-semibold text-neutral-200 text-xs">CH 2: DJ Voice Link</span>
              </div>
              <p className="text-[10px] text-neutral-500 mt-0.5">Auto-Ducking Bed</p>
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono text-neutral-400">
              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                Duck -12dB
              </span>
              <span>Voice</span>
            </div>
          </div>
        </div>

        {/* Scrollable Tracks Canvas with Time Ruler & Playhead */}
        <div
          ref={timelineRef}
          onClick={handleTimelineClick}
          className="flex-1 overflow-x-auto relative cursor-pointer select-none bg-neutral-950/90"
        >
          <div style={{ width: `${totalWidthPx}px` }} className="relative min-h-[232px]">
            {/* 1. Time Ruler */}
            <div className="h-9 border-b border-neutral-800 bg-neutral-900/70 flex items-center relative sticky top-0 z-10">
              {rulerMarkers.map((sec) => (
                <div
                  key={sec}
                  style={{ left: `${sec * pxPerSec}px` }}
                  className="absolute top-0 bottom-0 border-l border-neutral-800 flex flex-col justify-between pl-1 text-[10px] font-mono text-neutral-500 pointer-events-none"
                >
                  <span>{formatRulerTime(sec)}</span>
                  <div className="w-[1px] h-2 bg-neutral-700" />
                </div>
              ))}
            </div>

            {/* Vertical Grid Lines */}
            {rulerMarkers.map((sec) => (
              <div
                key={"grid_" + sec}
                style={{ left: `${sec * pxPerSec}px` }}
                className="absolute top-9 bottom-0 w-[1px] bg-neutral-900/50 pointer-events-none"
              />
            ))}

            {/* 2. CH 1: Music Track Blocks */}
            <div className="h-28 border-b border-neutral-800/80 relative p-2">
              {musicBlocks.map((block) => (
                <div
                  key={block.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    playTrack(block.trackObj);
                  }}
                  style={{
                    left: `${block.startTime * pxPerSec}px`,
                    width: `${Math.max(40, block.duration * pxPerSec)}px`,
                  }}
                  className={`absolute top-2 bottom-2 rounded-lg bg-gradient-to-r ${block.colorClass} border p-2 flex flex-col justify-between overflow-hidden shadow-sm hover:brightness-110 transition cursor-pointer group`}
                  title={`${block.title} by ${block.artist} (${Math.round(block.duration)}s)`}
                >
                  <div className="min-w-0">
                    <span className="font-bold text-xs truncate block">{block.title}</span>
                    <span className="text-[10px] opacity-80 truncate block">{block.artist}</span>
                  </div>

                  {/* Simulated Waveform Silhouette */}
                  <div className="flex items-end gap-[1px] h-4 opacity-50 overflow-hidden">
                    {Array.from({ length: 30 }).map((_, w) => (
                      <div
                        key={w}
                        style={{ height: `${(Math.sin(w * 0.8) * 0.5 + 0.5) * 100}%` }}
                        className="w-1 bg-white/70 rounded-xs"
                      />
                    ))}
                  </div>

                  <div className="flex items-center justify-between text-[9px] font-mono opacity-75">
                    <span>{formatRulerTime(block.startTime)}</span>
                    <span>{Math.round(block.duration)}s</span>
                  </div>
                </div>
              ))}
            </div>

            {/* 3. CH 2: Spoken DJ Announcements Track Blocks */}
            <div className="h-28 border-b border-neutral-800/80 relative p-2">
              {voiceBlocks.map((vBlock) => (
                <div
                  key={vBlock.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (vBlock.annObj.audioUrl) {
                      playAnnouncement(vBlock.annObj);
                    }
                  }}
                  style={{
                    left: `${vBlock.startTime * pxPerSec}px`,
                    width: `${Math.max(60, vBlock.duration * pxPerSec)}px`,
                  }}
                  className="absolute top-3 bottom-3 rounded-lg bg-gradient-to-r from-amber-600/70 to-orange-600/70 border border-amber-400/70 p-2 text-white flex flex-col justify-between overflow-hidden shadow-md hover:brightness-110 transition cursor-pointer"
                  title={`DJ Voice Link: ${vBlock.title} (~${vBlock.duration}s)`}
                >
                  <div className="flex items-center gap-1">
                    <Mic className="w-3 h-3 text-amber-200 shrink-0" />
                    <span className="font-bold text-xs truncate text-amber-100">
                      {vBlock.title}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-amber-200">
                    ~{vBlock.duration}s (Ducks music)
                  </span>
                </div>
              ))}
            </div>

            {/* 4. Real-time Animated Playhead */}
            <div
              style={{ left: `${currentTime * pxPerSec}px` }}
              className="absolute top-0 bottom-0 w-[2px] bg-cyan-400 z-30 pointer-events-none shadow-[0_0_12px_#22d3ee] transition-all duration-75"
            >
              <div className="w-3 h-3 -ml-[5px] bg-cyan-400 rounded-full shadow-lg" />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Playback Bar at Bottom of Timeline */}
      <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={togglePlay}
            className="w-10 h-10 rounded-full bg-cyan-500 hover:bg-cyan-400 text-white flex items-center justify-center transition shadow-lg shadow-cyan-500/20"
          >
            {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
          </button>
          <div>
            <span className="text-xs font-mono text-neutral-400">Playhead Position</span>
            <p className="text-base font-bold font-mono text-neutral-100">
              {formatRulerTime(currentTime)} / {formatRulerTime(totalLengthSec)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono text-neutral-400">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-cyan-500/60 border border-cyan-400" />
            <span>Music Audio</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-500/60 border border-amber-400" />
            <span>DJ Voice Overlay</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500/60 border border-indigo-400" />
            <span>Crossfade Overlap (3s)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
