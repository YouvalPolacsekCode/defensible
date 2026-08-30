// Shim window.storage (Chrome extension API) with localStorage
const STORAGE_KEY = 'defensible-storage';

window.storage = {
  async get(key) {
    try {
      const raw = localStorage.getItem(key || STORAGE_KEY);
      return raw ? { value: raw } : {};
    } catch {
      return {};
    }
  },
  async set(key, value) {
    try {
      localStorage.setItem(key || STORAGE_KEY, value);
    } catch (e) {
      console.error('storage.set failed:', e);
    }
  },
};