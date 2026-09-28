import { events } from '../core/Events.js';

// Web Audio sound: synthesised placeholder SFX + procedural music per level.
//
// To use real audio files, import them and add them to SOUND_FILES, e.g.
//   import serveUrl from '../../assets/audio/serve.mp3';
//   const SOUND_FILES = { serve: serveUrl };
// A loaded file always wins over the synthesised version. Credit it in ui/Credits.js.
const SOUND_FILES = {};

const MUTE_KEY = 'bistro-rush-muted';
const midi = (note) => 440 * Math.pow(2, (note - 69) / 12);

// Which sound plays for which game event.
const EVENT_SOUNDS = {
  'item:pickup': 'pickup',
  'item:place': 'place',
  'item:trash': 'trash',
  'cook:start': 'place',
  'cook:done': 'ding',
  'cook:burnt': 'burnt',
  'pour:start': 'pour',
  'pour:done': 'blip',
  'order:new': 'bell',
  'order:served': 'serve',
  'order:wrong': 'wrong',
  'order:missed': 'miss',
  'overclock:start': 'alarm',
  'rush:start': 'alarm',
  'level:complete': 'fanfare',
  'level:failed': 'fail',
  'ui:click': 'click',
};

const SYNTH = {
  click: (a) => a.tone({ freq: 900, duration: 0.05, volume: 0.15 }),
  pickup: (a) => {
    a.tone({ freq: 520, duration: 0.07, volume: 0.2, type: 'triangle' });
    a.tone({ freq: 780, duration: 0.08, volume: 0.2, type: 'triangle', delay: 0.06 });
  },
  place: (a) => a.tone({ freq: 180, slideTo: 120, duration: 0.12, volume: 0.35, type: 'triangle' }),
  trash: (a) => a.noise({ duration: 0.3, volume: 0.3, filter: 900, slideTo: 200 }),
  ding: (a) => {
    a.tone({ freq: 1320, duration: 0.5, volume: 0.2 });
    a.tone({ freq: 1980, duration: 0.4, volume: 0.08 });
  },
  burnt: (a) => {
    a.noise({ duration: 0.6, volume: 0.25, filter: 2400 });
    a.tone({ freq: 140, slideTo: 90, duration: 0.5, volume: 0.25, type: 'sawtooth' });
  },
  pour: (a) => a.noise({ duration: 0.5, volume: 0.12, filter: 1400, slideTo: 3000 }),
  blip: (a) => a.tone({ freq: 1040, duration: 0.09, volume: 0.18, type: 'square' }),
  bell: (a) => {
    a.tone({ freq: 1568, duration: 0.6, volume: 0.15 });
    a.tone({ freq: 2093, duration: 0.5, volume: 0.1, delay: 0.12 });
  },
  serve: (a) => [60, 64, 67, 72].forEach((note, index) => a.tone({ freq: midi(note + 12), duration: 0.18, volume: 0.2, type: 'triangle', delay: index * 0.07 })),
  wrong: (a) => {
    a.tone({ freq: 330, duration: 0.14, volume: 0.2, type: 'square' });
    a.tone({ freq: 247, duration: 0.2, volume: 0.2, type: 'square', delay: 0.14 });
  },
  miss: (a) => a.tone({ freq: 300, slideTo: 90, duration: 0.7, volume: 0.25, type: 'sawtooth' }),
  alarm: (a) => [0, 0.25, 0.5].forEach((delay) => a.tone({ freq: 700, slideTo: 1100, duration: 0.2, volume: 0.15, type: 'square', delay })),
  fanfare: (a) => [60, 64, 67, 72, 76, 79, 84].forEach((note, index) => a.tone({ freq: midi(note), duration: 0.3, volume: 0.2, type: 'triangle', delay: index * 0.1 })),
  fail: (a) => [67, 63, 60, 55].forEach((note, index) => a.tone({ freq: midi(note), duration: 0.4, volume: 0.2, type: 'sawtooth', delay: index * 0.22 })),
};

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.buffers = {};
    this.music = null;
    this.musicTimer = null;
    try {
      this.muted = localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      this.muted = false;
    }
  }

  // Browsers only allow audio after a user gesture; call this from input handlers.
  unlock() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      this.ctx = new AudioContextClass();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 1;
      this.master.connect(this.ctx.destination);
      this.sfx = this.ctx.createGain();
      this.sfx.gain.value = 0.7;
      this.sfx.connect(this.master);
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = 0.22;
      this.musicBus.connect(this.master);
      this.noiseBuffer = this.createNoiseBuffer();
      this.createSizzle();
      this.loadFiles();
      if (this.music) this.startMusic(this.music);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  bindEvents() {
    for (const [event, sound] of Object.entries(EVENT_SOUNDS)) {
      events.on(event, () => this.play(sound));
    }
  }

  async loadFiles() {
    for (const [name, url] of Object.entries(SOUND_FILES)) {
      try {
        const response = await fetch(url);
        this.buffers[name] = await this.ctx.decodeAudioData(await response.arrayBuffer());
      } catch (error) {
        console.warn(`Could not load sound "${name}"`, error);
      }
    }
  }

  play(name) {
    if (!this.ctx) return;
    const buffer = this.buffers[name];
    if (buffer) {
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(this.sfx);
      source.start();
      return;
    }
    SYNTH[name]?.(this);
  }

  tone({ freq, slideTo, duration = 0.15, volume = 0.3, type = 'sine', delay = 0, at, output = this.sfx }) {
    const start = at ?? this.ctx.currentTime + delay;
    const oscillator = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(freq, start);
    if (slideTo) oscillator.frequency.exponentialRampToValueAtTime(slideTo, start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(output);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.05);
  }

  noise({ duration = 0.3, volume = 0.2, filter = 1000, slideTo, delay = 0 }) {
    const start = this.ctx.currentTime + delay;
    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    const lowpass = this.ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(filter, start);
    if (slideTo) lowpass.frequency.exponentialRampToValueAtTime(slideTo, start + duration);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(lowpass).connect(gain).connect(this.sfx);
    source.start(start);
    source.stop(start + duration);
  }

  createNoiseBuffer() {
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  // Looping sizzle whose volume follows how many cookers are busy.
  createSizzle() {
    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.loop = true;
    const bandpass = this.ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 3200;
    bandpass.Q.value = 0.8;
    this.sizzleGain = this.ctx.createGain();
    this.sizzleGain.gain.value = 0;
    source.connect(bandpass).connect(this.sizzleGain).connect(this.sfx);
    source.start();
  }

  setSizzle(amount) {
    if (!this.ctx) return;
    this.sizzleGain.gain.setTargetAtTime(Math.min(amount, 3) * 0.05, this.ctx.currentTime, 0.15);
  }

  // `music` is a level's music config: { tempo, root, scale, progression, wave }.
  startMusic(music) {
    this.stopMusic();
    this.music = music;
    if (!this.ctx) return; // starts on unlock()
    this.step = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.musicTimer = setInterval(() => this.scheduleMusic(), 25);
  }

  stopMusic() {
    clearInterval(this.musicTimer);
    this.musicTimer = null;
  }

  scheduleMusic() {
    const { tempo, root, scale, progression, wave } = this.music;
    const eighth = 60 / tempo / 2;
    while (this.nextNoteTime < this.ctx.currentTime + 0.12) {
      const step = this.step;
      const chord = root + progression[Math.floor(step / 16) % progression.length];
      const time = this.nextNoteTime;
      if (step % 4 === 0) {
        this.tone({ freq: midi(chord - 12), duration: eighth * 3, volume: 0.35, type: 'triangle', at: time, output: this.musicBus });
      }
      const note = chord + scale[(step * 3 + Math.floor(step / 8)) % scale.length];
      if (step % 2 === 0 || Math.random() > 0.6) {
        this.tone({ freq: midi(note), duration: eighth * 0.9, volume: 0.12, type: wave, at: time, output: this.musicBus });
      }
      this.nextNoteTime += eighth;
      this.step += 1;
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 1;
    try {
      localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0');
    } catch {
      // ignore
    }
    return this.muted;
  }
}
