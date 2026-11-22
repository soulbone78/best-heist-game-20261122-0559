// Sound, synthesized with WebAudio — no audio files. A pickup chime, a coin-like
// loot arpeggio, a two-tone siren while the alarm is up, a low sting when caught,
// a little fanfare for the getaway, and soft clicks for the menus. The audio context
// is created on the first user gesture, and M mutes everything.

export function createSound() {
  let context = null;
  let master = null;
  let siren = null;
  let muted = false;

  function ensure() {
    if (context) return true;
    try {
      const AudioContext = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.5;
      master.connect(context.destination);
    } catch {
      return false;
    }
    return true;
  }

  /** Call from a user gesture (start, click) so the browser lets sound play. */
  function unlock() {
    if (ensure() && context.state === 'suspended') context.resume().catch(() => {});
  }

  function tone(frequency, seconds, type, volume, when = 0, slideTo = null) {
    if (!ensure() || muted) return;
    const start = context.currentTime + when;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (slideTo !== null) oscillator.frequency.exponentialRampToValueAtTime(slideTo, start + seconds);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, start + seconds);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(start);
    oscillator.stop(start + seconds + 0.05);
  }

  return {
    unlock,
    toggleMute() {
      muted = !muted;
      if (siren) this.stopSiren();
      return muted;
    },
    get muted() {
      return muted;
    },
    click() {
      tone(660, 0.07, 'sine', 0.15);
    },
    loot(kind) {
      const base = kind === 'diamond' ? 880 : kind === 'gold' ? 740 : 620;
      tone(base, 0.1, 'triangle', 0.25);
      tone(base * 1.25, 0.12, 'triangle', 0.25, 0.08);
      tone(base * 1.5, 0.16, 'triangle', 0.22, 0.16);
    },
    exitOpen() {
      tone(523, 0.12, 'sine', 0.2);
      tone(784, 0.2, 'sine', 0.2, 0.1);
    },
    caught() {
      tone(220, 0.4, 'sawtooth', 0.25, 0, 110);
      tone(165, 0.5, 'square', 0.12, 0.05, 82);
    },
    levelClear() {
      [523, 659, 784, 1047].forEach((frequency, index) => tone(frequency, 0.16, 'triangle', 0.22, index * 0.09));
    },
    win() {
      [523, 659, 784, 1047, 1319, 1568].forEach((frequency, index) =>
        tone(frequency, 0.22, 'triangle', 0.22, index * 0.11),
      );
    },
    smoke() {
      tone(300, 0.3, 'sine', 0.18, 0, 90);
    },
    emp() {
      tone(1200, 0.25, 'square', 0.1, 0, 200);
    },
    alarmStart() {
      if (!ensure() || muted || siren) return;
      const oscillator = context.createOscillator();
      const lfo = context.createOscillator();
      const lfoGain = context.createGain();
      const gain = context.createGain();
      oscillator.type = 'sawtooth';
      oscillator.frequency.value = 720;
      lfo.type = 'sine';
      lfo.frequency.value = 1.1;
      lfoGain.gain.value = 220;
      gain.gain.value = 0.06;
      lfo.connect(lfoGain);
      lfoGain.connect(oscillator.frequency);
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start();
      lfo.start();
      siren = { oscillator, lfo, gain };
    },
    stopSiren() {
      if (!siren) return;
      try {
        siren.gain.gain.setTargetAtTime(0, context.currentTime, 0.05);
        siren.oscillator.stop(context.currentTime + 0.3);
        siren.lfo.stop(context.currentTime + 0.3);
      } catch {
        // Already stopped: nothing to silence.
      }
      siren = null;
    },
  };
}
