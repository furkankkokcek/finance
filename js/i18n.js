// i18n — lightweight, dependency-free translation layer.
//
// Locale dictionaries live in locales/<lang>.js and assign onto window.I18N.
// Supported languages: tr (source), en, de, es, fr. Turkish is the fallback
// for any missing key so the app never shows a raw key.

window.I18N = window.I18N || {};

const I18N_LANGS = ['tr', 'en', 'de', 'es', 'fr'];
const I18N_LOCALE_CODES = { tr: 'tr-TR', en: 'en-US', de: 'de-DE', es: 'es-ES', fr: 'fr-FR' };

function detectLang() {
  const stored = (typeof S !== 'undefined' && S.settings && S.settings.language) || null;
  if (stored && I18N_LANGS.includes(stored)) return stored;
  // Default to Turkish until the user explicitly picks a language.
  return 'tr';
}

function getLang() { return detectLang(); }

function i18nLocaleCode() { return I18N_LOCALE_CODES[getLang()] || 'tr-TR'; }

// t('some.key', {name:'x'}) → translated string with {placeholders} filled.
function t(key, params) {
  const lang = getLang();
  const dict = window.I18N[lang] || {};
  let str = dict[key];
  if (str === undefined) str = (window.I18N.tr || {})[key];
  if (str === undefined) str = key;
  if (params) {
    str = str.replace(/\{(\w+)\}/g, (m, p) => (params[p] !== undefined ? params[p] : m));
  }
  return str;
}

function capitalize(s) { return s ? s.charAt(0).toLocaleUpperCase(i18nLocaleCode()) + s.slice(1) : s; }

// Localized month names via Intl (avoids translating 12 names × 5 languages).
function buildMonthNames(style) {
  const fmt = new Intl.DateTimeFormat(i18nLocaleCode(), { month: style });
  const out = [];
  for (let m = 0; m < 12; m++) out.push(capitalize(fmt.format(new Date(2021, m, 1))));
  return out;
}

// Weekday short names, Monday-first (calendar grid order).
function buildWeekdayShort() {
  const fmt = new Intl.DateTimeFormat(i18nLocaleCode(), { weekday: 'short' });
  const out = [];
  // 2021-03-01 is a Monday.
  for (let d = 1; d <= 7; d++) out.push(capitalize(fmt.format(new Date(2021, 2, d))));
  return out;
}

// Rebuilds locale-derived globals (month arrays, category label maps) in place
// and re-applies DOM translations. Called at boot and on language change.
function applyLocale() {
  // Month arrays are `const` but their contents are mutable — repopulate in place
  // so every existing MONTHS[i] / MONTHS.map(...) call site stays valid.
  if (typeof MONTHS !== 'undefined') MONTHS.splice(0, MONTHS.length, ...buildMonthNames('short'));
  if (typeof MONTHS_FULL !== 'undefined') MONTHS_FULL.splice(0, MONTHS_FULL.length, ...buildMonthNames('long'));

  if (typeof CAT_LABELS !== 'undefined') {
    CAT_LABELS.sabit = t('cat.sabit'); CAT_LABELS.kredi = t('cat.kredi');
    CAT_LABELS.kk = t('cat.kk'); CAT_LABELS.abonelik = t('cat.abonelik');
  }
  if (typeof SPD_CATS !== 'undefined') {
    ['market', 'restoran', 'ulasim', 'giyim', 'eglence', 'saglik', 'egitim', 'diger']
      .forEach(k => { SPD_CATS[k] = t('spd.' + k); });
  }
  if (typeof INV_TYPES !== 'undefined') {
    ['hisse', 'fon', 'altin', 'btc', 'kripto', 'diger'].forEach(k => { INV_TYPES[k] = t('invtype.' + k); });
  }
  if (typeof ALTIN_SUBTYPES !== 'undefined') {
    ALTIN_SUBTYPES.gram = t('gold.gram'); ALTIN_SUBTYPES.ayar22 = t('gold.ayar22'); ALTIN_SUBTYPES.ceyrek = t('gold.ceyrek');
  }

  document.documentElement.lang = getLang();
  applyTranslations(document);
  // Keep any on-screen language picker (setup + settings) in sync.
  document.querySelectorAll('.js-lang-select').forEach(sel => { sel.value = getLang(); });
}

// Walks the DOM applying translations to data-i18n* attributes.
function applyTranslations(root) {
  (root || document).querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.getAttribute('data-i18n')); });
  (root || document).querySelectorAll('[data-i18n-html]').forEach(el => { el.innerHTML = t(el.getAttribute('data-i18n-html')); });
  (root || document).querySelectorAll('[data-i18n-ph]').forEach(el => { el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph'))); });
  (root || document).querySelectorAll('[data-i18n-title]').forEach(el => { el.setAttribute('title', t(el.getAttribute('data-i18n-title'))); });
}

function setLanguage(lang) {
  if (!I18N_LANGS.includes(lang)) return;
  if (typeof S !== 'undefined') { S.settings.language = lang; if (typeof saveS === 'function') saveS(); }
  applyLocale();
  // Re-render whatever is on screen so dynamic strings refresh.
  if (typeof currentPage !== 'undefined' && typeof renderPage === 'function' && currentPage) renderPage(currentPage);
  if (typeof updatePpfInfoTexts === 'function') updatePpfInfoTexts();
  // Refresh IDB notification schedule so background (SW) notifications use the new language.
  if (typeof syncNotifSchedule === 'function') syncNotifSchedule();
}

function changeLanguage(el) { setLanguage(el.value); }
