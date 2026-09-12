import {
  AudioTrack,
  LibraryFolder,
  ScanStatus,
  RadioShow,
  ShowGeneratorParams,
  RenderJob,
  RenderSettings,
  Announcement,
} from "../types.js";

const BASE_URL = "/api";

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
    ...options,
  });

  if (!res.ok) {
    let errMsg = `Request failed: ${res.status} ${res.statusText}`;
    try {
      const errJson = await res.json();
      if (errJson.error) errMsg = errJson.error;
    } catch (_) {}
    throw new Error(errMsg);
  }

  return res.json();
}

export const api = {
  // System
  getSystemStatus: () => request<{ status: string; hasGeminiKey: boolean; platform: string; storageDir: string; scanner: ScanStatus }>("/system/status"),

  // Folders & Scanner
  getFolders: () => request<LibraryFolder[]>("/folders"),
  getFolderPresets: () =>
    request<
      Array<{
        id: string;
        label: string;
        path: string;
        description: string;
        exists: boolean;
        audioCount: number;
      }>
    >("/folders/presets"),
  validateFolder: (folderPath: string) =>
    request<{
      exists: boolean;
      isDirectory: boolean;
      audioCount: number;
      resolvedPath: string;
      isLocalComputerPathHint: boolean;
      message: string;
    }>("/folders/validate", {
      method: "POST",
      body: JSON.stringify({ folderPath }),
    }),
  addFolder: (folderPath: string, label?: string) =>
    request<LibraryFolder>("/folders", {
      method: "POST",
      body: JSON.stringify({ folderPath, label }),
    }),
  removeFolder: (id: string) =>
    request<{ success: boolean }>(`/folders/${id}`, { method: "DELETE" }),
  startScan: (folderId?: string) =>
    request<ScanStatus>("/scan/start", {
      method: "POST",
      body: JSON.stringify({ folderId }),
    }),
  pauseScan: () => request<ScanStatus>("/scan/pause", { method: "POST" }),
  resumeScan: () => request<ScanStatus>("/scan/resume", { method: "POST" }),
  cancelScan: () => request<ScanStatus>("/scan/cancel", { method: "POST" }),
  getScanStatus: () => request<ScanStatus>("/scan/status"),
  updateScanProgress: (progress: Partial<ScanStatus>) =>
    request<ScanStatus>("/scan/progress", {
      method: "POST",
      body: JSON.stringify(progress),
    }),

  // Assets (Tracks)
  getAssets: (params?: {
    q?: string;
    genre?: string;
    energy?: string;
    minBpm?: number;
    maxBpm?: number;
    aiOnly?: boolean;
  }) => {
    const query = new URLSearchParams();
    if (params?.q) query.set("q", params.q);
    if (params?.genre) query.set("genre", params.genre);
    if (params?.energy) query.set("energy", params.energy);
    if (params?.minBpm) query.set("minBpm", String(params.minBpm));
    if (params?.maxBpm) query.set("maxBpm", String(params.maxBpm));
    if (params?.aiOnly) query.set("aiOnly", "true");
    const qs = query.toString();
    return request<AudioTrack[]>(`/assets${qs ? `?${qs}` : ""}`);
  },

  uploadTracks: async (
    files: File[],
    folderMeta?: { folderLabel?: string; folderPath?: string }
  ): Promise<{ count: number; tracks: AudioTrack[]; folder?: LibraryFolder }> => {
    const formData = new FormData();
    for (const f of files) {
      formData.append("files", f);
    }
    if (folderMeta?.folderLabel) {
      formData.append("folderLabel", folderMeta.folderLabel);
    }
    if (folderMeta?.folderPath) {
      formData.append("folderPath", folderMeta.folderPath);
    }
    const res = await fetch(`${BASE_URL}/assets/upload`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Upload failed");
    }
    return res.json();
  },

  // AI Operations
  analyzeTrack: (trackId: string) =>
    request<AudioTrack>("/ai/analyze-track", {
      method: "POST",
      body: JSON.stringify({ trackId }),
    }),

  generateShow: (params: ShowGeneratorParams, showMeta: { name: string; station: string; host: string }) =>
    request<{
      selectedTrackIds: string[];
      rationale: string;
      suggestedAnnouncements: Array<{
        placement: "intro" | "between_tracks" | "outro" | "station_id";
        positionIndex: number;
        title: string;
        scriptText: string;
      }>;
    }>("/ai/generate-show", {
      method: "POST",
      body: JSON.stringify({ params, showMeta }),
    }),

  generateAnnouncements: (show: RadioShow, instruction?: string) =>
    request<
      Array<{
        placement: "intro" | "between_tracks" | "outro" | "station_id";
        positionIndex: number;
        beforeTrackId?: string;
        afterTrackId?: string;
        title: string;
        scriptText: string;
      }>
    >("/ai/generate-announcements", {
      method: "POST",
      body: JSON.stringify({ show, instruction }),
    }),

  synthesizeVoice: (text: string, voiceName?: string, voicePersonality?: string) =>
    request<{ audioUrl: string; duration: number; filePath: string }>("/voice/synthesize", {
      method: "POST",
      body: JSON.stringify({ text, voiceName, voicePersonality }),
    }),

  // Shows
  getShows: () => request<RadioShow[]>("/shows"),
  getShow: (id: string) => request<RadioShow>(`/shows/${id}`),
  saveShow: (show: RadioShow) =>
    request<{ success: boolean; show: RadioShow }>("/shows", {
      method: "POST",
      body: JSON.stringify(show),
    }),
  deleteShow: (id: string) =>
    request<{ success: boolean }>(`/shows/${id}`, { method: "DELETE" }),

  // Rendering
  startRender: (show: RadioShow, options?: Partial<RenderSettings>) =>
    request<RenderJob>("/render/start", {
      method: "POST",
      body: JSON.stringify({ show, options }),
    }),
  getRenderJobs: () => request<RenderJob[]>("/render/jobs"),

  // Audio Stream URL generator
  getTrackStreamUrl: (trackId: string) => `${BASE_URL}/audio/stream?id=${encodeURIComponent(trackId)}`,
};
