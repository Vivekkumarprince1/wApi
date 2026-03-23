/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GLOBAL LOADING STORE
 * Tracks active API requests to provide a unified loading state.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

class LoadingStore {
  constructor() {
    this.activeRequests = 0;
    this.listeners = new Set();
  }

  startRequest() {
    this.activeRequests++;
    this.notify();
  }

  endRequest() {
    this.activeRequests = Math.max(0, this.activeRequests - 1);
    this.notify();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    const isLoading = this.activeRequests > 0;
    this.listeners.forEach(listener => listener(isLoading));
  }

  isLoading() {
    return this.activeRequests > 0;
  }
}

export const loadingStore = new LoadingStore();
