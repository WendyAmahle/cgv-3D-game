// Best cleared earnings from each chapter form the story's buy-back fund.
// $360 equals the three required shift targets: $70 + $120 + $170.
const FUND_KEY = 'bistro-rush-buyback-fund-v1';
export const BUYBACK_COST = 360;

export class CampaignFund {
  constructor() {
    try {
      this.best = JSON.parse(localStorage.getItem(FUND_KEY)) ?? {};
    } catch {
      this.best = {};
    }
  }

  get total() {
    return Object.values(this.best).reduce((sum, earnings) => sum + earnings, 0);
  }

  get goal() {
    return BUYBACK_COST;
  }

  get ratio() {
    return Math.min(1, this.total / BUYBACK_COST);
  }

  // Replaying a shift can improve the fund, but can never reduce it.
  record(levelId, earnings) {
    if (earnings <= (this.best[levelId] ?? 0)) return false;
    this.best[levelId] = earnings;
    try {
      localStorage.setItem(FUND_KEY, JSON.stringify(this.best));
    } catch {
      // The fund just will not persist in restricted browser storage.
    }
    return true;
  }
}
