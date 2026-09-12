import React from "react";
import {
  LayoutDashboard,
  Library,
  Radio,
  Sliders,
  AudioWaveform,
  Mic,
  FileAudio,
  Settings,
  Disc3,
  Wifi,
} from "lucide-react";
import { RadioShow } from "../types.js";

export type TabType =
  | "dashboard"
  | "library"
  | "shows"
  | "builder"
  | "timeline"
  | "voice"
  | "render"
  | "settings";

interface SidebarProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
  activeShow: RadioShow | null;
  trackCount: number;
}

const NAV_ITEMS: Array<{ id: TabType; label: string; icon: React.FC<{ className?: string }> }> = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "library", label: "Audio Library", icon: Library },
  { id: "shows", label: "Radio Shows", icon: Radio },
  { id: "builder", label: "Show Builder", icon: Sliders },
  { id: "timeline", label: "Timeline", icon: AudioWaveform },
  { id: "voice", label: "Voice / TTS", icon: Mic },
  { id: "render", label: "Render", icon: FileAudio },
  { id: "settings", label: "Settings", icon: Settings },
];

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  activeShow,
  trackCount,
}) => {
  return (
    <aside
      id="studio-sidebar"
      className="w-64 bg-neutral-950 border-r border-neutral-800/80 flex flex-col justify-between shrink-0 select-none pb-24"
    >
      {/* Station Branding & Tally */}
      <div>
        <div className="p-5 border-b border-neutral-800/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <Disc3 className="w-5 h-5 text-white animate-spin [animation-duration:8s]" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-neutral-100 tracking-wider">AI RADIO</h1>
                <p className="text-[10px] uppercase font-mono text-cyan-400 font-semibold tracking-widest">
                  Studio Master
                </p>
              </div>
            </div>

            {/* Live On-Air Tally light */}
            <div
              className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[10px] font-mono font-bold tracking-wider animate-pulse"
              title="Broadcast Automation Active"
            >
              <Wifi className="w-3 h-3" />
              <span>ON AIR</span>
            </div>
          </div>

          {/* Active Project Card in Sidebar */}
          <div className="mt-4 p-2.5 rounded-lg bg-neutral-900/80 border border-neutral-800 text-xs">
            <span className="text-[10px] text-neutral-400 font-mono uppercase tracking-wider block">
              Active Show
            </span>
            <p className="font-semibold text-neutral-200 truncate mt-0.5">
              {activeShow ? activeShow.name : "No Show Selected"}
            </p>
            <div className="flex items-center justify-between text-[11px] text-neutral-400 mt-1">
              <span>{activeShow ? `${activeShow.tracks?.length || 0} tracks` : "Create or open a show"}</span>
              <span className="font-mono text-cyan-400">
                {activeShow ? `${Math.round((activeShow.targetDuration || 3600) / 60)} min` : ""}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                id={`sidebar-nav-${item.id}`}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition cursor-pointer ${
                  isActive
                    ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-sm"
                    : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/60"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? "text-cyan-400" : "text-neutral-400"}`} />
                  <span>{item.label}</span>
                </div>

                {item.id === "library" && (
                  <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-neutral-800 text-neutral-300">
                    {trackCount}
                  </span>
                )}
                {item.id === "builder" && activeShow && (
                  <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-cyan-900/60 text-cyan-300 border border-cyan-700/40">
                    {activeShow.tracks?.length || 0}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Info in Sidebar */}
      <div className="px-4 py-3 border-t border-neutral-800/60 text-[11px] text-neutral-400 font-mono flex items-center justify-between">
        <span>SQLite + FFmpeg</span>
        <span className="flex items-center gap-1 text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
          Engine Ready
        </span>
      </div>
    </aside>
  );
};
