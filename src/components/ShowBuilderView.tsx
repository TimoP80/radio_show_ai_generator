import React, { useState } from "react";
import {
  Sparkles,
  Play,
  Pause,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Mic,
  Music2,
  Clock,
  Volume2,
  Wand2,
  RefreshCw,
  X,
  VolumeX,
  Radio,
  Sliders,
  CheckCircle,
  Zap,
  Scissors,
  Layers,
  ArrowRight,
  SlidersHorizontal,
  Bookmark,
} from "lucide-react";
import {
  RadioShow,
  AudioTrack,
  Announcement,
  ShowGeneratorParams,
  TrackTransition,
  TransitionType,
  CrossfadeCurve,
  CutStyle,
  GlobalTransitionDefault,
} from "../types.js";
import { api } from "../services/api.js";
import { useAudioPlayer } from "../context/AudioPlayerContext.js";
import { TransitionEditorModal } from "./TransitionEditorModal.js";
import { GlobalTransitionDefaultModal } from "./GlobalTransitionDefaultModal.js";

interface ShowBuilderViewProps {
  activeShow: RadioShow | null;
  tracks: AudioTrack[];
  onUpdateShow: (updated: RadioShow) => void;
  onNavigateToTimeline: () => void;
  onNavigateToVoice: () => void;
}

