import * as THREE from 'three';
import { events, say } from './Events.js';
import { GameState, STATES } from './GameState.js';
import { LEVELS, LevelManager } from './LevelManager.js';
import { Gameplay } from '../gameplay/Gameplay.js';
import { Player } from '../player/Player.js';
import { Chef } from '../player/Chef.js';
import { Physics } from '../gameplay/Physics.js';
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
import { Minimap } from '../ui/Minimap.js';
import { StoryScreen } from '../ui/StoryScreen.js';
import { StarRecord, rateShift } from '../ui/Stars.js';
import { Achievements } from '../ui/Achievements.js';
import { CampaignFund } from '../ui/CampaignFund.js';
import { finale } from '../levels/Story.js';
import { KEYS, LAYOUT, matches } from '../utils/Constants.js';
import { assets } from '../utils/AssetLoader.js';
import { disposeObject } from '../utils/Dispose.js';
import { ITEMS, RECIPES } from '../gameplay/Recipes.js';
import { createOrderDisplay } from '../gameplay/Customers.js';
import { createCustomer } from '../world/Characters.js';
import { createItemMesh, createPlateMesh } from '../world/Models.js';

const CAMERA_KEYS = { Digit1: 1, Digit2: 2, Digit3: 3, Digit4: 4, Digit5: 5 };
const WARM_CUSTOMERS = 12; // sample customers whose shaders are compiled while a level loads
// Adaptive antialiasing: below `minFps` (averaged over `window` seconds, after
// `warmup` seconds), try rendering without MSAA and keep it only if that is at
// least `gain` times faster. Choosing Graphics in the pause menu turns it off.
const AUTO_AA = { minFps: 28, warmup: 4, window: 5, gain: 1.15 };
const SLIDE_SECONDS = 5; // how long each level is shown behind the main menu
const SLIDE_FADE_MS = 450; // matches the #menuFade transition in style.css
// Recorded track behind the main menu (credited in ui/Credits.js); each level sets its own music.
// The recording is quiet (about -20 LUFS), hence the high volume.
const MENU_MUSIC = { file: 'music/lofi-loop', volume: 4 };

