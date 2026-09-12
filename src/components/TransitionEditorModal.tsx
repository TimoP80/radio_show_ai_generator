import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Play,
  Pause,
  RotateCcw,
  Sliders,
  Sparkles,
  Volume2,
  Check,
  Radio,
  Zap,
  Scissors,
  Layers,
  ArrowRight,
  Info,
  Clock,
} from "lucide-react";
import {
  TrackTransition,
  TransitionType,
  CrossfadeCurve,
  CutStyle,
  EQSwapStyle,
  AudioTrack,
} from "../types.js";
import { api } from "../services/api.js";

interface TransitionEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  transition: TrackTransition;
  fromTrack: AudioTrack;
  toTrack: AudioTrack;
  onSaveTransition: (updated: TrackTransition) => void;
  onApplyToAll?: (transition: TrackTransition) => void;
}

export const TransitionEditorModal: React.FC<TransitionEditorModalProps> = ({
  isOpen,
  onClose,
  transition: initialTransition,
  fromTrack,
  toTrack,
  onSaveTransition,
  onApplyToAll,
}) => {
  // Local state for editing
  const [transition, setTransition] = useState<TrackTransition>(initialTransition);
  const [applyToAllSuccess, setApplyToAllSuccess] = useState(false);

  // Sync state if initialTransition prop changes
  useEffect(() => {
    setTransition(initialTransition);
  }, [initialTransition]);

  // Audio Audition Engine State
  const [isAuditioning, setIsAuditioning] = useState(false);
  const [auditionProgress, setAuditionProgress] = useState(0); // 0 to 100
  const [auditionPhase, setAuditionPhase] = useState<"prep" | "outgoing" | "transition" | "incoming">("prep");
  const [deckAVolume, setDeckAVolume] = useState(1);
  const [deckBVolume, setDeckBVolume] = useState(0);

  const audioDeckARef = useRef<HTMLAudioElement | null>(null);
  const audioDeckBRef = useRef<HTMLAudioElement | null>(null);
  const auditionTimerRef = useRef<number | null>(null);
  const auditionStartTimeRef = useRef<number>(0);

  // Stop audition audio on unmount or close
  const stopAudition = () => {
    if (auditionTimerRef.current) {
      clearInterval(auditionTimerRef.current);
      auditionTimerRef.current = null;
    }
    if (audioDeckARef.current) {
      audioDeckARef.current.pause();
      audioDeckARef.current.currentTime = 0;
    }
    if (audioDeckBRef.current) {
      audioDeckBRef.current.pause();
      audioDeckBRef.current.currentTime = 0;
    }
    setIsAuditioning(false);
    setAuditionProgress(0);
    setAuditionPhase("prep");
    setDeckAVolume(1);
    setDeckBVolume(0);
  };

  useEffect(() => {
    if (!isOpen) {
      stopAudition();
    }
  }, [isOpen]);

  // Calculate BPM metrics
  const fromBpm = fromTrack.bpm;
  const toBpm = toTrack.bpm;
  const bpmDiff = fromBpm && toBpm ? toBpm - fromBpm : null;
  const bpmPctDiff = fromBpm && toBpm ? Math.round(((toBpm - fromBpm) / fromBpm) * 1000) / 10 : null;

  // Beat match calculated duration based on bars and BPM
  const effectiveBpm = fromBpm || toBpm || 128;
  const bars = transition.beatAlignBars || 8;
  const beatsPerBar = 4;
  const totalBeats = bars * beatsPerBar;
  const calculatedBeatMatchSec = Math.round(((60 / effectiveBpm) * totalBeats) * 10) / 10;

  // Effective transition duration for preview
  const effectiveDuration =
    transition.type === "crossfade"
      ? transition.duration
      : transition.type === "beat_match"
      ? calculatedBeatMatchSec
      : (transition.pauseDuration || 0);

  // Start Interactive Audition
  const startAudition = () => {
    stopAudition();

    const preRoll = 3.5; // seconds before transition starts
    const postRoll = 4.0; // seconds after transition completes
    const transDuration = Math.max(0.5, effectiveDuration);
    const totalAuditionLength = preRoll + transDuration + postRoll;

    const streamUrlA = api.getTrackStreamUrl(fromTrack.id);
    const streamUrlB = api.getTrackStreamUrl(toTrack.id);

    const deckA = new Audio(streamUrlA);
    const deckB = new Audio(streamUrlB);
    audioDeckARef.current = deckA;
    audioDeckBRef.current = deckB;

    // Outgoing cue point: end of track minus (preRoll + transDuration)
    const cueA = Math.max(0, fromTrack.duration - (preRoll + transDuration));
    deckA.currentTime = cueA;
    deckA.volume = 1;

    deckB.currentTime = 0;
    deckB.volume = 0;

    setIsAuditioning(true);
    setAuditionPhase("outgoing");
    auditionStartTimeRef.current = Date.now();

    deckA.play().catch((err) => {
      console.warn("Autoplay error on Deck A:", err);
    });

    let deckBStarted = false;

    auditionTimerRef.current = window.setInterval(() => {
      const elapsed = (Date.now() - auditionStartTimeRef.current) / 1000;
      const progress = Math.min(100, Math.round((elapsed / totalAuditionLength) * 100));
      setAuditionProgress(progress);

      if (elapsed < preRoll) {
        // Phase 1: Pure Outgoing Track A
        setAuditionPhase("outgoing");
        setDeckAVolume(1);
        setDeckBVolume(0);
        deckA.volume = 1;
        deckB.volume = 0;
      } else if (elapsed >= preRoll && elapsed < preRoll + transDuration) {
        // Phase 2: Active Transition Window
        setAuditionPhase("transition");
        const transElapsed = elapsed - preRoll;
        const normalized = Math.min(1, Math.max(0, transElapsed / transDuration));

        if (!deckBStarted) {
          deckBStarted = true;
          deckB.currentTime = 0;
          deckB.play().catch((err) => console.warn("Deck B play error:", err));
        }

        if (transition.type === "crossfade") {
          let volA = 1 - normalized;
          let volB = normalized;

          if (transition.curve === "equal_power") {
            volA = Math.cos((normalized * Math.PI) / 2);
            volB = Math.sin((normalized * Math.PI) / 2);
          } else if (transition.curve === "exponential") {
            volA = Math.pow(1 - normalized, 1.8);
            volB = Math.pow(normalized, 1.8);
          } else if (transition.curve === "s_curve") {
            const s = (1 - Math.cos(normalized * Math.PI)) / 2;
            volA = 1 - s;
            volB = s;
          }

          setDeckAVolume(volA);
          setDeckBVolume(volB);
          deckA.volume = Math.max(0, Math.min(1, volA));
          deckB.volume = Math.max(0, Math.min(1, volB));
        } else if (transition.type === "beat_match") {
          // Club beat match: incoming joins in, outgoing fades bass/volume
          const volA = Math.cos((normalized * Math.PI) / 2);
          const volB = Math.sin((normalized * Math.PI) / 2);
          setDeckAVolume(volA);
          setDeckBVolume(volB);
          deckA.volume = Math.max(0, Math.min(1, volA));
          deckB.volume = Math.max(0, Math.min(1, volB));
        } else {
          // Cut
          if (normalized < 0.5) {
            setDeckAVolume(1);
            setDeckBVolume(0);
            deckA.volume = 1;
            deckB.volume = 0;
          } else {
            setDeckAVolume(0);
            setDeckBVolume(1);
            deckA.volume = 0;
            deckB.volume = 1;
          }
        }
      } else if (elapsed >= preRoll + transDuration && elapsed < totalAuditionLength) {
        // Phase 3: Incoming Track B Playing Solo
        setAuditionPhase("incoming");
        setDeckAVolume(0);
        setDeckBVolume(1);
        deckA.volume = 0;
        deckB.volume = 1;
        if (!deckA.paused) deckA.pause();
      } else {
        // Audition complete
        stopAudition();
      }
    }, 50);
  };

  // Auto-Detect Optimal Transition for this track pair
  const handleAutoSuggestTransition = () => {
    let suggestedType: TransitionType = "crossfade";
    let duration = 4.0;
    let curve: CrossfadeCurve = "equal_power";
    let cutStyle: CutStyle = "instant";
    let beatBars: 4 | 8 | 16 | 32 = 8;
    let notes = "";

    const eA = fromTrack.energy || 5;
    const eB = toTrack.energy || 5;
    const energyDelta = Math.abs(eB - eA);

    if (fromBpm && toBpm && Math.abs(fromBpm - toBpm) <= 6) {
      // Very close BPM -> Prime candidate for beat match!
      suggestedType = "beat_match";
      beatBars = 8;
      notes = `Matched on ~${Math.round((fromBpm + toBpm) / 2)} BPM (${Math.abs(fromBpm - toBpm)} BPM delta). 8-bar harmonic blend recommended.`;
    } else if (fromBpm && toBpm && Math.abs(fromBpm - toBpm) > 15) {
      // Large tempo jump -> Cut is much cleaner than dragging tempo
      suggestedType = "cut";
      cutStyle = "instant";
      notes = `High tempo divergence (${fromBpm} to ${toBpm} BPM). Hard drop cut recommended to avoid tempo dissonance.`;
    } else if (energyDelta >= 4) {
      // Big energy jump
      suggestedType = "cut";
      cutStyle = "reverb_tail";
      notes = `Significant energy shift (${eA} -> ${eB}). Reverb tail cut creates high drama.`;
    } else {
      // Smooth crossfade
      suggestedType = "crossfade";
      duration = 4.0;
      curve = "equal_power";
      notes = `Even energy curve. Standard 4.0s equal-power broadcast crossfade recommended.`;
    }

    setTransition((prev) => ({
      ...prev,
      type: suggestedType,
      duration,
      curve,
      cutStyle,
      beatAlignBars: beatBars,
      notes,
    }));
  };

  const handleSave = () => {
    stopAudition();
    onSaveTransition(transition);
    onClose();
  };

  const handleApplyAll = () => {
    if (onApplyToAll) {
      onApplyToAll(transition);
      setApplyToAllSuccess(true);
      setTimeout(() => setApplyToAllSuccess(false), 2500);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="transition-editor-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
    >
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-neutral-800/80 flex items-center justify-between sticky top-0 bg-neutral-900/95 backdrop-blur z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-100 flex items-center gap-2">
                Transition Editor
                <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-neutral-800 text-neutral-400">
                  Track-to-Track DJ Link
                </span>
              </h3>
              <p className="text-xs text-neutral-400">
                Configure audio overlap, beat synchronization, or drop-cut style between tracks.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopAudition();
              onClose();
            }}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 flex-1">
          {/* Deck A -> Deck B Visual Matcher */}
          <div className="p-4 rounded-xl bg-neutral-950/70 border border-neutral-800 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
              {/* Outgoing Deck A */}
              <div className="p-3 rounded-lg bg-neutral-900 border border-neutral-800/80 space-y-1">
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-cyan-400 font-bold">DECK A • OUTGOING</span>
                  <span className="px-1.5 py-0.2 rounded bg-neutral-800 text-neutral-300">
                    {fromTrack.bpm ? `${fromTrack.bpm} BPM` : "BPM N/A"}
                  </span>
                </div>
                <div className="font-semibold text-neutral-100 text-xs truncate">
                  {fromTrack.title}
                </div>
                <div className="flex items-center justify-between text-[11px] text-neutral-400">
                  <span className="truncate">{fromTrack.artist}</span>
                  {fromTrack.energy && (
                    <span className="font-mono text-amber-300">NRG {fromTrack.energy}/10</span>
                  )}
                </div>
              </div>

              {/* Incoming Deck B */}
              <div className="p-3 rounded-lg bg-neutral-900 border border-neutral-800/80 space-y-1">
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-emerald-400 font-bold">DECK B • INCOMING</span>
                  <span className="px-1.5 py-0.2 rounded bg-neutral-800 text-neutral-300">
                    {toTrack.bpm ? `${toTrack.bpm} BPM` : "BPM N/A"}
                  </span>
                </div>
                <div className="font-semibold text-neutral-100 text-xs truncate">
                  {toTrack.title}
                </div>
                <div className="flex items-center justify-between text-[11px] text-neutral-400">
                  <span className="truncate">{toTrack.artist}</span>
                  {toTrack.energy && (
                    <span className="font-mono text-emerald-300">NRG {toTrack.energy}/10</span>
                  )}
                </div>
              </div>
            </div>

            {/* Tempo & Harmonic Diagnostic Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] font-mono border-t border-neutral-800/60 text-neutral-400">
              <div className="flex items-center gap-2">
                <span>Tempo Delta:</span>
                {bpmDiff !== null ? (
                  <span
                    className={`font-bold ${
                      Math.abs(bpmDiff) <= 4
                        ? "text-emerald-400"
                        : Math.abs(bpmDiff) <= 10
                        ? "text-amber-400"
                        : "text-rose-400"
                    }`}
                  >
                    {bpmDiff > 0 ? `+${bpmDiff}` : bpmDiff} BPM ({bpmPctDiff > 0 ? `+${bpmPctDiff}` : bpmPctDiff}%)
                  </span>
                ) : (
                  <span className="text-neutral-500">Unanalyzed</span>
                )}
              </div>

              <button
                type="button"
                onClick={handleAutoSuggestTransition}
                className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-cyan-300 flex items-center gap-1.5 transition text-[11px] font-sans cursor-pointer"
                title="Automatically recommend best transition based on BPM and energy profiles"
              >
                <Sparkles className="w-3 h-3 text-cyan-400" />
                <span>AI Recommend Transition</span>
              </button>
            </div>
            {transition.notes && (
              <p className="text-[11px] text-cyan-400/90 font-mono bg-cyan-950/20 p-2 rounded border border-cyan-900/30">
                💡 {transition.notes}
              </p>
            )}
          </div>

          {/* Transition Type Selector */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-neutral-300 uppercase font-mono tracking-wider">
              Transition Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              {/* Crossfade Pill */}
              <button
                type="button"
                onClick={() => setTransition((prev) => ({ ...prev, type: "crossfade" }))}
                className={`p-3 rounded-xl border flex flex-col items-center justify-center text-center gap-1.5 transition cursor-pointer ${
                  transition.type === "crossfade"
                    ? "bg-cyan-500/15 border-cyan-500 text-cyan-200 shadow-md shadow-cyan-500/10"
                    : "bg-neutral-950/60 border-neutral-800 hover:border-neutral-700 text-neutral-400"
                }`}
              >
                <Zap className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold">Crossfade</span>
                <span className="text-[10px] text-neutral-400 leading-tight">
                  Smooth volume crossover
                </span>
              </button>

              {/* Beat Match Pill */}
              <button
                type="button"
                onClick={() =>
                  setTransition((prev) => ({
                    ...prev,
                    type: "beat_match",
                    beatAlignBars: prev.beatAlignBars || 8,
                    tempoSync: prev.tempoSync ?? true,
                  }))
                }
                className={`p-3 rounded-xl border flex flex-col items-center justify-center text-center gap-1.5 transition cursor-pointer ${
                  transition.type === "beat_match"
                    ? "bg-purple-500/15 border-purple-500 text-purple-200 shadow-md shadow-purple-500/10"
                    : "bg-neutral-950/60 border-neutral-800 hover:border-neutral-700 text-neutral-400"
                }`}
              >
                <Layers className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-bold">Beat-Match</span>
                <span className="text-[10px] text-neutral-400 leading-tight">
                  Bar & phrase synced blend
                </span>
              </button>

              {/* Cut Pill */}
              <button
                type="button"
                onClick={() =>
                  setTransition((prev) => ({
                    ...prev,
                    type: "cut",
                    cutStyle: prev.cutStyle || "instant",
                  }))
                }
                className={`p-3 rounded-xl border flex flex-col items-center justify-center text-center gap-1.5 transition cursor-pointer ${
                  transition.type === "cut"
                    ? "bg-rose-500/15 border-rose-500 text-rose-200 shadow-md shadow-rose-500/10"
                    : "bg-neutral-950/60 border-neutral-800 hover:border-neutral-700 text-neutral-400"
                }`}
              >
                <Scissors className="w-4 h-4 text-rose-400" />
                <span className="text-xs font-bold">Cut</span>
                <span className="text-[10px] text-neutral-400 leading-tight">
                  Instant drop or silence gap
                </span>
              </button>
            </div>
          </div>

          {/* Dynamic Configuration Panel according to selected type */}
          {transition.type === "crossfade" && (
            <div className="p-4 rounded-xl bg-neutral-950/80 border border-neutral-800 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-200">Crossfade Duration</span>
                <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono text-xs font-bold">
                  {transition.duration.toFixed(1)}s
                </span>
              </div>

              {/* Duration Slider */}
              <input
                type="range"
                min="0.5"
                max="16.0"
                step="0.5"
                value={transition.duration}
                onChange={(e) =>
                  setTransition((prev) => ({ ...prev, duration: parseFloat(e.target.value) }))
                }
                className="w-full accent-cyan-500 cursor-pointer"
              />

              {/* Preset Buttons */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-neutral-400 font-mono">Presets:</span>
                {[
                  { label: "Quick (2s)", val: 2 },
                  { label: "Standard (4s)", val: 4 },
                  { label: "Club Mix (8s)", val: 8 },
                  { label: "Ambient (12s)", val: 12 },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setTransition((prev) => ({ ...prev, duration: preset.val }))}
                    className={`px-2.5 py-1 rounded text-[11px] font-mono transition cursor-pointer ${
                      transition.duration === preset.val
                        ? "bg-cyan-500 text-white font-bold"
                        : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Curve Selection */}
              <div className="space-y-2 pt-2 border-t border-neutral-800/80">
                <label className="text-xs font-medium text-neutral-300">Fade Curve Algorithm</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: "equal_power", label: "Equal Power", desc: "No volume dip at center" },
                    { id: "exponential", label: "Exponential", desc: "Smooth radio broadcast curve" },
                    { id: "linear", label: "Linear", desc: "Constant slope" },
                    { id: "s_curve", label: "S-Curve", desc: "Gentle entry & exit" },
                  ].map((curveItem) => (
                    <button
                      key={curveItem.id}
                      type="button"
                      onClick={() =>
                        setTransition((prev) => ({
                          ...prev,
                          curve: curveItem.id as CrossfadeCurve,
                        }))
                      }
                      className={`p-2 rounded-lg border text-left transition cursor-pointer ${
                        transition.curve === curveItem.id
                          ? "bg-neutral-800 border-cyan-500 text-white"
                          : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-neutral-700"
                      }`}
                    >
                      <div className="text-xs font-semibold text-neutral-200">{curveItem.label}</div>
                      <div className="text-[10px] text-neutral-500 mt-0.5 leading-tight">
                        {curveItem.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Visual Envelope Simulation SVG */}
              <div className="p-3 bg-neutral-900 rounded-lg border border-neutral-800/80">
                <div className="flex items-center justify-between text-[10px] font-mono text-neutral-400 mb-1">
                  <span>OUTGOING FADE-OUT</span>
                  <span>CROSSOVER ZONE</span>
                  <span>INCOMING FADE-IN</span>
                </div>
                <svg className="w-full h-12 stroke-current" viewBox="0 0 300 40">
                  {/* Grid lines */}
                  <line x1="0" y1="20" x2="300" y2="20" stroke="#262626" strokeDasharray="3 3" />
                  <line x1="150" y1="0" x2="150" y2="40" stroke="#38bdf8" strokeDasharray="2 2" />
                  {/* Curve A (Cyan) */}
                  <path
                    d={
                      transition.curve === "exponential"
                        ? "M 10 5 Q 120 8 150 20 T 290 35"
                        : transition.curve === "equal_power"
                        ? "M 10 5 C 100 5, 140 15, 290 35"
                        : "M 10 5 L 290 35"
                    }
                    fill="none"
                    stroke="#06b6d4"
                    strokeWidth="2.5"
                  />
                  {/* Curve B (Emerald) */}
                  <path
                    d={
                      transition.curve === "exponential"
                        ? "M 10 35 Q 180 32 150 20 T 290 5"
                        : transition.curve === "equal_power"
                        ? "M 10 35 C 160 25, 200 5, 290 5"
                        : "M 10 35 L 290 5"
                    }
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="2.5"
                  />
                </svg>
              </div>
            </div>
          )}

          {transition.type === "beat_match" && (
            <div className="p-4 rounded-xl bg-neutral-950/80 border border-neutral-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-neutral-200">Phrase & Bar Alignment</span>
                  <p className="text-[11px] text-neutral-400">
                    Matches musical downbeats over structural bar phrases
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono text-xs font-bold">
                  {transition.beatAlignBars || 8} Bars ({calculatedBeatMatchSec}s @ {effectiveBpm} BPM)
                </span>
              </div>

              {/* Bar Count Selector */}
              <div className="grid grid-cols-4 gap-2">
                {[4, 8, 16, 32].map((barCount) => (
                  <button
                    key={barCount}
                    type="button"
                    onClick={() =>
                      setTransition((prev) => ({
                        ...prev,
                        beatAlignBars: barCount as 4 | 8 | 16 | 32,
                      }))
                    }
                    className={`p-2.5 rounded-lg border text-center transition cursor-pointer ${
                      (transition.beatAlignBars || 8) === barCount
                        ? "bg-purple-600 border-purple-400 text-white font-bold"
                        : "bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-800"
                    }`}
                  >
                    <div className="text-xs font-mono">{barCount} Bars</div>
                    <div className="text-[10px] text-neutral-400 mt-0.5">
                      {Math.round(((60 / effectiveBpm) * (barCount * 4)) * 10) / 10}s
                    </div>
                  </button>
                ))}
              </div>

              {/* EQ & Frequency Swap */}
              <div className="space-y-2 pt-2 border-t border-neutral-800/80">
                <label className="text-xs font-medium text-neutral-300">EQ & Bass Swap Profile</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    {
                      id: "gradual_bass_swap",
                      label: "Gradual Bass Swap",
                      desc: "Scoop outgoing bass at mid-bar, introduce incoming kick",
                    },
                    {
                      id: "instant",
                      label: "Snap Drop Cut",
                      desc: "Blend highs/mids, snap low-end on the 1",
                    },
                    {
                      id: "full_range",
                      label: "Full Club Blend",
                      desc: "Smooth equal-power acoustic transition",
                    },
                  ].map((eq) => (
                    <button
                      key={eq.id}
                      type="button"
                      onClick={() =>
                        setTransition((prev) => ({
                          ...prev,
                          eqSwap: eq.id as EQSwapStyle,
                        }))
                      }
                      className={`p-2.5 rounded-lg border text-left transition cursor-pointer ${
                        (transition.eqSwap || "gradual_bass_swap") === eq.id
                          ? "bg-purple-950/40 border-purple-500 text-purple-200"
                          : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-neutral-700"
                      }`}
                    >
                      <div className="text-xs font-semibold">{eq.label}</div>
                      <div className="text-[10px] text-neutral-400 mt-0.5 leading-tight">
                        {eq.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Tempo Sync Toggle */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-neutral-900 border border-neutral-800">
                <div className="space-y-0.5">
                  <div className="text-xs font-medium text-neutral-200">Preserve Pitch & Tempo Lock</div>
                  <div className="text-[11px] text-neutral-400">
                    Calculates phase correlation to avoid tempo drifting
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={transition.tempoSync ?? true}
                  onChange={(e) =>
                    setTransition((prev) => ({ ...prev, tempoSync: e.target.checked }))
                  }
                  className="w-4 h-4 accent-purple-500 cursor-pointer"
                />
              </div>
            </div>
          )}

          {transition.type === "cut" && (
            <div className="p-4 rounded-xl bg-neutral-950/80 border border-neutral-800 space-y-4">
              <label className="text-xs font-bold text-neutral-200">Cut & Drop Style</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  {
                    id: "instant",
                    label: "Instant Drop",
                    desc: "Direct cut on downbeat with zero silence gap",
                  },
                  {
                    id: "pause",
                    label: "Radio Gap",
                    desc: "Brief broadcast breath (0.5s - 2s silence)",
                  },
                  {
                    id: "reverb_tail",
                    label: "Reverb Tail",
                    desc: "Outgoing track decays into space before incoming drops",
                  },
                  {
                    id: "backspin",
                    label: "Vinyl Brake",
                    desc: "Turntable motor stop effect before incoming start",
                  },
                ].map((cutItem) => (
                  <button
                    key={cutItem.id}
                    type="button"
                    onClick={() =>
                      setTransition((prev) => ({
                        ...prev,
                        cutStyle: cutItem.id as CutStyle,
                      }))
                    }
                    className={`p-2.5 rounded-lg border text-left transition cursor-pointer ${
                      (transition.cutStyle || "instant") === cutItem.id
                        ? "bg-rose-950/40 border-rose-500 text-rose-200"
                        : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-neutral-700"
                    }`}
                  >
                    <div className="text-xs font-semibold">{cutItem.label}</div>
                    <div className="text-[10px] text-neutral-500 mt-0.5 leading-tight">
                      {cutItem.desc}
                    </div>
                  </button>
                ))}
              </div>

              {/* Pause Gap Slider */}
              {transition.cutStyle === "pause" && (
                <div className="space-y-2 pt-2 border-t border-neutral-800/80">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-neutral-300">Silence Gap Length</span>
                    <span className="font-mono text-xs text-rose-400 font-bold">
                      {(transition.pauseDuration || 0.5).toFixed(1)}s
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="3.0"
                    step="0.1"
                    value={transition.pauseDuration || 0.5}
                    onChange={(e) =>
                      setTransition((prev) => ({
                        ...prev,
                        pauseDuration: parseFloat(e.target.value),
                      }))
                    }
                    className="w-full accent-rose-500 cursor-pointer"
                  />
                </div>
              )}
            </div>
          )}

          {/* Live Interactive Transition Audition Player */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-neutral-950 to-neutral-900 border border-neutral-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold text-neutral-200 uppercase font-mono">
                  Transition Audition Player
                </span>
              </div>
              <span className="text-[11px] font-mono text-neutral-400">
                Phase:{" "}
                <strong className="text-cyan-300 uppercase">
                  {isAuditioning ? auditionPhase : "Idle"}
                </strong>
              </span>
            </div>

            {/* Audition Progress Bar */}
            <div className="w-full bg-neutral-950 h-2 rounded-full overflow-hidden border border-neutral-800 relative">
              <div
                className="bg-gradient-to-r from-cyan-500 via-purple-500 to-emerald-500 h-full transition-all duration-75"
                style={{ width: `${auditionProgress}%` }}
              />
            </div>

            {/* Dual Deck Level VU Display */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] font-mono text-neutral-400">
                  <span className="truncate">DECK A (Outgoing)</span>
                  <span>{Math.round(deckAVolume * 100)}%</span>
                </div>
                <div className="w-full bg-neutral-900 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-cyan-400 h-full transition-all duration-75"
                    style={{ width: `${Math.round(deckAVolume * 100)}%` }}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] font-mono text-neutral-400">
                  <span className="truncate">DECK B (Incoming)</span>
                  <span>{Math.round(deckBVolume * 100)}%</span>
                </div>
                <div className="w-full bg-neutral-900 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-400 h-full transition-all duration-75"
                    style={{ width: `${Math.round(deckBVolume * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Audition Controls */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={isAuditioning ? stopAudition : startAudition}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-lg ${
                  isAuditioning
                    ? "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/20"
                    : "bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-cyan-500/20"
                }`}
              >
                {isAuditioning ? (
                  <>
                    <Pause className="w-4 h-4 fill-current" />
                    <span>Stop Audition</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>Audition Transition</span>
                  </>
                )}
              </button>

              <span className="text-[11px] text-neutral-400 font-mono hidden sm:inline">
                Cues last seconds of Deck A &rarr; blends into Deck B
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-800 bg-neutral-900/90 flex flex-col sm:flex-row items-center justify-between gap-3 sticky bottom-0 z-10">
          <div>
            {onApplyToAll && (
              <button
                type="button"
                onClick={handleApplyAll}
                className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer border border-neutral-700"
              >
                {applyToAllSuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Applied to all tracks!</span>
                  </>
                ) : (
                  <>
                    <Layers className="w-3.5 h-3.5 text-neutral-400" />
                    <span>Apply Style to All in Show</span>
                  </>
                )}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                stopAudition();
                onClose();
              }}
              className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              id="transition-editor-btn-save"
              onClick={handleSave}
              className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-neutral-950 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-cyan-500/20"
            >
              <Check className="w-4 h-4" />
              <span>Apply Transition</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
