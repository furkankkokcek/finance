# FinTrack'i Mağazada Yayınlama (Capacitor)

Bu rehber, FinTrack PWA'sını **Capacitor** ile gerçek bir native mobil uygulamaya dönüştürüp
**Google Play** ve **App Store**'da yayınlamayı adım adım anlatır.

> **Neden Capacitor?** Mevcut HTML/CSS/JS kodu uygulamanın içine paketlenir; gerçek `android/` ve
> `ios/` native projeler oluşur. Bu bir "tarayıcı kabuğu" (TWA/PWABuilder) değildir — internet
> olmadan, siteye bağlı kalmadan çalışan gerçek bir uygulamadır.

---

## 0. Önkoşullar

| Platform | Gerekli araçlar |
|----------|-----------------|
| Her ikisi | [Node.js 18+](https://nodejs.org), npm |
| Android | [Android Studio](https://developer.android.com/studio) (+ Android SDK) |
| iOS | **macOS** + [Xcode](https://developer.apple.com/xcode/) (iOS yalnız Mac'te derlenir) |

Geliştirici hesapları (yayınlamak için zorunlu):
- **Google Play Console** — tek seferlik **$25** ([play.google.com/console](https://play.google.com/console))
- **Apple Developer Program** — yıllık **$99** ([developer.apple.com](https://developer.apple.com/programs/))
- **AdMob** hesabı (reklam için, ücretsiz) — [admob.google.com](https://admob.google.com)

---

## 1. Projeyi Capacitor'a hazırlama

Repo köküne klonladıktan sonra:

```bash
npm install            # Capacitor + AdMob bağımlılıklarını kurar
npm run build          # web dosyalarını www/ klasörüne kopyalar
```

`npm run build`, `index.html`, `css/`, `js/`, `locales/`, `icons/`, `manifest.json`, `sw.js`
dosyalarını `www/`'ye kopyalar (Capacitor bu klasörü native projeye gömecek — bkz.
`capacitor.config.json` → `webDir`).

`appId` ve `appName` `capacitor.config.json` içinde tanımlı:
- `appId`: `io.github.furkankkokcek.finance`
- `appName`: `FinTrack`

---

## 2. Android (Google Play)

### 2.1 Native Android projesini oluştur

```bash
npx cap add android     # android/ klasörünü üretir (tek seferlik)
npm run sync            # build + cap sync + AdMob manifest yamasını uygular
npx cap open android    # Android Studio'da açar
```

> Kod her değiştiğinde: **`npm run sync`** (sadece `npx cap sync` değil — aşağıdaki AdMob yaması da
> bununla çalışır).

### 2.2 AdMob App ID (manifest) — otomatik hallolur

Google Mobile Ads SDK, **test reklamlarında bile** `AndroidManifest.xml` içinde bir App ID arar.
Eksikse uygulama açılır açılmaz native seviyede crash eder (`js/ads.js`'teki `try/catch` bunu
yakalayamaz).

`scripts/patch-android.mjs` bunu **otomatik** ekler: `npm run sync` her çalıştığında
`android/app/src/main/AndroidManifest.xml`'e `com.google.android.gms.ads.APPLICATION_ID` meta-data'sını
(yoksa) enjekte eder. `android/` klasörü `.gitignore`'da olduğu için her `npx cap add android`
sonrası elle eklemen gerekmez — sadece `npm run sync` çalıştır.

> Geliştirmede Google'ın resmi **test App ID**'si kullanılır
> (`ca-app-pub-3940256099942544~3347511713`). Yayın öncesi `scripts/patch-android.mjs` içindeki
> `ADMOB_APP_ID`'yi kendi gerçek App ID'nle, `js/ads.js`'teki ad unit ID'lerini de gerçek ID'lerinle
> değiştir (bkz. §3). Dikkat: App ID'de `~`, reklam birimi ID'sinde `/` kullanılır.

Yamayı tek başına çalıştırmak için: `npm run patch:android`.

### 2.3 Emülatörde / cihazda dene
Android Studio'da **Run ▶** ile uygulamayı çalıştır. Alt kısımda **test reklam banner'ı** görünmeli
(gerçek reklam değil — bkz. AdMob bölümü).

### 2.4 İmzalı AAB üret
1. Android Studio → **Build → Generate Signed Bundle / APK → Android App Bundle**.
2. **Create new keystore** ile bir keystore (`.jks`) oluştur. **Bu dosyayı ve şifrelerini güvenle
   sakla** — kaybedersen uygulamayı bir daha güncelleyemezsin.
3. Release `.aab` dosyası üretilir.

### 2.5 Digital Asset Links (önemli)
Repo'da `/.well-known/assetlinks.json` mevcut ve paket adı doğru. İçindeki
`BURAYA_PWABUILDER_SHA256_HASH_GIRILECEK` placeholder'ını **imzalama anahtarının SHA256 parmak izi**
ile değiştir:

```bash
keytool -list -v -keystore yol/anahtar.jks -alias <alias>
# "SHA256:" satırındaki değeri kopyala
```

Play App Signing kullanıyorsan parmak izini **Play Console → Setup → App integrity** sayfasından al.
Güncelledikten sonra repo'yu commit + push et (GitHub Pages'te yayınlanır).

### 2.6 Play Console'a yükle
1. [Play Console](https://play.google.com/console) → **Create app**.
2. Mağaza listesi varlıkları:
   - Uygulama ikonu (512×512 — `icons/icon-512.png` kullanılabilir)
   - **Feature graphic** 1024×500 (manuel hazırla)
   - En az 2 telefon ekran görüntüsü
   - Kısa + uzun açıklama (çoklu dil için her dilde girilebilir)
   - **Gizlilik politikası URL'si** — veriler cihazda (localStorage) tutulduğu için basit bir metin
     yeterli; GitHub Pages'te bir `privacy.html` olarak yayınlayabilirsin.
3. **Data safety** ve **Content rating** formlarını doldur.
4. `.aab` dosyasını **Production** (veya önce **Internal testing**) track'ine yükle, incelemeye gönder.

---

## 3. AdMob (Reklam)

Uygulama `js/ads.js` üzerinden alt banner gösterir. **Şu an Google'ın resmi TEST reklam ID'leri**
kullanılır — yayınlamadan önce gerçek ID'lerinle değiştir.

1. [AdMob](https://admob.google.com) → uygulamanı ekle → bir **Banner** reklam birimi oluştur.
2. **App ID** ve **Ad unit ID** değerlerini al.
3. Gerçek ad unit ID'lerini `js/ads.js` içindeki `ADMOB_PROD_BANNER` nesnesine yaz:
   ```js
   const ADMOB_PROD_BANNER = {
     android: 'ca-app-pub-XXXX/YYYY',
     ios: 'ca-app-pub-XXXX/ZZZZ',
   };
   ```
4. **App ID**'yi native projeye ekle:
   - Android: `android/app/src/main/AndroidManifest.xml` içine
     ```xml
     <meta-data android:name="com.google.android.gms.ads.APPLICATION_ID"
                android:value="ca-app-pub-XXXX~APPID"/>
     ```
   - iOS: `ios/App/App/Info.plist` içine `GADApplicationIdentifier` anahtarı.
5. `npm run build && npx cap sync` ile yeniden senkronize et.

> ⚠️ Kendi gerçek reklamlarına tıklama veya yayında test ID kullanma AdMob hesabının
> askıya alınmasına yol açabilir.

---

## 4. iOS (App Store) — Mac gerekir

```bash
npx cap add ios
npx cap sync
npx cap open ios        # Xcode'da açar
```

1. Xcode → **Signing & Capabilities** → Apple Developer hesabınla imzala.
2. **Product → Archive** ile arşiv üret, **Distribute App → App Store Connect**.
3. [App Store Connect](https://appstoreconnect.apple.com) → uygulama kaydı, ekran görüntüleri,
   açıklama, gizlilik bilgileri → incelemeye gönder.

> **Apple Guideline 4.2 notu:** Salt web sarmalayıcılar reddedilebilir. FinTrack'in native değer
> kattığını vurgula: çevrimdışı çalışma, yerel bildirimler, takvim entegrasyonu.

---

## 5. Güncelleme akışı

Kod değiştiğinde:

```bash
npm run build
npx cap sync
```

Sonra sürüm numarasını artır:
- Android: `android/app/build.gradle` → `versionCode` (+1) ve `versionName`.
- iOS: Xcode → target → **Version** / **Build**.

Yeniden derleyip mağazaya yükle.

---

## 6. İleri / takip işleri (bu sürümde dahil değil)

- **Native bildirimler:** Şu an web `Notification` API + service worker kullanılıyor; native
  WebView'de bunlar güvenilir çalışmaz (uygulama yine çalışır, bildirimler sessizce devre dışı
  kalır). Tam native bildirim için `@capacitor/local-notifications` entegrasyonu önerilir.
- **Çoklu para birimi:** Arayüz 5 dilde; tutarlar ₺ (TRY) olarak kalır.
- **RTL diller** (Arapça vb.): mevcut 5 dil soldan-sağa; ileride eklenebilir.