// Owns the renderer and main loop, and moves between menu → intro → playing →
// paused → complete / game over. Levels can be restarted without a page reload.
export class Game {
  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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
      spill: (source, velocity) => this.gameplay?.spill(source, velocity),
    });
    this.scene.add(this.controller.ring, this.player.dragRoot);
    this.effects = new Effects(this.scene);
    this.post = new PostProcessing(this.renderer, this.scene, this.camera);
    this.physics = new Physics(this.scene);
    this.minimap = new Minimap(this.renderer, this.scene);
    this.chef = null; // created once the character models have loaded

    this.hud = new HUD();
    this.screens = new Screens();
    this.menu = new MainMenu();
    this.pauseMenu = new PauseMenu();
    this.credits = new Credits();
    this.story = new StoryScreen();
    this.stars = new StarRecord();
    this.achievements = new Achievements();
    this.fund = new CampaignFund();
    this.afterStory = null; // where to go once the prologue ends

    this.quality = 'high';
    this.autoAntialias = { enabled: true, trial: false, warm: AUTO_AA.warmup, time: 0, frames: 0, before: 0, tried: new Set() };
    this.levelIndex = 0;
    this.world = null;
    this.gameplay = null;
    this.focusPoint = new THREE.Vector3();
    this.chefTarget = new THREE.Vector3();
    this.request = 0; // guards against overlapping async level loads
    this.slideshow = { index: 0, next: 0, swapping: false }; // main-menu background tour
    this.menuWorlds = new Map(); // level index → hidden place kept built during the slideshow
  }

  async init() {
    document.querySelector('#app').appendChild(this.renderer.domElement);
    this.bindEvents();
    this.audio.bindEvents();
    this.achievements.bindEvents();
    this.credits.render();
    this.pauseMenu.setQuality(this.quality);
    this.pauseMenu.setMuted(this.audio.muted);
    this.onResize();
    this.renderer.setAnimationLoop((timestamp) => this.frame(timestamp));
    await this.ensureAssets('shared', 'Loading kitchen');
    this.chef = new Chef();
    this.scene.add(this.chef.root);
    this.cameraController.follow = this.chef.root;
    // The prologue is the first thing after loading, then the main menu.
    await this.showMenu({ withStory: true });
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
      this.menu.renderLevelCards(LEVELS, (index) => this.levels.isUnlocked(index), (level) => this.stars.get(level.id));
      this.menu.renderFund(this.fund);
      this.screens.show('levels', { returnTo: 'menu' });
    });
    on('ui:trophies', () => {
      this.achievements.render(this.stars.total, LEVELS.length * 3);
      this.screens.show('trophies', { returnTo: 'menu' });
    });
    on('ui:begin', () => this.begin());
    on('ui:story',() => this.showStory(() => this.screens.show('menu')));
    on('ui:story-prev', () => this.story.go(-1) || this.finishStory());
    on('ui:story-next', () => this.story.go(1) || this.finishStory());
    on('ui:story-skip', () => this.finishStory());
    on('ui:finale', () => this.showFinale());
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
    on('ui:camera-cycle', () => {
      if (this.state.is(STATES.PLAYING)) this.cameraController.cycle();
    });
    on('ui:discard', () => {
      if (this.state.is(STATES.PLAYING)) this.gameplay?.discardHeld();
    });

    on('level:complete', () => this.onLevelComplete());
    on('level:failed', ({ reason }) => this.onLevelFailed(reason));

    on('message', ({ text }) => this.hud.toast(text));
    on('order:served', ({ position, reward, tip, combo }) => this.hud.moneyPopup(position, reward, tip, combo, this.camera));
    on('camera:mode', ({ mode, name }) => {
      this.hud.setCamera(name);
      this.applyCutaway();
      // Third person: held items go in the chef's arms instead of the camera hand.
      this.player.setCarry(mode === 2 && this.chef ? this.chef.carry : null);
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

    if (this.screens.current === 'start') {
      this.begin();
      return;
    }

    if (matches(code, KEYS.mute)) {
      this.toggleMute();
      return;
    }

    if (matches(code, KEYS.pause)) {
      if (this.state.is(STATES.PLAYING)) this.pause();
      else if (this.state.is(STATES.PAUSED) && this.screens.current === 'pause') this.resume();
      else if (this.screens.current === 'story') this.finishStory();
      else if (['levels', 'trophies', 'howto', 'credits'].includes(this.screens.current)) this.screens.show(this.screens.returnTo);
      return;
    }

    if (this.screens.current === 'story') {
      if (code === 'ArrowRight') this.story.go(1) || this.finishStory();
      else if (code === 'ArrowLeft') this.story.go(-1);
      return;
    }

    if (this.state.is(STATES.INTRO) && matches(code, KEYS.interact)) {
      event.preventDefault();
      this.beginShift();
      return;
    }

    if (!this.state.is(STATES.PLAYING)) return;

    if (CAMERA_KEYS[code]) this.cameraController.setMode(CAMERA_KEYS[code]);
    else if (matches(code, KEYS.minimap)) this.hud.toast(this.minimap.toggle() ? 'Minimap on' : 'Minimap off');
    else if (matches(code, KEYS.cycleCamera)) this.cameraController.cycle();
    else if (matches(code, KEYS.orbitLeft)) this.cameraController.orbit(-1);
    else if (matches(code, KEYS.orbitRight)) this.cameraController.orbit(1);
    else if (matches(code, KEYS.discard)) this.gameplay.discardHeld();
    else if (this.controller.handleKey(code)) event.preventDefault();
  }

  // ------------------------------------------------------------------ flow

  // Returns false if a newer load started while this one waited for assets.
  async loadWorld(index, request) {
    this.clearMenuWorlds();
    this.teardownGameplay();
    const level = LEVELS[index];
    await this.ensureAssets(level.theme, `Loading ${level.name}`);
    if (request !== this.request) return false;
    if (this.world) this.levels.dispose(this.world);
    this.renderer.toneMappingExposure = level.exposure ?? 1;
    this.world = this.levels.build(level, this.scene);
    this.effects.attach(this.world, level);
    this.chef?.reset(level);
    this.post.configure(level.post);
    this.applyQuality();
    this.applyCutaway();
    return true;
  }

  // The top-down camera looks through the roof; pieces flagged
  // hideInThirdPerson also get out of the way of the over-the-shoulder view.
  applyCutaway() {
    const { mode, autoOrbit } = this.cameraController;
    this.world?.cutaway.forEach((object) => {
      const hide = !autoOrbit && (mode === 4 || (mode === 2 && object.userData.hideInThirdPerson));
      object.visible = !hide;
    });
  }

  teardownGameplay() {
    if (!this.gameplay) return;
    this.gameplay.dispose();
    this.gameplay = null;
    this.controller.clear();
    this.audio.setCooking();
  }

  async showMenu({ withStory = false } = {}) {
    const index = this.levels.highestUnlocked;
    const request = ++this.request;
    if (!(await this.loadWorld(index, request))) return;
    this.state.set(STATES.MENU);
    this.controller.enabled = false;
    this.hud.hide();
    this.menu.setPlayLabel(LEVELS[index], index);
    // On first launch: the start screen, then the prologue, then the menu.
    if (withStory) this.screens.show('start');
    else this.screens.show('menu', { returnTo: 'menu' });
    this.cameraController.autoOrbit = true;
    this.applyCutaway();
    this.audio.startMusic(MENU_MUSIC);
    this.audio.setLevelAudio(LEVELS[index]);
    this.slideshow.index = index;
    this.slideshow.next = this.timer.getElapsed() + SLIDE_SECONDS;
    // Fetch the other levels quietly so the slideshow can show them too.
    LEVELS.forEach((level) => assets.load(level.theme).catch(() => {}));
  }

  // Behind the main menu, cycles through every level's place (only the
  // world changes; the music stays the same).
  updateSlideshow(time) {
    const slideshow = this.slideshow;
    if (slideshow.swapping || time < slideshow.next) return;
    slideshow.next = time + SLIDE_SECONDS;
    for (let step = 1; step < LEVELS.length; step++) {
      const index = (slideshow.index + step) % LEVELS.length;
      if (assets.isLoaded(LEVELS[index].theme)) {
        this.swapMenuLevel(index);
        return;
      }
    }
  }

  async swapMenuLevel(index) {
    const request = ++this.request;
    const fade = document.querySelector('#menuFade');
    this.slideshow.swapping = true;
    fade.classList.add('on');
    await new Promise((resolve) => setTimeout(resolve, SLIDE_FADE_MS));
    // Bail if the player picked a level (or anything else loaded) meanwhile.
    if (request === this.request) {
      this.showMenuWorld(index);
      this.cameraController.snap(this.timer.getElapsed());
      // Compile the new place's shaders and upload its textures while still
      // black, so it doesn't freeze on screen.
      await this.renderer.compileAsync(this.scene, this.camera).catch(() => {});
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }
    this.slideshow.swapping = false;
    this.slideshow.next = this.timer.getElapsed() + SLIDE_SECONDS;
    fade.classList.remove('on');
  }

  // Swaps the menu background to another level. Places already shown are kept
  // built (not disposed) while the menu is open, so coming back to them is
  // instant instead of rebuilding and recompiling every shader.
  showMenuWorld(index) {
    const scene = this.scene;
    const uniforms = ['uLightDir', 'uLightColor', 'uAmbient'];
    this.menuWorlds.set(this.slideshow.index, {
      world: this.world,
      environment: scene.environment,
      environmentIntensity: scene.environmentIntensity,
      background: scene.background,
      fog: scene.fog,
      exposure: this.renderer.toneMappingExposure,
      uniforms: uniforms.map((name) => sharedUniforms[name].value.clone()),
    });
    this.world.root.removeFromParent();

    const level = LEVELS[index];
    const cached = this.menuWorlds.get(index);
    this.menuWorlds.delete(index);
    if (cached) {
      scene.add(cached.world.root);
      scene.environment = cached.environment;
      scene.environmentIntensity = cached.environmentIntensity;
      scene.background = cached.background;
      scene.fog = cached.fog;
      this.renderer.toneMappingExposure = cached.exposure;
      uniforms.forEach((name, i) => sharedUniforms[name].value.copy(cached.uniforms[i]));
      this.world = cached.world;
    } else {
      this.renderer.toneMappingExposure = level.exposure ?? 1;
      this.world = this.levels.build(level, scene);
    }
    this.effects.attach(this.world, level);
    this.chef?.reset(level);
    this.post.configure(level.post);
    this.applyCutaway();
    this.slideshow.index = index;
  }

  // Frees the slideshow's hidden places once the menu loads a level for real.
  clearMenuWorlds() {
    this.menuWorlds.forEach(({ world }) => this.levels.dispose(world));
    this.menuWorlds.clear();
  }

  // The click or key press that leaves the start screen also unlocks the
  // sound (see bindEvents), so the music is already playing for the story.
  begin() {
    if (this.screens.current !== 'start') return;
    this.showStory(() => this.screens.show('menu', { returnTo: 'menu' }));
  }

  showStory(then) {
    this.afterStory = then;
    this.screens.show('story', { returnTo: 'menu' });
    this.story.open();
  }

  showFinale() {
    if (this.fund.ratio < 1) {
      this.hud.toast('Earn $' + (this.fund.goal - this.fund.total) + ' more to buy back The Golden Ladle.');
      this.showMenu();
      return;
    }
    this.afterStory = () => this.showMenu();
    this.screens.show('story', { returnTo: 'menu' });
    this.story.open(finale(this.fund.total, this.fund.goal));
  }

  finishStory() {
    if (this.screens.current !== 'story') return;
    const then = this.afterStory;
    this.afterStory = null;
    then?.();
  }

  async openLevel(index) {
    const request = ++this.request;
    this.levelIndex = index;
    const level = LEVELS[index];
    this.controller.enabled = false;
    if (!(await this.loadWorld(index, request))) return;
    await this.warmShaders(level);
    if (request !== this.request) return;
    this.gameplay = new Gameplay(level, this.world, this.player, this.physics);
    this.controller.setTargets(this.gameplay.targets);
    this.controller.enabled = false;

    this.cameraController.autoOrbit = false;
    this.cameraController.reset();
    this.cameraController.snap();

    this.hud.hide();
    this.hud.setLevel(level, index);
    this.screens.showIntro(level, index, this.stars.get(level.id));
    this.state.set(STATES.INTRO);
    this.audio.startMusic(level.music);
    this.audio.setLevelAudio(level);
  }

  // Compiles the level's shaders behind the loading screen. Customers, order
  // displays and food only appear once the shift is under way, so a sample of
  // each is put in the scene while compiling and then removed; otherwise every
  // first appearance stalls the game while its shader compiles (measured at up
  // to 3.4 s on an integrated GPU). One render afterwards also prepares the
  // shadow pass's shaders.
  async warmShaders(level) {
    this.screens.showLoading('Preparing the kitchen…', 1);
    await new Promise((resolve) => requestAnimationFrame(resolve)); // let the loading screen paint
    const samples = new THREE.Group();
    for (let seed = 1; seed <= WARM_CUSTOMERS; seed += 1) {
      const { root } = createCustomer(level.theme, seed);
      root.position.set((seed - WARM_CUSTOMERS / 2) * 0.9, 0, LAYOUT.customerZ);
      samples.add(root);
    }
    const recipes = [...new Set(level.recipes)].map((id) => RECIPES[id]);
    const types = new Set(level.stations.map((station) => station.item).filter(Boolean));
    recipes.forEach((recipe) => recipe.ingredients.forEach((tag) => types.add(tag.split(':')[0])));
    [...types].filter((type) => ITEMS[type]).forEach((type, index) => {
      const mesh = createItemMesh(type);
      mesh.position.set(-5 + index * 0.7, LAYOUT.counterTopY, LAYOUT.frontRowZ);
      samples.add(mesh);
    });
    samples.add(createPlateMesh());
    recipes.forEach((recipe, index) => {
      const display = createOrderDisplay(level, recipe);
      display.position.set(-4 + index * 1.6, 2.4, LAYOUT.customerZ);
      samples.add(display);
    });
    this.scene.add(samples);
    this.renderer.setRenderTarget(this.post.enabled ? this.post.composer.renderTarget1 : null);
    await this.renderer.compileAsync(this.scene, this.camera);
    await this.renderer.compileAsync(this.scene, this.minimap.camera);
    this.renderer.setRenderTarget(null);
    this.post.render(0);
    samples.removeFromParent();
    disposeObject(samples);
    this.screens.hideLoading();
  }

  beginShift() {
    if (!this.state.is(STATES.INTRO)) return;
    this.resetAutoAntialias();
    this.screens.hideAll();
    this.hud.show();
    this.minimap.invalidate();
    this.controller.enabled = true;
    this.state.set(STATES.PLAYING);
    events.emit('level:start', { level: LEVELS[this.levelIndex] });
    // Mute is remembered between visits, so say so rather than play in silence.
    if (this.audio.muted) say('Sound is off: press M or the 🔇 button to turn it on.');
  }

  pause() {
    this.controller.cancelDrag();
    this.state.set(STATES.PAUSED);
    this.controller.enabled = false;
    this.audio.setCooking();
    this.screens.show('pause', { returnTo: 'pause' });
  }

  resume() {
    if (!this.state.is(STATES.PAUSED)) return;
    this.resetAutoAntialias();
    this.screens.hideAll();
    this.controller.enabled = true;
    this.state.set(STATES.PLAYING);
  }

  onLevelComplete() {
    this.controller.cancelDrag();
    this.levels.unlockAfter(this.levelIndex);
    this.state.set(STATES.LEVEL_COMPLETE);
    this.controller.enabled = false;
    this.audio.setCooking();
    const isLast = this.levelIndex === LEVELS.length - 1;
    const level = LEVELS[this.levelIndex];
    const stars = rateShift(level, this.gameplay.stats);
    const newBest = this.stars.record(level.id, stars);
    this.fund.record(level.id, this.gameplay.stats.money);
    this.screens.showComplete(level, this.gameplay.stats, isLast, stars, newBest, this.fund);
  }

  onLevelFailed(reason) {
    this.controller.cancelDrag();
    this.state.set(STATES.GAME_OVER);
    this.controller.enabled = false;
    this.audio.setCooking();
    this.screens.showGameOver(this.gameplay.stats, reason);
  }

  // -------------------------------------------------------------- settings

  toggleMute() {
    this.pauseMenu.setMuted(this.audio.toggleMute());
  }

  toggleQuality() {
    this.quality = this.quality === 'high' ? 'low' : 'high';
    this.autoAntialias.enabled = false; // the player's own choice wins
    if (this.quality === 'high') this.post.setAntialias(true);
    this.pauseMenu.setQuality(this.quality);
    this.applyQuality();
  }

  resetAutoAntialias() {
    Object.assign(this.autoAntialias, { warm: AUTO_AA.warmup, time: 0, frames: 0 });
  }

  // Measures the frame rate during a shift; if it is low, tries antialiasing
  // off and keeps that only if it helps (turning it off doesn't recompile any
  // shaders, unlike switching to Graphics: Low mid-shift).
  updateAutoAntialias(rawDt) {
    const auto = this.autoAntialias;
    if (!auto.enabled || this.quality !== 'high' || document.hidden) return;
    if (rawDt > 0.5) {
      this.resetAutoAntialias(); // a stall or a hidden tab, not the steady frame rate
      return;
    }
    if (auto.warm > 0) {
      auto.warm -= rawDt;
      return;
    }
    auto.time += rawDt;
    auto.frames += 1;
    if (auto.time < AUTO_AA.window) return;
    const fps = auto.frames / auto.time;
    auto.time = auto.frames = 0;
    if (!auto.trial) {
      if (fps >= AUTO_AA.minFps || auto.tried.has(this.levelIndex)) return;
      Object.assign(auto, { trial: true, before: fps, warm: 1 });
      this.post.setAntialias(false);
      return;
    }
    auto.trial = false;
    auto.tried.add(this.levelIndex);
    if (fps >= auto.before * AUTO_AA.gain) {
      auto.enabled = false; // keep it off for the rest of the session
      say(`Edge smoothing turned off for a smoother frame rate (${Math.round(auto.before)} → ${Math.round(fps)} fps). Pause → Graphics for more.`);
    } else {
      this.post.setAntialias(true);
    }
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
    this.minimap.invalidate();
    sharedUniforms.uPointScale.value = (height * this.renderer.getPixelRatio()) / 2;
  }

  // ------------------------------------------------------------------ loop

  frame(timestamp) {
    this.timer.update(timestamp);
    const rawDt = this.timer.getDelta();
    const dt = Math.min(rawDt, 0.1);
    const time = this.timer.getElapsed();
    const paused = this.state.is(STATES.PAUSED);
    const playing = this.state.is(STATES.PLAYING);
    if (this.state.is(STATES.MENU) && this.screens.current === 'menu') this.updateSlideshow(time);

    if (!paused) {
      sharedUniforms.uTime.value = time;
      // Shift progress drives Level 1's time of day (world/Lighting.js).
      const progress = this.gameplay ? Math.min(1, this.gameplay.elapsed / this.gameplay.level.duration) : 0;
      this.world?.update(dt, time, progress);
      this.effects.update(dt, this.gameplay?.stations ?? []);
    }

    if (!paused) {
      this.physics.update(dt);
      this.chef?.update(dt, this.chefGoal());
    }

    if (playing && this.gameplay) {
      this.updateAutoAntialias(rawDt);
      this.gameplay.update(dt);
      this.controller.update(dt, time);
      this.player.update(dt, time);
      // Cooking noise per kind of cooker in use (grill sizzle, fryer oil,
      // boiling pot) and for drinks being poured.
      const cooking = {};
      for (const station of this.gameplay.stations) {
        const kind = station.pouring ? 'pour' : station.item && station.accepts ? station.type : null;
        if (kind) cooking[kind] = (cooking[kind] ?? 0) + 1;
      }
      this.audio.setCooking(cooking);
      if (this.gameplay) this.hud.update(this.gameplay, this.controller, this.camera);
    }

    const selected = this.controller.selected;
    if (selected) this.cameraController.setFocus(selected.focus.getWorldPosition(this.focusPoint), selected.kind);
    this.cameraController.update(dt, time);
    this.audio.updateListener(this.camera);

    this.post.setHeatSources(this.effects.heatSources());
    this.post.render(dt);
    if (this.gameplay && !this.hud.root.classList.contains('hidden')) {
      this.minimap.render([...(this.world?.cutaway ?? []), this.player.hand], dt);
    }
  }

  // Where the chef should be working: the dragged item, else the selection.
  chefGoal() {
    if (!this.controller.enabled) return null;
    if (this.controller.drag) return this.player.dragRoot.position;
    return this.controller.selected?.focus.getWorldPosition(this.chefTarget) ?? null;
  }
}
