import React, { useState, useEffect } from "react";
import {
  X,
  Zap,
  Layers,
  Scissors,
  Bookmark,
  Plus,
  Trash2,
  Check,
  Sparkles,
  Sliders,
  Radio,
  SlidersHorizontal,
  Info,
  RotateCcw,
} from "lucide-react";
import {
  GlobalTransitionDefault,
  TransitionPreset,
  TransitionType,
  CrossfadeCurve,
  CutStyle,
  EQSwapStyle,
} from "../types.js";

interface GlobalTransitionDefaultModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDefault?: GlobalTransitionDefault;
  trackCount: number;
  onSaveDefault: (
    newDefault: GlobalTransitionDefault,
    applyMode: "default_only" | "apply_all" | "apply_uncustomized"
  ) => void;
}

const BUILT_IN_PRESETS: TransitionPreset[] = [
  {
    id: "preset_smooth_radio",
    name: "Smooth Radio Crossfade",
    description: "Classic commercial radio transition with 4.0s equal-power crossfade and bass swap.",
    type: "crossfade",
    duration: 4.0,
    curve: "equal_power",
    eqSwap: "gradual_bass_swap",
    isBuiltIn: true,
  },
  {
    id: "preset_tight_broadcast",
    name: "Tight Broadcast Flow",
    description: "Crisp 2.0s S-curve transition keeping energy punchy and momentum high.",
    type: "crossfade",
    duration: 2.0,
    curve: "s_curve",
    eqSwap: "instant",
    isBuiltIn: true,
  },
  {
    id: "preset_club_beatmatch",
    name: "Club Beat-Match (8 Bars)",
    description: "Synchronized DJ club mix across 8 musical bars with tempo lock and gradual bass swap.",
    type: "beat_match",
    duration: 15.0,
    curve: "equal_power",
    beatAlignBars: 8,
    tempoSync: true,
    eqSwap: "gradual_bass_swap",
    isBuiltIn: true,
  },
  {
    id: "preset_extended_rave",
    name: "Extended Rave Blend (16 Bars)",
    description: "Deep progressive 16-bar phrase blend for techno, trance, and continuous sets.",
    type: "beat_match",
    duration: 30.0,
    curve: "linear",
    beatAlignBars: 16,
    tempoSync: true,
    eqSwap: "gradual_bass_swap",
    isBuiltIn: true,
  },
  {
    id: "preset_instant_drop",
    name: "Hard Drop / Instant Cut",
    description: "Zero-gap instantaneous cut directly into the next track intro for high impact.",
    type: "cut",
    duration: 0.0,
    curve: "linear",
    cutStyle: "instant",
    pauseDuration: 0.0,
    isBuiltIn: true,
  },
  {
    id: "preset_studio_pause",
    name: "Studio Breath Gap (1.0s)",
    description: "Clean 1.0s silence gap between tracks, giving distinct separation between songs.",
    type: "cut",
    duration: 0.0,
    curve: "linear",
    cutStyle: "pause",
    pauseDuration: 1.0,
    isBuiltIn: true,
  },
  {
    id: "preset_ambient_dream",
    name: "Ambient Dream Fade (6.5s)",
    description: "Atmospheric exponential fade for chilled downtempo and ambient selections.",
    type: "crossfade",
    duration: 6.5,
    curve: "exponential",
    eqSwap: "full_range",
    isBuiltIn: true,
  },
];

const LOCAL_STORAGE_KEY = "airadio_transition_presets";

