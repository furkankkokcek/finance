# Sunucu Tabanlı Bildirimler (Firebase Cloud Messaging) Kurulumu

Bu rehber, FinTrack'e **uygulama kapalı/uykuda olsa bile** gelen push bildirimlerini
ekler. Mimari: **FCM + zamanlanmış Cloud Function + Firestore**.

> **Önemli gerçek:** Push, uygulamanın **en az bir kez açılmış** olmasını gerektirir
> (FCM token'ı o zaman üretilip sunucuya gider). "Hiç açılmamış" cihaza push gönderilemez —
> bu Android/iOS kuralıdır. Bir kez açıldıktan sonra uygulama bir daha hiç açılmasa bile
> bildirimler gelir.
>
> **Gizlilik:** Sunucuya yalnız **önceden render edilmiş bildirim metni (başlık/gövde) + tetik
> tarihi** gider; ham bütçe tablosu cihazdan çıkmaz. Metin tutarları içerir (hatırlatmanın amacı bu).
> Yayınlarken Play Console **Data Safety** formunda "bildirim içeriği sunucuda işlenir" beyan et.

---

## 0. Önkoşullar
- Node.js 18+, [Firebase CLI](https://firebase.google.com/docs/cli): `npm install -g firebase-tools`
- Bir Google hesabı (Gmail yeterli)

---

## 1. Firebase projesi oluştur
1. [Firebase Console](https://console.firebase.google.com) → **Add project** → isim ver (örn. `fintrack`).
2. Projeyi **Blaze planına** yükselt (Cloud Functions için gerekir). Günlük 1 cron + birkaç bin
   push **ücretsiz kotada** kalır; pratikte ücret çıkmaz. (Settings → Usage and billing → Modify plan)

## 2. Android uygulamasını Firebase'e ekle
1. Console → Project Overview → **Add app → Android**.
2. **Package name:** `io.github.furkankkokcek.finance` (capacitor.config.json ile aynı).
3. **google-services.json** dosyasını indir ve `android/app/google-services.json` konumuna koy.
   > `android/` ve `google-services.json` `.gitignore`'da — repoya commit edilmez, doğru olan budur.

## 3. Android tarafını FCM'e hazırla (Gradle)
`@capacitor/push-notifications` Firebase Gradle eklentisini ister. İki dosyayı düzenle:

**`android/build.gradle`** (proje köküdeki) → `dependencies` bloğuna:
```gradle
classpath 'com.google.gms:google-services:4.4.2'
```

**`android/app/build.gradle`** → en üste `apply plugin` satırlarının yanına ekle (dosyanın **en altına**
da olur):
```gradle
apply plugin: 'com.google.gms.google-services'
```

> Bu adımlar `npx cap add android` sonrası bir kez gerekir (android/ yeniden üretilirse tekrar).

## 4. Push eklentisini kur ve senkronize et
```bash
npm install            # @capacitor/push-notifications dahil
npm run sync           # native projeye ekler
```

## 5. Cloud Functions + Firestore kurallarını deploy et
Repo kökünde:
```bash
firebase login
firebase use --add          # 1. adımdaki projeyi seç, alias ver (örn. default)
cd functions && npm install && cd ..
firebase deploy --only functions,firestore:rules
```
Deploy bitince çıktıda **`registerSchedule`** fonksiyonunun URL'sini göreceksin, şuna benzer:
```
Function URL (registerSchedule): https://europe-west1-<proje-id>.cloudfunctions.net/registerSchedule
```
Bu URL'yi kopyala.

## 6. Uygulamaya endpoint URL'sini gir
`js/push.js` dosyasında en üstteki sabiti doldur:
```js
const PUSH_ENDPOINT = 'https://europe-west1-<proje-id>.cloudfunctions.net/registerSchedule';
```
Boş bırakılırsa push devre dışı kalır (local bildirimler yine çalışır). Sonra:
```bash
npm run sync
npx cap open android      # Android Studio → Run ▶
```

## 7. Test
1. Uygulamayı aç → **Ayarlar → Bildirimler** toggle'ını aç → izin ver.
2. **Firebase Console → Firestore** → `pushSchedules` koleksiyonunda cihazın için bir doküman
   oluşmalı (`token` + `notifications[]` ile).
3. **Anlık FCM testi:** Console → **Messaging → Send test message** → cihaz token'ını yapıştır
   → bildirim düşmeli.
4. **Zamanlanmış testi:** Bir gidere bugünün tarihine denk gelen vade günü ver, kaydet
   (Firestore güncellenir). `sendDailyNotifications` her gün 09:00 (Europe/Istanbul) çalışır;
   hemen denemek için Console → Functions → fonksiyonu **Run now** ya da
   `gcloud scheduler jobs run firebase-schedule-sendDailyNotifications-europe-west1`.

---

## Nasıl çalışıyor (özet)
- `js/push.js`: FCM token alır, gelecek **6 ay** için `{date,title,body}` listesini üretir
  (`collectMonthNotifEvents` ile — local bildirimlerle aynı mantık), `registerSchedule`'a POST eder.
  Her veri/dil değişiminde (debounce'lı) yeniden yükler.
- `functions/index.js`:
  - `registerSchedule` (HTTPS): token + listeyi Firestore `pushSchedules/{deviceId}` altına yazar;
    `{remove:true}` ile siler (bildirim kapatılınca).
  - `sendDailyNotifications` (zamanlanmış, 09:00 Europe/Istanbul): o güne ait kayıtları FCM ile
    gönderir; geçersiz token'ları temizler.
- `firestore.rules`: istemci doğrudan Firestore'a erişemez (yalnız fonksiyon Admin SDK ile yazar).

## Kısıtlar
- **Tek zaman dilimi:** Gönderim 09:00 Europe/Istanbul'da. TR kullanıcıları için doğru; farklı
  zaman dilimleri için fonksiyonu saatlik çalışıp kullanıcı `tz`'sine göre filtreleyecek şekilde
  genişletmek gerekir (kayıtta `tz` saklanıyor, ileriye hazır).
- **İlk kayıt için bir kez açılış şart** (yukarıda açıklandı).
- **iOS:** Ayrıca APNs anahtarı + `@capacitor/push-notifications` iOS kurulumu gerekir (bu rehber
  Android odaklı).
