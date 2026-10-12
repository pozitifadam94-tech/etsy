# Sonraki doğrulamalar — 1.8.0

Pinterest akışı ve ilk kullanım [RUN_LATEST.md](RUN_LATEST.md), yerel test/paket/yayımın son sonucu [UPGRADE_STATUS.md](UPGRADE_STATUS.md) içindedir. Alttaki 1.7.0 araştırma ve önceki veri işleri tarihsel devam listesi olarak korunur; canlı Pinterest bağlantısını beklemek kuyruk/önizleme/tekrar önleme geliştirmesini durdurmaz.

## Kullanıcının ilk bağlantısında doğrulanacaklar

1. [Pinterest uygulama panelinde](https://developers.pinterest.com/apps/) uygulama kaydı, gereken hesap türü/işletme hesabı, OAuth dönüş adresinin kabulü ve Standard/canlı onay kontrol edilmeli. Güncel web belgeleri `CONNECT 403` aldığı için bunlar bu oturumda tam doğrulanmadı. Kayıtlı localhost kabul edilmezse kullanıcıya ait kayıtlı HTTPS adresi + elle tam dönüş URL'si yolu vardır; ücretli tünel gerekmez. App secret/tokenlar sohbet veya test dosyasında istenmez.
2. Gerçek OAuth hesabı, sayısal hesap kimliği, beş gerekli kapsam ve mevcut panonun gizliliği yerel panelde kontrol edilmeli. API sayısal kimlik vermezse gerçek gönderim engelli kalır. Standard onayı yalnız hesaba bağlı **kullanıcı beyanı; API üzerinden doğrulanmadı** etiketiyle kaydedilir; OAuth veya açık pano onay kanıtı sayılmaz.
3. Güncel Etsy görsel sıralama sözleşmesi erişilebilir resmî belgede yeniden doğrulanmalı. Şimdiki tam `rank === 1` seçimi 2021 resmî şemasına dayanır; güncel kesin ilk görsel iddiası yoktur. Gerçek mağazanın güncel rank-1 kaydı ve önizlemesi kullanıcı tarafından kontrol edilmeli; eksik/belirsiz görselde başka görsele geçilmemeli. Kaynak kaydı [PINTEREST_SOURCES.md](PINTEREST_SOURCES.md) içindedir.
4. Kullanıcı hazır grubu görüp günlük düğmeye bastığında ilk gerçek pinin doğru görsel/Etsy hedefi/pano ve görünürlüğü kontrol edilmeli. Canlı OAuth, token yenileme ve pin kabulü bu geliştirme oturumunda denenmedi. Trial/Sandbox/dry-run gerçek herkese açık başarı sayılmaz; dry-run hiçbir pin oluşturma isteği yapmaz.
5. Kullanıcının Windows bilgisayarında eski kayıtlarla ZIP güncellemesi, kuyruk yeniden açılışı ve ayrı **Pinterest geçmişini indir** dışa aktarımı kontrol edilmeli. Olağan workspace yedeği Pinterest kuyruğunu içermez; `%LOCALAPPDATA%\STLNicheLab` ve `pinterest-sharing.json.backup` korunmalı. Gizli `pinterest-connection.json` paylaşılmamalı. Yerel bağlantıyı kaldırma dışında Pinterest hesap ayarından yetki kaldırma da kullanıcı tarafından yapılır.

Belirsiz pin sonucunda kapasite tutulur ve otomatik ikinci POST yapılmaz; olası okuma eşleşmesi tek başına kesin kanıt değildir. Kullanıcı sonucu açıkça çözmeden yeniden gönderim olmaz. Her koşulda tam bir kez yayın veya üç paylaşımın Pinterest açısından güvenli hacim olduğu iddia edilmez. Günlük limit **Europe/Istanbul** için yerel politikadır; aşağıdaki eski **UTC satış takvimi** işi bundan ayrıdır.

## Bu sürümün dışında kalanlar

Tam otomatik günlük zamanlama, kendiliğinden yeniden paylaşım, yeni pano oluşturma ve bütün eski manuel pinlerin kesin içe alınması bu sürümün kapsamına eklenmedi. Ücretli servis, n8n, tarayıcı botu veya parola/çerez yöntemi gerekmez. İlk gerçek paylaşımın kısa yolu: bağlantı ve mevcut pano → onay beyanı → güncel grubu önizle → günlük düğme.

---

# Tarihsel devam listesi — 1.7.0

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
