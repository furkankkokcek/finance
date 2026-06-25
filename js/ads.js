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
    prepareRewarded(); // preload so it's ready when import/export/backup fires
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

// Gate an action behind a rewarded video. Resolves true when the action may
// proceed: on web (no gating), when the plugin/ad can't load (never block a
// backup over an ad failure), or when the user earned the reward. Resolves false
// only when the ad showed but the user closed it before earning the reward.
async function showRewardedThen() {
  if (!isNativeApp()) return true;
  const AdMob = getAdMob();
  if (!AdMob) return true;
  try {
    if (!_rewardedReady) await prepareRewarded();
    if (!_rewardedReady) return true; // couldn't load → don't block the user
    const reward = await AdMob.showRewardVideoAd();
    return !!reward; // reward item present → earned
  } catch (e) {
    return true; // ad error must never block import/export/backup
  } finally {
    _rewardedReady = false;
    prepareRewarded();
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
