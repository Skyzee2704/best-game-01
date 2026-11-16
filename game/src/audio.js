// Procedural WebAudio for Nova Drift: every sound is synthesised, no audio files.
// A quiet two-bar bass-and-pluck loop runs under play; shots, explosions, pickups and
// upgrades are short oscillator/noise bursts. The context is created lazily on the
// first user gesture so browsers never autoplay-block it.
const MUSIC_NOTES = [55, 0, 65.41, 0, 49, 0, 58.27, 0, 55, 0, 65.41, 0, 73.42, 0, 65.41, 0];
const PLUCK_NOTES = [220, 261.63, 329.63, 392, 329.63, 261.63, 220, 196];

export function createAudio() {
  let ctx = null;
  let master = null;
  let musicTimer = null;
  let musicStep = 0;
  let muted = false;
  let noiseBuffer = null;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') void ctx.resume();
      return true;
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      const len = ctx.sampleRate * 0.5;
      noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(dur, vol, filterFreq) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFreq, t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, filterFreq * 0.2), t + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  function startMusic() {
    if (!ctx || musicTimer) return;
    musicStep = 0;
    musicTimer = window.setInterval(() => {
      if (muted || !ctx) return;
      const bass = MUSIC_NOTES[musicStep % MUSIC_NOTES.length];
      if (bass) tone(bass, 0.24, 'triangle', 0.16);
      if (musicStep % 2 === 0) {
        const pluck = PLUCK_NOTES[(musicStep / 2) % PLUCK_NOTES.length | 0];
        tone(pluck, 0.18, 'sine', 0.05);
      }
      musicStep += 1;
    }, 240);
  }

  function stopMusic() {
    if (musicTimer) {
      window.clearInterval(musicTimer);
      musicTimer = null;
    }
  }

  return {
    ensure,
    startMusic,
    stopMusic,
    get muted() {
      return muted;
    },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.5;
    },
    shoot() {
      tone(720 + Math.random() * 120, 0.08, 'square', 0.08, 240);
    },
    explode(big) {
      noise(big ? 0.5 : 0.28, big ? 0.5 : 0.3, big ? 900 : 1400);
      tone(big ? 90 : 140, big ? 0.45 : 0.25, 'sine', 0.35, 40);
    },
    hit() {
      tone(160, 0.12, 'sawtooth', 0.16, 70);
    },
    pickup() {
      tone(660, 0.09, 'sine', 0.14);
      window.setTimeout(() => tone(990, 0.12, 'sine', 0.14), 70);
    },
    heal() {
      tone(520, 0.12, 'sine', 0.12);
      window.setTimeout(() => tone(780, 0.16, 'sine', 0.12), 90);
    },
    upgrade() {
      [523, 659, 784, 1047].forEach((freq, i) => {
        window.setTimeout(() => tone(freq, 0.16, 'triangle', 0.16), i * 80);
      });
    },
    dash() {
      noise(0.18, 0.18, 3200);
    },
    bomb() {
      noise(0.7, 0.55, 700);
      tone(60, 0.6, 'sine', 0.4, 28);
    },
    waveClear() {
      [392, 523, 659].forEach((freq, i) => {
        window.setTimeout(() => tone(freq, 0.18, 'triangle', 0.15), i * 90);
      });
    },
    boss() {
      tone(55, 0.8, 'sawtooth', 0.25, 38);
      noise(0.5, 0.2, 500);
    },
  };
}
