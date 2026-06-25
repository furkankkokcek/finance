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

// Interstitial (full-screen) ads — shown after import/export. Google test units;
// replace with real IDs before publishing.
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
    prepareInterstitial(); // preload so it's ready when import/export fires
  } catch (e) {
    // Ads are non-critical; never let an ad failure break the app.
  }
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

// Show a full-screen interstitial (used after import/export). No-op on web; never
// throws to the caller, and preloads the next one for subsequent use.
async function showInterstitialAd() {
  if (!isNativeApp()) return;
  const AdMob = getAdMob();
  if (!AdMob) return;
  try {
    if (!_interstitialReady) await prepareInterstitial();
    if (!_interstitialReady) return;
    await AdMob.showInterstitial();
  } catch (e) {
    // ignore — ads must never block the actual import/export
  } finally {
    _interstitialReady = false;
    prepareInterstitial();
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
