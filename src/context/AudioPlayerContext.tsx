import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { AudioTrack, Announcement } from "../types.js";
import { api } from "../services/api.js";

interface PlayingItem {
  id: string;
  title: string;
  artist: string;
  album?: string;
  genre?: string;
  audioUrl: string;
  duration: number;
  type: "track" | "announcement" | "render";
}

interface AudioPlayerContextType {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  nowPlaying: PlayingItem | null;
  vuLevelLeft: number; // 0 to 1
  vuLevelRight: number; // 0 to 1
  playTrack: (track: AudioTrack) => void;
  playAnnouncement: (announcement: Announcement) => void;
  playCustomAudio: (item: PlayingItem) => void;
  togglePlay: () => void;
  stop: () => void;
  seek: (time: number) => void;
  setVolume: (vol: number) => void;
  toggleMute: () => void;
}

const AudioPlayerContext = createContext<AudioPlayerContextType | null>(null);

export const AudioPlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [nowPlaying, setNowPlaying] = useState<PlayingItem | null>(null);
  const [vuLevelLeft, setVuLevelLeft] = useState(0);
  const [vuLevelRight, setVuLevelRight] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Initialize Web Audio graph lazily on first user gesture
  const initAudioGraph = () => {
    if (!audioRef.current) return;
    if (audioContextRef.current) return;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.8;

      const gainNode = ctx.createGain();
      gainNode.gain.value = isMuted ? 0 : volume;

      const source = ctx.createMediaElementSource(audioRef.current);
      source.connect(analyser);
      analyser.connect(gainNode);
      gainNode.connect(ctx.destination);

      audioContextRef.current = ctx;
      analyserRef.current = analyser;
      gainNodeRef.current = gainNode;
      sourceNodeRef.current = source;
    } catch (e) {
      console.warn("Could not attach Web Audio Analyser node:", e);
    }
  };

  // Run VU meter analysis loop
  const updateVUMeter = useCallback(() => {
    if (analyserRef.current && isPlaying) {
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);

      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const avg = sum / (dataArray.length * 255);
      // Add slight stereo flutter for realistic broadcast meter ballistics
      const flutter = Math.sin(Date.now() / 80) * 0.04;
      const left = Math.min(1, Math.max(0, avg * 1.35 + flutter));
      const right = Math.min(1, Math.max(0, avg * 1.35 - flutter));
      setVuLevelLeft(left);
      setVuLevelRight(right);
    } else {
      setVuLevelLeft((prev) => Math.max(0, prev * 0.85 - 0.02));
      setVuLevelRight((prev) => Math.max(0, prev * 0.85 - 0.02));
    }

    animationFrameRef.current = requestAnimationFrame(updateVUMeter);
  }, [isPlaying]);

  useEffect(() => {
    animationFrameRef.current = requestAnimationFrame(updateVUMeter);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [updateVUMeter]);

  const loadAndPlay = async (item: PlayingItem) => {
    initAudioGraph();
    if (audioContextRef.current && audioContextRef.current.state === "suspended") {
      await audioContextRef.current.resume();
    }

    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.crossOrigin = "anonymous";
    }

    audioRef.current.src = item.audioUrl;
    audioRef.current.volume = isMuted ? 0 : volume;
    setNowPlaying(item);
    setCurrentTime(0);
    setDuration(item.duration || 0);

    audioRef.current.onloadedmetadata = () => {
      if (audioRef.current?.duration && !isNaN(audioRef.current.duration)) {
        setDuration(audioRef.current.duration);
      }
    };

    audioRef.current.ontimeupdate = () => {
      if (audioRef.current) {
        setCurrentTime(audioRef.current.currentTime);
      }
    };

    audioRef.current.onended = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audioRef.current.onerror = (e) => {
      console.error("Audio playback error:", e);
      setIsPlaying(false);
    };

    try {
      await audioRef.current.play();
      setIsPlaying(true);
    } catch (err) {
      console.warn("Audio play prevented or interrupted:", err);
      setIsPlaying(false);
    }
  };

  const playTrack = (track: AudioTrack) => {
    const url = api.getTrackStreamUrl(track.id);
    loadAndPlay({
      id: track.id,
      title: track.title,
      artist: track.artist,
      album: track.album,
      genre: track.genre,
      audioUrl: url,
      duration: track.duration,
      type: "track",
    });
  };

  const playAnnouncement = (announcement: Announcement) => {
    if (!announcement.audioUrl) return;
    loadAndPlay({
      id: announcement.id,
      title: announcement.title || "DJ Announcement",
      artist: `Host Voice (${announcement.voiceName || "Kore"})`,
      album: "Radio Voice Tracks",
      genre: "Spoken Voice",
      audioUrl: announcement.audioUrl,
      duration: announcement.duration,
      type: "announcement",
    });
  };

  const playCustomAudio = (item: PlayingItem) => {
    loadAndPlay(item);
  };

  const togglePlay = () => {
    if (!audioRef.current || !nowPlaying) return;
    initAudioGraph();
    if (audioContextRef.current && audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume();
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(console.warn);
    }
  };

  const stop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
      setIsPlaying(false);
    }
  };

  const seek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const setVolume = (val: number) => {
    const clamped = Math.max(0, Math.min(1, val));
    setVolumeState(clamped);
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : clamped;
    }
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = isMuted ? 0 : clamped;
    }
  };

  const toggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    if (audioRef.current) {
      audioRef.current.volume = newMuted ? 0 : volume;
    }
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = newMuted ? 0 : volume;
    }
  };

  return (
    <AudioPlayerContext.Provider
      value={{
        isPlaying,
        currentTime,
        duration,
        volume,
        isMuted,
        nowPlaying,
        vuLevelLeft,
        vuLevelRight,
        playTrack,
        playAnnouncement,
        playCustomAudio,
        togglePlay,
        stop,
        seek,
        setVolume,
        toggleMute,
      }}
    >
      {children}
    </AudioPlayerContext.Provider>
  );
};

export const useAudioPlayer = () => {
  const context = useContext(AudioPlayerContext);
  if (!context) {
    throw new Error("useAudioPlayer must be used within an AudioPlayerProvider");
  }
  return context;
};
