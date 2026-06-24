# FinTrack - Kişisel Finansal Yönetim Sistemi

Aylık gelir, gider, harcama ve finansal özgürlük hedeflerini takip etmeye yönelik Progressive Web App (PWA).

## Özellikler

- **PWA Desteği** - İnternetsiz çalışır, uygulama gibi kurulabilir
- **Çoklu Dil** - Türkçe, İngilizce, Almanca, İspanyolca, Fransızca (Ayarlar'dan değiştirilir)
- **Native Uygulama** - Capacitor ile Google Play / App Store için paketlenebilir (bkz. [PUBLISHING.md](PUBLISHING.md))
- **Gelir Takibi** - Aylık gelir kaynakları kalem kalem, Excel'den yapıştırma desteği
- **Gider Yönetimi** - Sabit giderler, krediler, kredi kartları; accordion açık kalır
- **KK Harcama Entegrasyonu** - Harcama eklerken KK'ya bağla, tek çekim veya taksitli; ilgili ayların KK tutarına otomatik eklenir, silinince geri alınır
- **Harcama Takibi** - Günlük harcamalar + KK taksit görünümü (1/4, 2/4...)
- **Grafikler** - Bar, pie ve trend grafikleriyle görselleştir
- **Finansal Özgürlük** - 5 seviye hedef takibi
- **Bildirimler** - Ödeme günü ve PPF hatırlatmaları
- **PPF Togglı** - Setup ve ayarlardan PPF özelliğini etkinleştir/devre dışı bırak
- **Tutar Gizleme** - Header'daki göz butonu ile tüm tutarları bulanıklaştır (gizlilik modu)
- **WhatsApp Paylaşım** - Aylık mali özeti paylaş (nakit kalan ÷2 ÷3 ÷4 dahil)
- **Import/Export** - JSON ile veri yedekleme
- **Yıllık Tablo** - Tüm yıl verilerini tablo halinde

## Kurulum

### GitHub Pages'de Deploy

1. Bu repoyu fork et
2. Reponun settings'ine git → Pages
3. Deploy from: **GitHub Actions** seç
4. `https://kullaniciadin.github.io/finance` adresinde çalışacak

### Yerel Çalıştırma

```bash
python3 -m http.server 8000
# veya
npx http-server
```

### Mobil Uygulamaya Dönüştürme (Capacitor)

FinTrack, **Capacitor** ile gerçek bir native Android/iOS uygulamasına dönüştürülebilir (PWABuilder/TWA
değil — kod uygulamanın içine gömülür). Google Play ve App Store'da yayınlamanın tam adımları için:

➡️ **[PUBLISHING.md](PUBLISHING.md)**

Özet:
```bash
npm install
npm run build          # web dosyalarını www/'ye kopyalar
npx cap add android    # native android/ projesini üretir
npx cap sync
npx cap open android   # Android Studio'da aç, imzalı AAB üret
```

### Çoklu Dil

Arayüz 5 dilde: **TR, EN, DE, ES, FR**. Çeviriler `locales/*.js` içinde, i18n altyapısı `js/i18n.js`
içindedir. Yeni dil eklemek için: `locales/<kod>.js` oluştur (`tr.js`'i şablon al), `js/i18n.js`'teki
`I18N_LANGS` ve `I18N_LOCALE_CODES` listelerine ekle, `index.html`'deki dil seçicisine bir `<option>`
ekle. Ay/gün adları `Intl` ile otomatik gelir.

## Kullanım

### Gelir Sekmesi
- Gelir kaynakları ekle (Maaş, Bonus vb.)
- Her ay için tutarları gir veya **Excel'den Yapıştır** butonuyla tab-separated veriyi yapıştır
- Yatırım tutarı belirle (tasarruf oranı otomatik hesaplanır)

### Gider Sekmesi
- **Sabit Giderler** — Aidat, internet, elektrik vb.
- **Krediler** — Konut, araba, kişisel krediler
- **Kredi Kartları** — Tüm kredi kartı ödemeleri
- Ödeme günü, taksit sayısı, ödeme durumu (Ödendi/Kısmen/Ödenmedi), PPF seçeneği
- O ay tutarı 0 olan kalemler gizlenir
- Açık bırakılan accordion ay/durum değişiminde açık kalır

### Harcama Sekmesi
- Günlük harcamaları kaydet (Market, Restoran vb.)
- **KK'dan Harcadım** seçeneğiyle kredi kartına bağla:
  - Tek çekim → sonraki ayın KK tutarına eklenir
  - Taksitli → ilgili aylara eşit taksit olarak dağıtılır
- KK harcamaları ödeme aylarında `1/4 taksit`, `2/4 taksit`... şeklinde görünür
- KK harcaması silinemez düzenlenemez, sadece silinebilir (KK tutarları otomatik geri alınır)

### Özet (Dashboard)
- Aylık gelir, gider, nakit kalan, tasarruf oranı
- Gider dağılımı pie chart, aylık bar ve trend grafiği
- PPF kutusu ve yıllık tablo butonu
- WhatsApp paylaşım (başlıklar kalın, nakit kalan ÷2 ÷3 ÷4 değerleriyle)

### Finansal Özgürlük
Net Servet girerek 5 seviyede ilerleme takibi:
1. **Finansal Bağımlı** — Toplam borçları bitir
2. **Finansal Stabilite** — 3× aylık gider
3. **Portföy Sahibi** — 5 yıllık gider
4. **Finansal Güvenlik** — 15 yıllık gider
5. **Finansal Özgür** — 25 yıllık gider

## Bildirimler

Bildirim açıldığında (saat 9:00):
- **Ödeme günü** — bugün ödemesi olan giderlere hatırlatma
- **Maaş günü** — PPF tutarı ve aylık mali özet

Üç kademe bildirim desteği:
- **Web/PWA:** service worker + periodic sync (sınırlı).
- **Native (Capacitor):** gerçek zamanlanmış local notification — uygulama kapalıyken de çalışır
  (bu + sonrası ay için kurulur, her açılışta yenilenir).
- **Sunucu push (opsiyonel):** Firebase Cloud Messaging ile uygulama hiç açılmasa bile bildirim —
  kurulum: [PUSH-SETUP.md](PUSH-SETUP.md).

## Veri Gizliliği

Tüm finansal veriler cihazda (localStorage) tutulur. **İstisna:** sunucu push'unu (PUSH-SETUP.md)
etkinleştirirsen, yalnızca önceden render edilmiş bildirim metni + tetik tarihi Firebase'e gider
(ham bütçe tablosu değil). Export ile yedekle.

## Proje Yapısı

```
index.html                  ← HTML kabuğu (CSS/JS referansları)
manifest.json
sw.js
capacitor.config.json       ← Capacitor native uygulama yapılandırması
package.json                ← Capacitor + AdMob bağımlılıkları
scripts/build-web.mjs       ← web dosyalarını www/'ye kopyalar

locales/                    ← çoklu dil sözlükleri (tr, en, de, es, fr)

css/
  base.css                  ← CSS değişkenleri, reset, body
  app.css                   ← Layout, nav, sayfalar, tutar gizleme kuralı
  components/
    header.css
    setup.css
    modal.css
    cards.css
    items.css
    charts.css

js/
  store.js                  ← S durum nesnesi, localStorage kalıcılığı
  i18n.js                   ← çoklu dil: t(), applyLocale(), Intl ay/gün adları
  ads.js                    ← AdMob banner (native uygulamada; web'de no-op)
  utils.js                  ← Formatlayıcılar, getTotalDebt, getMonthlyData
  notifications.js
  share.js
  router.js
  components/
    header.js               ← Tema, tutar görünürlüğü
    modal.js                ← Modal aç/kapat, yıl seçici
    grid.js                 ← Tutar grid render
  pages/
    setup.js
    dashboard.js
    income.js
    expense.js
    spending.js
    freedom.js
    yeartable.js
    year.js
    settings.js
  app.js                    ← initApp, service worker, başlatma
```

## Teknik

- **Framework**: Vanilla JS — sıfır bağımlılık
- **Storage**: Browser localStorage
- **PWA**: Service Worker + manifest.json
- **Deploy**: GitHub Pages
- **Versiyon**: Her `main` merge'ünde patch versiyonu otomatik artar (GitHub Actions)
