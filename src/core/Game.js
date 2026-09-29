import * as THREE from 'three';
import { events } from './Events.js';
import { GameState, STATES } from './GameState.js';
import { LEVELS, LevelManager } from './LevelManager.js';
import { Gameplay } from '../gameplay/Gameplay.js';
import { Player } from '../player/Player.js';
import { PlayerController } from '../player/PlayerController.js';
import { CameraController } from '../player/CameraController.js';
import { Effects } from '../graphics/Effects.js';
import { PostProcessing } from '../graphics/PostProcessing.js';
import { sharedUniforms } from '../graphics/Shaders.js';
import { AudioManager } from '../audio/AudioManager.js';
import { HUD } from '../ui/HUD.js';
import { Screens } from '../ui/Screens.js';
import { MainMenu } from '../ui/MainMenu.js';
import { PauseMenu } from '../ui/PauseMenu.js';
import { Credits } from '../ui/Credits.js';
import { KEYS, matches } from '../utils/Constants.js';
import { assets } from '../utils/AssetLoader.js';

const CAMERA_KEYS = { Digit1: 1, Digit2: 2, Digit3: 3, Digit4: 4 };

// Owns the renderer and main loop, and moves between menu → intro → playing →
// paused → complete / game over. Levels can be restarted without a page reload.
export class Game {
  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 300);
    this.scene.add(this.camera); // the held item is parented to the camera

    this.timer = new THREE.Timer();
    this.timer.connect(document);

    this.state = new GameState();
    this.levels = new LevelManager();
    this.audio = new AudioManager();
    this.cameraController = new CameraController(this.camera, this.renderer.domElement);
    this.player = new Player(this.camera);
    this.controller = new PlayerController(this.camera, this.renderer.domElement, this.player, {
      interact: (target) => this.gameplay?.interact(target),
      pickUp: (target) => this.gameplay?.pickUp(target) ?? false,
      canGive: (target) => target.kind === 'station' && this.player.isEmpty && target.ref.canGive(),
      canDrop: (target) => this.gameplay?.canDrop(target) ?? false,
      drop: (target, source) => this.gameplay?.drop(target, source),
    });
    this.scene.add(this.controller.ring, this.player.dragRoot);
    this.effects = new Effects(this.scene);
    this.post = new PostProcessing(this.renderer, this.scene, this.camera);

    this.hud = new HUD();
    this.screens = new Screens();
    this.menu = new MainMenu();
    this.pauseMenu = new PauseMenu();
    this.credits = new Credits();

    this.quality = 'high';
    this.levelIndex = 0;
    this.world = null;
    this.gameplay = null;
    this.focusPoint = new THREE.Vector3();
    this.request = 0; // guards against overlapping async level loads
  }

  async init() {
    document.querySelector('#app').appendChild(this.renderer.domElement);
    this.bindEvents();
    this.audio.bindEvents();
    this.credits.render();
    this.pauseMenu.setQuality(this.quality);
    this.pauseMenu.setMuted(this.audio.muted);
    this.onResize();
    this.renderer.setAnimationLoop((timestamp) => this.frame(timestamp));
    await this.ensureAssets('shared', 'Loading kitchen');
    await this.showMenu();
  }

  // Downloads a group of assets (see utils/AssetLoader.js) behind the loading screen.
  async ensureAssets(group, text) {
    if (assets.isLoaded(group)) return;
    this.screens.showLoading(`${text}…`, 0);
    await assets.load(group, (progress) => this.screens.showLoading(`${text}…`, progress));
    this.screens.hideLoading();
  }

  bindEvents() {
    window.addEventListener('resize', () => this.onResize());
    window.addEventListener('pointerdown', () => this.audio.unlock(), true);
    window.addEventListener('keydown', (event) => {
      this.audio.unlock();
      this.onKey(event);
    });

    const on = (name, handler) => events.on(name, handler);
    on('ui:play', () => this.openLevel(this.levels.highestUnlocked));
    on('ui:levels', () => {
      this.menu.renderLevelCards(LEVELS, (index) => this.levels.isUnlocked(index));
      this.screens.show('levels', { returnTo: 'menu' });
    });
    on('ui:select-level', ({ level }) => this.openLevel(Number(level)));
    on('ui:howto', () => this.screens.show('howto', { returnTo: this.state.is(STATES.PAUSED) ? 'pause' : 'menu' }));
    on('ui:credits', () => this.screens.show('credits', { returnTo: this.state.is(STATES.MENU) ? 'menu' : this.screens.current }));
    on('ui:back', () => this.screens.show(this.screens.returnTo));
    on('ui:start', () => this.beginShift());
    on('ui:pause', () => this.state.is(STATES.PLAYING) && this.pause());
    on('ui:resume', () => this.resume());
    on('ui:restart', () => this.openLevel(this.levelIndex));
    on('ui:next', () => this.openLevel(Math.min(this.levelIndex + 1, LEVELS.length - 1)));
    on('ui:menu', () => this.showMenu());
    on('ui:quality', () => this.toggleQuality());
    on('ui:mute', () => this.toggleMute());

    on('level:complete', () => this.onLevelComplete());
    on('level:failed', ({ reason }) => this.onLevelFailed(reason));

    on('message', ({ text }) => this.hud.toast(text));
    on('camera:mode', ({ name }) => {
      this.hud.setCamera(name);
      this.applyCutaway();
    });
    on('order:wrong', () => {
      this.cameraController.shake(0.08);
      this.post.flash(0.6);
    });
    on('order:missed', () => {
      this.cameraController.shake(0.15);
      this.post.flash(1);
    });
    on('cook:burnt', () => this.cameraController.shake(0.05));
    on('overclock:start', () => this.hud.banner('⚡ POWER SURGE ⚡', 'surge'));
    on('rush:start', () => this.hud.banner('RUSH HOUR!', 'rush'));
  }

  onKey(event) {
    const code = event.code;

    if (matches(code, KEYS.mute)) {
      this.toggleMute();
      return;
    }

    if (matches(code, KEYS.pause)) {
      if (this.state.is(STATES.PLAYING)) this.pause();
      else if (this.state.is(STATES.PAUSED) && this.screens.current === 'pause') this.resume();
      else if (['levels', 'howto', 'credits'].includes(this.screens.current)) this.screens.show(this.screens.returnTo);
      return;
    }

    if (this.state.is(STATES.INTRO) && matches(code, KEYS.interact)) {
      event.preventDefault();
      this.beginShift();
      return;
    }

    if (!this.state.is(STATES.PLAYING)) return;

    if (CAMERA_KEYS[code]) this.cameraController.setMode(CAMERA_KEYS[code]);
    else if (matches(code, KEYS.cycleCamera)) this.cameraController.cycle();
    else if (matches(code, KEYS.orbitLeft)) this.cameraController.orbit(-1);
    else if (matches(code, KEYS.orbitRight)) this.cameraController.orbit(1);
    else if (matches(code, KEYS.discard)) this.gameplay.discardHeld();
    else if (this.controller.handleKey(code)) event.preventDefault();
  }

  // ------------------------------------------------------------------ flow

  // Returns false if a newer load started while this one waited for assets.
  async loadWorld(index, request) {
    this.teardownGameplay();
    const level = LEVELS[index];
    await this.ensureAssets(level.theme, `Loading ${level.name}`);
    if (request !== this.request) return false;
    if (this.world) this.levels.dispose(this.world);
    this.renderer.toneMappingExposure = level.exposure ?? 1;
    this.world = this.levels.build(level, this.scene);
    this.effects.attach(this.world, level);
    this.post.configure(level.post);
    this.applyQuality();
    this.applyCutaway();
    return true;
  }

  // The top-down camera looks through the roof.
  applyCutaway() {
    const hide = this.cameraController.mode === 4 && !this.cameraController.autoOrbit;
    this.world?.cutaway.forEach((object) => (object.visible = !hide));
  }

  teardownGameplay() {
    if (!this.gameplay) return;
    this.gameplay.dispose();
    this.gameplay = null;
    this.controller.clear();
    this.audio.setSizzle(0);
  }

  async showMenu() {
    const index = this.levels.highestUnlocked;
    const request = ++this.request;
    if (!(await this.loadWorld(index, request))) return;
    this.state.set(STATES.MENU);
    this.controller.enabled = false;
    this.hud.hide();
    this.menu.setPlayLabel(LEVELS[index], index);
    this.screens.show('menu', { returnTo: 'menu' });
    this.cameraController.autoOrbit = true;
    this.applyCutaway();
    this.audio.startMusic(LEVELS[index].music);
  }

  async openLevel(index) {
    const request = ++this.request;
    this.levelIndex = index;
    const level = LEVELS[index];
    this.controller.enabled = false;
    if (!(await this.loadWorld(index, request))) return;
    this.gameplay = new Gameplay(level, this.world, this.player);
    this.controller.setTargets(this.gameplay.targets);
    this.controller.enabled = false;

    this.cameraController.autoOrbit = false;
    this.cameraController.reset();
    this.cameraController.snap();

    this.hud.hide();
    this.hud.setLevel(level, index);
    this.screens.showIntro(level, index);
    this.state.set(STATES.INTRO);
    this.audio.startMusic(level.music);
  }

  beginShift() {
    if (!this.state.is(STATES.INTRO)) return;
    this.screens.hideAll();
    this.hud.show();
    this.controller.enabled = true;
    this.state.set(STATES.PLAYING);
    events.emit('level:start', { level: LEVELS[this.levelIndex] });
  }

  pause() {
    this.controller.cancelDrag();
    this.state.set(STATES.PAUSED);
    this.controller.enabled = false;
    this.audio.setSizzle(0);
    this.screens.show('pause', { returnTo: 'pause' });
  }

  resume() {
    if (!this.state.is(STATES.PAUSED)) return;
    this.screens.hideAll();
    this.controller.enabled = true;
    this.state.set(STATES.PLAYING);
  }

  onLevelComplete() {
    this.controller.cancelDrag();
    this.levels.unlockAfter(this.levelIndex);
    this.state.set(STATES.LEVEL_COMPLETE);
    this.controller.enabled = false;
    this.audio.setSizzle(0);
    const isLast = this.levelIndex === LEVELS.length - 1;
    this.screens.showComplete(LEVELS[this.levelIndex], this.gameplay.stats, isLast);
  }

  onLevelFailed(reason) {
    this.controller.cancelDrag();
    this.state.set(STATES.GAME_OVER);
    this.controller.enabled = false;
    this.audio.setSizzle(0);
    this.screens.showGameOver(this.gameplay.stats, reason);
  }

  // -------------------------------------------------------------- settings

  toggleMute() {
    this.pauseMenu.setMuted(this.audio.toggleMute());
  }

  toggleQuality() {
    this.quality = this.quality === 'high' ? 'low' : 'high';
    this.pauseMenu.setQuality(this.quality);
    this.applyQuality();
  }

  // Low: no post-processing, 1× pixel ratio, no shadows — for weak lab machines.
  applyQuality() {
    const high = this.quality === 'high';
    this.post.enabled = high;
    this.renderer.setPixelRatio(high ? Math.min(window.devicePixelRatio, 2) : 1);
    this.post.composer.setPixelRatio(this.renderer.getPixelRatio());
    if (this.renderer.shadowMap.enabled !== high) {
      this.renderer.shadowMap.enabled = high;
      this.scene.traverse((object) => {
        if (object.material) [].concat(object.material).forEach((material) => (material.needsUpdate = true));
      });
    }
    this.onResize();
  }

  onResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.post.setSize(width, height);
    sharedUniforms.uPointScale.value = (height * this.renderer.getPixelRatio()) / 2;
  }

  // ------------------------------------------------------------------ loop

  frame(timestamp) {
    this.timer.update(timestamp);
    const dt = Math.min(this.timer.getDelta(), 0.1);
    const time = this.timer.getElapsed();
    const paused = this.state.is(STATES.PAUSED);
    const playing = this.state.is(STATES.PLAYING);

    if (!paused) {
      sharedUniforms.uTime.value = time;
      this.world?.update(dt, time);
      this.effects.update(dt, this.gameplay?.stations ?? []);
    }

    if (playing && this.gameplay) {
      this.gameplay.update(dt);
      this.controller.update(dt, time);
      this.player.update(dt, time);
      const busyCookers = this.gameplay.stations.filter((station) => station.item && station.accepts).length;
      this.audio.setSizzle(busyCookers);
      if (this.gameplay) this.hud.update(this.gameplay, this.controller, this.camera);
    }

    const selected = this.controller.selected;
    if (selected) this.cameraController.setFocus(selected.focus.getWorldPosition(this.focusPoint), selected.kind);
    this.cameraController.update(dt, time);

    this.post.setHeatSources(this.effects.heatSources());
    this.post.render(dt);
  }
}