export const GlobalTransitionDefaultModal: React.FC<GlobalTransitionDefaultModalProps> = ({
  isOpen,
  onClose,
  currentDefault,
  trackCount,
  onSaveDefault,
}) => {
  // Active editing configuration
  const [selectedType, setSelectedType] = useState<TransitionType>(
    currentDefault?.type || "crossfade"
  );
  const [duration, setDuration] = useState<number>(currentDefault?.duration ?? 4.0);
  const [curve, setCurve] = useState<CrossfadeCurve>(currentDefault?.curve || "equal_power");
  const [beatAlignBars, setBeatAlignBars] = useState<4 | 8 | 16 | 32>(
    currentDefault?.beatAlignBars || 8
  );
  const [tempoSync, setTempoSync] = useState<boolean>(currentDefault?.tempoSync ?? true);
  const [eqSwap, setEqSwap] = useState<EQSwapStyle>(
    currentDefault?.eqSwap || "gradual_bass_swap"
  );
  const [cutStyle, setCutStyle] = useState<CutStyle>(currentDefault?.cutStyle || "instant");
  const [pauseDuration, setPauseDuration] = useState<number>(
    currentDefault?.pauseDuration ?? 0.5
  );
  const [activePresetName, setActivePresetName] = useState<string>(
    currentDefault?.presetName || "Smooth Radio Crossfade"
  );

  // Custom user presets
  const [customPresets, setCustomPresets] = useState<TransitionPreset[]>([]);
  const [newPresetName, setNewPresetName] = useState("");
  const [showSavePresetInput, setShowSavePresetInput] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Load custom presets from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        setCustomPresets(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed loading presets from storage", e);
    }
  }, []);

  // Update form if currentDefault changes
  useEffect(() => {
    if (currentDefault) {
      setSelectedType(currentDefault.type);
      setDuration(currentDefault.duration);
      setCurve(currentDefault.curve);
      if (currentDefault.beatAlignBars) setBeatAlignBars(currentDefault.beatAlignBars);
      if (currentDefault.tempoSync !== undefined) setTempoSync(currentDefault.tempoSync);
      if (currentDefault.eqSwap) setEqSwap(currentDefault.eqSwap);
      if (currentDefault.cutStyle) setCutStyle(currentDefault.cutStyle);
      if (currentDefault.pauseDuration !== undefined)
        setPauseDuration(currentDefault.pauseDuration);
      if (currentDefault.presetName) setActivePresetName(currentDefault.presetName);
    }
  }, [currentDefault]);

  if (!isOpen) return null;

  // Apply a preset to active form state
  const handleSelectPreset = (preset: TransitionPreset) => {
    setSelectedType(preset.type);
    setDuration(preset.duration);
    setCurve(preset.curve);
    if (preset.beatAlignBars) setBeatAlignBars(preset.beatAlignBars);
    if (preset.tempoSync !== undefined) setTempoSync(preset.tempoSync);
    if (preset.eqSwap) setEqSwap(preset.eqSwap);
    if (preset.cutStyle) setCutStyle(preset.cutStyle);
    if (preset.pauseDuration !== undefined) setPauseDuration(preset.pauseDuration);
    setActivePresetName(preset.name);
  };

  // Save new custom preset
  const handleSaveAsNewPreset = () => {
    if (!newPresetName.trim()) return;
    const newPreset: TransitionPreset = {
      id: "preset_usr_" + Date.now(),
      name: newPresetName.trim(),
      description: `Custom preset (${selectedType}, ${
        selectedType === "crossfade"
          ? `${duration.toFixed(1)}s`
          : selectedType === "beat_match"
          ? `${beatAlignBars} bars`
          : cutStyle
      })`,
      type: selectedType,
      duration: selectedType === "crossfade" ? duration : 0,
      curve,
      beatAlignBars: selectedType === "beat_match" ? beatAlignBars : undefined,
      tempoSync: selectedType === "beat_match" ? tempoSync : undefined,
      eqSwap,
      cutStyle: selectedType === "cut" ? cutStyle : undefined,
      pauseDuration: selectedType === "cut" ? pauseDuration : undefined,
      isBuiltIn: false,
    };

    const updated = [...customPresets, newPreset];
    setCustomPresets(updated);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error("Failed saving preset to storage", e);
    }
    setActivePresetName(newPreset.name);
    setNewPresetName("");
    setShowSavePresetInput(false);
    setSaveSuccessMsg(`Preset "${newPreset.name}" saved!`);
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  // Delete custom preset
  const handleDeleteCustomPreset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = customPresets.filter((p) => p.id !== id);
    setCustomPresets(updated);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    } catch (err) {
      console.error("Failed updating preset storage", err);
    }
  };

  const getPayload = (): GlobalTransitionDefault => {
    return {
      type: selectedType,
      duration: selectedType === "crossfade" ? duration : 0,
      curve,
      beatAlignBars: selectedType === "beat_match" ? beatAlignBars : undefined,
      tempoSync: selectedType === "beat_match" ? tempoSync : undefined,
      eqSwap,
      cutStyle: selectedType === "cut" ? cutStyle : undefined,
      pauseDuration: selectedType === "cut" ? pauseDuration : undefined,
      presetName: activePresetName,
    };
  };

  const handleApply = (mode: "default_only" | "apply_all" | "apply_uncustomized") => {
    onSaveDefault(getPayload(), mode);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl bg-neutral-900 border border-neutral-800 shadow-2xl overflow-hidden text-neutral-200">
        {/* Modal Header */}
        <div className="p-5 border-b border-neutral-800/80 flex items-center justify-between bg-neutral-950/70">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-100 flex items-center gap-2">
                <span>Global Transition Default</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-neutral-800 text-neutral-400 border border-neutral-700">
                  Show Consistency
                </span>
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Set standard transition behavior for new tracks and apply consistent blending across your show.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Preset Selector Strip */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                <Bookmark className="w-3.5 h-3.5 text-cyan-400" />
                <span>Transition Presets</span>
              </span>
              <button
                onClick={() => setShowSavePresetInput(!showSavePresetInput)}
                className="text-[11px] text-cyan-400 hover:text-cyan-300 font-mono flex items-center gap-1 hover:underline cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Save Current as Preset</span>
              </button>
            </div>

            {/* Save Preset Input Bar */}
            {showSavePresetInput && (
              <div className="p-3 rounded-xl bg-neutral-950/80 border border-cyan-500/30 flex items-center gap-2 animate-in slide-in-from-top duration-150">
                <input
                  type="text"
                  placeholder="Enter preset name (e.g. My Rave Drop)..."
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  className="flex-1 bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-1.5 text-xs text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-cyan-500"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveAsNewPreset();
                  }}
                  autoFocus
                />
                <button
                  onClick={handleSaveAsNewPreset}
                  disabled={!newPresetName.trim()}
                  className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-xs font-semibold text-white cursor-pointer"
                >
                  Save Preset
                </button>
                <button
                  onClick={() => setShowSavePresetInput(false)}
                  className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {saveSuccessMsg && (
              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
                <Check className="w-3.5 h-3.5" />
                <span>{saveSuccessMsg}</span>
              </div>
            )}

            {/* Presets Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {BUILT_IN_PRESETS.map((preset) => {
                const isSelected = activePresetName === preset.name;
                return (
                  <button
                    key={preset.id}
                    onClick={() => handleSelectPreset(preset)}
                    className={`p-3 rounded-xl text-left border transition cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? "bg-cyan-500/10 border-cyan-500/50 shadow-sm shadow-cyan-500/10"
                        : "bg-neutral-950/50 border-neutral-800/80 hover:bg-neutral-800/60 hover:border-neutral-700"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`text-xs font-bold truncate ${
                            isSelected ? "text-cyan-300" : "text-neutral-200"
                          }`}
                        >
                          {preset.name}
                        </span>
                        {preset.type === "crossfade" && (
                          <Zap className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        )}
                        {preset.type === "beat_match" && (
                          <Layers className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                        )}
                        {preset.type === "cut" && (
                          <Scissors className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-neutral-400 line-clamp-2 leading-relaxed">
                        {preset.description}
                      </p>
                    </div>
                    <div className="mt-2.5 pt-2 border-t border-neutral-800/60 flex items-center justify-between text-[10px] font-mono text-neutral-500">
                      <span>
                        {preset.type === "crossfade"
                          ? `${preset.duration.toFixed(1)}s • ${preset.curve}`
                          : preset.type === "beat_match"
                          ? `${preset.beatAlignBars || 8} Bars Sync`
                          : preset.cutStyle || "Instant Drop"}
                      </span>
                      {isSelected && (
                        <span className="text-cyan-400 font-bold flex items-center gap-0.5">
                          <Check className="w-3 h-3" /> Active
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}

              {/* User Saved Presets */}
              {customPresets.map((preset) => {
                const isSelected = activePresetName === preset.name;
                return (
                  <button
                    key={preset.id}
                    onClick={() => handleSelectPreset(preset)}
                    className={`p-3 rounded-xl text-left border transition cursor-pointer flex flex-col justify-between relative group ${
                      isSelected
                        ? "bg-amber-500/10 border-amber-500/50 shadow-sm shadow-amber-500/10"
                        : "bg-neutral-950/50 border-neutral-800/80 hover:bg-neutral-800/60 hover:border-neutral-700"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`text-xs font-bold truncate ${
                            isSelected ? "text-amber-300" : "text-neutral-200"
                          }`}
                        >
                          {preset.name}
                        </span>
                        <div className="flex items-center gap-1">
                          <span className="px-1 py-0.2 rounded text-[9px] font-mono bg-neutral-800 text-amber-400">
                            Custom
                          </span>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteCustomPreset(preset.id, e)}
                            className="text-neutral-500 hover:text-rose-400 p-0.5 transition"
                            title="Delete custom preset"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <p className="text-[11px] text-neutral-400 line-clamp-2 leading-relaxed">
                        {preset.description}
                      </p>
                    </div>
                    <div className="mt-2.5 pt-2 border-t border-neutral-800/60 flex items-center justify-between text-[10px] font-mono text-neutral-500">
                      <span>
                        {preset.type === "crossfade"
                          ? `${preset.duration.toFixed(1)}s`
                          : preset.type === "beat_match"
                          ? `${preset.beatAlignBars || 8} Bars`
                          : preset.cutStyle}
                      </span>
                      {isSelected && (
                        <span className="text-amber-400 font-bold flex items-center gap-0.5">
                          <Check className="w-3 h-3" /> Active
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Transition Settings Form */}
          <div className="p-4 rounded-xl bg-neutral-950/70 border border-neutral-800/90 space-y-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                <span>Custom Configuration</span>
              </span>
              <span className="text-[11px] font-mono text-neutral-400">
                Active: <strong className="text-neutral-200">{activePresetName}</strong>
              </span>
            </div>

            {/* Type Switcher Tabs */}
            <div className="grid grid-cols-3 gap-2 p-1 bg-neutral-900 rounded-xl border border-neutral-800">
              <button
                type="button"
                onClick={() => {
                  setSelectedType("crossfade");
                  setActivePresetName("Custom Crossfade");
                }}
                className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer ${
                  selectedType === "crossfade"
                    ? "bg-cyan-500 text-neutral-950 font-bold shadow-md shadow-cyan-500/20"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Crossfade</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedType("beat_match");
                  setActivePresetName("Custom Beat-Match");
                }}
                className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer ${
                  selectedType === "beat_match"
                    ? "bg-purple-600 text-white font-bold shadow-md shadow-purple-500/20"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Beat-Match</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedType("cut");
                  setActivePresetName("Custom Cut");
                }}
                className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer ${
                  selectedType === "cut"
                    ? "bg-rose-600 text-white font-bold shadow-md shadow-rose-500/20"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                <Scissors className="w-3.5 h-3.5" />
                <span>Cut</span>
              </button>
            </div>

            {/* Type Specific Fields */}
            {selectedType === "crossfade" && (
              <div className="space-y-4 pt-1">
                {/* Duration Slider */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-neutral-300 font-medium">Crossfade Duration</span>
                    <span className="font-mono text-cyan-400 font-bold text-sm">
                      {duration.toFixed(1)}s
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="12.0"
                    step="0.5"
                    value={duration}
                    onChange={(e) => {
                      setDuration(parseFloat(e.target.value));
                      setActivePresetName("Custom Crossfade");
                    }}
                    className="w-full accent-cyan-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-neutral-500 mt-1">
                    <span>0.5s (Quick)</span>
                    <span>4.0s (Standard)</span>
                    <span>8.0s (Club)</span>
                    <span>12.0s (Ambient)</span>
                  </div>
                </div>

                {/* Fade Curve Selection */}
                <div>
                  <label className="text-xs font-medium text-neutral-300 block mb-2">
                    Fade Curve Geometry
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      {
                        id: "equal_power" as CrossfadeCurve,
                        label: "Equal Power",
                        desc: "Maintains constant perceived acoustic volume (Recommended)",
                      },
                      {
                        id: "s_curve" as CrossfadeCurve,
                        label: "S-Curve",
                        desc: "Gentle entrance, rapid midpoint swap, gentle exit",
                      },
                      {
                        id: "linear" as CrossfadeCurve,
                        label: "Linear",
                        desc: "Straight proportional fade slope across time",
                      },
                      {
                        id: "exponential" as CrossfadeCurve,
                        label: "Exponential",
                        desc: "Slow start with steep swell at the finish",
                      },
                      {
                        id: "logarithmic" as CrossfadeCurve,
                        label: "Logarithmic",
                        desc: "Fast initial drop, gradual tail",
                      },
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setCurve(item.id);
                          setActivePresetName("Custom Crossfade");
                        }}
                        className={`p-2.5 rounded-lg text-left border transition cursor-pointer ${
                          curve === item.id
                            ? "bg-cyan-500/15 border-cyan-500/60 text-neutral-100"
                            : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200"
                        }`}
                      >
                        <div className="font-semibold text-xs text-neutral-200 mb-0.5">
                          {item.label}
                        </div>
                        <div className="text-[10px] leading-tight text-neutral-400">
                          {item.desc}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* EQ Swap Mode */}
                <div>
                  <label className="text-xs font-medium text-neutral-300 block mb-2">
                    EQ Frequency Balancing
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      {
                        id: "gradual_bass_swap" as EQSwapStyle,
                        label: "Bass Swap",
                        desc: "Filters low-end bass conflict at midpoint",
                      },
                      {
                        id: "instant" as EQSwapStyle,
                        label: "Instant Cut EQ",
                        desc: "Cuts outgoing frequencies instantly on drop",
                      },
                      {
                        id: "full_range" as EQSwapStyle,
                        label: "Full Range Blend",
                        desc: "Standard full spectrum blending without filtering",
                      },
                    ].map((eq) => (
                      <button
                        key={eq.id}
                        type="button"
                        onClick={() => setEqSwap(eq.id)}
                        className={`p-2.5 rounded-lg text-left border transition cursor-pointer ${
                          eqSwap === eq.id
                            ? "bg-cyan-500/15 border-cyan-500/60 text-neutral-100"
                            : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200"
                        }`}
                      >
                        <div className="font-semibold text-xs text-neutral-200 mb-0.5">
                          {eq.label}
                        </div>
                        <div className="text-[10px] leading-tight text-neutral-400">{eq.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {selectedType === "beat_match" && (
              <div className="space-y-4 pt-1">
                {/* Bar Grid Alignment */}
                <div>
                  <label className="text-xs font-medium text-neutral-300 block mb-1.5">
                    Phrase Alignment Length
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {([4, 8, 16, 32] as const).map((bars) => (
                      <button
                        key={bars}
                        type="button"
                        onClick={() => {
                          setBeatAlignBars(bars);
                          setActivePresetName("Custom Beat-Match");
                        }}
                        className={`py-3 px-2 rounded-xl text-center border transition cursor-pointer ${
                          beatAlignBars === bars
                            ? "bg-purple-600/20 border-purple-500 text-purple-200 font-bold"
                            : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200"
                        }`}
                      >
                        <div className="text-sm font-mono">{bars} Bars</div>
                        <div className="text-[10px] font-mono text-neutral-500 mt-0.5">
                          ~{Math.round((bars * 4 * 60) / 128)}s @ 128 BPM
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tempo Sync Toggle */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-900 border border-neutral-800">
                  <div>
                    <div className="text-xs font-semibold text-neutral-200">
                      Lock Tempo & Phase Alignment
                    </div>
                    <div className="text-[11px] text-neutral-400 mt-0.5">
                      Ensures downbeats are locked during the overlap period
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={tempoSync}
                    onChange={(e) => setTempoSync(e.target.checked)}
                    className="w-4 h-4 accent-purple-600 cursor-pointer"
                  />
                </div>
              </div>
            )}

            {selectedType === "cut" && (
              <div className="space-y-4 pt-1">
                {/* Cut Style */}
                <div>
                  <label className="text-xs font-medium text-neutral-300 block mb-1.5">
                    Cut Articulation
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: "instant" as CutStyle, label: "Instant Drop", desc: "No gap, hard switch" },
                      { id: "pause" as CutStyle, label: "Silence Gap", desc: "Custom silence breather" },
                      { id: "reverb_tail" as CutStyle, label: "Reverb Tail", desc: "Decays into silence" },
                      { id: "backspin" as CutStyle, label: "DJ Backspin", desc: "Vinyl scratch stop" },
                    ].map((style) => (
                      <button
                        key={style.id}
                        type="button"
                        onClick={() => {
                          setCutStyle(style.id);
                          setActivePresetName("Custom Cut");
                        }}
                        className={`p-2.5 rounded-lg text-left border transition cursor-pointer ${
                          cutStyle === style.id
                            ? "bg-rose-500/15 border-rose-500/60 text-neutral-100"
                            : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200"
                        }`}
                      >
                        <div className="font-semibold text-xs text-neutral-200 mb-0.5">
                          {style.label}
                        </div>
                        <div className="text-[10px] leading-tight text-neutral-400">{style.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pause Duration Slider */}
                {cutStyle === "pause" && (
                  <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-neutral-300 font-medium">Silence Gap Duration</span>
                      <span className="font-mono text-rose-400 font-bold text-sm">
                        {pauseDuration.toFixed(1)}s
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="3.0"
                      step="0.1"
                      value={pauseDuration}
                      onChange={(e) => setPauseDuration(parseFloat(e.target.value))}
                      className="w-full accent-rose-500 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] font-mono text-neutral-500">
                      <span>0.1s (Quick Breath)</span>
                      <span>1.0s (Radio Standard)</span>
                      <span>3.0s (Dramatic Pause)</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer with Application Modes */}
        <div className="p-5 border-t border-neutral-800/80 bg-neutral-950 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-neutral-400 flex items-center gap-1.5">
            <Info className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>
              Show contains <strong>{trackCount}</strong> tracks (
              {Math.max(0, trackCount - 1)} transition boundaries).
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end w-full sm:w-auto">
            <button
              onClick={onClose}
              className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs text-neutral-300 transition cursor-pointer"
            >
              Cancel
            </button>

            <button
              id="btn-save-default-only"
              onClick={() => handleApply("default_only")}
              className="px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-cyan-300 border border-cyan-500/30 transition cursor-pointer"
              title="Set as default for new tracks without modifying current custom overrides"
            >
              Save as Default Only
            </button>

            <button
              id="btn-apply-all-tracks"
              onClick={() => handleApply("apply_all")}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-semibold shadow-lg shadow-cyan-500/20 transition cursor-pointer flex items-center gap-1.5"
              title="Batch-apply this transition preset to every track pair in the show"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Apply to ALL {Math.max(0, trackCount - 1)} Boundaries</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
