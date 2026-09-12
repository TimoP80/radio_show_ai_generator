import React, { useState, useEffect } from "react";
import {
  Settings,
  Sparkles,
  Database,
  Cpu,
  CheckCircle2,
  HardDrive,
  Sliders,
  Volume2,
  ShieldCheck,
} from "lucide-react";
import { api } from "../services/api.js";

export const SettingsView: React.FC = () => {
  const [systemInfo, setSystemInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getSystemStatus()
      .then((info) => setSystemInfo(info))
      .catch(console.warn)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div id="settings-view" className="p-8 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <span className="text-xs font-mono uppercase text-cyan-400 font-semibold tracking-wider">
          Configuration & Diagnostics
        </span>
        <h2 className="text-2xl font-bold text-neutral-100 tracking-tight">Studio Settings</h2>
        <p className="text-xs text-neutral-400 mt-0.5">
          System telemetry, audio processing parameters, Gemini model connection, and local storage layout.
        </p>
      </div>

      <div className="space-y-6">
        {/* Gemini AI Status */}
        <div className="p-6 rounded-2xl bg-neutral-900/60 border border-neutral-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-neutral-100">Gemini AI Studio Engine</h3>
                <p className="text-xs text-neutral-400">
                  Track analysis, running order curation, and speech synthesis
                </p>
              </div>
            </div>
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-mono font-semibold flex items-center gap-1.5 ${
                systemInfo?.hasGeminiKey
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{systemInfo?.hasGeminiKey ? "API Key Connected" : "Local Fallback Ready"}</span>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs font-mono">
            <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800">
              <span className="text-neutral-500 block text-[10px]">Curation & Logic Model</span>
              <span className="text-neutral-200">gemini-2.5-flash</span>
            </div>
            <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800">
              <span className="text-neutral-500 block text-[10px]">Text-to-Speech Engine</span>
              <span className="text-neutral-200">gemini-3.1-flash-tts-preview</span>
            </div>
            <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800">
              <span className="text-neutral-500 block text-[10px]">Speech Fallback</span>
              <span className="text-neutral-200">FFmpeg Multi-Tone Synthesis</span>
            </div>
          </div>
        </div>

        {/* Audio Engine Configuration */}
        <div className="p-6 rounded-2xl bg-neutral-900/60 border border-neutral-800 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-neutral-800 flex items-center justify-center">
              <Sliders className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-100">Broadcast Audio Processing Defaults</h3>
              <p className="text-xs text-neutral-400">
                DSP parameters used during rendering and live auditioning
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3.5 rounded-lg bg-neutral-950 border border-neutral-800 space-y-1">
              <span className="font-semibold text-neutral-200 block">Default Music Crossfade</span>
              <p className="text-neutral-400">
                3.0 seconds exponential equal-power crossfade curve
              </p>
            </div>
            <div className="p-3.5 rounded-lg bg-neutral-950 border border-neutral-800 space-y-1">
              <span className="font-semibold text-neutral-200 block">Vocal Music Ducking</span>
              <p className="text-neutral-400">
                -12 dB attenuation during spoken DJ speech links with 350ms attack/release
              </p>
            </div>
            <div className="p-3.5 rounded-lg bg-neutral-950 border border-neutral-800 space-y-1">
              <span className="font-semibold text-neutral-200 block">EBU R128 Master Target</span>
              <p className="text-neutral-400">
                -23 LUFS integrated loudness, -1.0 dBTP maximum true peak
              </p>
            </div>
            <div className="p-3.5 rounded-lg bg-neutral-950 border border-neutral-800 space-y-1">
              <span className="font-semibold text-neutral-200 block">Web Audio Analyser FFT</span>
              <p className="text-neutral-400">
                128 FFT points, 0.8 smoothing constant for stereo peak meters
              </p>
            </div>
          </div>
        </div>

        {/* Local Storage Layout */}
        <div className="p-6 rounded-2xl bg-neutral-900/60 border border-neutral-800 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-neutral-800 flex items-center justify-center">
              <Database className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-100">Local Storage Subsystems</h3>
              <p className="text-xs text-neutral-400">
                All data is persisted strictly to local disk. Original files are never modified.
              </p>
            </div>
          </div>

          <div className="space-y-2 text-xs font-mono">
            <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 flex items-center justify-between">
              <span className="text-neutral-400">SQLite Database</span>
              <span className="text-neutral-200">storage/radio_studio.sqlite</span>
            </div>
            <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 flex items-center justify-between">
              <span className="text-neutral-400">Voice Synthesis Cache</span>
              <span className="text-neutral-200">storage/voice_cache/</span>
            </div>
            <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 flex items-center justify-between">
              <span className="text-neutral-400">Rendered Broadcast Masters</span>
              <span className="text-neutral-200">storage/renders/</span>
            </div>
          </div>
        </div>

        {/* System Architecture */}
        <div className="p-6 rounded-2xl bg-neutral-900/60 border border-neutral-800 space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <h4 className="text-xs font-mono uppercase text-neutral-300 font-bold">
              Production Architecture Guarantee
            </h4>
          </div>
          <p className="text-xs text-neutral-400 leading-relaxed">
            AI Radio Show Creator operates as a standalone production system utilizing native FFmpeg 6+,
            Node.js, SQLite with sql.js, and HTML5 Web Audio API. Audio rendering is non-destructive
            and produces authentic broadcast-standard MP3 and WAV outputs.
          </p>
        </div>
      </div>
    </div>
  );
};
