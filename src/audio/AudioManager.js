import * as THREE from 'three';
import { events } from '../core/Events.js';

// Web Audio sound: recorded sound effects and ambience (public/assets/audio/,
// credited in ui/Credits.js) plus procedural music per level.
//
// - One-shots (SAMPLES) play on game events. A sample can be a slice of a
//   longer recording (offset/duration) and can have variants picked at random.
// - Loops (LOOPS) are cooking noises and per-level ambience. Each recording is
//   made seamless with a crossfade, then its volume follows the game state.
// - Spatial sounds (passing cars, horns) go through a PannerNode that tracks
//   a moving object, heard from wherever the camera is.
// If a recording fails to load, the synthesised version in SYNTH plays instead.
const BASE = 'assets/audio/';
const MUTE_KEY = 'bistro-rush-muted';
const midi = (note) => 440 * Math.pow(2, (note - 69) / 12);
const pick = (list) => list[Math.floor(Math.random() * list.length)];

const SAMPLES = {
  click: { files: ['sfx/click'], volume: 0.5 },
  pickup: { files: ['sfx/pickup'], volume: 0.8 },
  place: { files: ['sfx/place-1', 'sfx/place-2', 'sfx/place-3'], volume: 0.55 },
  bounce: { files: ['sfx/bounce'], volume: 0.35 },
  onCooker: { files: ['sfx/metal'], volume: 0.45 },
  trash: { files: ['sfx/trash'], offset: 2.0, duration: 1.3, volume: 0.5 },
  ding: { files: ['sfx/timer-ding'], offset: 0.2, duration: 1.3, volume: 0.4 },
  burnt: { files: ['sfx/buzzer'], volume: 0.3 },
  fizz: { files: ['sfx/pour-soda'], offset: 0.2, duration: 1.6, volume: 0.55 },
  orderUp: { files: ['sfx/pop'], volume: 0.6 },
  counterBell: { files: ['sfx/counter-bell'], duration: 1.4, volume: 0.55 },
  register: { files: ['sfx/register-beep'], volume: 0.14 },
  coins: { files: ['sfx/coins'], volume: 1 },
  wrong: { files: ['sfx/error'], volume: 0.6 },
  alarm: { files: ['sfx/alarm'], offset: 0.1, duration: 2.2, volume: 5 }, // a very quiet recording
  applause: { files: ['sfx/applause'], volume: 1.4 },
  trophy: { files: ['sfx/confirm'], volume: 0.35 },
  stepConcrete: { files: [1, 2, 3, 4, 5].map((n) => `sfx/step-concrete-${n}`), volume: 0.18 },
  stepWood: { files: [1, 2, 3, 4, 5].map((n) => `sfx/step-wood-${n}`), volume: 0.3 },
  thunder: {
    files: ['sfx/thunder-1', 'sfx/thunder-2', 'sfx/thunder-3'],
    slices: { 'sfx/thunder-3': { offset: 0.9, duration: 7 } },
    volume: 0.9,
    vary: 0.08,
  },
  // Passing cars, sliced so the loudest moment (the car right in front of
  // the mic) comes `peak` seconds into the slice.
  carPass: {
    files: ['sfx/car-pass-1', 'sfx/car-pass-2'],
    slices: { 'sfx/car-pass-1': { offset: 3.0, duration: 8, peak: 3.1 }, 'sfx/car-pass-2': { offset: 4.0, duration: 8, peak: 3.2 } },
    volume: 1.4,
  },
  horn: { files: ['sfx/horn'], volume: 0.5 },
};

// Which sounds play for which game event (several layer, with optional delays).
const EVENT_SOUNDS = {
  'item:pickup': ['pickup'],
  'item:place': ['place'],
  'item:trash': ['trash'],
  'item:bounce': ['bounce'],
  'cook:start': ['onCooker'],
  'cook:done': ['ding'],
  'cook:burnt': ['burnt'],
  'pour:done': ['blip'],
  'order:new': ['orderUp'],
  'order:served': ['counterBell', ['register', 0.15], ['coins', 0.3]],
  'order:wrong': ['wrong'],
  'order:missed': ['miss'],
  'overclock:start': ['alarm'],
  'rush:start': ['alarm'],
  'level:complete': ['fanfare', ['applause', 0.3]],
  'level:failed': ['fail'],
  'ui:click': ['click'],
  'hud:coin': ['coins'],
  'achievement:unlocked': ['trophy', 'trophyChime'],
};

