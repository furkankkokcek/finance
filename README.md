# FinTrack - Kişisel Finansal Yönetim Sistemi 💰

Aylık gelir, gider, harcama ve finansal özgürlük hedeflerini takip etmeye yönelik Progressive Web App (PWA).

## Özellikler ✨

- **PWA Desteği** - İnternetsiz çalışır, uygulama gibi kurulabilir
- **Gelir Takibi** - Aylık gelir kaynakları kalem kalem
- **Gider Yönetimi** - Sabit giderler, krediler, kredi kartları
- **Harcama Kaydı** - Günlük harcamaları kategorize et
- **Grafikler** - Bar, pie ve trend grafikleriyle görselleştir
- **Finansal Özgürlük** - 5 seviye hedef takibi
- **Bildirimler** - Ödeme günü ve PPF hatırlatmaları
- **WhatsApp Paylaşım** - Aylık mali özeti paylaş
- **Import/Export** - JSON ile veri yedekleme
- **Yıllık Tablo** - Tüm yıl verilerini tablo halinde

## Kurulum 🚀

### GitHub Pages'de Deploy Etme

1. Bu repoyu fork et
2. Reponun settings'ine git → Pages
3. Deploy from: **GitHub Actions** seç
4. Yapıldı! `https://kullaniciadin.github.io/finance` adresinde çalışacak

### Yerel Çalıştırma

Herhangi bir HTTP sunucusu ile çalıştır:
```bash
python3 -m http.server 8000
# veya
npx http-server
```

## Kullanım 📖

### Setup
İlk açılışta maaş gün, başlangıç yılı ve net servet gir.

### Gelir Sekmesi
- Gelir kaynakları ekle (Maaş, Bonus vb.)
- Her ay için tutarları gir
- Yatırım tutarı belirle (tasarruf oranı otomatik hesaplanır)

### Gider Sekmesi
- **Sabit Giderler**: Aidat, internet, elektrik vb.
- **Krediler**: Konut, araba, kişisel krediler
- **Kredi Kartları**: Tüm kredi kartı ödemeleri
- Her giderde:
  - Ödeme günü (hafta sonu otomatik pazartesi'ye alınır)
  - Taksit sayısı ve ödenen taksit (krediler için)
  - Ödeme durumu: Ödendi/Kısmen/Ödenmedi
  - PPF seçeneği (bu gideri PPF bildirimine dahil et)

### Harcama Sekmesi
- Günlük harcamaları kaydet (Market, Restoran vb.)
- Otomatik kategorize

### Özet (Dashboard)
- Aylık gelir, gider, nakit kalan göstergesi
- Gider dağılımı pie chart
- Aylık trend grafiği
- Nakit kalan WhatsApp'ta paylaş

### Finansal Özgürlük
- Net Servet gir
- 5 seviye hedef:
  1. **Finansal Bağımlı** - Toplam borçları bitir
  2. **Finansal Stabilite** - 3 ay aylık gider
  3. **Portföy Sahibi** - 5 yıllık gider
  4. **Finansal Güvenlik** - 15 yıllık gider
  5. **Finansal Özgür** - 25 yıllık gider

## Bildirimler 📬

Bildirim açtıktan sonra:
- **Saat 9:00** - Bugün ödemesi olan giderlere hatırlatma
- **Maaş Günü (9:00)** - PPF tutarı ve aylık mali özet

## Veri Gizliliği 🔒

- Tüm veriler tarayıcında (localStorage) tutulur
- Sunucuya gönderilmez
- Export ederek yedekle

## Teknik 🛠️

- **Framework**: Vanilla JS (bağımlılık yok)
- **Storage**: Browser localStorage
- **PWA**: Service Worker + manifest.json
- **Deploy**: GitHub Pages