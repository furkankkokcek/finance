# FinTrack - Kişisel Finansal Yönetim Sistemi

Aylık gelir, gider, harcama ve finansal özgürlük hedeflerini takip etmeye yönelik Progressive Web App (PWA).

## Özellikler

- **PWA Desteği** - İnternetsiz çalışır, uygulama gibi kurulabilir
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

Bildirim açıldığında:
- **Saat 9:00** — Bugün ödemesi olan giderlere hatırlatma
- **Maaş Günü 9:00** — PPF tutarı ve aylık mali özet

## Veri Gizliliği

Tüm veriler tarayıcıda (localStorage) tutulur, sunucuya gönderilmez. Export ile yedekle.

## Proje Yapısı

```
index.html                  ← HTML kabuğu (CSS/JS referansları)
manifest.json
sw.js

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
