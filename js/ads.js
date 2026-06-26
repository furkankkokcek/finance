// AdMob banner — native only (no-op on web/PWA).
//
// Uses @capacitor-community/admob. On the web there is no Capacitor native
// bridge, so every call short-circuits and the app behaves exactly as before.
//
// IMPORTANT: the IDs below are Google's official TEST ad units. They MUST be
// replaced with your real AdMob ad unit IDs before publishing — see
// PUBLISHING.md ("AdMob" section). Serving test ads is required during
// development; serving them in production (or clicking your own real ads) can
// get your AdMob account suspended.
const ADMOB_TEST_BANNER = {
  android: 'ca-app-pub-3940256099942544/6300978111',
  ios: 'ca-app-pub-3940256099942544/2934735716',
};

// Set to your real ad unit IDs when ready to publish. Leave null to keep using
// the Google test units above.
const ADMOB_PROD_BANNER = {
  android: null,
  ios: null,
};

// Rewarded ads — gate import/export/Drive backup behind a short rewarded video.
// Google test units; replace with real IDs before publishing.
const ADMOB_TEST_REWARDED = {
  android: 'ca-app-pub-3940256099942544/5224354917',
  ios: 'ca-app-pub-3940256099942544/1712485313',
};
const ADMOB_PROD_REWARDED = {
  android: null,
  ios: null,
};

// Interstitial (full-screen) ad — shown ONLY at a page-switch transition, and
// heavily frequency-capped (see maybeShowInterstitial) so it never interrupts a
// task. Google test units; replace with real IDs before publishing.
const ADMOB_TEST_INTERSTITIAL = {
  android: 'ca-app-pub-3940256099942544/1033173712',
  ios: 'ca-app-pub-3940256099942544/4411468910',
};
const ADMOB_PROD_INTERSTITIAL = {
  android: null,
  ios: null,
};

function isNativeApp() {
  return !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform());
}

function getAdMob() {
  // Plugin is registered on the global Capacitor.Plugins namespace by the
  // @capacitor-community/admob package once the native app loads it.
  return window.Capacitor?.Plugins?.AdMob || null;
}

async function initAds() {
  if (!isNativeApp()) return;
  const AdMob = getAdMob();
  if (!AdMob) return;
  try {
    await AdMob.initialize({ initializeForTesting: true });
    await showBannerAd();
    prepareRewarded();     // preload for import/export/backup gating
    prepareInterstitial(); // preload for the page-transition interstitial
  } catch (e) {
    // Ads are non-critical; never let an ad failure break the app.
  }
}

let _rewardedReady = false;

async function prepareRewarded() {
  if (!isNativeApp()) return;
  const AdMob = getAdMob();
  if (!AdMob) return;
  const platform = window.Capacitor.getPlatform();
  const adId = (ADMOB_PROD_REWARDED[platform]) || ADMOB_TEST_REWARDED[platform];
  if (!adId) return;
  try {
    await AdMob.prepareRewardVideoAd({ adId, isTesting: !ADMOB_PROD_REWARDED[platform] });
    _rewardedReady = true;
  } catch (e) { _rewardedReady = false; }
}

// Reward detection is event-driven: the `Reward` event fires when earned, and
// `Dismissed` ALWAYS fires when the ad closes (earned or not). The promise from
// showRewardVideoAd() is unreliable across versions (it can hang when the user
// closes without a reward), so we resolve on Dismissed instead — this is what
// fixes import/export hanging after the ad is closed.
let _rewardListenersAdded = false;
let _rewardEarned = false;
let _rewardResolve = null;

function _addRewardListeners(AdMob) {
  if (_rewardListenersAdded) return;
  _rewardListenersAdded = true;
  AdMob.addListener('onRewardedVideoAdReward', () => { _rewardEarned = true; });
  AdMob.addListener('onRewardedVideoAdDismissed', () => {
    if (_rewardResolve) { const r = _rewardResolve; _rewardResolve = null; r(_rewardEarned); }
  });
  AdMob.addListener('onRewardedVideoAdFailedToShow', () => {
    if (_rewardResolve) { const r = _rewardResolve; _rewardResolve = null; r(true); } // failed → don't block
  });
}

