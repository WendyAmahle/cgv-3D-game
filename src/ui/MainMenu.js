import { starString } from './Stars.js';

const $ = (selector) => document.querySelector(selector);

// Main-menu specifics: the Play button label and the level-select cards.
export class MainMenu {
  setPlayLabel(level, index) {
    $('#playButton').textContent = index === 0 ? 'Play' : `Continue: ${level.name}`;
  }

  renderLevelCards(levels, isUnlocked, bestStars) {
    $('#levelCards').replaceChildren(
      ...levels.map((level, index) => {
        const unlocked = isUnlocked(index);
        const card = document.createElement('button');
        card.className = `level-card theme-${level.theme}`;
        card.disabled = !unlocked;
        card.dataset.action = 'select-level';
        card.dataset.level = String(index);
        card.innerHTML = '<span class="eyebrow"></span><strong></strong><span class="desc"></span><span class="card-stars"></span>';
        card.children[0].textContent = unlocked ? `Level ${index + 1}` : `Level ${index + 1} · locked`;
        card.children[1].textContent = level.name;
        card.children[2].textContent = unlocked ? level.tagline : 'Clear the previous level to unlock.';
        const stars = bestStars(level);
        card.children[3].textContent = starString(stars);
        card.children[3].classList.toggle('none', stars === 0);
        return card;
      })
    );
  }

  renderFund(fund) {
    $('#buybackAmount').textContent = '$' + fund.total + ' / $' + fund.goal;
    $('#buybackFill').style.width = (fund.ratio * 100) + '%';
    $('#buybackFund').classList.toggle('ready', fund.ratio >= 1);
  }
}