// Looping beds. `volume` is the level at full intensity.
const LOOPS = {
  grill: { file: 'sfx/grill-sizzle', volume: 0.9 },
  fryer: { file: 'sfx/fryer', volume: 0.7 },
  pot: { file: 'sfx/pot-boil', volume: 0.45 },
  pour: { file: 'sfx/pour-broth', volume: 0.45 },
  park: { file: 'ambience/park', volume: 1, ambience: true },
  insects: { file: 'ambience/night-insects', volume: 1, ambience: true },
  city: { file: 'ambience/city-night', volume: 1, ambience: true },
  rain: { file: 'ambience/rain', volume: 1, ambience: true },
};

// Synthesised sounds: musical stingers, and stand-ins for missing recordings.
const SYNTH = {
  click: (a) => a.tone({ freq: 900, duration: 0.05, volume: 0.15 }),
  pickup: (a) => {
    a.tone({ freq: 520, duration: 0.07, volume: 0.2, type: 'triangle' });
    a.tone({ freq: 780, duration: 0.08, volume: 0.2, type: 'triangle', delay: 0.06 });
  },
  place: (a) => a.tone({ freq: 180, slideTo: 120, duration: 0.12, volume: 0.35, type: 'triangle' }),
  onCooker: (a) => a.tone({ freq: 180, slideTo: 120, duration: 0.12, volume: 0.35, type: 'triangle' }),
  trash: (a) => a.noise({ duration: 0.3, volume: 0.3, filter: 900, slideTo: 200 }),
  ding: (a) => {
    a.tone({ freq: 1320, duration: 0.5, volume: 0.2 });
    a.tone({ freq: 1980, duration: 0.4, volume: 0.08 });
  },
  burnt: (a) => {
    a.noise({ duration: 0.6, volume: 0.25, filter: 2400 });
    a.tone({ freq: 140, slideTo: 90, duration: 0.5, volume: 0.25, type: 'sawtooth' });
  },
  blip: (a) => a.tone({ freq: 1040, duration: 0.09, volume: 0.12, type: 'square' }),
  orderUp: (a) => {
    a.tone({ freq: 1568, duration: 0.6, volume: 0.15 });
    a.tone({ freq: 2093, duration: 0.5, volume: 0.1, delay: 0.12 });
  },
  counterBell: (a) => [60, 64, 67, 72].forEach((note, index) => a.tone({ freq: midi(note + 12), duration: 0.18, volume: 0.2, type: 'triangle', delay: index * 0.07 })),
  wrong: (a) => {
    a.tone({ freq: 330, duration: 0.14, volume: 0.2, type: 'square' });
    a.tone({ freq: 247, duration: 0.2, volume: 0.2, type: 'square', delay: 0.14 });
  },
  miss: (a) => a.tone({ freq: 300, slideTo: 90, duration: 0.7, volume: 0.25, type: 'sawtooth' }),
  alarm: (a) => [0, 0.25, 0.5].forEach((delay) => a.tone({ freq: 700, slideTo: 1100, duration: 0.2, volume: 0.15, type: 'square', delay })),
  fanfare: (a) => [60, 64, 67, 72, 76, 79, 84].forEach((note, index) => a.tone({ freq: midi(note), duration: 0.3, volume: 0.2, type: 'triangle', delay: index * 0.1 })),
  coins: (a) => {
    a.noise({ duration: 0.06, volume: 0.18, filter: 5000 });
    a.tone({ freq: 2637, duration: 0.35, volume: 0.12, delay: 0.05 });
    a.tone({ freq: 3520, duration: 0.3, volume: 0.08, delay: 0.08 });
  },
  trophyChime: (a) => [72, 76, 79, 84, 88].forEach((note, index) => a.tone({ freq: midi(note), duration: 0.25, volume: 0.16, type: 'sine', delay: index * 0.06 })),
  fail: (a) => [67, 63, 60, 55].forEach((note, index) => a.tone({ freq: midi(note), duration: 0.4, volume: 0.2, type: 'sawtooth', delay: index * 0.22 })),
};

// Copy of `buffer` whose end crossfades (equal power) into its start, so it
// loops without a click or a jump in the background noise.
function seamless(ctx, buffer, fade = 1.2) {
  const fadeLength = Math.min(Math.floor(fade * buffer.sampleRate), Math.floor(buffer.length / 3));
  const length = buffer.length - fadeLength;
  const out = ctx.createBuffer(buffer.numberOfChannels, length, buffer.sampleRate);
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const source = buffer.getChannelData(channel);
    const target = out.getChannelData(channel);
    target.set(source.subarray(0, length));
    for (let i = 0; i < fadeLength; i += 1) {
      const t = i / fadeLength;
      target[i] = source[i] * Math.sqrt(t) + source[length + i] * Math.sqrt(1 - t);
    }
  }
  return out;
}

