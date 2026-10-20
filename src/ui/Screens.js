import { events } from '../core/Events.js';
import { RECIPES } from '../gameplay/Recipes.js';
import { STAR_RULES, nextStarHint, starString, starTargets } from './Stars.js';

const $ = (selector) => document.querySelector(selector);

const SCREENS = ['start', 'menu', 'story', 'levels', 'shop', 'trophies', 'howto', 'intro', 'pause', 'complete', 'purchase', 'gameover', 'credits'];

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

  showIntro(level, index, bestStars = 0) {
    $('#introNumber').textContent = `Level ${index + 1}`;
    $('#introName').textContent = level.name;
    $('#introTagline').textContent = level.tagline;
    $('#introChapter').textContent = `${level.story.chapter} · ${level.story.title}`;
    $('#introStory').textContent = level.story.text;
    $('#introMechanic').textContent = level.mechanic;
    $('#introGoal').textContent = `Earn $${level.targetMoney} in ${Math.round(level.duration / 60 * 10) / 10} minutes. Lose if ${level.maxMisses} customers walk out.`;
    const targets = starTargets(level);
    $('#introBest').textContent = bestStars ? `· your best ${starString(bestStars)}` : '';
    $('#introStars').textContent = `★ $${targets.one} · ★★ $${targets.two} · ★★★ $${targets.three} with ${STAR_RULES.threeMaxMisses} walkout or fewer`;
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

  showComplete(level, stats, isLast, stars, newBest, fund = null) {
    $('#completeTitle').textContent = isLast ? 'You conquered every kitchen!' : `${level.name} cleared!`;
    const lines = isLast
      ? [level.story.outro, `Your buy-back fund is $${fund?.total ?? 0} of $${fund?.goal ?? 360}. The Golden Ladle is waiting.`]
      : [level.story.outro];
    $('#completeStory').replaceChildren(
      ...lines.map((line) => {
        const paragraph = document.createElement('p');
        paragraph.textContent = line;
        return paragraph;
      })
    );
    // Stars pop in one after another.
    $('#completeStars').replaceChildren(
      ...[0, 1, 2].map((index) => {
        const star = document.createElement('span');
        star.className = index < stars ? 'star earned' : 'star';
        star.textContent = '★';
        star.style.animationDelay = `${0.3 + index * 0.35}s`;
        return star;
      })
    );
    const hint = nextStarHint(level, stats, stars);
    $('#completeStarNote').textContent = [newBest ? 'New best!' : '', hint ?? 'Perfect shift!'].filter(Boolean).join(' · ');
    renderStats($('#completeStats'), stats);
    const next = $('#nextButton');
    if (!isLast) {
      next.textContent = 'Next level';
      next.dataset.action = 'next';
    } else if (fund?.purchased) {
      next.textContent = 'Visit The Golden Ladle';
      next.dataset.action = 'finale';
    } else if (fund?.canBuy) {
      next.textContent = 'Buy back The Golden Ladle';
      next.dataset.action = 'purchase';
    } else {
      next.textContent = 'Build the buy-back fund';
      next.dataset.action = 'menu';
    }
    this.show('complete', { returnTo: 'menu' });
  }

  showPurchase(fund) {
    $('#purchaseRaised').textContent = '$' + fund.total;
    $('#purchaseCost').textContent = '$' + fund.goal;
    $('#purchaseRemaining').textContent = '$' + Math.max(0, fund.total - fund.goal);
    this.show('purchase', { returnTo: 'menu' });
  }

  showGameOver(stats, reason) {
    $('#gameoverReason').textContent = reason;
    renderStats($('#gameoverStats'), stats);
    this.show('gameover');
  }
}
