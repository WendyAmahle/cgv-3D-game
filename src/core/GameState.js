import { events } from './Events.js';

export const STATES = {
  MENU: 'menu',
  INTRO: 'intro',
  PLAYING: 'playing',
  PAUSED: 'paused',
  LEVEL_COMPLETE: 'levelComplete',
  GAME_OVER: 'gameOver',
};

export class GameState {
  constructor() {
    this.current = STATES.MENU;
  }

  set(next) {
    if (next === this.current) return;
    const previous = this.current;
    this.current = next;
    events.emit('state:change', { state: next, previous });
  }

  is(...states) {
    return states.includes(this.current);
  }
}
