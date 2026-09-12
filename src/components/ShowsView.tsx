import React, { useState } from "react";
import {
  Radio,
  Plus,
  Clock,
  Music2,
  Mic,
  Calendar,
  Trash2,
  Copy,
  FolderOpen,
  X,
  Sliders,
} from "lucide-react";
import { RadioShow } from "../types.js";
import { api } from "../services/api.js";

interface ShowsViewProps {
  shows: RadioShow[];
  activeShow: RadioShow | null;
  onSelectShow: (show: RadioShow) => void;
  onRefreshShows: () => void;
  onNavigateToBuilder: () => void;
}

export const ShowsView: React.FC<ShowsViewProps> = ({
  shows,
  activeShow,
  onSelectShow,
  onRefreshShows,
  onNavigateToBuilder,
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form states
  const [name, setName] = useState("Electronic Velocity Sessions");
  const [stationName, setStationName] = useState("Null Sector Radio");
  const [hostName, setHostName] = useState("DJ Timbor");
  const [episodeNumber, setEpisodeNumber] = useState(1);
  const [genre, setGenre] = useState("Hardcore / Rave / Techno");
  const [targetDurationMin, setTargetDurationMin] = useState(60);
  const [description, setDescription] = useState("High energy underground rave broadcast with continuous club mixing and DJ voice links.");
  const [voicePersonality, setVoicePersonality] = useState("Energetic, hype, underground rave DJ with high broadcast punch");
  const [voiceName, setVoiceName] = useState("Kore");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateShow = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    const newShow: RadioShow = {
      id: "sho_" + Date.now(),
      name: name.trim(),
      stationName: stationName.trim(),
      hostName: hostName.trim(),
      episodeNumber,
      date: new Date().toISOString().split("T")[0],
      description: description.trim(),
      genre: genre.trim(),
      targetDuration: targetDurationMin * 60,
      introText: `Welcome to ${name} on ${stationName}! I'm your host ${hostName}.`,
      outroText: `Thanks for listening to ${name} on ${stationName}. See you next time!`,
      voicePersonality,
      voiceName,
      voiceSpeed: 1.0,
      voicePitch: 1.0,
      tracks: [],
      announcements: [],
      segments: [],
      renderSettings: {
        format: "mp3",
        bitrate: "256k",
        sampleRate: 44100,
        normalizeAudio: true,
        crossfadeDuration: 3,
        duckingLevel: 0.25,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await api.saveShow(newShow);
      onRefreshShows();
      onSelectShow(newShow);
      setShowCreateModal(false);
      onNavigateToBuilder();
    } catch (err: any) {
      alert("Failed to create show: " + err.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteShow = async (showId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Delete this radio show project? Original audio files will not be deleted.")) {
      try {
        await api.deleteShow(showId);
        onRefreshShows();
      } catch (err: any) {
        alert("Failed to delete show: " + err.message);
      }
    }
  };

  const handleDuplicateShow = async (show: RadioShow, e: React.MouseEvent) => {
    e.stopPropagation();
    const duplicated: RadioShow = {
      ...show,
      id: "sho_" + Date.now(),
      name: `${show.name} (Copy)`,
      episodeNumber: show.episodeNumber + 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    try {
      await api.saveShow(duplicated);
      onRefreshShows();
    } catch (err: any) {
      alert("Duplicate failed: " + err.message);
    }
  };

  return (
    <div id="shows-view" className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-mono uppercase text-cyan-400 font-semibold tracking-wider">
            Broadcast Projects
          </span>
          <h2 className="text-2xl font-bold text-neutral-100 tracking-tight">
            Radio Show Projects
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Configure multi-episode programming, DJ voice persona, running orders and broadcast render profiles.
          </p>
        </div>

        <button
          id="shows-btn-new-show"
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs flex items-center gap-2 shadow-lg shadow-cyan-600/20 transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Radio Show</span>
        </button>
      </div>

      {/* Shows Grid */}
      {shows.length === 0 ? (
        <div className="py-20 text-center rounded-2xl bg-neutral-900/50 border border-neutral-800 p-8">
          <Radio className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-neutral-200">No Radio Shows Found</h3>
          <p className="text-xs text-neutral-400 mt-1 max-w-md mx-auto">
            Create your first radio show to start sequencing tracks, placing DJ voice links, and rendering complete broadcasts.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-5 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition"
          >
            Create Radio Show
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {shows.map((show) => {
            const isActive = activeShow?.id === show.id;
            const totalSec = (show.tracks || []).reduce((acc, t) => acc + t.duration, 0);
            const totalMin = Math.round(totalSec / 60);

            return (
              <div
                key={show.id}
                onClick={() => {
                  onSelectShow(show);
                  onNavigateToBuilder();
                }}
                className={`p-5 rounded-xl border transition cursor-pointer flex flex-col justify-between group ${
                  isActive
                    ? "bg-neutral-900/90 border-cyan-500/60 shadow-lg shadow-cyan-500/10"
                    : "bg-neutral-900/50 hover:bg-neutral-900 border-neutral-800 hover:border-neutral-700"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-neutral-800 text-cyan-400 border border-neutral-700">
                      Ep #{show.episodeNumber}
                    </span>
                    {isActive && (
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        Active Project
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-bold text-neutral-100 group-hover:text-cyan-300 transition">
                    {show.name}
                  </h3>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    {show.hostName} • {show.stationName}
                  </p>
                  <p className="text-xs text-neutral-400 mt-2 line-clamp-2 leading-relaxed">
                    {show.description || "No description set"}
                  </p>

                  <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-neutral-800/80 text-xs font-mono">
                    <div className="flex items-center gap-1.5 text-neutral-400">
                      <Music2 className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{show.tracks?.length || 0} tracks</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-neutral-400">
                      <Mic className="w-3.5 h-3.5 text-amber-400" />
                      <span>{show.announcements?.length || 0} DJ links</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-neutral-400">
                      <Clock className="w-3.5 h-3.5 text-neutral-400" />
                      <span>{totalMin}m / {Math.round(show.targetDuration / 60)}m target</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-neutral-400">
                      <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                      <span>{show.date || "2026"}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-neutral-800/80 flex items-center justify-between">
                  <span className="text-[11px] text-neutral-400 font-mono">
                    Voice: {show.voiceName || "Kore"}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => handleDuplicateShow(show, e)}
                      className="p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition"
                      title="Duplicate Show"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => handleDeleteShow(show.id, e)}
                      className="p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-rose-400 transition"
                      title="Delete Show"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Show Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 border-b border-neutral-800 pb-3">
              <h3 className="text-base font-bold text-neutral-100">Create Radio Show Project</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-neutral-500 hover:text-neutral-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateShow} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-mono text-neutral-400 block mb-1">
                    Show Title
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-xs text-neutral-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-mono text-neutral-400 block mb-1">
                    Station / Network Name
                  </label>
                  <input
                    type="text"
                    value={stationName}
                    onChange={(e) => setStationName(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-xs text-neutral-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-mono text-neutral-400 block mb-1">
                    Host / DJ Name
                  </label>
                  <input
                    type="text"
                    value={hostName}
                    onChange={(e) => setHostName(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-xs text-neutral-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-mono text-neutral-400 block mb-1">
                    Episode #
                  </label>
                  <input
                    type="number"
                    value={episodeNumber}
                    min={1}
                    onChange={(e) => setEpisodeNumber(parseInt(e.target.value, 10))}
                    required
                    className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-xs text-neutral-100 focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-mono text-neutral-400 block mb-1">
                    Target Duration (Minutes)
                  </label>
                  <input
                    type="number"
                    value={targetDurationMin}
                    min={5}
                    max={360}
                    onChange={(e) => setTargetDurationMin(parseInt(e.target.value, 10))}
                    required
                    className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-xs text-neutral-100 focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-mono text-neutral-400 block mb-1">
                  Genre & Sound Signature
                </label>
                <input
                  type="text"
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  placeholder="e.g. Hardcore / Frenchcore / Rave / Techno"
                  required
                  className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-xs text-neutral-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-xs font-mono text-neutral-400 block mb-1">
                  Show Description & Format
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-xs text-neutral-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-mono text-neutral-400 block mb-1">
                    DJ Voice Preset (TTS)
                  </label>
                  <select
                    value={voiceName}
                    onChange={(e) => setVoiceName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-xs text-neutral-100 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="Kore">Kore (Clear, punchy, broadcast standard)</option>
                    <option value="Puck">Puck (Energetic, high-tempo, youthful)</option>
                    <option value="Fenrir">Fenrir (Deep, resonant, underground)</option>
                    <option value="Zephyr">Zephyr (Smooth, late-night, relaxed)</option>
                    <option value="Charon">Charon (Bold, authoritative, cinematic)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-mono text-neutral-400 block mb-1">
                    Voice Personality Style
                  </label>
                  <input
                    type="text"
                    value={voicePersonality}
                    onChange={(e) => setVoicePersonality(e.target.value)}
                    placeholder="e.g. Energetic rave DJ with quick banter"
                    className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-xs text-neutral-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs text-neutral-300 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-xs font-semibold text-white transition"
                >
                  {isCreating ? "Creating..." : "Initialize Show"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