export const ShowBuilderView: React.FC<ShowBuilderViewProps> = ({
  activeShow,
  tracks,
  onUpdateShow,
  onNavigateToTimeline,
  onNavigateToVoice,
}) => {
  const { playTrack, playAnnouncement, nowPlaying, isPlaying, togglePlay } = useAudioPlayer();

  // Generator modal states
  const [showAiModal, setShowAiModal] = useState(false);
  const [targetLengthMin, setTargetLengthMin] = useState(60);
  const [targetTracks, setTargetTracks] = useState(10);
  const [selectedGenre, setSelectedGenre] = useState(activeShow?.genre || "Hardcore / Rave / Techno");
  const [energyCurve, setEnergyCurve] = useState<"peak" | "high" | "building" | "rollercoaster" | "smooth">("peak");
  const [hostStyle, setHostStyle] = useState("Energetic, hype, underground rave DJ");
  const [announcementFreq, setAnnouncementFreq] = useState<"minimal" | "moderate" | "frequent">("moderate");
  const [customPrompt, setCustomPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  // Manual track selection drawer
  const [showAddTrackModal, setShowAddTrackModal] = useState(false);
  const [trackSearchQuery, setTrackSearchQuery] = useState("");

  // Generating announcements state
  const [isGeneratingAnnouncements, setIsGeneratingAnnouncements] = useState(false);
  const [synthesizingId, setSynthesizingId] = useState<string | null>(null);

  // Transition Editor Modal state
  const [editingTransitionPair, setEditingTransitionPair] = useState<{
    fromTrack: AudioTrack;
    toTrack: AudioTrack;
    transition: TrackTransition;
  } | null>(null);
  const [showGlobalTransitionModal, setShowGlobalTransitionModal] = useState(false);

  if (!activeShow) {
    return (
      <div className="p-12 text-center max-w-xl mx-auto">
        <Radio className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-neutral-200">No Radio Show Selected</h3>
        <p className="text-xs text-neutral-400 mt-1">
          Please create or select a radio show project from the Radio Shows tab first.
        </p>
      </div>
    );
  }

  // Calculate current durations
  const totalTrackDuration = (activeShow.tracks || []).reduce((acc, t) => acc + t.duration, 0);
  const totalAnnounceDuration = (activeShow.announcements || []).reduce((acc, a) => acc + a.duration, 0);
  const totalDuration = totalTrackDuration + totalAnnounceDuration;
  const progressPercent = Math.min(100, Math.round((totalDuration / activeShow.targetDuration) * 100));

  const formatMinSec = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${mins}:${s.toString().padStart(2, "0")}`;
  };

  // Reorder handlers
  const moveTrack = (index: number, direction: "up" | "down") => {
    const newTracks = [...activeShow.tracks];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newTracks.length) return;
    const temp = newTracks[index];
    newTracks[index] = newTracks[targetIndex];
    newTracks[targetIndex] = temp;

    const updated: RadioShow = { ...activeShow, tracks: newTracks, updatedAt: new Date().toISOString() };
    onUpdateShow(updated);
  };

  const removeTrack = (index: number) => {
    const newTracks = activeShow.tracks.filter((_, i) => i !== index);
    const updated: RadioShow = { ...activeShow, tracks: newTracks, updatedAt: new Date().toISOString() };
    onUpdateShow(updated);
  };

  // Transition handlers
  const getTransitionBetween = (fromId: string, toId: string): TrackTransition => {
    const existing = (activeShow.transitions || []).find(
      (t) => t.fromTrackId === fromId && t.toTrackId === toId
    );
    if (existing) return existing;
    const def = activeShow.defaultTransition;
    return {
      id: `tr_${fromId}_${toId}`,
      fromTrackId: fromId,
      toTrackId: toId,
      type: def?.type || "crossfade",
      duration: def?.type === "crossfade" ? (def.duration ?? 4.0) : (def?.duration ?? 0),
      curve: def?.curve || "equal_power",
      beatAlignBars: def?.beatAlignBars,
      tempoSync: def?.tempoSync,
      eqSwap: def?.eqSwap,
      cutStyle: def?.cutStyle,
      pauseDuration: def?.pauseDuration,
      notes: def?.presetName ? `Default: ${def.presetName}` : undefined,
    };
  };

  const handleSaveGlobalTransitionDefault = (
    newDefault: GlobalTransitionDefault,
    applyMode: "default_only" | "apply_all" | "apply_uncustomized"
  ) => {
    let updatedTransitions = [...(activeShow.transitions || [])];

    if (applyMode === "apply_all") {
      updatedTransitions = [];
      for (let i = 0; i < activeShow.tracks.length - 1; i++) {
        const fromId = activeShow.tracks[i].id;
        const toId = activeShow.tracks[i + 1].id;
        updatedTransitions.push({
          id: `tr_${fromId}_${toId}`,
          fromTrackId: fromId,
          toTrackId: toId,
          type: newDefault.type,
          duration: newDefault.duration,
          curve: newDefault.curve,
          beatAlignBars: newDefault.beatAlignBars,
          tempoSync: newDefault.tempoSync,
          eqSwap: newDefault.eqSwap,
          cutStyle: newDefault.cutStyle,
          pauseDuration: newDefault.pauseDuration,
          notes: newDefault.presetName || newDefault.type,
        });
      }
    } else if (applyMode === "apply_uncustomized") {
      for (let i = 0; i < activeShow.tracks.length - 1; i++) {
        const fromId = activeShow.tracks[i].id;
        const toId = activeShow.tracks[i + 1].id;
        const exists = updatedTransitions.some(
          (t) => t.fromTrackId === fromId && t.toTrackId === toId
        );
        if (!exists) {
          updatedTransitions.push({
            id: `tr_${fromId}_${toId}`,
            fromTrackId: fromId,
            toTrackId: toId,
            type: newDefault.type,
            duration: newDefault.duration,
            curve: newDefault.curve,
            beatAlignBars: newDefault.beatAlignBars,
            tempoSync: newDefault.tempoSync,
            eqSwap: newDefault.eqSwap,
            cutStyle: newDefault.cutStyle,
            pauseDuration: newDefault.pauseDuration,
            notes: newDefault.presetName || newDefault.type,
          });
        }
      }
    }

    const updatedShow: RadioShow = {
      ...activeShow,
      defaultTransition: newDefault,
      transitions: updatedTransitions,
      updatedAt: new Date().toISOString(),
    };
    onUpdateShow(updatedShow);
  };

  const handleSaveTransition = (updated: TrackTransition) => {
    const currentTransitions = activeShow.transitions || [];
    const index = currentTransitions.findIndex(
      (t) => t.fromTrackId === updated.fromTrackId && t.toTrackId === updated.toTrackId
    );
    let newTransitions: TrackTransition[];
    if (index >= 0) {
      newTransitions = [...currentTransitions];
      newTransitions[index] = updated;
    } else {
      newTransitions = [...currentTransitions, updated];
    }
    const updatedShow: RadioShow = {
      ...activeShow,
      transitions: newTransitions,
      updatedAt: new Date().toISOString(),
    };
    onUpdateShow(updatedShow);
  };

  const handleApplyTransitionToAll = (template: TrackTransition) => {
    if (activeShow.tracks.length < 2) return;
    const newTransitions: TrackTransition[] = [];
    for (let i = 0; i < activeShow.tracks.length - 1; i++) {
      const fromId = activeShow.tracks[i].id;
      const toId = activeShow.tracks[i + 1].id;
      newTransitions.push({
        ...template,
        id: `tr_${fromId}_${toId}`,
        fromTrackId: fromId,
        toTrackId: toId,
      });
    }
    const updatedShow: RadioShow = {
      ...activeShow,
      transitions: newTransitions,
      updatedAt: new Date().toISOString(),
    };
    onUpdateShow(updatedShow);
  };

  const handleQuickSetTransitionType = (fromId: string, toId: string, type: TransitionType) => {
    const current = getTransitionBetween(fromId, toId);
    const updated: TrackTransition = {
      ...current,
      type,
      duration: type === "crossfade" ? (current.duration || 3.0) : 0,
      beatAlignBars: type === "beat_match" ? (current.beatAlignBars || 8) : undefined,
      tempoSync: type === "beat_match" ? (current.tempoSync ?? true) : undefined,
      cutStyle: type === "cut" ? (current.cutStyle || "instant") : undefined,
    };
    handleSaveTransition(updated);
  };

  const handleAutoDetectAllTransitions = () => {
    if (activeShow.tracks.length < 2) {
      alert("Add at least two tracks to the show running order first.");
      return;
    }
    const newTransitions: TrackTransition[] = [];
    for (let i = 0; i < activeShow.tracks.length - 1; i++) {
      const tA = activeShow.tracks[i];
      const tB = activeShow.tracks[i + 1];
      let type: TransitionType = "crossfade";
      let duration = 4.0;
      let curve: CrossfadeCurve = "equal_power";
      let cutStyle: CutStyle = "instant";
      let beatBars: 4 | 8 | 16 | 32 = 8;
      let notes = "";

      if (tA.bpm && tB.bpm && Math.abs(tA.bpm - tB.bpm) <= 6) {
        type = "beat_match";
        beatBars = 8;
        notes = `BPM Synced (${tA.bpm} -> ${tB.bpm} BPM)`;
      } else if (tA.bpm && tB.bpm && Math.abs(tA.bpm - tB.bpm) > 15) {
        type = "cut";
        cutStyle = "instant";
        notes = `Tempo jump (${tA.bpm} -> ${tB.bpm} BPM)`;
      } else {
        type = "crossfade";
        duration = 4.0;
        curve = "equal_power";
        notes = `Standard 4.0s crossfade`;
      }

      newTransitions.push({
        id: `tr_${tA.id}_${tB.id}`,
        fromTrackId: tA.id,
        toTrackId: tB.id,
        type,
        duration,
        curve,
        cutStyle,
        beatAlignBars: beatBars,
        tempoSync: true,
        notes,
      });
    }
    const updatedShow: RadioShow = {
      ...activeShow,
      transitions: newTransitions,
      updatedAt: new Date().toISOString(),
    };
    onUpdateShow(updatedShow);
  };

  // Announcements handlers
  const handleGenerateAllAnnouncements = async () => {
    if (activeShow.tracks.length === 0) {
      alert("Add tracks to your show first before generating DJ announcements.");
      return;
    }
    setIsGeneratingAnnouncements(true);
    try {
      const generated = await api.generateAnnouncements(activeShow);
      const newAnnouncements: Announcement[] = generated.map((g, idx) => ({
        id: `ann_${Date.now()}_${idx}`,
        showId: activeShow.id,
        placement: g.placement,
        positionIndex: g.positionIndex,
        title: g.title,
        scriptText: g.scriptText,
        voiceName: activeShow.voiceName || "Kore",
        voiceSpeed: activeShow.voiceSpeed || 1.0,
        voicePitch: activeShow.voicePitch || 1.0,
        duration: Math.max(4, Math.round(g.scriptText.length * 0.065)),
        duckMusic: true,
        duckingLevel: 0.25,
      }));

      const updated: RadioShow = {
        ...activeShow,
        announcements: newAnnouncements,
        updatedAt: new Date().toISOString(),
      };
      onUpdateShow(updated);
    } catch (err: any) {
      alert("Failed to generate announcements: " + err.message);
    } finally {
      setIsGeneratingAnnouncements(false);
    }
  };

  const handleSynthesizeAnnouncement = async (announcement: Announcement) => {
    setSynthesizingId(announcement.id);
    try {
      const result = await api.synthesizeVoice(
        announcement.scriptText,
        announcement.voiceName || activeShow.voiceName || "Kore",
        activeShow.voicePersonality
      );

      const updatedAnnouncements = activeShow.announcements.map((a) => {
        if (a.id === announcement.id) {
          return {
            ...a,
            audioUrl: result.audioUrl,
            duration: result.duration,
          };
        }
        return a;
      });

      const updated: RadioShow = {
        ...activeShow,
        announcements: updatedAnnouncements,
        updatedAt: new Date().toISOString(),
      };
      onUpdateShow(updated);
    } catch (err: any) {
      alert("Speech synthesis failed: " + err.message);
    } finally {
      setSynthesizingId(null);
    }
  };

  const handleAddAnnouncementAt = (positionIndex: number, placement: "intro" | "between_tracks" | "outro" | "station_id") => {
    const newAnn: Announcement = {
      id: `ann_${Date.now()}`,
      showId: activeShow.id,
      placement,
      positionIndex,
      title: `${placement.toUpperCase().replace("_", " ")} Link`,
      scriptText: `You're listening to ${activeShow.name} on ${activeShow.stationName}. Keep the volume cranked!`,
      voiceName: activeShow.voiceName || "Kore",
      voiceSpeed: 1.0,
      voicePitch: 1.0,
      duration: 6,
      duckMusic: true,
      duckingLevel: 0.25,
    };
    const updated: RadioShow = {
      ...activeShow,
      announcements: [...activeShow.announcements, newAnn],
      updatedAt: new Date().toISOString(),
    };
    onUpdateShow(updated);
  };

  const handleRemoveAnnouncement = (id: string) => {
    const updated: RadioShow = {
      ...activeShow,
      announcements: activeShow.announcements.filter((a) => a.id !== id),
      updatedAt: new Date().toISOString(),
    };
    onUpdateShow(updated);
  };

  const handleUpdateAnnouncementScript = (id: string, newScript: string) => {
    const updated: RadioShow = {
      ...activeShow,
      announcements: activeShow.announcements.map((a) =>
        a.id === id
          ? {
              ...a,
              scriptText: newScript,
              duration: Math.max(3, Math.round(newScript.length * 0.065)),
            }
          : a
      ),
      updatedAt: new Date().toISOString(),
    };
    onUpdateShow(updated);
  };

  // Run AI show generator
  const handleRunAiGenerator = async () => {
    setIsGenerating(true);
    try {
      const params: ShowGeneratorParams = {
        targetDuration: targetLengthMin * 60,
        targetTrackCount: targetTracks,
        primaryGenre: selectedGenre,
        energyCurve,
        hostPersona: hostStyle,
        announcementFrequency: announcementFreq,
        customPrompt,
      };

      const result = await api.generateShow(params, {
        name: activeShow.name,
        station: activeShow.stationName,
        host: activeShow.hostName,
      });

      // Find selected track objects from library
      const selectedTracks = result.selectedTrackIds
        .map((id) => tracks.find((t) => t.id === id))
        .filter(Boolean) as AudioTrack[];

      // Build suggested announcements
      const generatedAnnouncements: Announcement[] = result.suggestedAnnouncements.map((s, idx) => ({
        id: `ann_gen_${Date.now()}_${idx}`,
        showId: activeShow.id,
        placement: s.placement,
        positionIndex: s.positionIndex,
        title: s.title,
        scriptText: s.scriptText,
        voiceName: activeShow.voiceName || "Kore",
        voiceSpeed: 1.0,
        voicePitch: 1.0,
        duration: Math.max(4, Math.round(s.scriptText.length * 0.065)),
        duckMusic: true,
        duckingLevel: 0.25,
      }));

      const updated: RadioShow = {
        ...activeShow,
        targetDuration: targetLengthMin * 60,
        genre: selectedGenre,
        tracks: selectedTracks,
        announcements: generatedAnnouncements,
        updatedAt: new Date().toISOString(),
      };

      onUpdateShow(updated);
      setShowAiModal(false);
    } catch (err: any) {
      alert("AI Show Generation failed: " + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div id="show-builder-view" className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header & Runtime Target Progress */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono uppercase text-cyan-400 font-semibold tracking-wider">
              Sequence Master
            </span>
            <span className="text-xs font-mono text-neutral-400">• Ep #{activeShow.episodeNumber}</span>
          </div>
          <h2 className="text-2xl font-bold text-neutral-100 tracking-tight">
            Show Running Order: {activeShow.name}
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Arrange tracks, insert DJ speech links, configure voice ducking, and view broadcast duration timing.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            id="builder-btn-ai-generate"
            onClick={() => setShowAiModal(true)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-cyan-500/20 transition cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>AI Show Generator</span>
          </button>

          <button
            id="builder-btn-auto-transitions"
            onClick={handleAutoDetectAllTransitions}
            disabled={activeShow.tracks.length < 2}
            className="px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-neutral-200 text-xs font-medium flex items-center gap-2 border border-neutral-700 transition cursor-pointer"
            title="Auto-analyze tempo & energy deltas and assign optimal crossfades, beat-matches, or cuts"
          >
            <Zap className="w-4 h-4 text-cyan-400" />
            <span>Auto-Match Transitions</span>
          </button>

          <button
            id="builder-btn-global-transition-default"
            onClick={() => setShowGlobalTransitionModal(true)}
            className="px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium flex items-center gap-2 border border-neutral-700 transition cursor-pointer"
            title="Configure global transition preset and defaults for consistent radio show blending"
          >
            <SlidersHorizontal className="w-4 h-4 text-cyan-400" />
            <span>Global Defaults</span>
            {activeShow.defaultTransition?.presetName && (
              <span className="hidden lg:inline text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-semibold">
                {activeShow.defaultTransition.presetName}
              </span>
            )}
          </button>

          <button
            id="builder-btn-gen-announcements"
            onClick={handleGenerateAllAnnouncements}
            disabled={isGeneratingAnnouncements || activeShow.tracks.length === 0}
            className="px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-neutral-200 text-xs font-medium flex items-center gap-2 border border-neutral-700 transition cursor-pointer"
          >
            <Mic className="w-4 h-4 text-amber-400" />
            <span>{isGeneratingAnnouncements ? "Writing Scripts..." : "Auto-Generate DJ Links"}</span>
          </button>

          <button
            id="builder-btn-timeline"
            onClick={onNavigateToTimeline}
            className="px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium flex items-center gap-2 border border-neutral-700 transition cursor-pointer"
          >
            <Sliders className="w-4 h-4 text-cyan-400" />
            <span>View Timeline</span>
          </button>
        </div>
      </div>

      {/* Runtime Bar Widget */}
      <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800/80 space-y-2">
        <div className="flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-4">
            <span className="text-neutral-300">
              Total Show Time:{" "}
              <strong className="text-cyan-400 font-bold">{formatMinSec(totalDuration)}</strong>
            </span>
            <span className="text-neutral-500">
              (Music: {formatMinSec(totalTrackDuration)} • Voice: {formatMinSec(totalAnnounceDuration)})
            </span>
          </div>
          <span className="text-neutral-400">
            Target: {formatMinSec(activeShow.targetDuration)} ({progressPercent}%)
          </span>
        </div>
        <div className="w-full bg-neutral-950 h-2.5 rounded-full overflow-hidden border border-neutral-800 flex">
          <div
            className="bg-cyan-500 h-full transition-all duration-300"
            style={{ width: `${Math.min(100, (totalTrackDuration / activeShow.targetDuration) * 100)}%` }}
            title="Music Duration"
          />
          <div
            className="bg-amber-400 h-full transition-all duration-300"
            style={{ width: `${Math.min(100, (totalAnnounceDuration / activeShow.targetDuration) * 100)}%` }}
            title="Spoken DJ Duration"
          />
        </div>
      </div>

      {/* Global Transition Default Banner */}
      <div className="p-3.5 rounded-xl bg-neutral-900/70 border border-neutral-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center text-cyan-400 shrink-0">
            <SlidersHorizontal className="w-4.5 h-4.5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-neutral-100">Global Transition Preset</span>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                {activeShow.defaultTransition?.presetName || "Smooth Radio Crossfade"}
              </span>
              <span className="text-[11px] font-mono text-neutral-400">
                (
                {activeShow.defaultTransition?.type === "crossfade"
                  ? `${(activeShow.defaultTransition.duration ?? 4.0).toFixed(1)}s • ${activeShow.defaultTransition.curve || "equal_power"}`
                  : activeShow.defaultTransition?.type === "beat_match"
                  ? `${activeShow.defaultTransition.beatAlignBars || 8} Bars • Beat-Synced`
                  : activeShow.defaultTransition?.cutStyle || "Instant Drop"}
                )
              </span>
            </div>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              Standardized transition applied to all newly added tracks and uncustomized boundaries across this show.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <button
            onClick={() => setShowGlobalTransitionModal(true)}
            className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition border border-neutral-700 cursor-pointer shadow-sm"
          >
            <Sliders className="w-3.5 h-3.5 text-cyan-400" />
            <span>Edit Global Default</span>
          </button>
        </div>
      </div>

      {/* Show Running Order List */}
      <div className="space-y-3">
        {/* Intro Announcement Position */}
        <div className="p-3 rounded-lg bg-neutral-950/70 border border-dashed border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-amber-500/15 text-amber-300 border border-amber-500/30">
              Show Opening
            </span>
            <span className="text-xs text-neutral-400">Station Opening Hook & Show Intro</span>
          </div>
          <button
            onClick={() => handleAddAnnouncementAt(0, "intro")}
            className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-[11px] font-mono text-neutral-300 flex items-center gap-1 transition cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            <span>Add Intro Link</span>
          </button>
        </div>

        {/* Tracks & In-Between Announcements */}
        {activeShow.tracks.length === 0 ? (
          <div className="py-16 text-center rounded-xl border border-dashed border-neutral-800 bg-neutral-900/30 p-6">
            <Music2 className="w-10 h-10 text-neutral-600 mx-auto mb-2" />
            <h4 className="text-sm font-semibold text-neutral-300">Running Order is Empty</h4>
            <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
              Use the AI Show Generator to curate a sequenced playlist, or manually add tracks from your audio library.
            </p>
            <div className="flex justify-center gap-3 mt-4">
              <button
                onClick={() => setShowAiModal(true)}
                className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Auto-Curate with AI</span>
              </button>
              <button
                onClick={() => setShowAddTrackModal(true)}
                className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add from Library</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {activeShow.tracks.map((track, index) => {
              // Find any announcement placed before or after this track
              const announcementsHere = activeShow.announcements.filter(
                (a) => a.positionIndex === index
              );
              const isTrackPlaying = nowPlaying?.id === track.id && isPlaying;

              return (
                <React.Fragment key={track.id + "_" + index}>
                  {/* Any announcements linked at this slot */}
                  {announcementsHere.map((ann) => {
                    const isAnnPlaying = nowPlaying?.id === ann.id && isPlaying;
                    return (
                      <div
                        key={ann.id}
                        className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-800/40 text-xs space-y-2 shadow-sm"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                              <Mic className="w-3 h-3" />
                              <span>{ann.placement.replace("_", " ")}</span>
                            </span>
                            <span className="font-semibold text-neutral-200">{ann.title}</span>
                            <span className="text-[11px] font-mono text-neutral-400">
                              (~{ann.duration}s)
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {ann.audioUrl ? (
                              <button
                                onClick={() =>
                                  isAnnPlaying ? togglePlay() : playAnnouncement(ann)
                                }
                                className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[11px] font-mono flex items-center gap-1 transition"
                              >
                                {isAnnPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 fill-current" />}
                                <span>Audition Voice</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => handleSynthesizeAnnouncement(ann)}
                                disabled={synthesizingId === ann.id}
                                className="px-2.5 py-1 rounded bg-cyan-600/80 hover:bg-cyan-600 text-white text-[11px] font-mono flex items-center gap-1 transition cursor-pointer"
                              >
                                <Wand2 className="w-3 h-3" />
                                <span>
                                  {synthesizingId === ann.id ? "Synthesizing..." : "Synthesize Speech"}
                                </span>
                              </button>
                            )}
                            <button
                              onClick={() => handleRemoveAnnouncement(ann.id)}
                              className="p-1 text-neutral-400 hover:text-rose-400 transition"
                              title="Delete announcement"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Script Editor Box */}
                        <div className="relative">
                          <textarea
                            rows={2}
                            value={ann.scriptText}
                            onChange={(e) => handleUpdateAnnouncementScript(ann.id, e.target.value)}
                            className="w-full p-2 rounded bg-neutral-950/80 border border-neutral-800 text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-amber-500 font-sans"
                          />
                        </div>

                        <div className="flex items-center justify-between text-[11px] font-mono text-neutral-400 pt-1">
                          <span>Voice: {ann.voiceName || activeShow.voiceName || "Kore"}</span>
                          <span>Auto-Music Ducking: -12 dB</span>
                        </div>
                      </div>
                    );
                  })}

                  {/* Main Track Item Card */}
                  <div className="p-3.5 rounded-xl bg-neutral-900/80 border border-neutral-800/80 hover:border-neutral-700 flex items-center justify-between gap-4 transition group">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono text-neutral-500 w-5 text-center text-xs">
                        {index + 1}
                      </span>

                      <button
                        onClick={() => (isTrackPlaying ? togglePlay() : playTrack(track))}
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition shrink-0 ${
                          isTrackPlaying
                            ? "bg-cyan-500 text-white"
                            : "bg-neutral-800 text-neutral-300 group-hover:bg-neutral-700"
                        }`}
                        title="Audition track"
                      >
                        {isTrackPlaying ? (
                          <Pause className="w-4 h-4 fill-current" />
                        ) : (
                          <Play className="w-4 h-4 fill-current ml-0.5" />
                        )}
                      </button>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-neutral-100 text-sm truncate">
                            {track.title}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-neutral-800 text-neutral-400">
                            {track.genre}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-neutral-400 mt-0.5">
                          <span>{track.artist}</span>
                          <span>•</span>
                          <span>{track.album || "Single"}</span>
                          {track.bpm && (
                            <>
                              <span>•</span>
                              <span className="font-mono text-neutral-300">{track.bpm} BPM</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <span className="font-mono text-xs text-neutral-300">
                        {formatMinSec(track.duration)}
                      </span>

                      {/* Add Announcement Between Button */}
                      <button
                        onClick={() => handleAddAnnouncementAt(index + 1, "between_tracks")}
                        className="px-2 py-1 rounded bg-neutral-800 hover:bg-amber-500/20 text-neutral-400 hover:text-amber-300 text-[11px] font-mono flex items-center gap-1 transition cursor-pointer"
                        title="Add spoken link after this track"
                      >
                        <Mic className="w-3 h-3" />
                        <span className="hidden sm:inline">Add Voice Link</span>
                      </button>

                      {/* Move Up / Down Buttons */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => moveTrack(index, "up")}
                          disabled={index === 0}
                          className="p-1 text-neutral-400 hover:text-neutral-200 disabled:opacity-30 transition"
                          title="Move up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => moveTrack(index, "down")}
                          disabled={index === activeShow.tracks.length - 1}
                          className="p-1 text-neutral-400 hover:text-neutral-200 disabled:opacity-30 transition"
                          title="Move down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => removeTrack(index)}
                          className="p-1 text-neutral-400 hover:text-rose-400 transition ml-1"
                          title="Remove from show"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Transition Connector Between Track index and Track index + 1 */}
                  {index < activeShow.tracks.length - 1 && (() => {
                    const nextTrack = activeShow.tracks[index + 1];
                    const trans = getTransitionBetween(track.id, nextTrack.id);
                    const isCrossfade = trans.type === "crossfade";
                    const isBeatMatch = trans.type === "beat_match";
                    const isCut = trans.type === "cut";

                    return (
                      <div
                        key={`trans_conn_${track.id}_${nextTrack.id}`}
                        className="my-1.5 p-2.5 rounded-xl bg-neutral-950/70 border border-neutral-800/90 hover:border-neutral-700 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      >
                        {/* Transition Information & Badges */}
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <div className="flex items-center gap-1.5 font-mono text-[11px]">
                            <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400/50" />
                            <span className="text-neutral-400 font-bold uppercase tracking-wider">Transition</span>
                            <ArrowRight className="w-3 h-3 text-neutral-600" />
                          </div>

                          {isCrossfade && (
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 flex items-center gap-1.5">
                              <Zap className="w-3 h-3 text-cyan-400" />
                              <span>Crossfade ({trans.duration.toFixed(1)}s • {trans.curve})</span>
                            </span>
                          )}

                          {isBeatMatch && (
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30 flex items-center gap-1.5">
                              <Layers className="w-3 h-3 text-purple-400" />
                              <span>Beat-Match ({trans.beatAlignBars || 8} Bars • {trans.tempoSync ? "Tempo Locked" : "Free"})</span>
                            </span>
                          )}

                          {isCut && (
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30 flex items-center gap-1.5">
                              <Scissors className="w-3 h-3 text-rose-400" />
                              <span>Cut ({trans.cutStyle === "pause" ? `${(trans.pauseDuration || 0.5).toFixed(1)}s Silence Gap` : trans.cutStyle || "Instant Drop"})</span>
                            </span>
                          )}

                          {/* BPM Comparison & Delta indicator */}
                          {track.bpm && nextTrack.bpm && (
                            <span className="text-[10px] font-mono text-neutral-400 bg-neutral-900 px-1.5 py-0.5 rounded border border-neutral-800">
                              {track.bpm} &rarr; {nextTrack.bpm} BPM
                              {Math.abs(nextTrack.bpm - track.bpm) === 0 ? (
                                <span className="text-emerald-400 ml-1 font-bold">Perfect Match</span>
                              ) : (
                                <span className="text-neutral-500 ml-1">
                                  (&Delta; {nextTrack.bpm - track.bpm > 0 ? `+${nextTrack.bpm - track.bpm}` : nextTrack.bpm - track.bpm})
                                </span>
                              )}
                            </span>
                          )}
                        </div>

                        {/* Quick Type Selection & Transition Editor Modal Trigger */}
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex items-center bg-neutral-900 rounded-lg p-0.5 border border-neutral-800">
                            <button
                              type="button"
                              onClick={() => handleQuickSetTransitionType(track.id, nextTrack.id, "crossfade")}
                              className={`px-2 py-1 rounded text-[10px] font-mono font-semibold transition cursor-pointer flex items-center gap-1 ${
                                isCrossfade ? "bg-cyan-500 text-neutral-950 font-bold shadow-sm" : "text-neutral-400 hover:text-neutral-200"
                              }`}
                              title="Quick-set crossfade"
                            >
                              <Zap className="w-2.5 h-2.5" />
                              <span>Fade</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleQuickSetTransitionType(track.id, nextTrack.id, "beat_match")}
                              className={`px-2 py-1 rounded text-[10px] font-mono font-semibold transition cursor-pointer flex items-center gap-1 ${
                                isBeatMatch ? "bg-purple-600 text-white font-bold shadow-sm" : "text-neutral-400 hover:text-neutral-200"
                              }`}
                              title="Quick-set beat-match sync"
                            >
                              <Layers className="w-2.5 h-2.5" />
                              <span>Beat-Sync</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleQuickSetTransitionType(track.id, nextTrack.id, "cut")}
                              className={`px-2 py-1 rounded text-[10px] font-mono font-semibold transition cursor-pointer flex items-center gap-1 ${
                                isCut ? "bg-rose-600 text-white font-bold shadow-sm" : "text-neutral-400 hover:text-neutral-200"
                              }`}
                              title="Quick-set instant cut / gap"
                            >
                              <Scissors className="w-2.5 h-2.5" />
                              <span>Cut</span>
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              setEditingTransitionPair({
                                fromTrack: track,
                                toTrack: nextTrack,
                                transition: trans,
                              })
                            }
                            className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white text-xs font-medium flex items-center gap-1.5 transition border border-neutral-700 cursor-pointer shadow-sm"
                            title="Open Transition Editor with live dual-deck preview and envelope controls"
                          >
                            <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Edit Transition</span>
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </React.Fragment>
              );
            })}

            {/* Outro Announcement Position */}
            <div className="p-3 rounded-lg bg-neutral-950/70 border border-dashed border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  Show Signoff
                </span>
                <span className="text-xs text-neutral-400">Closing credits, track recap & signoff</span>
              </div>
              <button
                onClick={() => handleAddAnnouncementAt(activeShow.tracks.length, "outro")}
                className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-[11px] font-mono text-neutral-300 flex items-center gap-1 transition cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Add Outro Link</span>
              </button>
            </div>
          </div>
        )}

        <div className="pt-2 flex justify-end">
          <button
            onClick={() => setShowAddTrackModal(true)}
            className="px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-medium text-neutral-200 flex items-center gap-2 border border-neutral-700 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add More Tracks from Library</span>
          </button>
        </div>
      </div>

      {/* AI Show Generator Modal */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <h3 className="text-base font-bold text-neutral-100">
                  Gemini AI Radio Show Generator
                </h3>
              </div>
              <button
                onClick={() => setShowAiModal(false)}
                className="text-neutral-500 hover:text-neutral-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-mono text-neutral-400 block mb-1">
                    Target Broadcast Length
                  </label>
                  <select
                    value={targetLengthMin}
                    onChange={(e) => setTargetLengthMin(parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-neutral-200 focus:outline-none"
                  >
                    <option value={15}>15 Minutes (Mini Mix)</option>
                    <option value={30}>30 Minutes (Short Broadcast)</option>
                    <option value={60}>60 Minutes (Standard 1 Hour)</option>
                    <option value={90}>90 Minutes (Club Session)</option>
                    <option value={120}>120 Minutes (2 Hour Special)</option>
                  </select>
                </div>
                <div>
                  <label className="font-mono text-neutral-400 block mb-1">
                    Approximate Tracks Target
                  </label>
                  <input
                    type="number"
                    min={3}
                    max={40}
                    value={targetTracks}
                    onChange={(e) => setTargetTracks(parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-neutral-200 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-mono text-neutral-400 block mb-1">
                    Genre / Sound Palette
                  </label>
                  <input
                    type="text"
                    value={selectedGenre}
                    onChange={(e) => setSelectedGenre(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-neutral-200 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-mono text-neutral-400 block mb-1">
                    Energy Flow Curve
                  </label>
                  <select
                    value={energyCurve}
                    onChange={(e) => setEnergyCurve(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-neutral-200 focus:outline-none"
                  >
                    <option value="peak">Peak Energy Throughout (Rave / Hardcore)</option>
                    <option value="high">Consistently High (Club Prime)</option>
                    <option value="building">Warm-up Building to Climax</option>
                    <option value="rollercoaster">Waves (High / Low Transitions)</option>
                    <option value="smooth">Smooth Flow (Ambient / Chill)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-mono text-neutral-400 block mb-1">
                  Host Style & Persona
                </label>
                <input
                  type="text"
                  value={hostStyle}
                  onChange={(e) => setHostStyle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-neutral-200 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-mono text-neutral-400 block mb-1">
                  Announcement Frequency
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["minimal", "moderate", "frequent"] as const).map((freq) => (
                    <button
                      key={freq}
                      type="button"
                      onClick={() => setAnnouncementFreq(freq)}
                      className={`py-2 px-3 rounded-lg border font-mono capitalize transition ${
                        announcementFreq === freq
                          ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                          : "bg-neutral-950 border-neutral-800 text-neutral-400"
                      }`}
                    >
                      {freq}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-mono text-neutral-400 block mb-1">
                  Custom Producer Prompt (Optional instructions)
                </label>
                <textarea
                  rows={2}
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="e.g. Focus on tracks with high BPM, include an energetic middle peak, and mention track facts."
                  className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-neutral-200 focus:outline-none placeholder-neutral-600"
                />
              </div>

              <div className="p-3 rounded-lg bg-cyan-950/20 border border-cyan-800/30 text-[11px] text-cyan-300 leading-relaxed">
                Gemini will inspect your {tracks.length} local audio library tracks, evaluate their metadata and BPMs, select the best sequence to fill ~{targetLengthMin} minutes, and write custom DJ spoken links.
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setShowAiModal(false)}
                  className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRunAiGenerator}
                  disabled={isGenerating}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold flex items-center gap-2 transition cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{isGenerating ? "Gemini Curating Show..." : "Generate Running Order"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Track From Library Drawer/Modal */}
      {showAddTrackModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between mb-4 border-b border-neutral-800 pb-3">
              <h3 className="text-base font-bold text-neutral-100">Add Track to Running Order</h3>
              <button
                onClick={() => setShowAddTrackModal(false)}
                className="text-neutral-500 hover:text-neutral-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4">
              <input
                type="text"
                value={trackSearchQuery}
                onChange={(e) => setTrackSearchQuery(e.target.value)}
                placeholder="Search library tracks by title, artist, genre, BPM..."
                className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-xs text-neutral-100 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {tracks
                .filter(
                  (t) =>
                    !trackSearchQuery ||
                    t.title.toLowerCase().includes(trackSearchQuery.toLowerCase()) ||
                    t.artist.toLowerCase().includes(trackSearchQuery.toLowerCase()) ||
                    t.genre.toLowerCase().includes(trackSearchQuery.toLowerCase())
                )
                .map((track) => {
                  const alreadyInShow = activeShow.tracks.some((t) => t.id === track.id);
                  return (
                    <div
                      key={track.id}
                      className="p-3 rounded-lg bg-neutral-950/60 border border-neutral-800/80 hover:bg-neutral-800/40 flex items-center justify-between text-xs transition"
                    >
                      <div className="min-w-0 pr-3">
                        <div className="font-semibold text-neutral-200 truncate">{track.title}</div>
                        <div className="text-[11px] text-neutral-400 truncate">
                          {track.artist} • {track.genre} • {track.bpm ? `${track.bpm} BPM` : ""}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-mono text-neutral-400 text-xs">
                          {formatMinSec(track.duration)}
                        </span>
                        <button
                          onClick={() => {
                            const newTracks = [...activeShow.tracks, track];
                            let newTransitions = [...(activeShow.transitions || [])];

                            // Automatically populate new transition using default preset
                            if (activeShow.tracks.length > 0) {
                              const lastTrack = activeShow.tracks[activeShow.tracks.length - 1];
                              const def = activeShow.defaultTransition;
                              newTransitions.push({
                                id: `tr_${lastTrack.id}_${track.id}`,
                                fromTrackId: lastTrack.id,
                                toTrackId: track.id,
                                type: def?.type || "crossfade",
                                duration: def?.type === "crossfade" ? (def.duration ?? 4.0) : (def?.duration ?? 0),
                                curve: def?.curve || "equal_power",
                                beatAlignBars: def?.beatAlignBars,
                                tempoSync: def?.tempoSync,
                                eqSwap: def?.eqSwap,
                                cutStyle: def?.cutStyle,
                                pauseDuration: def?.pauseDuration,
                                notes: def?.presetName || "Default Transition",
                              });
                            }

                            const updated: RadioShow = {
                              ...activeShow,
                              tracks: newTracks,
                              transitions: newTransitions,
                              updatedAt: new Date().toISOString(),
                            };
                            onUpdateShow(updated);
                          }}
                          className={`px-2.5 py-1 rounded text-[11px] font-semibold transition ${
                            alreadyInShow
                              ? "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"
                              : "bg-cyan-600 hover:bg-cyan-500 text-white"
                          }`}
                        >
                          {alreadyInShow ? "Add Again" : "Add to Show"}
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>

            <div className="pt-4 mt-4 border-t border-neutral-800 flex justify-end">
              <button
                onClick={() => setShowAddTrackModal(false)}
                className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs text-neutral-200"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transition Editor Modal */}
      {editingTransitionPair && (
        <TransitionEditorModal
          isOpen={true}
          onClose={() => setEditingTransitionPair(null)}
          fromTrack={editingTransitionPair.fromTrack}
          toTrack={editingTransitionPair.toTrack}
          transition={editingTransitionPair.transition}
          onSaveTransition={handleSaveTransition}
          onApplyToAll={handleApplyTransitionToAll}
        />
      )}

      {/* Global Transition Default Modal */}
      <GlobalTransitionDefaultModal
        isOpen={showGlobalTransitionModal}
        onClose={() => setShowGlobalTransitionModal(false)}
        currentDefault={activeShow.defaultTransition}
        trackCount={activeShow.tracks.length}
        onSaveDefault={handleSaveGlobalTransitionDefault}
      />
    </div>
  );
};
