/**
 * Small synthesized sound effects via Web Audio (no audio assets needed).
 * Respects the global mute flag set from the settings store.
 */
export type SoundName = 'click' | 'place' | 'road' | 'collect' | 'error' | 'turn' | 'hover' | 'dice' | 'robber' | 'steal' | 'win';

let ctx: AudioContext | null = null;
let muted = false;

export function setMuted(value: boolean): void {
  muted = value;
}

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  // Browsers block audio until the user has interacted with the page.
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(ac: AudioContext, freq: number, start: number, dur: number, type: OscillatorType, gain: number, endFreq?: number) {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, start + dur);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(gain, start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

/** Short filtered noise burst — sounds like wood knocking on wood. */
function knock(ac: AudioContext, start: number, freq: number, gain: number) {
  const len = Math.floor(ac.sampleRate * 0.08);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  const src = ac.createBufferSource();
  src.buffer = buf;
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  filter.Q.value = 4;
  const g = ac.createGain();
  g.gain.value = gain;
  src.connect(filter).connect(g).connect(ac.destination);
  src.start(start);
}

export function playSound(name: SoundName): void {
  if (muted) return;
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  switch (name) {
    case 'click':
      knock(ac, t, 1800, 0.5);
      break;
    case 'hover':
      tone(ac, 900, t, 0.04, 'sine', 0.015);
      break;
    case 'place':
      knock(ac, t, 520, 1.4);
      knock(ac, t + 0.09, 700, 0.7);
      break;
    case 'road':
      knock(ac, t, 850, 1.1);
      break;
    case 'collect':
      [660, 880, 1100].forEach((f, i) => tone(ac, f, t + i * 0.07, 0.18, 'triangle', 0.06));
      break;
    case 'error':
      tone(ac, 220, t, 0.18, 'square', 0.03, 160);
      break;
    case 'turn':
      tone(ac, 523, t, 0.22, 'sine', 0.06);
      tone(ac, 784, t + 0.12, 0.3, 'sine', 0.05);
      break;
    case 'dice': {
      // two dice rattling and bouncing to a stop on wood
      const hits = [0, 0.09, 0.16, 0.3, 0.38, 0.55, 0.62, 0.8, 0.92, 1.05, 1.13];
      hits.forEach((h, i) => knock(ac, t + h, 1300 + ((i * 397) % 900), 0.9 * Math.pow(0.86, i)));
      break;
    }
    case 'robber':
      tone(ac, 196, t, 0.5, 'sawtooth', 0.025, 98);
      tone(ac, 147, t + 0.05, 0.6, 'triangle', 0.05, 110);
      break;
    case 'steal':
      tone(ac, 880, t, 0.08, 'square', 0.02, 660);
      tone(ac, 660, t + 0.08, 0.12, 'square', 0.02, 440);
      break;
    case 'win':
      [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(ac, f, t + i * 0.13, i === 5 ? 0.9 : 0.22, 'triangle', 0.07));
      break;
  }
}
