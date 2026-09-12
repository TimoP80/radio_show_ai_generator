import React, { useState } from "react";
import {
  Mic,
  Wand2,
  Play,
  Pause,
  Sliders,
  Volume2,
  Sparkles,
  Download,
  Plus,
  Radio,
  FileText,
  Copy,
} from "lucide-react";
import { RadioShow, Announcement } from "../types.js";
import { api } from "../services/api.js";
import { useAudioPlayer } from "../context/AudioPlayerContext.js";

interface VoiceStudioViewProps {
  activeShow: RadioShow | null;
  onUpdateShow: (updated: RadioShow) => void;
}

const TEMPLATES = [
  {
    title: "Station Intro & Opening Hook",
    placement: "intro" as const,
    text: "Welcome back to another massive session on Null Sector Radio! I'm your host DJ Timbor, and for the next hour we're pushing sound systems to the absolute limit. Lock in and crank it loud!",
  },
  {
    title: "Track Segue & Backsell",
    placement: "between_tracks" as const,
    text: "That was an absolute heater right there! Keeping the pressure dialed up as we transition into this next heavy roller. You're tuned into the official sound of the underground.",
  },
  {
    title: "Track Lore & Producer Trivia",
    placement: "between_tracks" as const,
    text: "Fun fact on this upcoming cut — produced straight out of an analog studio in 1998, this track redefined the underground hardcore tempo. Check this out!",
  },
  {
    title: "Station ID Sweeper",
    placement: "station_id" as const,
    text: "Null Sector Radio. The underground electronic broadcast network. 24/7 uninterrupted power.",
  },
  {
    title: "Show Signoff & Credits",
    placement: "outro" as const,
    text: "That brings us to the end of another massive broadcast! Thank you for locking in with DJ Timbor on Null Sector Radio. Stay safe, keep the bass heavy, and catch you next week!",
  },
];

const VOICES = [
  { id: "Kore", name: "Kore", desc: "Clear, punchy, broadcast standard", gender: "Neutral" },
  { id: "Puck", name: "Puck", desc: "Energetic, youthful, hype MC", gender: "Upbeat" },
  { id: "Fenrir", name: "Fenrir", desc: "Deep, resonant, underground late-night", gender: "Deep" },
  { id: "Zephyr", name: "Zephyr", desc: "Smooth, relaxed, atmospheric", gender: "Warm" },
  { id: "Charon", name: "Charon", desc: "Bold, cinematic, authoritative", gender: "Power" },
];

