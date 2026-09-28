const $ = (selector) => document.querySelector(selector);

// Main-menu specifics: the Play button label and the level-select cards.
export class MainMenu {
  setPlayLabel(level, index) {
    $('#playButton').textContent = index === 0 ? 'Play' : `Continue: ${level.name}`;
  }

  renderLevelCards(levels, isUnlocked) {
    $('#levelCards').replaceChildren(
      ...levels.map((level, index) => {
        const unlocked = isUnlocked(index);
        const card = document.createElement('button');
        card.className = `level-card theme-${level.theme}`;
        card.disabled = !unlocked;
        card.dataset.action = 'select-level';
        card.dataset.level = String(index);
        card.innerHTML = '<span class="eyebrow"></span><strong></strong><span class="desc"></span>';
        card.children[0].textContent = unlocked ? `Level ${index + 1}` : `Level ${index + 1} · locked`;
        card.children[1].textContent = level.name;
        card.children[2].textContent = unlocked ? level.tagline : 'Clear the previous level to unlock.';
        return card;
      })
    );
  }
}
