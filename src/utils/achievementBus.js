export const achievementBus = {
  listeners: [],

  emit(event) {
    this.listeners.forEach(fn => fn(event));
  },

  subscribe(fn) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter(l => l !== fn);
    };
  },
};
