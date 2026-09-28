// Tiny event bus so systems can react to gameplay without importing each other.
//
// Events currently emitted:
//   message            { text }                       HUD toast
//   item:pickup        { item }
//   item:place         { item }
//   item:trash         { item }
//   cook:start|done|burnt  { station, item }
//   pour:start|done    { station }
//   order:new          { customer }                   customer reached the counter
//   order:served       { customer, reward, tip, combo, position }
//   order:wrong        { customer }
//   order:missed       { customer }                   customer walked out
//   overclock:start|end { station }                   Level 3 power surge
//   rush:start         {}                             Level 2 rush hour
//   level:start        { level }
//   level:complete     { stats }
//   level:failed       { stats, reason }
//   state:change       { state, previous }
//   camera:mode        { mode, name }
//   ui:<action>        { ...button dataset }          any [data-action] button
export class EventBus {
  constructor() {
    this.handlers = new Map();
  }

  on(name, handler) {
    if (!this.handlers.has(name)) this.handlers.set(name, new Set());
    this.handlers.get(name).add(handler);
    return () => this.handlers.get(name).delete(handler);
  }

  emit(name, payload = {}) {
    this.handlers.get(name)?.forEach((handler) => handler(payload));
  }
}

export const events = new EventBus();

export const say = (text) => events.emit('message', { text });
