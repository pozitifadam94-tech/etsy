# STL Niş Atölyesi

GoatDesgnShop için Türkçe STL niş araştırma ve ürün aday takip uygulaması. Node.js 20+ yeterlidir; harici paket veya hesap gerekmez.

## Çalıştırma

```sh
cd /workspace/etsy
npm start
```

Sunucu 3000 portunu kullanır; `PORT` ile değiştirilebilir. `npm test` puanlama kontrollerini çalıştırır.

## Kullanım

1. Niş ve İngilizce Etsy arama ifadesi ekle. İlgili sonuç sayısını biliyorsan kaydet.
2. Etsy araştırma bağlantısını aç, dijital STL ilanlarını seç. Aynı 90 günlük dönem için yorum sayısı, fiyat ve gözlem tarihini kaydet. Bilinmeyen yorumu boş bırak.
3. En az üç yorum verili ilan ve iki mağaza olduğunda örneklem fırsat puanı oluşur. Farklı tarihler ve seçilmiş örnekler sonuçları etkiler.
4. Telegram ürün adaylarını nişlere bağla ve durumlarını takip et.
5. JSON yedek indir. Veriler tarayıcının localStorage alanındadır; farklı cihaz veya tarayıcı otomatik paylaşmaz.

CSV başlıkları: `niche,title,shop,url,price,reviews,date`. Tarih YYYY-MM-DD, fiyat USD ve ondalık ayırıcı nokta olmalıdır. Bilinmeyen yorum boş bırakılır. Niş adı mevcut kayıtla eşleşmelidir. Hatalı aktarım kısmen uygulanmaz; yinelenen ilanlar atlanır.

Canlı Etsy toplama/API entegrasyonu yoktur. Gerçek rakip ve satış verileri uydurulmaz. Yorum sayısı satış hacmi değildir; puan kârlılığı ölçmez. Uygulama hesap veya sunucu veritabanı içermez.

## Tanıtım sayfasını yayımlama

`docs/index.html` Etsy uygulama başvurusu için İngilizce proje tanıtımıdır; çalışan uygulama veya canlı API bağlantısı değildir. Dosyalar GitHub'a gönderildikten sonra depo Settings → Pages bölümünde "Deploy from a branch", gerçek yayımlama dalı ve `/docs` klasörünü seç. Yayımlama başarıyla tamamlanırsa beklenen adres `https://pozitifadam94-tech.github.io/etsy/` olur. Başvuruya yazmadan önce adresin açıldığını doğrula. GitHub Pages kullanılabilirliği depo görünürlüğüne ve hesap planına bağlıdır; özel depoyu kendiliğinden herkese açık yapma.

## Geliştirilmiş arayüz

Niş arama, veri yeterliliği filtresi, puan/fiyat sıralama, yan yana karşılaştırma, ilan düzenleme, son silmeyi geri alma ve aday araştırma bilgileri bulunur. Etsy API durum kartı onay beklediğini gösterir; canlı bağlantı yoktur.

`npm run build:pages` ile statik uygulama dosyalarını `docs/app` içine güncelle. GitHub Pages yayımlaması tamamlandığında panel `/etsy/app/` yolunda açılır. API anahtarlarını bu statik siteye ekleme; gelecekteki API bağlantısı güvenli bir sunucu gerektirir.

## Ürün havuzu ve satış denemeleri

Ürün adaylarına PNG/JPEG/WebP görseller eklenebilir (en fazla 5 MB); tarayıcı 640 piksele küçültüp JPEG olarak yedeğe dahil eder. Görseller cihazdaki tarayıcı depolama kotasını kullanır. Aday adını/notunu arayabilir, durumla filtreleyebilirsin.

Satış denemelerinde ürün başına ilk 30/60/90 günün birikimli sonuçları ayrı tutulur; aynı dönem yeniden kaydedilirse güncellenir. Dönüşüm sipariş/görüntülenme olarak hesaplanır; sıfır görüntülenmede gösterilmez. Net tutar yalnızca gider girildiyse gelir eksi giderdir. Dönemleri toplama. Ürün veya niş silindiğinde bağlı sonuçlar silinir; son silmeyi geri al tüm bağlı kayıtları geri getirir. Eski JSON yedekleri desteklenir.

Araştırma görevleri eksik örnekleri, eksik sonuç sayısını, 30 günden eski gözlemleri ve tek mağaza ağırlığını gösterir. Görevler puanın yerine geçmez. Canlı API, kullanıcı girişi ve cihazlar arası otomatik senkronizasyon henüz yoktur.
