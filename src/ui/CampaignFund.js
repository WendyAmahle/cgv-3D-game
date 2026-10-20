// Best cleared earnings from each chapter form the story's buy-back fund.
// $360 equals the three required shift targets: $70 + $120 + $170.
const FUND_KEY = 'bistro-rush-buyback-fund-v1';
const PURCHASE_KEY = 'bistro-rush-golden-ladle-purchased-v1';
export const BUYBACK_COST = 360;

export class CampaignFund {
  constructor() {
    try {
      this.best = JSON.parse(localStorage.getItem(FUND_KEY)) ?? {};
    } catch {
      this.best = {};
    }
    try {
      this.purchased = localStorage.getItem(PURCHASE_KEY) === '1';
    } catch {
      this.purchased = false;
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

  get canBuy() {
    return this.total >= BUYBACK_COST && !this.purchased;
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

  // The fund is intentionally retained after purchase so the player can see
  // what the three saved kitchens earned. The purchase itself is persisted.
  purchase() {
    if (this.purchased) return true;
    if (!this.canBuy) return false;
    this.purchased = true;
    try {
      localStorage.setItem(PURCHASE_KEY, '1');
    } catch {
      // The ending still plays in this session if browser storage is blocked.
    }
    return true;
  }
}
