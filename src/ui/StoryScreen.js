import { PROLOGUE } from '../levels/Story.js';
import { STORAGE_KEY } from '../utils/Constants.js';

const $ = (selector) => document.querySelector(selector);
const SEEN_KEY = `${STORAGE_KEY}:story-seen`;

// The prologue pages shown before the player first sees the levels.
// Remembers (per browser) that it has been watched so it plays only once.
export class StoryScreen {
  constructor() {
    this.page = 0;
    try {
      this.seen = localStorage.getItem(SEEN_KEY) === '1';
    } catch {
      this.seen = false;
    }
  }

  get isLastPage() {
    return this.page === PROLOGUE.length - 1;
  }

  markSeen() {
    this.seen = true;
    try {
      localStorage.setItem(SEEN_KEY, '1');
    } catch {
      // It'll just play again next visit.
    }
  }

  // Returns false once there are no more pages in that direction.
  go(step) {
    const next = this.page + step;
    if (next < 0 || next >= PROLOGUE.length) return false;
    this.render(next);
    return true;
  }

  render(page = 0) {
    this.page = page;
    const { eyebrow, title, text } = PROLOGUE[page];
    $('#storyEyebrow').textContent = `${eyebrow} · ${page + 1}/${PROLOGUE.length}`;
    $('#storyTitle').textContent = title;
    $('#storyText').replaceChildren(
      ...text.map((line, index) => {
        const paragraph = document.createElement('p');
        paragraph.textContent = line;
        paragraph.style.animationDelay = `${0.15 + index * 0.35}s`;
        return paragraph;
      })
    );
    $('#storyDots').replaceChildren(
      ...PROLOGUE.map((_, index) => {
        const dot = document.createElement('span');
        if (index === page) dot.className = 'active';
        return dot;
      })
    );
    $('#storyPrev').disabled = page === 0;
    $('#storyNext').textContent = this.isLastPage ? 'Let\'s cook!' : 'Next';
    $('#storyNext').focus({ preventScroll: true });
    // Re-trigger the card's entrance animation on every page turn.
    const card = $('#screen-story .card');
    card.style.animation = 'none';
    void card.offsetWidth;
    card.style.animation = '';
  }
}
