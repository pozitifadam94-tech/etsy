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

## Ürün karnesi ve ücretsiz mesaj yardımcısı

Ürün karnesi en uzun tamamlanmış deneme dönemini kullanır. 100 görüntülenmeden az veri için puan verilmez. En az 3 sipariş ve %2 dönüşümde "Devam et"; ilk 90 günde 300 görüntülenme ve sıfır siparişte "Duraklatmayı değerlendir" gösterilir. Negatif net gelir maliyet incelemesi gerektirir. Bunlar başlangıç eşikleridir, Etsy ölçütleri veya istatistiksel güven garantisi değildir. Hiçbir ilan otomatik kaldırılmaz. Puan %3 dönüşümde 100 olacak şekilde ölçeklenir. Eski veya tutarsız gözlemlerde puan gösterilmez.

Mesaj yardımcısı ücretsiz sabit İngilizce/Türkçe şablonlar ve mevcut ChatGPT kullanımına aktarılabilecek profil+mesaj metni sağlar. Otomatik çeviri, AI API veya Etsy mesaj erişimi yoktur. İngilizce metin düzenlenirse Türkçe açıklama otomatik güncellenmez. Müşteri mesajı sunucuya gönderilmez veya uygulama yedeğine kaydedilmez.

Etsy uygulamasının onaylandığı kullanıcı tarafından bildirildi; API bağlantısı henüz yapılmadı. GitHub Pages güvenli sunucu veya gizli anahtar deposu değildir. Keystring/Shared secret/OAuth token kaynak koduna, tarayıcıya veya GitHub'a eklenmemelidir. Kendi mağaza verilerine erişim için uygun OAuth izinleri ve kayıtlı callback gerekir. API'nin Etsy Stats görüntülenmelerini veya mesajlarını sağladığı varsayılmamalıdır; desteklenmeyen ölçümler manuel girilir. Ücretsiz kişisel sunucu seçeneği bilgisayar açıkken çalışabilir; sürekli ücretsiz barındırma garanti edilmez.

## Günlük öncelikler, trend ve değişiklik günlüğü

Canlı ürünlerin son 30 günü, 60 günlük toplamdan 30 günlük toplam çıkarılarak elde edilen önceki 30 günle adet bazında karşılaştırılır. İlan yaşı 60 günden küçükse eşit dönem karşılaştırması yapılmaz. Toplam 3 adetten az satış küçük örnek olarak belirtilir. Başlangıç sıfırsa yüzde artış üretilmez. İki günden eski satış snapshot'ı güncelleme gerektirir. Öncelikler inceleme önerisidir; Etsy ilanını değiştirmez veya silmez.

Ürün detayında görsel/başlık/fiyat/açıklama değişikliklerini not edebilirsin. Bu notlar tarayıcıda saklanır ve JSON yedeğine dahildir. Yeni API snapshot'ı notları silmez. Önceki/sonraki 14 günlük adet karşılaştırması değişiklik sonrası 14 tam gün tamamlanınca yapılır. Önceki dönem 90 günlük veri kapsamına sığmalı ve ilan o dönemde açık olmalıdır. Hesap günlük UTC satış toplamları kullanır, değişiklik günü sonraki pencereye dahildir. Bu karşılaştırma nedensellik kanıtı değildir; eşzamanlı değişiklikler, sezon ve reklamlar sonucu etkiler.

Yeni sürümde günlük satış adetlerinin gelmesi için bir kez başarılı senkronizasyon gerekir. Günlük satışlar kişisel müşteri bilgisi içermez. Eski snapshot'larda günlük veri bulunmuyorsa karşılaştırma beklemede gösterilir.

## İnceledim, erteleme ve haftalık özet

Günlük öneride İnceledim, öneriyi aynı durum devam ettiği sürece 7 gün gizler; durum değişirse öneri daha erken geri gelir. 3/7 gün sonra ertelemesi, seçilen süre bitene kadar öneriyi gizler. Bu işlemler Etsy ilanını değiştirmez. Gizlenen önerileri yeniden göster tüm işaretleri temizler. Kayıtlar tarayıcıda tutulur ve JSON yedeğine dahildir.

Haftalık özet, son satış snapshot'ının gününden önceki 7 tam UTC gününü, ondan önceki ayrık 7 günle karşılaştırır. Bugün dışarıda kalır. Karşılaştırılabilir ürünler en az 14 günlük, günlük satış verisi bulunan aktif ilanlardır. Bu ürünlerin toplamı mağaza geneli toplamı olarak sunulmaz. Toplam 3 adetten az satış küçük örnek olarak işaretlenir. Son 90 günlük veri içinde ilk gözlenen satış yaşam boyu ilk satış değildir. Eski ve eksik veri ayrı gösterilir. Sonuçları görmek için bir kez senkronizasyon yap.
