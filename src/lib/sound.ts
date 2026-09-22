/**
 * The app's voice, synthesised rather than sampled.
 *
 * Interface feedback is a handful of short tones, and a handful of short tones
 * is cheaper to compute than to download: no files in the bundle, no request
 * that can arrive late, no licence attached to somebody else's recording, and
 * a cue that fires on the same frame as the animation it belongs to. A
 * sampled version of this would be worse at every one of those.
 *
 * The character is deliberate. Right answers rise, wrong ones fall; everything
 * lands on a major pentatonic, which is the scale that can't produce a sour
 * interval however you stack it, and that's why cheerful apps live there. The
 * envelopes are all attack-then-exponential-decay with nothing sustained,
 * because a UI sound that lingers is a UI sound you learn to resent by the
 * fortieth time you hear it.
 */

/** Semitones above A3 (220 Hz), so the notes read as music instead of numbers. */
const A3 = 220;
const note = (semitones: number) => A3 * 2 ** (semitones / 12);

/** One voice: a tone with a shape. Everything below is built out of these. */
interface Voice {
  /** Semitones from A3. */
  pitch: number;
  /** Seconds from the start of the cue. */
  at: number;
  /** Seconds. */
  hold: number;
  gain?: number;
  type?: OscillatorType;
  /** Semitones to slide to across `hold` — the little "whoop" on a rise. */
  bend?: number;
  /**
   * Filtered noise instead of a tone, centred on `pitch`.
   *
   * Only two things in the app earn it: a liquidation, which needs to sound
   * like something breaking rather than like a note, and the shimmer on a
   * payout. A tone can be pleasant or unpleasant; only noise sounds *wrong*.
   */
  noise?: boolean;
  /** Cents of detune. A pair a few cents apart beats, and beating is tension. */
  detune?: number;
}

/*
 * The cues.
 *
 * A3 is 0, so 12 is an octave up. The pentatonic degrees used throughout are
 * 0, 2, 4, 7 and 9 — root, second, third, fifth, sixth.
 */
