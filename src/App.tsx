import React, { useState, useEffect, useCallback } from "react";
import { Sidebar, TabType } from "./components/Sidebar.js";
import { TransportBar } from "./components/TransportBar.js";
import { DashboardView } from "./components/DashboardView.js";
import { LibraryView } from "./components/LibraryView.js";
import { ShowsView } from "./components/ShowsView.js";
import { ShowBuilderView } from "./components/ShowBuilderView.js";
import { TimelineView } from "./components/TimelineView.js";
import { VoiceStudioView } from "./components/VoiceStudioView.js";
import { RenderView } from "./components/RenderView.js";
import { SettingsView } from "./components/SettingsView.js";
import { AudioPlayerProvider } from "./context/AudioPlayerContext.js";
import {
  AudioTrack,
  LibraryFolder,
  RadioShow,
  RenderJob,
  ScanStatus,
} from "./types.js";
import { api } from "./services/api.js";

export function App() {
  const [currentTab, setCurrentTab] = useState<TabType>("dashboard");
  const [tracks, setTracks] = useState<AudioTrack[]>([]);
  const [folders, setFolders] = useState<LibraryFolder[]>([]);
  const [shows, setShows] = useState<RadioShow[]>([]);
  const [activeShow, setActiveShow] = useState<RadioShow | null>(null);
  const [renderJobs, setRenderJobs] = useState<RenderJob[]>([]);
  const [scanStatus, setScanStatus] = useState<ScanStatus>({
    isScanning: false,
    isPaused: false,
    totalFiles: 0,
    scannedFiles: 0,
    filesAdded: 0,
    filesChanged: 0,
    filesRemoved: 0,
    errorCount: 0,
    currentFile: "",
    progressPercent: 0,
  });

  // Fetch initial data
  const refreshLibrary = useCallback(async () => {
    try {
      const data = await api.getAssets();
      setTracks(data);
    } catch (e) {
      console.warn("Failed to fetch assets:", e);
    }
  }, []);

  const refreshFolders = useCallback(async () => {
    try {
      const data = await api.getFolders();
      setFolders(data);
    } catch (e) {
      console.warn("Failed to fetch folders:", e);
    }
  }, []);

  const refreshShows = useCallback(async () => {
    try {
      const data = await api.getShows();
      if (data.length > 0) {
        setShows(data);
        if (!activeShow) {
          setActiveShow(data[0]);
        }
      } else {
        // Create initial starter show with discovered library tracks
        const libTracks = await api.getAssets();
        const starterShow: RadioShow = {
          id: "show_default_001",
          name: "Null Sector Sessions #001",
          stationName: "Null Sector Radio",
          hostName: "DJ Timbor",
          episodeNumber: 1,
          date: new Date().toISOString().slice(0, 10),
          description: "High-energy underground electronic broadcast featuring breakbeats, synthwave, and acid techno.",
          genre: "Electronic / Rave",
          targetDuration: 3600,
          introText: "Welcome to Null Sector Sessions episode 1! I'm your host DJ Timbor. Lock in and crank it up!",
          outroText: "That's it for episode 1. Keep the bass rolling and stay tuned for the next broadcast!",
          voicePersonality: "Energetic underground club DJ",
          voiceName: "Kore",
          voiceSpeed: 1.0,
          voicePitch: 1.0,
          tracks: libTracks.slice(0, 4),
          announcements: [
            {
              id: "ann_intro_001",
              showId: "show_default_001",
              positionIndex: 0,
              placement: "intro",
              title: "Station Intro & Host Welcome",
              scriptText: "Welcome to Null Sector Sessions episode 1! I'm your host DJ Timbor, and we're kicking things off with heavy electronic heat.",
              voiceName: "Kore",
              duration: 7,
              duckMusic: true,
              duckingLevel: 0.25,
            },
          ],
          segments: [],
          renderSettings: {
            format: "mp3",
            bitrate: "320k",
            sampleRate: 44100,
            normalizeAudio: true,
            crossfadeDuration: 3,
            duckingLevel: 0.25,
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await api.saveShow(starterShow);
        setShows([starterShow]);
        setActiveShow(starterShow);
      }
    } catch (e) {
      console.warn("Failed to fetch shows:", e);
    }
  }, [activeShow]);

  const refreshJobs = useCallback(async () => {
    try {
      const data = await api.getRenderJobs();
      setRenderJobs(data);
    } catch (e) {
      console.warn("Failed to fetch render jobs:", e);
    }
  }, []);

  useEffect(() => {
    refreshLibrary();
    refreshFolders();
    refreshShows();
    refreshJobs();
  }, [refreshLibrary, refreshFolders, refreshShows, refreshJobs]);

  // Scanner status polling
  useEffect(() => {
    let interval: any = null;
    let wasScanning = false;
    const checkScanner = async () => {
      try {
        const st = await api.getScanStatus();
        setScanStatus(st);
        if (st.isScanning) {
          wasScanning = true;
          refreshLibrary();
          refreshFolders();
        } else if (wasScanning) {
          wasScanning = false;
          refreshLibrary();
          refreshFolders();
        }
      } catch (_) {}
    };

    interval = setInterval(checkScanner, 1500);
    return () => clearInterval(interval);
  }, [refreshLibrary, refreshFolders]);

  const handleUpdateShow = async (updated: RadioShow) => {
    setActiveShow(updated);
    try {
      await api.saveShow(updated);
      setShows((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    } catch (err: any) {
      console.warn("Auto-save show failed:", err);
    }
  };

  const handleAddTrackToShow = (track: AudioTrack) => {
    if (!activeShow) {
      alert("Select or create a radio show first.");
      return;
    }
    const updated: RadioShow = {
      ...activeShow,
      tracks: [...activeShow.tracks, track],
      updatedAt: new Date().toISOString(),
    };
    handleUpdateShow(updated);
  };

  return (
    <AudioPlayerProvider>
      <div id="studio-app" className="flex h-screen w-screen bg-neutral-950 text-neutral-100 overflow-hidden font-sans select-none">
        {/* Left Sidebar */}
        <Sidebar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          activeShow={activeShow}
          trackCount={tracks.length}
        />

        {/* Main Production Workspace */}
        <main className="flex-1 h-screen overflow-y-auto pb-28">
          {currentTab === "dashboard" && (
            <DashboardView
              activeShow={activeShow}
              tracks={tracks}
              renderJobs={renderJobs}
              onNavigate={setCurrentTab}
              onOpenGenerator={() => setCurrentTab("builder")}
            />
          )}

          {currentTab === "library" && (
            <LibraryView
              tracks={tracks}
              folders={folders}
              scanStatus={scanStatus}
              activeShow={activeShow}
              onRefreshLibrary={refreshLibrary}
              onRefreshFolders={refreshFolders}
              onAddTrackToShow={handleAddTrackToShow}
            />
          )}

          {currentTab === "shows" && (
            <ShowsView
              shows={shows}
              activeShow={activeShow}
              onSelectShow={setActiveShow}
              onRefreshShows={refreshShows}
              onNavigateToBuilder={() => setCurrentTab("builder")}
            />
          )}

          {currentTab === "builder" && (
            <ShowBuilderView
              activeShow={activeShow}
              tracks={tracks}
              onUpdateShow={handleUpdateShow}
              onNavigateToTimeline={() => setCurrentTab("timeline")}
              onNavigateToVoice={() => setCurrentTab("voice")}
            />
          )}

          {currentTab === "timeline" && <TimelineView activeShow={activeShow} />}

          {currentTab === "voice" && (
            <VoiceStudioView activeShow={activeShow} onUpdateShow={handleUpdateShow} />
          )}

          {currentTab === "render" && (
            <RenderView
              activeShow={activeShow}
              renderJobs={renderJobs}
              onRefreshJobs={refreshJobs}
            />
          )}

          {currentTab === "settings" && <SettingsView />}
        </main>

        {/* Bottom Persistent Transport Bar */}
        <TransportBar />
      </div>
    </AudioPlayerProvider>
  );
}

export default App;
