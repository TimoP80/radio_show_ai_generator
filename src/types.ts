export interface AudioTrack {
  id: string;
  path: string;
  filename: string;
  extension: string;
  duration: number; // in seconds
  sampleRate: number;
  channels: number;
  bitrate: number;
  codec: string;
  fileSize: number;
  artist: string;
  title: string;
  album: string;
  genre: string;
  year: number | null;
  trackNumber: number | null;
  bpm: number | null;
  energy: number | null; // 1-10
  mood: string | null;
  aiTags: string[];
  aiAnalyzed: boolean;
  aiMetadata?: AITrackAnalysis;
  createdAt: string;
  updatedAt: string;
}

export interface AITrackAnalysis {
  genre?: string;
  subgenre?: string;
  mood?: string;
  energy?: number; // 1-10
  era?: string;
  category?: string;
  danceability?: number; // 1-10
  instrumental?: boolean;
  timeOfDay?: 'morning' | 'afternoon' | 'drive_time' | 'late_night' | 'peak_rave';
  introStyle?: string;
  outroStyle?: string;
  summary?: string;
  analyzedAt?: string;
}

export interface LibraryFolder {
  id: string;
  path: string;
  label: string;
  addedAt: string;
  lastScannedAt: string | null;
  fileCount: number;
  status: 'idle' | 'scanning' | 'paused' | 'error';
  errorMessage?: string;
}

export interface ScanStatus {
  isScanning: boolean;
  isPaused: boolean;
  currentFolder?: string;
  currentFile?: string;
  filesDiscovered: number;
  filesAdded: number;
  filesChanged: number;
  filesRemoved: number;
  errorCount: number;
  progressPercent: number;
  lastError?: string;
}

export type AnnouncementPlacement = 'intro' | 'between_tracks' | 'outro' | 'station_id';

export interface Announcement {
  id: string;
  showId: string;
  positionIndex: number;
  placement: AnnouncementPlacement;
  beforeTrackId?: string;
  afterTrackId?: string;
  title: string;
  scriptText: string;
  voiceName: string;
  voiceStyle?: string;
  voiceSpeed?: number;
  voicePitch?: number;
  audioUrl?: string;
  duration: number; // duration in seconds
  duckMusic: boolean;
  duckVolume?: number; // 0.1 - 0.5 (e.g. 0.2 = 20% music volume during speech)
  duckingLevel?: number;
  status?: 'draft' | 'synthesizing' | 'ready' | 'error';
  errorMessage?: string;
}

export interface ShowSegment {
  id: string;
  type: 'track' | 'announcement' | 'jingle';
  trackId?: string;
  announcementId?: string;
  title: string;
  artist?: string;
  duration: number;
  startTime: number;
  endTime: number;
  transitionIn: 'cut' | 'crossfade' | 'duck';
  transitionOut: 'cut' | 'crossfade' | 'fade_out';
  crossfadeDuration: number;
}

export type TransitionType = 'crossfade' | 'beat_match' | 'cut';
export type CrossfadeCurve = 'equal_power' | 'exponential' | 'linear' | 's_curve' | 'logarithmic';
export type CutStyle = 'instant' | 'reverb_tail' | 'backspin' | 'pause';
export type EQSwapStyle = 'instant' | 'gradual_bass_swap' | 'full_range';

export interface TrackTransition {
  id: string;
  fromTrackId: string;
  toTrackId: string;
  type: TransitionType; // 'crossfade' | 'beat_match' | 'cut'
  duration: number; // in seconds, e.g. 4.0
  curve: CrossfadeCurve;
  // Cut specific
  cutStyle?: CutStyle;
  pauseDuration?: number; // silence gap in seconds (e.g. 0.0 to 3.0)
  // Beat-match specific
  beatAlignBars?: 4 | 8 | 16 | 32;
  tempoSync?: boolean;
  eqSwap?: EQSwapStyle;
  notes?: string;
}

export interface GlobalTransitionDefault {
  type: TransitionType;
  duration: number; // in seconds
  curve: CrossfadeCurve;
  beatAlignBars?: 4 | 8 | 16 | 32;
  tempoSync?: boolean;
  eqSwap?: EQSwapStyle;
  cutStyle?: CutStyle;
  pauseDuration?: number;
  presetName?: string;
}

export interface TransitionPreset {
  id: string;
  name: string;
  description: string;
  type: TransitionType;
  duration: number;
  curve: CrossfadeCurve;
  beatAlignBars?: 4 | 8 | 16 | 32;
  tempoSync?: boolean;
  eqSwap?: EQSwapStyle;
  cutStyle?: CutStyle;
  pauseDuration?: number;
  isBuiltIn?: boolean;
}

export interface RenderSettings {
  format: 'mp3' | 'wav';
  bitrate: string; // '192k' | '256k' | '320k'
  sampleRate: number; // 44100 | 48000
  normalizeAudio: boolean;
  crossfadeDuration: number; // in seconds, e.g. 3.0
  duckingLevel: number; // 0.25 (-12dB)
}

export interface RadioShow {
  id: string;
  name: string;
  stationName: string;
  hostName: string;
  episodeNumber: number;
  date: string;
  description: string;
  genre: string;
  targetDuration: number; // seconds
  introText: string;
  outroText: string;
  voicePersonality: string;
  voiceName: string;
  voiceSpeed: number;
  voicePitch: number;
  tracks: AudioTrack[];
  announcements: Announcement[];
  transitions?: TrackTransition[];
  defaultTransition?: GlobalTransitionDefault;
  segments: ShowSegment[];
  renderSettings: RenderSettings;
  createdAt: string;
  updatedAt: string;
}

export interface ShowGeneratorParams {
  showLengthMinutes?: number;
  targetDuration?: number;
  genre?: string;
  primaryGenre?: string;
  targetTrackCount?: number;
  energyLevel?: 'low' | 'medium' | 'high' | 'peak';
  energyCurve?: 'peak' | 'high' | 'building' | 'rollercoaster' | 'smooth';
  era?: string;
  hostStyle?: string;
  hostPersona?: string;
  announcementFrequency?: 'minimal' | 'moderate' | 'frequent';
  customInstructions?: string;
  customPrompt?: string;
}

export interface RenderJob {
  id: string;
  showId: string;
  showName: string;
  format: 'mp3' | 'wav';
  status: 'queued' | 'rendering' | 'completed' | 'failed' | 'processing' | 'error';
  progress: number;
  duration?: number;
  fileSize?: number;
  filePath?: string;
  downloadUrl?: string;
  log?: string;
  logs?: string[];
  createdAt: string;
}

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  totalDuration: number;
  volume: number;
  isMuted: boolean;
  currentTrack?: AudioTrack;
  currentAnnouncement?: Announcement;
  activeSegmentId?: string;
}
