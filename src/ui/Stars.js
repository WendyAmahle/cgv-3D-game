const STARS_KEY = 'bistro-rush-stars';

// Cooking Fever-style 1–3 star rating for a cleared shift.
// ★ = hit the target, ★★ = beat it by 25%, ★★★ = beat it by 50% with at most one walkout.
export const STAR_RULES = {
  two: 1.25,
  three: 1.5,
  threeMaxMisses: 1,
};

export function starTargets(level) {
  return {
    one: level.targetMoney,
    two: Math.ceil(level.targetMoney * STAR_RULES.two),
    three: Math.ceil(level.targetMoney * STAR_RULES.three),
  };
}

export function rateShift(level, stats) {
  const targets = starTargets(level);
  if (stats.money < targets.one) return 0;
  if (stats.money >= targets.three && stats.missed <= STAR_RULES.threeMaxMisses) return 3;
  if (stats.money >= targets.two) return 2;
  return 1;
}

// What the player still needs for the next star (null at 3 stars).
export function nextStarHint(level, stats, stars) {
  const targets = starTargets(level);
  if (stars >= 3) return null;
  if (stars === 2) {
    const walkouts = `${STAR_RULES.threeMaxMisses} or fewer walkouts`;
    if (stats.money >= targets.three) return `Keep it to ${walkouts} for ★★★`;
    const withWalkouts = stats.missed > STAR_RULES.threeMaxMisses ? ` with ${walkouts}` : '';
    return `Earn $${targets.three}${withWalkouts} for ★★★`;
  }
  return `Earn $${targets.two} for ★★`;
}

export const starString = (count) => '★'.repeat(count) + '☆'.repeat(3 - count);

// Best star rating per level id, saved in this browser.
export class StarRecord {
  constructor() {
    try {
      this.best = JSON.parse(localStorage.getItem(STARS_KEY)) ?? {};
    } catch {
      this.best = {};
    }
  }

  get(levelId) {
    return this.best[levelId] ?? 0;
  }

  get total() {
    return Object.values(this.best).reduce((sum, stars) => sum + stars, 0);
  }

  // Returns true if this is a new best for the level.
  record(levelId, stars) {
    if (stars <= this.get(levelId)) return false;
    this.best[levelId] = stars;
    try {
      localStorage.setItem(STARS_KEY, JSON.stringify(this.best));
    } catch {
      // Ratings just won't persist.
    }
    return true;
  }
}
