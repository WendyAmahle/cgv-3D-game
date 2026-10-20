const UPGRADE_KEY = 'bistro-rush-kitchen-upgrades-v1';

export const UPGRADE_DEFINITIONS = [
  { id: 'cookers', icon: 'FIRE', name: 'Faster Burners', description: 'Cookers work 12% faster per rank.', max: 2, costs: [1, 2] },
  { id: 'dispensers', icon: 'POUR', name: 'Quick-Pour Nozzles', description: 'Drinks and broth pour 15% faster per rank.', max: 2, costs: [1, 2] },
  { id: 'patience', icon: 'HEART', name: 'Comfortable Seating', description: 'Customers wait 12% longer per rank.', max: 2, costs: [1, 2] },
  { id: 'tips', icon: 'TIP', name: 'Golden Service', description: 'Tips increase by 10% per rank.', max: 2, costs: [1, 2] },
];

const $ = (selector) => document.querySelector(selector);

// Stars are the upgrade currency. They are earned by improving a level's best
// rating, so replaying a shift rewards better play without touching campaign cash.
export class KitchenUpgrades {
  constructor() {
    try {
      this.levels = JSON.parse(localStorage.getItem(UPGRADE_KEY)) ?? {};
    } catch {
      this.levels = {};
    }
  }

  level(id) {
    return Math.min(UPGRADE_DEFINITIONS.find((upgrade) => upgrade.id === id)?.max ?? 0, this.levels[id] ?? 0);
  }

  get spent() {
    return UPGRADE_DEFINITIONS.reduce((total, upgrade) => total + upgrade.costs.slice(0, this.level(upgrade.id)).reduce((sum, cost) => sum + cost, 0), 0);
  }

  available(stars) {
    return Math.max(0, stars - this.spent);
  }

  get effects() {
    return {
      cookSpeed: 1 + this.level('cookers') * 0.12,
      pourSpeed: 1 + this.level('dispensers') * 0.15,
      patience: 1 + this.level('patience') * 0.12,
      tipMultiplier: 1 + this.level('tips') * 0.1,
    };
  }

  buy(id, stars) {
    const upgrade = UPGRADE_DEFINITIONS.find((entry) => entry.id === id);
    if (!upgrade) return { ok: false, message: 'That upgrade does not exist.' };
    const rank = this.level(id);
    if (rank >= upgrade.max) return { ok: false, message: `${upgrade.name} is fully upgraded.` };
    const cost = upgrade.costs[rank];
    if (this.available(stars) < cost) return { ok: false, message: `You need ${cost} star${cost === 1 ? '' : 's'} for ${upgrade.name}.` };
    this.levels[id] = rank + 1;
    try {
      localStorage.setItem(UPGRADE_KEY, JSON.stringify(this.levels));
    } catch {
      // The upgrade works for this session if browser storage is unavailable.
    }
    return { ok: true, message: `${upgrade.name} upgraded to rank ${rank + 1}.` };
  }
}

export class UpgradeShop {
  render(upgrades, stars, message = '') {
    const available = upgrades.available(stars);
    $('#upgradeStars').textContent = `${available} star${available === 1 ? '' : 's'} available`;
    $('#upgradeStatus').textContent = message || 'Earn stars by improving your best rating in each shift.';
    $('#upgradeList').replaceChildren(
      ...UPGRADE_DEFINITIONS.map((upgrade) => {
        const rank = upgrades.level(upgrade.id);
        const cost = upgrade.costs[rank];
        const full = rank >= upgrade.max;
        const card = document.createElement('article');
        card.className = 'upgrade-card';
        const heading = document.createElement('div');
        heading.className = 'upgrade-heading';
        const icon = document.createElement('span');
        icon.className = 'upgrade-icon';
        icon.textContent = upgrade.icon;
        const name = document.createElement('div');
        const title = document.createElement('strong');
        title.textContent = upgrade.name;
        const rankText = document.createElement('span');
        rankText.textContent = `Rank ${rank}/${upgrade.max}`;
        name.append(title, rankText);
        heading.append(icon, name);
        const description = document.createElement('p');
        description.textContent = upgrade.description;
        const footer = document.createElement('div');
        footer.className = 'upgrade-footer';
        const price = document.createElement('span');
        price.textContent = full ? 'MAXED' : `${cost} star${cost === 1 ? '' : 's'}`;
        const button = document.createElement('button');
        button.dataset.action = 'buy-upgrade';
        button.dataset.upgrade = upgrade.id;
        button.textContent = full ? 'Installed' : 'Upgrade';
        button.disabled = full || available < cost;
        footer.append(price, button);
        card.append(heading, description, footer);
        return card;
      })
    );
  }
}
