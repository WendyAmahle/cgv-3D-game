import { PROLOGUE } from '../levels/Story.js';

const $ = (selector) => document.querySelector(selector);

// The prologue pages, shown right after loading and before the main menu.
export class StoryScreen {
  constructor() {
    this.page = 0;
    this.pages = PROLOGUE;
  }

  get isLastPage() {
    return this.page === this.pages.length - 1;
  }

  // Returns false once there are no more pages in that direction.
  go(step) {
    const next = this.page + step;
    if (next < 0 || next >= this.pages.length) return false;
    this.render(next);
    return true;
  }

  open(pages = PROLOGUE) {
    this.pages = pages;
    this.render(0);
  }

  render(page = 0) {
    this.page = page;
    const { eyebrow, title, text, visual = '🍳' } = this.pages[page];
    $('#storyTitle').textContent = title;
    $('#storyEyebrow').textContent = eyebrow + ' - ' + (page + 1) + '/' + this.pages.length;
    $('#storyVisual').textContent = visual;
    $('#storyText').replaceChildren(
      ...text.map((line, index) => {
        const paragraph = document.createElement('p');
        paragraph.textContent = line;
        paragraph.style.animationDelay = `${0.15 + index * 0.35}s`;
        return paragraph;
      })
    );
    $('#storyDots').replaceChildren(
      ...this.pages.map((_, index) => {
        const dot = document.createElement('span');
        if (index === page) dot.className = 'active';
        return dot;
      })
    );
    // On the first page, Back leaves the story instead of turning a page.
    $('#storyPrev').textContent = page === 0 ? 'Back to menu' : 'Back';
    $('#storyNext').textContent = this.isLastPage ? 'Continue' : 'Next';
    $('#storyNext').focus({ preventScroll: true });
    // Re-trigger the card's entrance animation on every page turn.
    const card = $('#screen-story .card');
    card.style.animation = 'none';
    void card.offsetWidth;
    card.style.animation = '';
  }
}
