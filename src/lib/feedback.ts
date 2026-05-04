'use client';

/**
 * feedback.ts — micro-interactions: Web Audio tones + reduced-motion check.
 * No external assets — every sound is generated on the fly with the Web Audio API.
 * Respects prefers-reduced-motion.
 */

let audioCtx: AudioContext | null = null;

function ctx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    try {
      const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!C) return null;
      audioCtx = new C();
    } catch {
      return null;
    }
  }
  return audioCtx;
}

export function reducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

interface ToneOptions {
  /** Starting frequency in Hz */
  start: number;
  /** Ending frequency in Hz */
  end: number;
  /** Duration in seconds */
  durationSec: number;
  /** Peak gain (0-1, kept low to avoid clipping) */
  gain?: number;
  /** Oscillator type */
  type?: OscillatorType;
}

function tone({ start, end, durationSec, gain = 0.06, type = 'sine' }: ToneOptions) {
  if (reducedMotion()) return;
  const ac = ctx();
  if (!ac) return;
  // Resume on user gesture if needed
  if (ac.state === 'suspended') ac.resume().catch(() => {});

  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(start, ac.currentTime);
  osc.frequency.exponentialRampToValueAtTime(Math.max(end, 1), ac.currentTime + durationSec);
  g.gain.setValueAtTime(0.0001, ac.currentTime);
  g.gain.exponentialRampToValueAtTime(gain, ac.currentTime + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + durationSec);
  osc.connect(g).connect(ac.destination);
  osc.start();
  osc.stop(ac.currentTime + durationSec + 0.05);
}

/** Approve / success — rising blip 440 → 880 Hz, ~150ms */
export const playSuccess = () => tone({ start: 440, end: 880, durationSec: 0.15, gain: 0.07, type: 'sine' });

/** Reject / skip — descending dip 220 → 110 Hz, ~200ms */
export const playSkip = () => tone({ start: 220, end: 110, durationSec: 0.2, gain: 0.05, type: 'triangle' });

/** Error — short low buzz */
export const playError = () => tone({ start: 110, end: 80, durationSec: 0.3, gain: 0.08, type: 'sawtooth' });
