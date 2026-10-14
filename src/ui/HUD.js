import * as THREE from 'three';
import { RECIPES, tagColor, tagLabel } from '../gameplay/Recipes.js';
import { itemLabel } from '../gameplay/Items.js';
import { events } from '../core/Events.js';

const $ = (selector) => document.querySelector(selector);

function setText(element, value) {
  const text = String(value);
  if (element.textContent !== text) element.textContent = text;
}

const formatTime = (seconds) => {
  const whole = Math.ceil(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
};

// In-game dashboard: stats, order tickets, held item, tooltip, toasts, banners.
export class HUD {
  constructor() {
    this.root = $('#hud');
    this.el = {
      levelNumber: $('#hudLevelNumber'),
      levelName: $('#hudLevelName'),
      time: $('#hudTime'),
      money: $('#hudMoney'),
      target: $('#hudTarget'),
      targetFill: $('#hudTargetFill'),
      score: $('#hudScore'),
      combo: $('#hudCombo'),
      lives: $('#hudLives'),
      held: $('#heldText'),
      camera: $('#cameraText'),
      tickets: $('#tickets'),
      toast: $('#toast'),
      tooltip: $('#tooltip'),
      tooltipTitle: $('#tooltipTitle'),
      tooltipStatus: $('#tooltipStatus'),
      banner: $('#banner'),
    };
    this.tickets = new Map(); // customer id -> { element, fill, seconds }
    this.projected = new THREE.Vector3();
    this.popupPoint = new THREE.Vector3();
    this.toastTimer = null;
    this.bannerTimer = null;
  }

  show() {
    this.root.classList.remove('hidden');
  }

  hide() {
    this.root.classList.add('hidden');
  }

  setLevel(level, index) {
    setText(this.el.levelNumber, `Level ${index + 1}`);
    setText(this.el.levelName, level.name);
    setText(this.el.target, `· target $${level.targetMoney}`);
    this.clearTickets();
    this.root.querySelectorAll('.money-pop, .coin').forEach((element) => element.remove());
  }

  setCamera(name) {
    setText(this.el.camera, name);
  }

  update(gameplay, controller, camera) {
    const { stats, level } = gameplay;
    setText(this.el.time, formatTime(stats.timeLeft));
    this.el.time.classList.toggle('warning', stats.timeLeft < 20);
    setText(this.el.money, `$${stats.money}`);
    this.el.targetFill.style.width = `${Math.min(100, (stats.money / level.targetMoney) * 100)}%`;
    this.el.targetFill.classList.toggle('done', stats.money >= level.targetMoney);
    setText(this.el.score, stats.score);
    setText(this.el.combo, stats.combo > 1 ? `Combo ×${stats.combo}` : '');
    setText(this.el.lives, Math.max(0, level.maxMisses - stats.missed));
    setText(this.el.held, gameplay.player.held ? itemLabel(gameplay.player.held) : 'Nothing');

    this.updateTickets(gameplay.customers.waiting);
    this.updateTooltip(controller.selected, camera);
  }

  updateTickets(customers) {
    const ids = new Set(customers.map((customer) => customer.id));
    for (const [id, ticket] of this.tickets) {
      if (!ids.has(id)) {
        ticket.element.remove();
        this.tickets.delete(id);
      }
    }

    for (const customer of customers) {
      let ticket = this.tickets.get(customer.id);
      if (!ticket) {
        const recipe = RECIPES[customer.recipeId];
        const element = document.createElement('div');
        element.className = 'ticket';
        element.innerHTML = `
          <div class="ticket-head"><strong></strong><span class="seconds"></span><span class="price"></span></div>
          <div class="chips"></div>
          <div class="meter"><div class="meter-fill"></div></div>`;
        element.querySelector('strong').textContent = recipe.name;
        element.querySelector('.price').textContent = `$${recipe.price}`;
        const chips = element.querySelector('.chips');
        for (const tag of recipe.ingredients) {
          const chip = document.createElement('span');
          chip.className = 'chip';
          chip.textContent = tagLabel(tag);
          const swatch = tagColor(tag);
          if (swatch !== null) chip.style.boxShadow = `inset 6px 0 0 #${swatch.toString(16).padStart(6, '0')}`;
          chips.append(chip);
        }
        this.el.tickets.append(element);
        ticket = { element, fill: element.querySelector('.meter-fill'), seconds: element.querySelector('.seconds') };
        this.tickets.set(customer.id, ticket);
      }
      const ratio = Math.max(0, customer.patience / customer.maxPatience);
      ticket.fill.style.width = `${ratio * 100}%`;
      ticket.fill.style.background = `hsl(${ratio * 120}, 80%, 50%)`;
      ticket.element.classList.toggle('urgent', ratio < 0.3);
      ticket.seconds.textContent = customer.patience < 10 ? `${Math.ceil(customer.patience)}s` : '';
    }
  }

  clearTickets() {
    this.tickets.forEach((ticket) => ticket.element.remove());
    this.tickets.clear();
  }

  updateTooltip(target, camera) {
    const tooltip = this.el.tooltip;
    if (!target) {
      tooltip.classList.add('hidden');
      return;
    }
    target.focus.getWorldPosition(this.projected);
    this.projected.y += target.kind === 'customer' ? 2.9 : 1.2;
    this.projected.project(camera);
    if (this.projected.z > 1) {
      tooltip.classList.add('hidden');
      return;
    }
    tooltip.classList.remove('hidden');
    tooltip.style.left = `${(this.projected.x * 0.5 + 0.5) * window.innerWidth}px`;
    tooltip.style.top = `${(-this.projected.y * 0.5 + 0.5) * window.innerHeight}px`;
    setText(this.el.tooltipTitle, target.title());
    setText(this.el.tooltipStatus, target.status());
  }

  // "+$12" floats up from the customer, and a coin flies into the earnings panel.
  moneyPopup(position, reward, tip, combo, camera) {
    const point = this.popupPoint.copy(position).project(camera);
    if (point.z > 1) return;
    const x = (point.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-point.y * 0.5 + 0.5) * window.innerHeight;

    const popup = document.createElement('div');
    popup.className = 'money-pop';
    popup.innerHTML = '<strong></strong><span></span>';
    popup.children[0].textContent = `+$${reward}`;
    const extras = [tip ? `$${tip} tip` : '', combo > 1 ? `combo ×${combo}` : ''].filter(Boolean);
    popup.children[1].textContent = extras.join(' · ');
    popup.style.left = `${x}px`;
    popup.style.top = `${y}px`;
    this.root.append(popup);
    popup.addEventListener('animationend', () => popup.remove());

    const coin = document.createElement('div');
    coin.className = 'coin';
    coin.textContent = '$';
    this.root.append(coin);
    const goal = this.el.money.getBoundingClientRect();
    const dx = goal.left + goal.width / 2 - x;
    const dy = goal.top + goal.height / 2 - y;
    const flight = coin.animate(
      [
        { transform: `translate(${x}px, ${y}px) translate(-50%, -50%) scale(0.6)`, opacity: 0 },
        { transform: `translate(${x}px, ${y - 40}px) translate(-50%, -50%) scale(1.2)`, opacity: 1, offset: 0.25 },
        { transform: `translate(${x + dx}px, ${y + dy}px) translate(-50%, -50%) scale(0.7)`, opacity: 1 },
      ],
      { duration: 850, delay: 150, easing: 'cubic-bezier(0.5, 0, 0.75, 0)', fill: 'backwards' }
    );
    flight.onfinish = () => {
      coin.remove();
      events.emit('hud:coin');
      this.el.money.classList.remove('bump');
      void this.el.money.offsetWidth; // restart the bump animation
      this.el.money.classList.add('bump');
    };
  }

  toast(text) {
    const toast = this.el.toast;
    toast.textContent = text;
    toast.classList.add('visible');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => toast.classList.remove('visible'), 2600);
  }

  banner(text, className = '') {
    const banner = this.el.banner;
    banner.textContent = text;
    banner.className = className;
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => banner.classList.add('hidden'), 2200);
  }
}