const CUES = {
  // ─────────────────────────────── Lecciones ───────────────────────────────

  /** Two notes up a fourth: the shortest phrase that sounds like "yes". */
  correct: [
    { pitch: 16, at: 0, hold: 0.09, gain: 0.5 },
    { pitch: 21, at: 0.07, hold: 0.18, gain: 0.5 },
  ],
  /**
   * A semitone down, soft and low.
   *
   * Not a buzzer. Getting it wrong is the ordinary case while you're learning,
   * and a sound that punishes is a sound that makes people stop playing —
   * this one just says "no" and gets out of the way.
   */
  wrong: [
    { pitch: 3, at: 0, hold: 0.12, gain: 0.32, type: 'triangle' as OscillatorType },
    { pitch: 1, at: 0.08, hold: 0.22, gain: 0.32, type: 'triangle' as OscillatorType },
  ],
  /** The whole chord, climbed: root, third, fifth, octave. */
  lesson: [
    { pitch: 16, at: 0, hold: 0.1, gain: 0.42 },
    { pitch: 20, at: 0.08, hold: 0.1, gain: 0.42 },
    { pitch: 23, at: 0.16, hold: 0.12, gain: 0.42 },
    { pitch: 28, at: 0.24, hold: 0.34, gain: 0.46 },
  ],
  /** Higher, with the last note bending up: something was won, not just done. */
  levelUp: [
    { pitch: 21, at: 0, hold: 0.1, gain: 0.4 },
    { pitch: 25, at: 0.09, hold: 0.1, gain: 0.4 },
    { pitch: 28, at: 0.18, hold: 0.12, gain: 0.42 },
    { pitch: 33, at: 0.27, hold: 0.42, gain: 0.46, bend: 2 },
  ],
  /** Sparkle: high, quick, slightly out of step so it shimmers. */
  reward: [
    { pitch: 28, at: 0, hold: 0.08, gain: 0.3 },
    { pitch: 33, at: 0.05, hold: 0.08, gain: 0.3 },
    { pitch: 35, at: 0.1, hold: 0.08, gain: 0.3 },
    { pitch: 40, at: 0.15, hold: 0.3, gain: 0.34 },
  ],
  /** The streak: a rising pair with a bend, like a flame catching. */
  streak: [
    { pitch: 12, at: 0, hold: 0.1, gain: 0.36, bend: 3 },
    { pitch: 19, at: 0.09, hold: 0.3, gain: 0.4, bend: 2 },
  ],
  /** A section or a node opening up. Brighter than a level: it's a door. */
  unlock: [
    { pitch: 21, at: 0, hold: 0.08, gain: 0.34 },
    { pitch: 26, at: 0.07, hold: 0.08, gain: 0.36 },
    { pitch: 33, at: 0.14, hold: 0.3, gain: 0.4, bend: 2 },
  ],
  /** Climbing a league. Wider and slower than a level: it took a week. */
  promotion: [
    { pitch: 16, at: 0, hold: 0.12, gain: 0.4 },
    { pitch: 23, at: 0.1, hold: 0.12, gain: 0.42 },
    { pitch: 28, at: 0.2, hold: 0.12, gain: 0.44 },
    { pitch: 35, at: 0.3, hold: 0.5, gain: 0.48, bend: 2 },
    { pitch: 40, at: 0.34, hold: 0.44, gain: 0.22 },
  ],
  /** A friend poking you. A little call, and then its own answer. */
  ping: [
    { pitch: 33, at: 0, hold: 0.07, gain: 0.3 },
    { pitch: 28, at: 0.06, hold: 0.07, gain: 0.28 },
    { pitch: 33, at: 0.13, hold: 0.2, gain: 0.32 },
  ],

  // ────────────────────────────── Operar ───────────────────────────────────
  //
  // The direction is audible on purpose: a long rises, a short falls, and the
  // pair is the same two notes read in opposite order. You shouldn't need the
  // screen to know which way you just committed.

  /** Into a long. Confident, bodied, over in a tenth of a second. */
  openLong: [
    { pitch: 14, at: 0, hold: 0.07, gain: 0.42, type: 'triangle' as OscillatorType },
    { pitch: 21, at: 0.06, hold: 0.2, gain: 0.44, type: 'triangle' as OscillatorType },
  ],
  /** Into a short. The same two notes, the other way round. */
  openShort: [
    { pitch: 21, at: 0, hold: 0.07, gain: 0.42, type: 'triangle' as OscillatorType },
    { pitch: 14, at: 0.06, hold: 0.2, gain: 0.44, type: 'triangle' as OscillatorType },
  ],
  /** A limit order left waiting. A stamp: noted, nothing bought yet. */
  orderPlaced: [
    { pitch: 24, at: 0, hold: 0.04, gain: 0.3 },
    { pitch: 24, at: 0.07, hold: 0.05, gain: 0.26 },
  ],
  /** The order becoming a position. Drier than opening at market — it waited. */
  orderFilled: [
    { pitch: 16, at: 0, hold: 0.05, gain: 0.4 },
    { pitch: 23, at: 0.05, hold: 0.16, gain: 0.42 },
  ],
  /** Taking the order back. Soft and falling: nothing was risked, nothing lost. */
  orderCancelled: [
    { pitch: 19, at: 0, hold: 0.06, gain: 0.26 },
    { pitch: 14, at: 0.05, hold: 0.14, gain: 0.24 },
  ],

  // ── Objetivos ──
  // A target sits above and a stop below, and they sound like where they sit.

  /** Target set. High and pinned, two quick notes upward. */
  targetSet: [
    { pitch: 28, at: 0, hold: 0.05, gain: 0.32 },
    { pitch: 33, at: 0.05, hold: 0.14, gain: 0.34 },
  ],
  /** Stop set. Lower and heavier: it's a floor, and floors are serious. */
  stopSet: [
    { pitch: 16, at: 0, hold: 0.05, gain: 0.32, type: 'triangle' as OscillatorType },
    { pitch: 12, at: 0.05, hold: 0.16, gain: 0.34, type: 'triangle' as OscillatorType },
  ],
  /** Dragging one that already exists. A tick, not an announcement. */
  targetMoved: [{ pitch: 31, at: 0, hold: 0.05, gain: 0.22 }],
  stopMoved: [{ pitch: 14, at: 0, hold: 0.05, gain: 0.22, type: 'triangle' as OscillatorType }],
  /** Taking one off. A short slide down and out. */
  targetCleared: [{ pitch: 26, at: 0, hold: 0.13, gain: 0.24, bend: -5 }],
  stopCleared: [{ pitch: 14, at: 0, hold: 0.13, gain: 0.24, bend: -5, type: 'triangle' as OscillatorType }],

  // ── Cierres ──

  /** Closed in the green, by your own hand. Warm, three notes, unhurried. */
  closeProfit: [
    { pitch: 19, at: 0, hold: 0.08, gain: 0.4, type: 'triangle' as OscillatorType },
    { pitch: 23, at: 0.07, hold: 0.08, gain: 0.42, type: 'triangle' as OscillatorType },
    { pitch: 26, at: 0.14, hold: 0.32, gain: 0.44, type: 'triangle' as OscillatorType },
  ],
  /** Closed in the red. Falls, but keeps its dignity: no jeering. */
  closeLoss: [
    { pitch: 14, at: 0, hold: 0.08, gain: 0.32, type: 'triangle' as OscillatorType },
    { pitch: 11, at: 0.07, hold: 0.08, gain: 0.3, type: 'triangle' as OscillatorType },
    { pitch: 7, at: 0.14, hold: 0.26, gain: 0.3, type: 'triangle' as OscillatorType },
  ],
  /**
   * Closed at exactly nothing, which happens more than you'd think — the
   * balance is whole coins and a small move can't clear the fee. The same note
   * twice: the sound of not having moved.
   */
  closeFlat: [
    { pitch: 19, at: 0, hold: 0.06, gain: 0.26 },
    { pitch: 19, at: 0.07, hold: 0.14, gain: 0.24 },
  ],
  /** The target firing by itself. The best thing that happens here, so it's the
   *  brightest thing you can hear: a bell, and then a shimmer over it. */
  takeProfitHit: [
    { pitch: 28, at: 0, hold: 0.1, gain: 0.42 },
    { pitch: 35, at: 0.08, hold: 0.12, gain: 0.44 },
    { pitch: 40, at: 0.18, hold: 0.5, gain: 0.46, bend: 2 },
    { pitch: 47, at: 0.2, hold: 0.36, gain: 0.16 },
    { pitch: 44, at: 0.26, hold: 0.3, gain: 0.12, detune: 12 },
  ],
  /** The stop firing. Two low, firm, square knocks — it caught you. Protective,
   *  not punishing: this is the order doing its job. */
  stopLossHit: [
    { pitch: 12, at: 0, hold: 0.07, gain: 0.34, type: 'square' as OscillatorType },
    { pitch: 12, at: 0.09, hold: 0.16, gain: 0.3, type: 'square' as OscillatorType },
  ],
  /**
   * Liquidated. The one genuinely ugly sound in the app, and it has to be:
   * everything else is a note, so the thing that isn't a note is the thing
   * that went wrong. Noise for the break, then two detuned lows beating
   * against each other underneath.
   */
  liquidated: [
    { pitch: 20, at: 0, hold: 0.18, gain: 0.3, noise: true },
    { pitch: 3, at: 0.02, hold: 0.42, gain: 0.34, type: 'sawtooth' as OscillatorType },
    { pitch: 3, at: 0.02, hold: 0.42, gain: 0.3, type: 'sawtooth' as OscillatorType, detune: 28 },
  ],

  // ─────────────────────────────── Interfaz ────────────────────────────────

  /** Almost subliminal. It exists to make a tap feel physical, not to be heard. */
  tap: [{ pitch: 26, at: 0, hold: 0.035, gain: 0.16, type: 'sine' as OscillatorType }],
  /** A switch or a tab. One step up from a tap, so a choice feels like one. */
  toggle: [{ pitch: 22, at: 0, hold: 0.045, gain: 0.2 }],
  /** Refused: not enough coins, no trades left, a target where none fits. Two
   *  flat low blips. It says "no" without saying "bad". */
  denied: [
    { pitch: 8, at: 0, hold: 0.05, gain: 0.26, type: 'triangle' as OscillatorType },
    { pitch: 8, at: 0.08, hold: 0.09, gain: 0.24, type: 'triangle' as OscillatorType },
  ],
} satisfies Record<string, Voice[]>;

