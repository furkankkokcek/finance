# Google Drive Yedekleme Kurulumu

FinTrack, verini Google hesabındaki **gizli bir uygulama klasörüne** (`drive.appdata`)
yedekleyip geri yükleyebilir. Bu klasör kullanıcının normal Drive'ında görünmez; yalnız
uygulama erişebilir. Auth için `@codetrix-studio/capacitor-google-auth`, dosya işlemleri için
Drive REST API kullanılır.

> **Gizlilik:** Yedek (tüm finansal veri) Google Drive'a yüklenir. Bu özellik **opsiyoneldir** —
> kullanıcı "Drive'a Yedekle"ye basmadıkça hiçbir şey yüklenmez. Play Console **Data Safety**
> formunda beyan et.

---

## 1. Google Cloud / Firebase projesinde Drive API'yi aç
FCM ile aynı projeyi (örn. `fintrack-d74b7`) kullanabilirsin.
1. [Google Cloud Console](https://console.cloud.google.com) → projeyi seç.
2. **APIs & Services → Library** → **Google Drive API** → **Enable**.

## 2. OAuth consent screen
1. **APIs & Services → OAuth consent screen** → User type **External** → uygulama adı, destek
   e-postası, geliştirici e-postası.
2. **Scopes** → `.../auth/drive.appdata` ekle.
3. **Test users** → kendi Google hesabını ekle (yayın doğrulaması olmadan test edebilmek için).

> ⚠️ `drive.appdata` hassas bir kapsamdır. **Test users** ile (≤100 kişi) doğrulamasız çalışır.
> Play Store'da herkese açık yayın için Google **OAuth verification** isteyebilir.

## 3. OAuth Client ID'leri oluştur
**APIs & Services → Credentials → Create credentials → OAuth client ID**:

**a) Web application** (zorunlu — `serverClientId` bu olacak)
- Tür: Web application → oluştur → çıkan **Client ID**'yi kopyala
  (`xxxx.apps.googleusercontent.com`).

**b) Android**
- Tür: Android
- Package name: `io.github.furkankkokcek.finance`
- **SHA-1** parmak izi gir. Debug için:
  ```bash
  keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
  ```
  (Windows'ta keystore: `%USERPROFILE%\.android\debug.keystore`.) Release için kendi
  keystore'unun SHA-1'ini de ekle (Play App Signing kullanıyorsan Play Console → App integrity'den).

## 4. Web Client ID'yi uygulamaya gir
`capacitor.config.json` → `plugins.GoogleAuth.serverClientId` alanına **(a)**'daki Web Client ID'yi yaz:
```json
"GoogleAuth": {
  "scopes": ["https://www.googleapis.com/auth/drive.appdata"],
  "serverClientId": "xxxx.apps.googleusercontent.com",
  "forceCodeForRefreshToken": false
}
```

## 5. Kur ve senkronize et
```bash
npm install              # @codetrix-studio/capacitor-google-auth dahil
npm run sync
npx cap open android      # Run ▶
```

## 6. Test
1. Ayarlar → **☁️ Drive'a Yedekle** → Google hesabı seçimi açılır → izin ver → "Yedek yüklendi".
2. [Drive API dosyaları](https://developers.google.com/drive/api/v3/reference/files/list) appDataFolder'da
   görünür (normal Drive arayüzünde görünmez — normaldir).
3. Veriyi değiştir → **⬇️ Drive'dan Geri Yükle** → en son yedeği geri yükler.

---

## Nasıl çalışıyor (özet)
- `js/drive.js`: `GoogleAuth.signIn()` ile `drive.appdata` kapsamlı access token alır; Drive REST
  API'ye `fetch` ile multipart upload (yedekle) / list+download (geri yükle) yapar. En son yedeği
  geri yükler.
- Native-only; web/PWA'da ve `serverClientId` doldurulmadan **no-op / nazik hata** verir (uygulama
  kırılmaz). Web'de yedek için mevcut "Dışa/İçe Aktar" dosya akışı kullanılabilir.

## Kısıtlar
- Sadece **en son** yedeği geri yükler (liste seçimi ileride eklenebilir).
- Drive kapsamı yayın doğrulaması gerektirebilir (§2 notu).
- iOS için ayrıca iOS OAuth client + `GIDClientID` Info.plist kurulumu gerekir (bu rehber Android odaklı).
