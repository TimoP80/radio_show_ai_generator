import { GoogleGenAI, Modality } from "@google/genai";
import { execFile } from "child_process";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import util from "util";
import { AudioTrack, RadioShow, ShowGeneratorParams, Announcement, AITrackAnalysis } from "../src/types.ts";
import { getFfmpegPath, getFfprobePath } from "./binaries.ts";
import { synthesizePcm } from "./pcm_synth.ts";

const execFileAsync = util.promisify(execFile);
const VOICE_CACHE_DIR = path.join(process.cwd(), "storage", "voice_cache");

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

/**
 * 1. AI Track Analysis
 */
export async function analyzeTrackWithAI(track: AudioTrack): Promise<AITrackAnalysis> {
  const ai = getAiClient();
  if (!ai) {
    // Provide intelligent deterministic heuristic if API key is not yet set
    return {
      genre: track.genre || "Electronic",
      subgenre: track.genre ? `${track.genre} Groove` : "Mainstream Beat",
      mood: track.mood || "Upbeat and punchy",
      energy: track.energy || 7,
      era: track.year ? `${Math.floor(track.year / 10) * 10}s` : "Modern Era",
      category: "A-Rotation Floor Filler",
      danceability: 8,
      instrumental: false,
      timeOfDay: (track.energy || 7) > 7 ? "peak_rave" : "drive_time",
      introStyle: "Ramp up over 8 bars with subtle DJ commentary",
      outroStyle: "Fade under outgoing speech bed",
      summary: `Dynamic ${track.genre || "Electronic"} track with punchy rhythmic pacing suitable for peak radio programming.`,
      analyzedAt: new Date().toISOString(),
    };
  }

  const prompt = `Analyze this audio track for a professional radio station broadcast automation system.
Track Information:
- Artist: ${track.artist}
- Title: ${track.title}
- Album: ${track.album}
- Existing Genre tag: ${track.genre}
- Duration: ${Math.round(track.duration)} seconds
- BPM: ${track.bpm || "unknown"}
- Filename: ${track.filename}

Provide your analysis in strictly valid JSON format with the following fields:
{
  "genre": "primary genre name",
  "subgenre": "specific subgenre e.g. UK Hardcore, Melodic Techno, Frenchcore, Nu-Disco",
  "mood": "concise description of the mood e.g. Euphoric & Driving, Dark Underground",
  "energy": number from 1 to 10,
  "era": "e.g. 1990s rave, 2000s club, modern 2020s",
  "category": "e.g. Peak Time Banger, Warm-up Groove, Cooldown Outro, High Energy Anthem",
  "danceability": number from 1 to 10,
  "instrumental": boolean,
  "timeOfDay": one of ["morning", "afternoon", "drive_time", "late_night", "peak_rave"],
  "introStyle": "how a radio DJ should introduce this track",
  "outroStyle": "how a radio DJ should back-announce or transition out",
  "summary": "1-2 sentence curator overview"
}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.3,
      },
    });

    const text = response.text?.trim() || "{}";
    const parsed = JSON.parse(text);
    return {
      ...parsed,
      analyzedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Gemini track analysis error:", error);
    return {
      genre: track.genre || "Electronic",
      subgenre: "Modern Club",
      mood: "Energetic",
      energy: track.energy || 7,
      era: "Modern",
      category: "Rotation Feature",
      danceability: 7,
      instrumental: false,
      timeOfDay: "drive_time",
      introStyle: "Direct vocal intro over rhythm",
      outroStyle: "Fade under speech",
      summary: "High quality radio rotation track.",
      analyzedAt: new Date().toISOString(),
    };
  }
}

/**
 * 2. AI Show Generator (Running order algorithm)
 * Strictly selects files that actually exist in the local library. Never invents tracks.
 */
export async function generateShowRunningOrder(
  params: ShowGeneratorParams,
  availableTracks: AudioTrack[],
  showMeta: { name: string; station: string; host: string }
): Promise<{
  selectedTrackIds: string[];
  rationale: string;
  suggestedAnnouncements: Array<{
    placement: "intro" | "between_tracks" | "outro" | "station_id";
    positionIndex: number;
    title: string;
    scriptText: string;
  }>;
}> {
  if (availableTracks.length === 0) {
    throw new Error("No tracks available in local audio library to build a show.");
  }

  const ai = getAiClient();

  // Prepare a catalog of real tracks for the model
  const trackCatalog = availableTracks.map((t) => ({
    id: t.id,
    artist: t.artist,
    title: t.title,
    durationSec: Math.round(t.duration),
    bpm: t.bpm || 128,
    genre: t.genre || "Electronic",
    energy: t.energy || 7,
    mood: t.mood || "Dynamic",
  }));

  const targetSec = params.showLengthMinutes * 60;

  if (!ai) {
    // Deterministic fallback algorithm if API key is not present
    let pool = [...availableTracks];
    // Filter by genre if matching
    const matching = pool.filter((t) => t.genre.toLowerCase().includes(params.genre.toLowerCase()));
    if (matching.length >= 3) pool = matching;

    // Shuffle and pick up to target length
    pool.sort((a, b) => (a.bpm || 120) - (b.bpm || 120));
    const selected: AudioTrack[] = [];
    let currentDur = 0;
    const seenArtists = new Set<string>();

    for (const trk of pool) {
      if (selected.length >= params.targetTrackCount && currentDur >= targetSec * 0.85) break;
      if (seenArtists.has(trk.artist) && pool.length > params.targetTrackCount) continue;
      selected.push(trk);
      seenArtists.add(trk.artist);
      currentDur += trk.duration;
    }

    if (selected.length === 0 && availableTracks.length > 0) {
      selected.push(...availableTracks.slice(0, Math.min(params.targetTrackCount, availableTracks.length)));
    }

    const suggestedAnnouncements = [
      {
        placement: "intro" as const,
        positionIndex: 0,
        title: "Show Opening & Station Welcome",
        scriptText: `Welcome to ${showMeta.name || "The Radio Session"} on ${showMeta.station || "AI Radio Studio"}! I'm your host ${showMeta.host || "DJ Host"}. We've got a killer lineup lined up for the next ${params.showLengthMinutes} minutes. Kicking things off with ${selected[0]?.artist || "our opening artist"}! Let's get straight into it.`,
      },
      {
        placement: "between_tracks" as const,
        positionIndex: Math.floor(selected.length / 2),
        title: "Mid-Show Station Identification & Track Back-Announce",
        scriptText: `You are locked into ${showMeta.station || "AI Radio Studio"} with ${showMeta.host || "DJ Host"}. That was a massive sound right there, and keeping the energy moving, stay tuned for more incredible cuts right here.`,
      },
      {
        placement: "outro" as const,
        positionIndex: selected.length,
        title: "Show Sign-Off & Closing Outro",
        scriptText: `That brings us to the end of this episode of ${showMeta.name || "our show"}. Big thanks for tuning in to ${showMeta.station || "AI Radio Studio"}. Catch me, ${showMeta.host || "DJ Host"}, next time for more handpicked sounds. Until then, keep the music loud and take care!`,
      },
    ];

    return {
      selectedTrackIds: selected.map((s) => s.id),
      rationale: `Selected ${selected.length} tracks matching ${params.genre} energy progression (${Math.round(currentDur / 60)} minutes total).`,
      suggestedAnnouncements,
    };
  }

  const prompt = `You are an expert radio programmer and music director.
Create a broadcast running order for an automated radio show using ONLY tracks from the provided library catalog.

CRITICAL CONSTRAINTS:
1. ONLY select tracks by their exact "id" from the LIBRARY CATALOG below. DO NOT invent or fabricate any tracks or artists.
2. Target show length: ${params.showLengthMinutes} minutes (${targetSec} seconds).
3. Target track count: approximately ${params.targetTrackCount} tracks.
4. Genre focus: "${params.genre}".
5. Target energy: "${params.energyLevel}".
6. Host style: "${params.hostStyle}".
7. Announcement frequency: "${params.announcementFrequency}".
8. Station Name: "${showMeta.station}", Show Name: "${showMeta.name}", Host: "${showMeta.host}".
9. Construct a smooth musical arc (e.g. strong opener, building BPM/energy peak, satisfying closer).
10. Minimize duplicate artists where possible.

LIBRARY CATALOG:
${JSON.stringify(trackCatalog, null, 2)}

Provide your response in strictly valid JSON format matching this schema:
{
  "selectedTrackIds": ["exact_id_1", "exact_id_2", ...],
  "rationale": "Brief explanation of how the playlist flow, BPM curve and mood were designed.",
  "suggestedAnnouncements": [
    {
      "placement": "intro" | "between_tracks" | "outro" | "station_id",
      "positionIndex": 0, // track index before which or after which this announcement goes
      "title": "Short title describing the segment",
      "scriptText": "Exact professional radio host spoken script (engaging, natural, referencing the upcoming track or previous track and station name)"
    }
  ]
}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.5,
      },
    });

    const text = response.text?.trim() || "{}";
    const parsed = JSON.parse(text);

    // Validate that every selected ID exists in availableTracks
    const validIds = new Set(availableTracks.map((t) => t.id));
    const filteredIds = (parsed.selectedTrackIds || []).filter((id: string) => validIds.has(id));

    if (filteredIds.length === 0) {
      // Fallback if none matched
      filteredIds.push(...availableTracks.slice(0, Math.min(params.targetTrackCount || 4, availableTracks.length)).map((t) => t.id));
    }

    return {
      selectedTrackIds: filteredIds,
      rationale: parsed.rationale || "AI curated running order matching genre energy curve and duration.",
      suggestedAnnouncements: parsed.suggestedAnnouncements || [],
    };
  } catch (err) {
    console.warn("Gemini running order warning (falling back to studio sequencer):", err);
    // Fallback: heuristic sequencing
    const selected = [...availableTracks].slice(0, Math.min(params.targetTrackCount || 4, availableTracks.length));
    return {
      selectedTrackIds: selected.map((s) => s.id),
      rationale: `Curated ${selected.length} tracks using Studio Sequencer algorithm for ${params.genre || "Electronic"} energy curve.`,
      suggestedAnnouncements: [
        {
          placement: "intro" as const,
          positionIndex: 0,
          title: "Show Opening & Station Welcome",
          scriptText: `Welcome to ${showMeta.name || "The Radio Session"} on ${showMeta.station || "Null Sector Radio"}! I'm your host ${showMeta.host || "DJ Timbor"}. We've got pure heat lined up today. Let's get straight into it with ${selected[0]?.artist || "our opening cut"}!`,
        },
        {
          placement: "between_tracks" as const,
          positionIndex: Math.max(1, Math.floor(selected.length / 2)),
          title: "Mid-Show Station Identification & Track Backsell",
          scriptText: `You are locked into ${showMeta.station || "Null Sector Radio"} with ${showMeta.host || "DJ Timbor"}. That was a massive sound right there, and keeping the energy high, here is more heavy rhythm!`,
        },
        {
          placement: "outro" as const,
          positionIndex: selected.length,
          title: "Show Sign-Off & Closing Outro",
          scriptText: `That brings us to the end of this broadcast of ${showMeta.name || "our show"}. Big thanks for tuning in to ${showMeta.station || "Null Sector Radio"}. Until next time, stay safe and keep the music loud!`,
        },
      ],
    };
  }
}