export type Cue = keyof typeof CUES;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

/**
 * Whether sound plays at all. Read on every cue rather than captured, so
 * turning it off in Perfil silences the very next tap.
 */
let enabled = true;
export function setSoundEnabled(on: boolean): void {
  enabled = on;
}

/**
 * Browsers refuse to start audio that the player didn't ask for, so the
 * context is created inside the first gesture and kept. Calling this more than
 * once is free, which is why it can sit on a global listener without anybody
 * having to remember to remove it.
 */
export function unlockSound(): void {
  if (ctx || typeof window === 'undefined') return;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return;
  try {
    ctx = new Ctor();
    master = ctx.createGain();
    // Headroom: four voices at once must not clip, and interface sound should
    // sit under whatever the player is actually listening to.
    master.gain.value = 0.22;
    master.connect(ctx.destination);
  } catch {
    ctx = null;
  }
}

export function play(cue: Cue): void {
  if (!enabled || !ctx || !master) return;
  // Resumed every time on purpose: iOS suspends the context when the app goes
  // to the background, and comes back with it still suspended.
  if (ctx.state === 'suspended') void ctx.resume();
  const now = ctx.currentTime;
  for (const v of CUES[cue] as Voice[]) {
    const start = now + v.at;
    const gain = ctx.createGain();
    // A couple of milliseconds of attack instead of none: a square edge on the
    // waveform is a click, and the click is louder than the note.
    const peak = v.gain ?? 0.4;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + v.hold);
    gain.connect(master);

    if (v.noise) {
      const frames = Math.ceil(ctx.sampleRate * v.hold);
      const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      // Band-passed rather than raw: white noise across the whole spectrum is
      // a hiss, and a hiss has no pitch to tell you anything.
      const band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = note(v.pitch);
      band.Q.value = 1.4;
      src.connect(band);
      band.connect(gain);
      src.start(start);
      src.stop(start + v.hold + 0.02);
      continue;
    }

    const osc = ctx.createOscillator();
    osc.type = v.type ?? 'sine';
    osc.frequency.setValueAtTime(note(v.pitch), start);
    if (v.detune) osc.detune.setValueAtTime(v.detune, start);
    if (v.bend) osc.frequency.exponentialRampToValueAtTime(note(v.pitch + v.bend), start + v.hold);
    osc.connect(gain);
    osc.start(start);
    osc.stop(start + v.hold + 0.02);
  }
}
