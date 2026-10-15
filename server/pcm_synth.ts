/**
 * Pure-JavaScript PCM audio synthesis.
 *
 * Used instead of ffmpeg's `lavfi` filter graphs (sine/tremolo sources)
 * because some bundled static ffmpeg builds crash on certain lavfi
 * filter combinations. Writing raw signed 16-bit PCM from JS and letting
 * ffmpeg do a plain PCM -> MP3 transcode is bulletproof on every build.
 */

export interface PcmSynthOptions {
  durationSec: number;
  /** Base frequency in Hz of the tone. */
  frequency: number;
  /** Rhythmic tremolo (amplitude gating) rate in Hz, e.g. track BPM / 60. */
  tremoloHz?: number;
  /** Tremolo depth 0..1 (0.7 = amplitude dips to 30%). */
  tremoloDepth?: number;
  /** Relative loudness 0..1 of the final signal. */
  amplitude?: number;
  /** Add an octave harmonic for a richer tone. */
  octaveHarmonic?: number;
  /** Fade in / out lengths in seconds (avoid clicks). */
  fadeInSec?: number;
  fadeOutSec?: number;
  sampleRate?: number;
  channels?: number;
}

/**
 * Synthesizes a signed 16-bit little-endian PCM buffer
 * (optionally stereo by duplicating the channel).
 */
export function synthesizePcm(opts: PcmSynthOptions): Buffer {
  const sampleRate = opts.sampleRate ?? 44100;
  const channels = opts.channels ?? 2;
  const totalSamples = Math.max(1, Math.round(opts.durationSec * sampleRate));
  const buf = Buffer.alloc(totalSamples * channels * 2);

  const tremoloHz = opts.tremoloHz ?? 0;
  const tremoloDepth = Math.min(1, Math.max(0, opts.tremoloDepth ?? 0.7));
  const amplitude = opts.amplitude ?? 0.75;
  const harmonic = opts.octaveHarmonic ?? 0.25;
  const fadeInSec = opts.fadeInSec ?? 0.01;
  const fadeOutSec = opts.fadeOutSec ?? 0.25;

  for (let n = 0; n < totalSamples; n++) {
    const t = n / sampleRate;

    // Base tone + octave harmonic
    const wave =
      Math.sin(2 * Math.PI * opts.frequency * t) * (1 - harmonic) +
      Math.sin(2 * Math.PI * opts.frequency * 2 * t) * harmonic;

    // Rhythmic amplitude gating at the given rate
    const trem = tremoloHz > 0 ? 1 - (tremoloDepth / 2) * (1 + Math.sin(2 * Math.PI * tremoloHz * t)) : 1;

    // Fade envelope to avoid clicks at the edges
    const fadeIn = Math.min(1, t / Math.max(0.001, fadeInSec));
    const fadeOut = Math.min(1, (opts.durationSec - t) / Math.max(0.001, fadeOutSec));
    const envelope = Math.max(0, Math.min(1, fadeIn * fadeOut));

    const sample = Math.max(-1, Math.min(1, amplitude * wave * trem * envelope));
    const value = Math.round(sample * 32767);

    for (let ch = 0; ch < channels; ch++) {
      buf.writeInt16LE(value, (n * channels + ch) * 2);
    }
  }

  return buf;
}
