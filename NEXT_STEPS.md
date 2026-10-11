# Sonraki geliştirmeler — 1.6.0

Gerçek teslim sırası korunacak: ürün → Drive klasörü → teslim TXT’si → Etsy ilanı. ZIP/STL paketlemesi ana teslim yöntemi değildir. Şu anki çalışan özellik ve doğrulama kaydı `UPGRADE_STATUS.md`, açılış yönergesi `RUN_LATEST.md` içindedir.

## Önce veri ve gerçek kurulum

1. Kullanıcının Windows bilgisayarında mevcut kayıtlarla güncelleme ve kendi Etsy yetkilendirmesiyle salt okunur eşitleme denenmeli. İkinci bilgisayarda ikinci mağaza ayrı veri deposuyla kurulmalı. Bulut senkronizasyonu veya iki bilgisayar arasında ortak çalışma alanı henüz yok.
2. Satış günlerini İstanbul takvimine geçirmek için sürümlü geçiş tasarlanmalı. Mevcut `history.coverageBasis` **UTC**; eski günlük toplamların sipariş saatleri artık bilinmediğinde bunları üç saat kaydırıp doğrulanmış İstanbul günü diye sunmak yanlış olur. Yeni zaman damgalı işlemler ayrı hesaplanmalı, eski UTC dönemleri kaynak bilgisiyle korunmalı; gece yarısı, aynı siparişte çok satır ve eksik geçmiş testleri eklenmeli.
3. Son 90 günlük oluşturulma penceresi dışındaki sipariş düzeltmeleri/iade kayıtları için kaynak ve kapsam araştırılmalı. Şu anki tutar kalem brüt bedelidir; ödeme, ücret, iade veya net kâr hesabı değildir. Farklı para birimleri birleştirilmeyecek.

## Drive erişimi

Şu anda herhangi bir Drive OAuth bağlantısı zorunlu değil. Klasör paylaşım URL’si bir kez giriliyor veya seçilen mevcut TXT’den açık seçimle alınıyor. Oturumsuz, boyut/zaman/yönlendirme sınırları olan HTML kontrolü bazı klasör sayfalarını doğrulayabilir; belirsiz HTML **doğrulanamadı** kalır. Bu sonuç dosya indirme veya klasörün doğru/eksiksiz içeriğini kanıtlamaz.

11 Ekim 2026’da erişim araçları tarandı; bu oturumda Google Drive bağlayıcısı bulunmadı. Aşağıdaki resmî sayfaların okunması ağ geçidinin **403** yanıtıyla engellendi; güncel izin, doğrulama, ücret ve kota koşulları doğrulanmış sayılamaz:

- https://developers.google.com/workspace/drive/api/guides/api-specific-auth
- https://developers.google.com/workspace/drive/api/guides/manage-sharing
- https://developers.google.com/workspace/drive/api/guides/limits

İçerik listeleme gerekirse resmî OAuth ve gereken en dar salt okunur izin araştırılmalı. Kullanıcının Google oturumuyla listeleme, müşterinin anonim indirme erişiminin kanıtı değildir; iki sonuç ayrı tutulmalı. Parola istenmeyecek, paylaşım izinleri değiştirilmeyecek, dosyalar taşınmayacak/silinmeyecek, bütün arşiv indirilmeyecek. Yeni ücretli hizmet zorunlu kılınmayacak. Seçilen tek dosyaya gerçekten erişmeden geometri veya görsel üretilmiş gibi davranılmayacak.

## Hazırlık ve otomasyon

- Günlük kontrolün mevcut kapsamı: salt okunur Etsy eşitlemesi, en fazla üç vadesi gelen klasör sayfası kontrolü ve yerel teslim/ilan işlerinin sıralanması. Açık uygulamada çalışır. Arka planda mesaj okuma, yanıt gönderme, ilan değiştirme/kaldırma ve tek tuşla gerçek mağaza yazma henüz yok.
- Ücretsiz müşteri şablonları ve dış ChatGPT’ye kopyalanan bağlam hazır. Genel amaçlı otomatik çeviri veya uygulama içine ücretli yapay zekâ eklenmedi. Mesaj kutusu entegrasyonu için gerçek resmî API erişimi ayrıca doğrulanmalı; Star Seller yanıt süresi takibi varmış gibi sunulmayacak.
- Başlık/etiket sınırlarının güncel Etsy resmî kaynağıyla kontrolü gerekli. Şimdiki 140/13/20 değerleri yerel taslak koruması olarak açıkça etiketli.
- Değişiklik karşılaştırmaları ve eski/yeni metin arşivi var; bunlar nedensel satış etkisi kanıtı değil. Trafik/dönüşüm için gerçekten dışa aktarılabilen bir Etsy Stats dosyası örneği ve kapsamı araştırılmalı. Kullanıcıdan rutin elle metrik doldurması istenmeyecek; olmayan trafik sıfır yapılmayacak.
- Gerçek yerel STL’den tek model önizlemesi, PNG bilgi görseli ve dosya hash ilişkileri var. Yüksek ayrıntılı render, çok modelli kolaj, geometri benzerliği ve Drive dosyası hash karşılaştırması henüz yok. Örneklenmiş görünüm satış fotoğrafı sayılmayacak.
- Pazar araştırması korunuyor. Daha ileri örneklem ayıklama, fiziksel/dijital ayrımı ve araştırma adayını yerel hazırlığa taşıma ayrı geliştirme işi; rakip özel satışları veya yüksek talep bilgisi varsayılmayacak.

Kaynaklar ve paket yalnızca yerel olarak hazırlandı. Uzak depoya gönderim, dağıtım yayını veya gerçek mağaza/Drive üzerinde yazma yapılmadı.
