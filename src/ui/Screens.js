import { events } from '../core/Events.js';
import { RECIPES } from '../gameplay/Recipes.js';
import { CHAPTERS, EPILOGUE } from '../levels/Story.js';

const $ = (selector) => document.querySelector(selector);

const SCREENS = ['menu', 'story', 'levels', 'howto', 'intro', 'pause', 'complete', 'gameover', 'credits'];

function renderStats(container, stats) {
  const rows = [
    ['Earnings', `$${stats.money}`],
    ['Score', stats.score],
    ['Orders served', stats.served],
    ['Walkouts', stats.missed],
    ['Best combo', `×${stats.bestCombo}`],
  ];
  container.replaceChildren(
    ...rows.map(([label, value]) => {
      const row = document.createElement('div');
      row.innerHTML = '<span></span><strong></strong>';
      row.children[0].textContent = label;
      row.children[1].textContent = value;
      return row;
    })
  );
}

// Shows/hides the full-screen overlays. Any [data-action] button emits
// `ui:<action>` on the event bus; core/Game.js decides what happens.
export class Screens {
  constructor() {
    this.elements = Object.fromEntries(SCREENS.map((name) => [name, $(`#screen-${name}`)]));
    this.current = null;
    this.returnTo = 'menu';

    document.addEventListener('click', (event) => {
      const button = event.target.closest('[data-action]');
      if (!button || button.disabled) return;
      events.emit('ui:click');
      events.emit(`ui:${button.dataset.action}`, { ...button.dataset });
    });
  }

  show(name, { returnTo } = {}) {
    for (const [key, element] of Object.entries(this.elements)) {
      element.classList.toggle('hidden', key !== name);
    }
    this.current = name;
    if (returnTo) this.returnTo = returnTo;
    this.elements[name]?.querySelector('button.primary, button')?.focus({ preventScroll: true });
  }

  hideAll() {
    Object.values(this.elements).forEach((element) => element.classList.add('hidden'));
    this.current = null;
    document.activeElement?.blur?.();
  }

  showLoading(text, progress) {
    $('#loading').classList.remove('hidden');
    $('#loadingText').textContent = text;
    $('#loadingFill').style.width = `${Math.round(progress * 100)}%`;
  }

  hideLoading() {
    $('#loading').classList.add('hidden');
  }

  showIntro(level, index) {
    $('#introNumber').textContent = `Level ${index + 1}`;
    $('#introName').textContent = level.name;
    $('#introTagline').textContent = level.tagline;
    $('#introChapter').textContent = `${CHAPTERS[level.id].chapter} · ${CHAPTERS[level.id].title}`;
    $('#introStory').textContent = CHAPTERS[level.id].text;
    $('#introMechanic').textContent = level.mechanic;
    $('#introGoal').textContent = `Earn $${level.targetMoney} in ${Math.round(level.duration / 60 * 10) / 10} minutes. Lose if ${level.maxMisses} customers walk out.`;
    const unique = [...new Set(level.recipes)];
    $('#introRecipes').replaceChildren(
      ...unique.map((id) => {
        const chip = document.createElement('span');
        chip.className = 'chip large';
        chip.textContent = `${RECIPES[id].name} · $${RECIPES[id].price}`;
        return chip;
      })
    );
    this.show('intro');
  }

  showComplete(level, stats, isLast) {
    $('#completeTitle').textContent = isLast ? 'You conquered every kitchen!' : `${level.name} cleared!`;
    // The last level's outro leads straight into the epilogue.
    const lines = isLast ? [CHAPTERS[level.id].outro, ...EPILOGUE] : [CHAPTERS[level.id].outro];
    $('#completeStory').replaceChildren(
      ...lines.map((line) => {
        const paragraph = document.createElement('p');
        paragraph.textContent = line;
        return paragraph;
      })
    );
    renderStats($('#completeStats'), stats);
    const next = $('#nextButton');
    next.textContent = isLast ? 'Credits' : 'Next level';
    next.dataset.action = isLast ? 'credits' : 'next';
    this.show('complete', { returnTo: 'menu' });
  }

  showGameOver(stats, reason) {
    $('#gameoverReason').textContent = reason;
    renderStats($('#gameoverStats'), stats);
    this.show('gameover');
  }
}