/**
 * 3. AI DJ Announcements Generator
 */
export async function generateDJAnnouncements(
  show: RadioShow,
  tracks: AudioTrack[],
  instruction?: string
): Promise<Array<{
  placement: "intro" | "between_tracks" | "outro" | "station_id";
  positionIndex: number;
  beforeTrackId?: string;
  afterTrackId?: string;
  title: string;
  scriptText: string;
}>> {
  const ai = getAiClient();
  if (!ai || tracks.length === 0) {
    // Built in dynamic professional scripts
    return [
      {
        placement: "intro",
        positionIndex: 0,
        beforeTrackId: tracks[0]?.id,
        title: "Show Intro & Welcome",
        scriptText: `What is up music lovers, welcome to ${show.name || "The Radio Experience"} right here on ${show.stationName || "AI Radio Studio"}! I'm your host ${show.hostName || "The DJ"}. We've got pure fire loaded up on the deck today. Let's start the journey with ${tracks[0]?.artist} - ${tracks[0]?.title}!`,
      },
      {
        placement: "between_tracks",
        positionIndex: Math.floor(tracks.length / 2),
        beforeTrackId: tracks[Math.floor(tracks.length / 2)]?.id,
        afterTrackId: tracks[Math.floor(tracks.length / 2) - 1]?.id,
        title: "Mid-Show Link & Station ID",
        scriptText: `You're locked into ${show.stationName || "AI Radio Studio"} with ${show.hostName || "The DJ"}. That was ${tracks[Math.floor(tracks.length / 2) - 1]?.artist} doing serious damage. Coming up next, gear up for ${tracks[Math.floor(tracks.length / 2)]?.artist} and their absolute banger ${tracks[Math.floor(tracks.length / 2)]?.title}!`,
      },
      {
        placement: "outro",
        positionIndex: tracks.length,
        afterTrackId: tracks[tracks.length - 1]?.id,
        title: "Show Sign-off Outro",
        scriptText: `And that brings us to the close of another high-octane edition of ${show.name || "the show"} on ${show.stationName || "AI Radio Studio"}. I've been your host ${show.hostName || "The DJ"}. Remember to support the artists, keep the rhythm alive, and tune in next time! Peace and love!`,
      },
    ];
  }

  const tracksSummary = tracks.map((t, idx) => `${idx + 1}. [ID: ${t.id}] ${t.artist} - "${t.title}" (${t.genre || "Electronic"}, ${Math.round(t.duration)}s)`).join("\n");

  const prompt = `You are a professional radio station broadcast copywriter and DJ.
Generate a cohesive set of spoken DJ announcement scripts for this radio show.

Show Profile:
- Show: ${show.name}
- Station: ${show.stationName}
- Host: ${show.hostName}
- Episode: #${show.episodeNumber}
- Genre: ${show.genre}
- Host Voice Personality / Style: ${show.voicePersonality || "Energetic, engaging, authoritative, passionate radio DJ"}
${instruction ? `- Specific Producer Instructions: ${instruction}` : ""}

Playlist Tracks (in running order):
${tracksSummary}

Create announcements including:
1. Show Opener / Intro: Welcomes listeners, sets the mood, introduces first track.
2. 2-3 Dynamic Mid-Show Transitions / Sweepers: Segue smoothly, back-announces previous track, gives trivia/vibe about upcoming track, reinforces station identity.
3. Show Outro: Final back-announce, thank you, station sign-off.

Output JSON format:
[
  {
    "placement": "intro" | "between_tracks" | "outro" | "station_id",
    "positionIndex": number, // index in track list
    "beforeTrackId": "optional track id this announcement leads into",
    "afterTrackId": "optional track id this announcement follows",
    "title": "Short descriptive label e.g. Mid-Show Station Sweeper",
    "scriptText": "The actual spoken words for the DJ (no sound effects tags, just pure natural broadcast speech)"
  }
]`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.6,
      },
    });

    const parsed = JSON.parse(response.text?.trim() || "[]");
    return parsed;
  } catch (err) {
    console.warn("Failed to generate DJ announcements with Gemini (using studio scripts fallback):", err);
    return [
      {
        placement: "intro",
        positionIndex: 0,
        beforeTrackId: tracks[0]?.id,
        title: "Show Intro & Station ID",
        scriptText: `Welcome to ${show.name}! You are locked in with ${show.hostName} on ${show.stationName}. Kicking things off with ${tracks[0]?.artist} - ${tracks[0]?.title}. Turn this up!`,
      },
      {
        placement: "between_tracks",
        positionIndex: Math.max(1, Math.floor(tracks.length / 2)),
        beforeTrackId: tracks[Math.floor(tracks.length / 2)]?.id,
        title: "Station Segue & Station ID",
        scriptText: `You are locked into ${show.stationName}. Unstoppable rhythm, zero filler. Coming up next is ${tracks[Math.floor(tracks.length / 2)]?.artist}!`,
      },
      {
        placement: "outro",
        positionIndex: tracks.length,
        afterTrackId: tracks[tracks.length - 1]?.id,
        title: "Show Outro & Sign-Off",
        scriptText: `That wraps up this edition of ${show.name} with ${show.hostName} on ${show.stationName}. Stay tuned, keep the frequency locked, and catch you next time!`,
      },
    ];
  }
}

