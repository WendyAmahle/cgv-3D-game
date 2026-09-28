import './style.css';
import { Game } from './core/Game.js';

const game = new Game();
game.init();

// Handy for debugging in the browser console during development (not in builds).
if (import.meta.env.DEV) window.game = game;