export const VoiceStudioView: React.FC<VoiceStudioViewProps> = ({ activeShow, onUpdateShow }) => {
  const { playCustomAudio, isPlaying, nowPlaying, togglePlay } = useAudioPlayer();

  const [scriptText, setScriptText] = useState(TEMPLATES[0].text);
  const [selectedVoice, setSelectedVoice] = useState(activeShow?.voiceName || "Kore");
  const [personality, setPersonality] = useState(
    activeShow?.voicePersonality || "Energetic, hype radio host"
  );
  const [isSynthesizing, setIsSynthesizing] = useState(false);

  // Result preview
  const [synthesizedResult, setSynthesizedResult] = useState<{
    audioUrl: string;
    duration: number;
    filePath: string;
  } | null>(null);

  const wordCount = scriptText.trim().split(/\s+/).filter(Boolean).length;
  const estimatedDurationSec = Math.max(2, Math.round(scriptText.length * 0.065));

  const handleSynthesize = async () => {
    if (!scriptText.trim()) return;
    setIsSynthesizing(true);
    try {
      const res = await api.synthesizeVoice(scriptText, selectedVoice, personality);
      setSynthesizedResult(res);
      // Auto play preview
      playCustomAudio({
        id: "voice_audition_" + Date.now(),
        title: "Voice Audition",
        artist: `Voice (${selectedVoice})`,
        audioUrl: res.audioUrl,
        duration: res.duration,
        type: "announcement",
      });
    } catch (err: any) {
      alert("Voice synthesis failed: " + err.message);
    } finally {
      setIsSynthesizing(false);
    }
  };

  const handleInsertIntoShow = () => {
    if (!activeShow) {
      alert("Please select a radio show first.");
      return;
    }
    const newAnn: Announcement = {
      id: "ann_studio_" + Date.now(),
      showId: activeShow.id,
      placement: "between_tracks",
      positionIndex: activeShow.tracks.length > 0 ? 1 : 0,
      title: "Studio Spoken Link",
      scriptText,
      voiceName: selectedVoice,
      voiceSpeed: 1.0,
      voicePitch: 1.0,
      duration: synthesizedResult?.duration || estimatedDurationSec,
      audioUrl: synthesizedResult?.audioUrl,
      duckMusic: true,
      duckingLevel: 0.25,
    };

    const updated: RadioShow = {
      ...activeShow,
      announcements: [...activeShow.announcements, newAnn],
      updatedAt: new Date().toISOString(),
    };
    onUpdateShow(updated);
    alert(`Voice announcement inserted into active show "${activeShow.name}"!`);
  };

  return (
    <div id="voice-studio-view" className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <span className="text-xs font-mono uppercase text-cyan-400 font-semibold tracking-wider">
          Voice Production
        </span>
        <h2 className="text-2xl font-bold text-neutral-100 tracking-tight">
          DJ Voice & Announcement Studio
        </h2>
        <p className="text-xs text-neutral-400 mt-0.5">
          Generate professional spoken radio announcements using Gemini Text-to-Speech with broadcast compression and ducking curves.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Script Workbench & Voice Selector */}
        <div className="lg:col-span-2 space-y-6">
          {/* Voice Selector Cards */}
          <div className="p-5 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-3">
            <h3 className="text-xs font-mono uppercase text-neutral-300 font-bold">
              Broadcast Voice Presets
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {VOICES.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setSelectedVoice(v.id)}
                  className={`p-3 rounded-lg border text-left transition cursor-pointer ${
                    selectedVoice === v.id
                      ? "bg-cyan-500/15 border-cyan-500/50 shadow-sm"
                      : "bg-neutral-950/60 border-neutral-800 hover:border-neutral-700"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-neutral-200">{v.name}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400">
                      {v.gender}
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-400 mt-1">{v.desc}</p>
                </button>
              ))}
            </div>

            <div className="pt-2">
              <label className="text-xs font-mono text-neutral-400 block mb-1">
                Voice Personality / Delivery Style
              </label>
              <input
                type="text"
                value={personality}
                onChange={(e) => setPersonality(e.target.value)}
                placeholder="e.g. Energetic rave DJ with fast punchy pacing and club crowd enthusiasm"
                className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-xs text-neutral-100 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* Script Editor Box */}
          <div className="p-5 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono uppercase text-neutral-300 font-bold flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-cyan-400" />
                <span>Spoken Announcement Script</span>
              </h3>
              <span className="text-xs font-mono text-neutral-400">
                {wordCount} words • ~{estimatedDurationSec}s airtime
              </span>
            </div>

            <textarea
              id="voice-script-input"
              rows={5}
              value={scriptText}
              onChange={(e) => setScriptText(e.target.value)}
              placeholder="Type your radio announcement script here..."
              className="w-full p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-cyan-500 leading-relaxed font-sans"
            />

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2 text-xs text-neutral-400">
                <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Broadcasting compression and EQ auto-applied</span>
              </div>

              <button
                id="voice-btn-synthesize"
                onClick={handleSynthesize}
                disabled={isSynthesizing || !scriptText.trim()}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/20 transition cursor-pointer disabled:opacity-50"
              >
                <Wand2 className="w-4 h-4" />
                <span>{isSynthesizing ? "Synthesizing Speech..." : "Synthesize Broadcast Speech"}</span>
              </button>
            </div>
          </div>

          {/* Synthesized Output Audition Card */}
          {synthesizedResult && (
            <div className="p-5 rounded-xl bg-emerald-950/20 border border-emerald-800/40 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase text-emerald-400 font-bold flex items-center gap-1.5">
                  <Mic className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Synthesized Voice Link Ready</span>
                </span>
                <span className="text-xs font-mono text-neutral-300">
                  Exact Duration: {synthesizedResult.duration.toFixed(1)}s
                </span>
              </div>

              <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-neutral-950/80 border border-neutral-800">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() =>
                      playCustomAudio({
                        id: "voice_audition_play",
                        title: "Synthesized Spoken Link",
                        artist: `Voice (${selectedVoice})`,
                        audioUrl: synthesizedResult.audioUrl,
                        duration: synthesizedResult.duration,
                        type: "announcement",
                      })
                    }
                    className="w-9 h-9 rounded-full bg-emerald-500 hover:bg-emerald-400 text-neutral-950 flex items-center justify-center transition"
                  >
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  </button>
                  <div>
                    <p className="text-xs font-semibold text-neutral-200">
                      Broadcast Vocal Track
                    </p>
                    <p className="text-[11px] font-mono text-neutral-400">
                      Sample Rate: 44.1 kHz • Format: WAV
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleInsertIntoShow}
                    className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Insert into Active Show</span>
                  </button>
                  <a
                    href={synthesizedResult.audioUrl}
                    download="announcement.wav"
                    className="p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition"
                    title="Download vocal audio"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right 1 Col: Templates Library */}
        <div className="space-y-4">
          <div className="p-5 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-3">
            <h3 className="text-xs font-mono uppercase text-neutral-300 font-bold">
              Radio Script Templates
            </h3>
            <p className="text-xs text-neutral-400">
              Click any standard radio template to load it into the speech workbench:
            </p>

            <div className="space-y-2.5">
              {TEMPLATES.map((tmpl, idx) => (
                <div
                  key={idx}
                  onClick={() => setScriptText(tmpl.text)}
                  className="p-3 rounded-lg bg-neutral-950/60 hover:bg-neutral-800/50 border border-neutral-800/80 transition cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-neutral-200 group-hover:text-cyan-300 transition">
                      {tmpl.title}
                    </span>
                    <Copy className="w-3 h-3 text-neutral-500 group-hover:text-neutral-300" />
                  </div>
                  <p className="text-xs text-neutral-400 mt-1 line-clamp-2 leading-relaxed">
                    {tmpl.text}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-neutral-900/40 border border-neutral-800/60 text-xs text-neutral-400 space-y-2">
            <span className="font-bold text-neutral-300 block font-mono">
              Broadcast Voice Engine Notes:
            </span>
            <p className="leading-relaxed">
              Synthesized voice links are automatically processed through an FFmpeg compressor and stereo limiter to ensure consistent speech presence when played over music beds.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