const listenerPosition = new THREE.Vector3();
const listenerForward = new THREE.Vector3();
const voicePosition = new THREE.Vector3();

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.buffers = {};
    this.ready = false;
    this.loops = new Map(); // name -> { gain, source, target }
    this.spatial = new Set(); // { panner, object }
    this.footsteps = 'stepConcrete';
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
      this.ambienceBus = this.ctx.createGain();
      this.ambienceBus.gain.value = 0.6;
      this.ambienceBus.connect(this.master);
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = 0.2;
      this.musicBus.connect(this.master);
      this.noiseBuffer = this.createNoiseBuffer();
      this.loadFiles();
      if (this.music) this.startMusic(this.music);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  bindEvents() {
    for (const [event, sounds] of Object.entries(EVENT_SOUNDS)) {
      events.on(event, () => {
        for (const entry of sounds) {
          const [name, delay = 0] = [].concat(entry);
          this.play(name, { delay });
        }
      });
    }
    events.on('pour:start', ({ station }) => {
      if (station.config.item !== 'broth' && station.config.item !== 'tea') this.play('fizz');
    });
    events.on('chef:step', () => this.play(this.footsteps));
    events.on('weather:thunder', ({ delay = 0 }) => this.play('thunder', { delay, volume: 0.6 + Math.random() * 0.4 }));
    events.on('traffic:pass', ({ object, heavy }) => this.playPassBy(object, heavy));
    events.on('traffic:horn', ({ object }) => this.playAt('horn', object));
  }

  // Each sound is usable as soon as its own file has decoded, so ambience and
  // cooking loops start without waiting for the whole set to download.
  async loadFiles() {
    const loopFiles = new Set(Object.values(LOOPS).map((loop) => loop.file));
    const files = new Set(loopFiles);
    for (const sample of Object.values(SAMPLES)) sample.files.forEach((file) => files.add(file));
    await Promise.all(
      [...files].map(async (file) => {
        try {
          const response = await fetch(`${BASE}${file}.ogg`);
          if (!response.ok) throw new Error(response.status);
          const buffer = await this.ctx.decodeAudioData(await response.arrayBuffer());
          this.buffers[file] = loopFiles.has(file) ? seamless(this.ctx, buffer) : buffer;
          if (loopFiles.has(file)) this.refreshLoops();
        } catch (error) {
          console.warn(`Could not load sound "${file}"`, error);
        }
      })
    );
    this.ready = true; // from here on, loops whose file failed use their stand-in
    this.refreshLoops();
  }

  refreshLoops() {
    for (const [name, loop] of this.loops) this.setLoop(name, loop.target);
  }

  // Plays a one-shot (a recording, or its synthesised stand-in) and returns
  // the gain node it plays through, or null.
  play(name, { delay = 0, volume = 1, output = this.sfx } = {}) {
    if (!this.ctx) return null;
    const sample = SAMPLES[name];
    const file = sample && pick(sample.files);
    const buffer = file && this.buffers[file];
    if (!buffer) {
      if (SYNTH[name]) {
        if (delay) setTimeout(() => SYNTH[name](this), delay * 1000);
        else SYNTH[name](this);
      }
      return null;
    }
    const slice = { offset: sample.offset ?? 0, duration: sample.duration, ...sample.slices?.[file] };
    const start = this.ctx.currentTime + delay;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = 1 + (Math.random() - 0.5) * 2 * (sample.vary ?? 0.04);
    const gain = this.ctx.createGain();
    const level = (sample.volume ?? 1) * volume;
    gain.gain.value = level;
    if (slice.duration) {
      // Fade out the end of a slice instead of cutting the recording off.
      const end = start + slice.duration;
      gain.gain.setValueAtTime(level, Math.max(start, end - 0.25));
      gain.gain.linearRampToValueAtTime(0, end);
      source.connect(gain).connect(output);
      source.start(start, slice.offset, slice.duration);
    } else {
      source.connect(gain).connect(output);
      source.start(start, slice.offset);
    }
    return { source, gain, slice };
  }

  // A sound positioned on (and following) a moving object.
  playAt(name, object, options = {}) {
    if (!this.ctx || !object) return null;
    const panner = this.ctx.createPanner();
    panner.panningModel = 'equalpower';
    panner.distanceModel = 'inverse';
    panner.refDistance = options.refDistance ?? 4;
    panner.rolloffFactor = 1.2;
    panner.connect(this.sfx);
    const voice = { panner, object };
    this.placeVoice(voice);
    const played = this.play(name, { ...options, output: panner });
    if (!played) {
      panner.disconnect();
      return null;
    }
    this.spatial.add(voice);
    played.source.onended = () => {
      this.spatial.delete(voice);
      panner.disconnect();
    };
    return played;
  }

  // A passing car, timed so the loudest moment lands as it passes the diner.
  // At most two at once, so the street doesn't turn into a wall of noise.
  playPassBy(object, heavy) {
    if (this.spatial.size >= 2) return;
    const played = this.playAt('carPass', object, { volume: heavy ? 1.2 : 1, refDistance: 5 });
    if (played && heavy) played.source.playbackRate.value *= 0.8;
  }

  // The listener is the camera: called once per frame.
  updateListener(camera) {
    if (!this.ctx) return;
    camera.getWorldPosition(listenerPosition);
    camera.getWorldDirection(listenerForward);
    const listener = this.ctx.listener;
    if (listener.positionX) {
      const time = this.ctx.currentTime;
      listener.positionX.setTargetAtTime(listenerPosition.x, time, 0.05);
      listener.positionY.setTargetAtTime(listenerPosition.y, time, 0.05);
      listener.positionZ.setTargetAtTime(listenerPosition.z, time, 0.05);
      listener.forwardX.setTargetAtTime(listenerForward.x, time, 0.05);
      listener.forwardY.setTargetAtTime(listenerForward.y, time, 0.05);
      listener.forwardZ.setTargetAtTime(listenerForward.z, time, 0.05);
      listener.upX.value = 0;
      listener.upY.value = 1;
      listener.upZ.value = 0;
    } else {
      listener.setPosition(listenerPosition.x, listenerPosition.y, listenerPosition.z);
      listener.setOrientation(listenerForward.x, listenerForward.y, listenerForward.z, 0, 1, 0);
    }
    this.spatial.forEach((voice) => this.placeVoice(voice));
  }

  placeVoice({ panner, object }) {
    object.getWorldPosition(voicePosition);
    if (panner.positionX) {
      const time = this.ctx.currentTime;
      panner.positionX.setTargetAtTime(voicePosition.x, time, 0.05);
      panner.positionY.setTargetAtTime(voicePosition.y, time, 0.05);
      panner.positionZ.setTargetAtTime(voicePosition.z, time, 0.05);
    } else {
      panner.setPosition(voicePosition.x, voicePosition.y, voicePosition.z);
    }
  }

  // Fades a looping bed to `level` (0..1 of its configured volume). Loops are
  // created on first use, once their recordings have loaded.
  setLoop(name, level, fade = 0.2) {
    const config = LOOPS[name];
    if (!config) return;
    let loop = this.loops.get(name);
    if (!loop) {
      loop = { target: 0, gain: null, source: null };
      this.loops.set(name, loop);
    }
    loop.target = level;
    if (!this.ctx || !(this.buffers[config.file] || this.ready)) return;
    if (!loop.gain) {
      if (level <= 0) return;
      loop.gain = this.ctx.createGain();
      loop.gain.gain.value = 0;
      loop.gain.connect(config.ambience ? this.ambienceBus : this.sfx);
      loop.source = this.ctx.createBufferSource();
      const buffer = this.buffers[config.file];
      if (buffer) {
        loop.source.buffer = buffer;
        loop.source.connect(loop.gain);
      } else {
        // Stand-in: band-passed noise.
        loop.source.buffer = this.noiseBuffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = config.ambience ? 800 : 3200;
        filter.Q.value = 0.8;
        loop.source.connect(filter).connect(loop.gain);
      }
      loop.source.loop = true;
      // Start each bed somewhere random so repeats don't line up.
      loop.source.start(0, Math.random() * loop.source.buffer.duration);
    }
    loop.gain.gain.setTargetAtTime(level * config.volume, this.ctx.currentTime, fade);
  }

  // Busy cookers and pours: { grill, fryer, pot, pour } as counts.
  setCooking(counts = {}) {
    for (const name of ['grill', 'fryer', 'pot', 'pour']) {
      const count = counts[name] ?? 0;
      this.setLoop(name, count > 0 ? Math.min(1, 0.6 + count * 0.25) : 0);
    }
  }

  // A level's background sound: its ambience beds and the chef's footsteps.
  setLevelAudio(level) {
    const ambience = level.ambience ?? {};
    for (const [name, config] of Object.entries(LOOPS)) {
      if (config.ambience) this.setLoop(name, ambience[name] ?? 0, 1.2);
    }
    this.footsteps = level.footsteps === 'wood' ? 'stepWood' : 'stepConcrete';
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