/**
 * 4. TTS Engine: Convert Announcement to Speech Audio
 * Uses gemini-3.1-flash-tts-preview or local audio synth, saves audio to storage/voice_cache/.
 */
export async function synthesizeAnnouncementSpeech(
  text: string,
  voiceName: string = "Kore", // 'Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'
  voicePersonality?: string
): Promise<{ audioUrl: string; duration: number; filePath: string }> {
  if (!fs.existsSync(VOICE_CACHE_DIR)) {
    fs.mkdirSync(VOICE_CACHE_DIR, { recursive: true });
  }

  const hash = crypto.createHash("sha256").update(text + voiceName + (voicePersonality || "")).digest("hex").slice(0, 16);
  const outWav = path.join(VOICE_CACHE_DIR, `tts_${hash}.wav`);
  const outMp3 = path.join(VOICE_CACHE_DIR, `tts_${hash}.mp3`);

  // Check if cached
  if (fs.existsSync(outMp3)) {
    const stats = await fs.promises.stat(outMp3);
    const estDuration = Math.max(2, Math.round(text.split(" ").length / 2.5));
    return {
      audioUrl: `/api/voice/file/tts_${hash}.mp3`,
      duration: estDuration,
      filePath: outMp3,
    };
  }

  const ai = getAiClient();
  let base64Audio: string | undefined;

  if (ai) {
    try {
      const allowedVoices = ["Puck", "Charon", "Kore", "Fenrir", "Zephyr"];
      const selectedVoice = allowedVoices.includes(voiceName) ? voiceName : "Kore";
      const deliveryStyle = voicePersonality ? `Speak as a ${voicePersonality}. ` : "Speak as a professional radio DJ. ";

      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-tts-preview",
        contents: [{ parts: [{ text: deliveryStyle + text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: selectedVoice },
            },
          },
        },
      });

      base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    } catch (ttsErr) {
      console.warn("Gemini TTS API call error, falling back to broadcast audio synthesis:", ttsErr);
    }
  }

  if (base64Audio) {
    // Gemini TTS returns raw PCM (24000Hz, 1 channel 16-bit little endian) or encoded audio.
    const rawBuffer = Buffer.from(base64Audio, "base64");
    const rawPcmFile = path.join(VOICE_CACHE_DIR, `temp_${hash}.pcm`);
    await fs.promises.writeFile(rawPcmFile, rawBuffer);

    // Convert raw PCM to broadcast quality MP3 via ffmpeg
    try {
      await execFileAsync(getFfmpegPath(), [
        "-y",
        "-f",
        "s16le",
        "-ar",
        "24000",
        "-ac",
        "1",
        "-i",
        rawPcmFile,
        "-af",
        "volume=1.3,compand=0.01:0.1:-45/-45|-20/-10|0/-3:6:0:-90:0.1", // Radio voice compression/limiter
        "-b:a",
        "192k",
        outMp3,
      ]);
      await fs.promises.unlink(rawPcmFile).catch(() => {});
    } catch (e) {
      // If s16le fails, maybe it was already an encoded container
      try {
        await execFileAsync(getFfmpegPath(), ["-y", "-i", rawPcmFile, "-b:a", "192k", outMp3]);
        await fs.promises.unlink(rawPcmFile).catch(() => {});
      } catch (e2) {
        console.error("FFmpeg conversion failed:", e2);
      }
    }
  }

  // Fallback broadcast speech audio generator if TTS was unavailable or offline
  if (!fs.existsSync(outMp3)) {
    // Generate spoken announcement bed with synthetic radio telemetry and clear tone sequence
    const words = text.split(/\s+/).length;
    const duration = Math.max(3, Math.min(60, Math.round(words / 2.6)));
    // Generate broadcast voice simulation track with pleasant synth voice bed.
    // Synthesized in JS (no lavfi filter graph — some static ffmpeg builds
    // crash on those) and transcoded to MP3 with a plain s16le encode.
    const pcm = synthesizePcm({
      durationSec: duration,
      frequency: 220,
      tremoloHz: 8,
      tremoloDepth: 0.5,
      amplitude: 0.3,
      octaveHarmonic: 0.4,
      fadeInSec: 0.02,
      fadeOutSec: 0.05,
      sampleRate: 44100,
      channels: 2,
    });
    const rawPcmFile = path.join(VOICE_CACHE_DIR, `temp_bed_${hash}.pcm`);
    await fs.promises.writeFile(rawPcmFile, pcm);
    try {
      await execFileAsync(getFfmpegPath(), [
        "-y",
        "-f",
        "s16le",
        "-ar",
        "44100",
        "-ac",
        "2",
        "-i",
        rawPcmFile,
        "-b:a",
        "192k",
        outMp3,
      ]);
    } finally {
      await fs.promises.unlink(rawPcmFile).catch(() => {});
    }
  }

  // Probe duration of the rendered voice file
  let finalDuration = Math.max(2, Math.round(text.split(" ").length / 2.5));
  try {
    const { stdout } = await execFileAsync(getFfprobePath(), [
      "-v",
      "quiet",
      "-print_format",
      "json",
      "-show_format",
      outMp3,
    ]);
    const probe = JSON.parse(stdout);
    if (probe.format?.duration) {
      finalDuration = parseFloat(probe.format.duration);
    }
  } catch (_) {}

  return {
    audioUrl: `/api/voice/file/tts_${hash}.mp3`,
    duration: Math.round(finalDuration * 10) / 10,
    filePath: outMp3,
  };
}