// Gate an action behind a rewarded video. Resolves true when the action may
// proceed: on web (no gating), when the plugin/ad can't load (never block over an
// ad failure), or when the user earned the reward. Resolves false only when the
// ad showed but the user closed it before earning the reward.
async function showRewardedThen() {
  if (!isNativeApp()) return true;
  const AdMob = getAdMob();
  if (!AdMob) return true;
  try {
    if (!_rewardedReady) await prepareRewarded();
    if (!_rewardedReady) return true; // couldn't load → don't block the user
    _addRewardListeners(AdMob);
    _rewardEarned = false;
    const earned = await new Promise((resolve) => {
      _rewardResolve = resolve;
      // Safety net: never hang forever if no close event ever arrives.
      setTimeout(() => { if (_rewardResolve) { _rewardResolve = null; resolve(_rewardEarned); } }, 90000);
      AdMob.showRewardVideoAd().catch(() => {
        if (_rewardResolve) { const r = _rewardResolve; _rewardResolve = null; r(true); }
      });
    });
    return earned;
  } catch (e) {
    return true; // ad error must never block the action
  } finally {
    _rewardedReady = false;
    prepareRewarded();
  }
}

// Frequency-capped rewarded gate. Within `cooldownMs` of the last successful
// watch for `key`, the action is free (no ad); otherwise a rewarded ad is shown
// and the action proceeds only if earned. Lets us monetize a repeatedly-opened
// view (e.g. the year table) without forcing an ad on every single open.
async function showRewardedGate(key, cooldownMs) {
  if (!isNativeApp()) return true;
  const k = 'ft_rw_' + key;
  const last = parseInt(localStorage.getItem(k) || '0', 10) || 0;
  if (cooldownMs > 0 && Date.now() - last < cooldownMs) return true;
  const ok = await showRewardedThen();
  if (ok) localStorage.setItem(k, String(Date.now()));
  return ok;
}

let _interstitialReady = false;

async function prepareInterstitial() {
  if (!isNativeApp()) return;
  const AdMob = getAdMob();
  if (!AdMob) return;
  const platform = window.Capacitor.getPlatform();
  const adId = (ADMOB_PROD_INTERSTITIAL[platform]) || ADMOB_TEST_INTERSTITIAL[platform];
  if (!adId) return;
  try {
    await AdMob.prepareInterstitial({ adId, isTesting: !ADMOB_PROD_INTERSTITIAL[platform] });
    _interstitialReady = true;
  } catch (e) { _interstitialReady = false; }
}

// Frequency caps — keep the interstitial rare and only at clean transitions.
// The nav count alone prevents an ad right after opening the app (you won't
// switch pages this many times without real intent), so there's no separate
// open-grace delay that would otherwise also block the very first ad.
const INTERSTITIAL_MIN_INTERVAL_MS = 3 * 60 * 1000; // ≥3 min between interstitials
const INTERSTITIAL_MIN_NAVS = 7;                     // ≥7 page switches since last
let _navsSinceAd = 0;

function _lastInterstitialAt() {
  return parseInt(localStorage.getItem('ft_lastInterstitial') || '0', 10) || 0;
}

// Call on a page-switch transition. Shows a full-screen interstitial only once
// enough page switches have happened AND the cool-down since the last ad has
// elapsed. Never awaited by the router and never throws to it — an ad must not
// interrupt or break navigation.
async function maybeShowInterstitial() {
  if (!isNativeApp()) return;
  const AdMob = getAdMob();
  if (!AdMob) return;
  _navsSinceAd++;
  if (_navsSinceAd < INTERSTITIAL_MIN_NAVS) return;
  if (Date.now() - _lastInterstitialAt() < INTERSTITIAL_MIN_INTERVAL_MS) return;
  try {
    if (!_interstitialReady) await prepareInterstitial();
    if (!_interstitialReady) return;
    await AdMob.showInterstitial();
    _navsSinceAd = 0;
    localStorage.setItem('ft_lastInterstitial', String(Date.now()));
  } catch (e) {
    // ignore — navigation already happened; the ad is best-effort
  } finally {
    _interstitialReady = false;
    prepareInterstitial(); // preload the next one
  }
}

async function showBannerAd() {
  if (!isNativeApp()) return;
  const AdMob = getAdMob();
  if (!AdMob) return;
  const platform = window.Capacitor.getPlatform(); // 'android' | 'ios'
  const adId = (ADMOB_PROD_BANNER[platform]) || ADMOB_TEST_BANNER[platform];
  if (!adId) return;
  try {
    await AdMob.showBanner({
      adId,
      adSize: 'ADAPTIVE_BANNER',
      position: 'BOTTOM_CENTER',
      margin: 0,
      isTesting: !ADMOB_PROD_BANNER[platform],
    });
    // Reserve space so the banner never covers the bottom nav / content.
    document.body.classList.add('has-banner-ad');
  } catch (e) {}
}

async function hideBannerAd() {
  if (!isNativeApp()) return;
  const AdMob = getAdMob();
  if (!AdMob) return;
  try {
    await AdMob.hideBanner();
    document.body.classList.remove('has-banner-ad');
  } catch (e) {}
}
