# Sonraki geliştirmeler — 1.7.0

1.7.0’ın çalışan kapsamı ve son doğrulama [UPGRADE_STATUS.md](UPGRADE_STATUS.md), ilk araştırma/açılış [RUN_LATEST.md](RUN_LATEST.md) içindedir. Önceki 1.6.0 kayıtları tarihsel olarak korunur. Gerçek müşteri teslimi **Etsy TXT → Google Drive klasörü → STL**; gerçek klasör bağlantısı ilan/araştırma metnine eklenmez. Uygulama güncelleme ZIP’i, STL teslim yöntemi değildir.

## İlan araştırmasında kalan doğrulamalar

1. Kullanıcının tek gerçek ürününde Marketplace Insights ekranından aktarım, dönem/kapsam, önizleme ve önceki araştırmayı yeniden kullanma denenmeli. Manuel metin/tablo akışı vardır; otomatik MI erişimi, güncel ücretsiz kota ve varsayılan veri dönemi doğrulanmış değildir.
2. Güncel Etsy Help, Search Handbook ve API/taxonomy belgeleri erişilebilir olduğunda yeniden incelenmeli. 12 Ekim 2026’daki bu sayfa istekleri `CONNECT 403` ile engellendi; resmî GitHub kaynakları okunabildi. 140/13/20 yerel kontrolleri güncel resmî sınır diye sunulmamalı; kategori/özellik kimliği tahmin edilmemeli. Kaynak ve engel kaydı [RESEARCH_SOURCES.md](RESEARCH_SOURCES.md) içindedir.
3. İsteğe bağlı API ilan örneklemi canlı salt okunur hesapla ayrıca denenmeli. Şimdiki en fazla ilk 100 aktif/yeni ilan tüm Etsy pazarı veya kişiselleştirilmiş müşteri sırası değildir. Dijital/fiziksel/diğer dijital/bilinmeyen ayrımı düzeltilebilir, ilan tekrarları ve mağaza yoğunlaşması görünür; daha geniş veya temsili örneklem için ayrıca kanıt gerekir. Rakip özel satışları, talep veya dönüşüm varsayılmamalı.
4. Kullanıcı Etsy’de metni yayımladıktan sonra ilan ilişkisi gerçek kullanımda kontrol edilmeli. Bağlanan başlangıç yerel taslak, hedefler ve onun ilk araştırma tarihidir; yayımlanan Etsy metninin birebir doğrulaması değildir. Trafik/arama terimleri bilinmiyorsa boş kalmalı; birkaç günlük satışsızlıktan kelime başarısızlığı veya SEO etkisi çıkarılmamalı.

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
- 1.7.0’da araştırma taslağını fark önizlemesiyle ilan hazırlık alanına yeni sürüm olarak kopyalama vardır. İlk araştırma dayanağı sabit kalır; sonraki gözlem ve seçimler geçmiş sürümü veya yayın sonrası yerel başlangıcı değiştirmemeli. Daha ileri örneklem kapsamı ve gerçek Etsy metniyle karşılaştırma ayrı değerlendirme gerektirir.

Önceki 1.6.0 teslimi kullanıcı yetkilendirmesiyle GitHub’a yayımlandı. 1.7.0’ın test, temiz ZIP ve dağıtım sonucu son doğrulama kaydında tutulur; doğrudan GitHub ZIP bağlantısı teslim mesajında verilir. Uygulama gerçek Etsy mağazasına veya Drive’a otomatik yazma yapmaz.
