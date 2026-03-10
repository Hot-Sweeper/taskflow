// TaskFlow — Lightweight i18n module (no dependencies)
const I18n = {
  lang: 'en',
  translations: {},
  fallback: {},

  async init() {
    this.lang = localStorage.getItem('taskflow_lang')
      || navigator.language.split('-')[0]
      || 'en';

    const [fallback, translations] = await Promise.all([
      fetch('/shared/i18n/en.json').then(r => r.json()),
      this.lang !== 'en'
        ? fetch(`/shared/i18n/${this.lang}.json`).then(r => r.ok ? r.json() : {}).catch(() => ({}))
        : Promise.resolve({})
    ]);

    this.fallback = fallback;
    this.translations = translations;
    this.translateDOM();
  },

  t(key, vars = {}) {
    let text = this.translations[key] || this.fallback[key] || key;
    for (const [k, v] of Object.entries(vars)) {
      text = text.replace(`{${k}}`, v);
    }
    return text;
  },

  translateDOM() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = this.t(el.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      el.placeholder = this.t(el.dataset.i18nPlaceholder);
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      el.title = this.t(el.dataset.i18nTitle);
    });
  },

  async setLang(code) {
    localStorage.setItem('taskflow_lang', code);
    this.lang = code;
    if (code !== 'en') {
      const res = await fetch(`/shared/i18n/${code}.json`);
      this.translations = res.ok ? await res.json() : {};
    } else {
      this.translations = {};
    }
    this.translateDOM();
  }
};

if (typeof window !== 'undefined') {
  window.I18n = I18n;
}
