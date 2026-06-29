# FinTrack — Google Play Yayınlama Rehberi

Bu doküman, FinTrack'i Google Play Store'a yayınlamak için **kalan tüm adımları** sırasıyla
listeler. Kod tarafı hazır; aşağıdakilerin tamamı senin tarafında yapılacak.

> Versiyon: **1.1.0** · Paket: `io.github.furkankkokcek.finance`

---

## ✅ Kod tarafında hazır olanlar (zaten yapıldı)

- Capacitor 6 + Android projesi (`npm run sync`)
- AdMob banner + ödüllü + geçiş reklamları (şu an Google **TEST** ID'leri)
- Yerel bildirimler (`@capacitor/local-notifications`)
- Splash screen + launcher icon + bildirim ikonu — `npm run sync`'te logodan üretiliyor
- 5 dil (TR/EN/DE/ES/FR) + 4 para birimi (TRY/USD/EUR/GBP)
- Dışa/içe aktarma, takvim entegrasyonu (.ics + Google Calendar), WhatsApp paylaşımı
- Açılış ekranında "Yedekten İçe Aktar"

## ❌ Senin yapacakların (sıralı)

### 1. Geliştirici hesapları
- [ ] **Google Play Console** kaydı — tek seferlik **\$25** · [play.google.com/console](https://play.google.com/console)
- [ ] **AdMob** hesabı — ücretsiz · [admob.google.com](https://admob.google.com)

### 2. AdMob: gerçek reklam ID'leri al ve yaz

AdMob'da uygulamanı oluştur → **dört ID** al:

| Tür | Nereye |
|-----|--------|
| App ID (`ca-app-pub-XXX~APPID`) | `scripts/patch-android.mjs` → `ADMOB_APP_ID` |
| Banner ad unit (`ca-app-pub-XXX/YYY`) | `js/ads.js` → `ADMOB_PROD_BANNER.android` |
| Rewarded ad unit | `js/ads.js` → `ADMOB_PROD_REWARDED.android` |
| Interstitial ad unit | `js/ads.js` → `ADMOB_PROD_INTERSTITIAL.android` |

> App ID'de `~`, ad unit'te `/` — karıştırma. Bittiğinde `npm run sync`.

> ⚠️ **Yayında test ID kullanma, kendi reklamına tıklama** — AdMob hesabın askıya alınabilir.

### 3. Release keystore oluştur

```cmd
keytool -genkey -v -keystore fintrack-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias fintrack
```

- Çıkan `.jks` ve şifreleri **çok güvenli sakla** (örn. parola yöneticisi + offline yedek).
  **Kaybedersen uygulamayı bir daha güncelleyemezsin.**
- Repo'ya **commit ETME**.

### 4. İmzalı AAB üret

Android Studio'da:
1. **Build → Generate Signed Bundle / APK → Android App Bundle**
2. 3. adımdaki `.jks` ile imzala
3. **release** seçili, **Finish**
4. Çıkan `.aab` dosyası → `app/build/outputs/bundle/release/app-release.aab`

### 5. Play Console — uygulama oluştur ve yükle

Play Console → **Create app**:
- **App name:** FinTrack
- **Default language:** Türkçe (5 dil için sonradan store listing eklenir)
- **App or game:** App · **Free or paid:** Free
- Yönetmeliklere onay

#### 5.1 Mağaza listesi (store listing)
- **Uygulama ikonu** — 512×512 (kullan: `icons/icon-512.png`)
- **Feature graphic** — 1024×500 (manuel hazırlanır)
- **Phone screenshots** — en az 2 adet (önerilen 4–6)
- **Kısa açıklama** (80 karakter): örn. *"Aylık gelir-gider, kredi kartı, yatırım takibi — reklamlı ücretsiz."*
- **Uzun açıklama** (4000 karakter)
- Çoklu dil için her dilde tekrarla (TR/EN/DE/ES/FR)

#### 5.2 Data Safety formu

| Veri türü | Cihazda | Sunucuya gönderiliyor? |
|-----------|---------|------------------------|
| Finansal işlemler, gelir, harcamalar | localStorage | Hayır |
| AdMob reklam ID'si | — | AdMob'a (reklam için) |
| FCM cihaz token'ı (bildirim için) | — | Kendi sunucuna (varsa) |

- Şifreleme: HTTPS (reklam/push istekleri için)
- Veri silme: kullanıcı "Tüm Verileri Sil" butonuyla silebilir → bunu belirt

#### 5.3 Content Rating
- Anketi cevapla → büyük ihtimal **Everyone** çıkar (finansal araç, hassas içerik yok)

#### 5.4 Gizlilik politikası URL'si (zorunlu)
- Basit bir `privacy.html` yaz → GitHub Pages'e koy → URL'sini gir
- İçerikte mutlaka olmalı: "veriler cihazda saklanır, AdMob reklam gösterir, FCM bildirim için cihaz token'ı kullanılır"

#### 5.5 AAB yükle
- **Production** track → **Create new release** → AAB sürükle-bırak
- Release notes (5 dilde) → **Save → Review release → Start rollout to production**

İlk gönderim incelemesi genelde **birkaç gün – 1 hafta** sürer.

> 💡 Önce **Internal testing** track'ine yükleyip kendi cihazında deneyip sonra Production'a almak
> en güvenlisi (yanlış imza/AdMob ID hataları erkenden yakalanır).

### 6. (Sonradan) Güncelleme akışı

Her yeni sürümde:
1. `package.json` ve `index.html` içindeki versiyonu artır (örn. 1.1.0 → 1.1.1)
2. Android Studio → `android/app/build.gradle` → `versionCode` **+1**, `versionName` aynı string
3. `npm run sync` → yeni signed AAB üret → Play Console'a yükle

---

## Kısa referans — komutlar

```cmd
:: Geliştirme döngüsü
npm install
npm run sync         :: build + cap sync + android patch (ikon/splash/manifest)
npx cap open android :: Android Studio'da aç

:: Yayın öncesi son senkron
npm run sync
:: Android Studio → Build → Generate Signed Bundle / APK → AAB
```

## Sık karşılaşılan hatalar

| Sorun | Sebep / Çözüm |
|-------|---------------|
| Açılışta beyaz flaş | Çözüldü — `patch-android.mjs` koyu splash üretiyor |
| Bildirim ikonu gri kare | Çözüldü — beyaz silüet üretiliyor |
| AdMob bağlanmadı / native crash | `patch-android.mjs` App ID enjekte ediyor; yine sorun varsa `ADMOB_APP_ID` doğru mu kontrol et |
| Reklam gelmiyor | Test ID'leri çalışıyor; prod ID'leriniz AdMob'da "Active" mi? Yeni hesapta onay 1-2 gün sürer |
| AAB upload reddedildi | `versionCode` aynı kalmış olabilir — her yüklemede +1 |
