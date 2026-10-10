import { events } from '../core/Events.js';
import { rateShift } from './Stars.js';

const $ = (selector) => document.querySelector(selector);
const SAVE_KEY = 'bistro-rush-trophies';

const TROPHIES = [
  { id: 'first-plate', icon: '🍔', name: 'First Plate', desc: 'Serve your first dish.' },
  { id: 'crowd-pleaser', icon: '🍽️', name: 'Crowd Pleaser', desc: 'Serve 50 dishes in total.' },
  { id: 'head-chef', icon: '🧑‍🍳', name: 'Head Chef', desc: 'Serve 200 dishes in total.' },
  { id: 'combo-5', icon: '🔥', name: 'On a Roll', desc: 'Reach a ×5 combo.' },
  { id: 'combo-10', icon: '⚡', name: 'Unstoppable', desc: 'Reach a ×10 combo.' },
  { id: 'lightning', icon: '⏱️', name: 'Lightning Service', desc: 'Serve a customer while their patience bar is still over 80%.' },
  { id: 'big-earner', icon: '💰', name: 'Big Earner', desc: 'Earn $1,000 across all shifts.' },
  { id: 'oops', icon: '💨', name: 'Well Done… Too Well', desc: 'Burn something for the first time.' },
  { id: 'clean-kitchen', icon: '✨', name: 'Clean Kitchen', desc: 'Clear a shift without burning anything.' },
  { id: 'no-walkouts', icon: '😊', name: 'Nobody Left Hungry', desc: 'Clear a shift with no walkouts.' },
  { id: 'three-stars', icon: '⭐', name: 'Star Chef', desc: 'Earn ★★★ on any shift.' },
  { id: 'chapter-1', icon: '🚚', name: 'A Truck Called Hope', desc: 'Save Sam\'s burger truck (clear Level 1).' },
  { id: 'chapter-2', icon: '🏮', name: 'Lanterns Lit', desc: 'Save Auntie Mei\'s noodle bar (clear Level 2).' },
  { id: 'chapter-3', icon: '🏆', name: 'The Golden Ladle', desc: 'Save the Neon Diner and win back The Golden Ladle (clear Level 3).' },
];

const CAREER_ROWS = [
  ['served', 'Dishes served', (value) => value],
  ['earned', 'Money earned', (value) => `$${value.toLocaleString()}`],
  ['tips', 'Tips collected', (value) => `$${value.toLocaleString()}`],
  ['shifts', 'Shifts cleared', (value) => value],
  ['bestCombo', 'Best combo', (value) => `×${value}`],
  ['burnt', 'Food burnt', (value) => value],
  ['walkouts', 'Walkouts', (value) => value],
];

const emptyCareer = () => Object.fromEntries(CAREER_ROWS.map(([key]) => [key, 0]));

// Trophies and lifetime ("career") stats, earned by listening to gameplay
// events, so no gameplay code has to know about them. Saved in this browser.
export class Achievements {
  constructor() {
    const saved = this.load();
    this.unlocked = saved.unlocked ?? {};
    this.career = { ...emptyCareer(), ...saved.career };
    this.level = null;
    this.shift = { burnt: 0 };
    this.queue = [];
    this.showing = false;
  }

  load() {
    try {
      return JSON.parse(localStorage.getItem(SAVE_KEY)) ?? {};
    } catch {
      return {};
    }
  }

  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ unlocked: this.unlocked, career: this.career }));
    } catch {
      // Trophies just won't persist.
    }
  }

  bindEvents() {
    events.on('level:start', ({ level }) => {
      this.level = level;
      this.shift = { burnt: 0 };
    });

    events.on('order:served', ({ reward, tip, combo }) => {
      const career = this.career;
      career.served += 1;
      career.earned += reward;
      career.tips += tip;
      career.bestCombo = Math.max(career.bestCombo, combo);
      this.unlock('first-plate');
      if (career.served >= 50) this.unlock('crowd-pleaser');
      if (career.served >= 200) this.unlock('head-chef');
      if (combo >= 5) this.unlock('combo-5');
      if (combo >= 10) this.unlock('combo-10');
      // The tip is half the price scaled by how much patience was left.
      if (tip > 0 && tip >= (reward - tip) * 0.5 * 0.8) this.unlock('lightning');
      if (career.earned >= 1000) this.unlock('big-earner');
      this.save();
    });

    events.on('cook:burnt', () => {
      this.career.burnt += 1;
      this.shift.burnt += 1;
      this.unlock('oops');
      this.save();
    });

    events.on('order:missed', () => {
      this.career.walkouts += 1;
      this.save();
    });

    events.on('level:complete', ({ stats }) => {
      this.career.shifts += 1;
      if (this.shift.burnt === 0) this.unlock('clean-kitchen');
      if (stats.missed === 0) this.unlock('no-walkouts');
      if (this.level) {
        if (rateShift(this.level, stats) === 3) this.unlock('three-stars');
        this.unlock(`chapter-${this.level.id}`);
      }
      this.save();
    });
  }

  unlock(id) {
    const trophy = TROPHIES.find((entry) => entry.id === id);
    if (!trophy || this.unlocked[id]) return;
    this.unlocked[id] = Date.now();
    this.save();
    this.queue.push(trophy);
    this.showNext();
  }

  // Pop-ups queue up so several trophies at once each get their moment.
  showNext() {
    if (this.showing || !this.queue.length) return;
    const trophy = this.queue.shift();
    this.showing = true;
    const popup = $('#trophyPopup');
    $('#trophyPopupIcon').textContent = trophy.icon;
    $('#trophyPopupName').textContent = trophy.name;
    popup.classList.remove('hidden', 'leaving');
    events.emit('achievement:unlocked', { trophy });
    setTimeout(() => popup.classList.add('leaving'), 2800);
    setTimeout(() => {
      popup.classList.add('hidden');
      this.showing = false;
      this.showNext();
    }, 3200);
  }

  get count() {
    return Object.keys(this.unlocked).length;
  }

  // Fills the Trophies screen.
  render(totalStars, maxStars) {
    $('#trophyCount').textContent = `${this.count} of ${TROPHIES.length} trophies · ${totalStars} of ${maxStars} stars`;
    $('#careerStats').replaceChildren(
      ...CAREER_ROWS.map(([key, label, format]) => {
        const row = document.createElement('div');
        row.innerHTML = '<span></span><strong></strong>';
        row.children[0].textContent = label;
        row.children[1].textContent = format(this.career[key]);
        return row;
      })
    );
    $('#trophyList').replaceChildren(
      ...TROPHIES.map((trophy) => {
        const earned = Boolean(this.unlocked[trophy.id]);
        const card = document.createElement('div');
        card.className = `trophy${earned ? ' earned' : ''}`;
        card.innerHTML = '<span class="trophy-icon"></span><div><strong></strong><span class="desc"></span></div>';
        card.querySelector('.trophy-icon').textContent = earned ? trophy.icon : '🔒';
        card.querySelector('strong').textContent = trophy.name;
        card.querySelector('.desc').textContent = trophy.desc;
        return card;
      })
    );
  }
}
