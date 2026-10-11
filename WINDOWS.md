## 1.6.0 — Drive üzerinden TXT teslimi ve günlük hazırlık

Güncel açılış yönergesi **RUN_LATEST.md** içindedir. Eski sunucu penceresini kapat, `STL-Atolyesi-1.6.0.zip` dosyasını yeni bir klasöre çıkar ve `windows-start.cmd` aç. Node.js 20+ dışında yeni çalışma bağımlılığı veya ücretli hizmet yok. Bu oturumda temiz ZIP açılışı ve tarayıcı akışları Linux'ta doğrulandı; Windows `.cmd` çalıştırması denenmedi.

Mevcut kayıtlar ve Etsy bağlantısı aynı Windows kullanıcısının `%LOCALAPPDATA%\STLNicheLab` klasöründe korunur; bu klasörü silme. Eski tarayıcı verisinin mağazası bilinmiyorsa ayrı eski kayıt olarak saklanır. Yalnızca sana ait olduğunu doğruladığın kaydı bağlı mağazaya bir kez ata; başka mağazaya otomatik taşınmaz. Her bilgisayar kendi mağazasına ait ayrı yerel depo kullanır.

**Teslim ve hazırlık**: Etsy ürününe Drive klasörünü bir kez bağla veya mevcut TXT'leri seçip ilan/klasör eşleştirmesini doğrula. Ürüne özel TXT'yi önizle, sürüm olarak sakla ve indir. TXT'yi Etsy'ye yüklemeyi sen yaparsın. Etsy ilan URL'si teslim bağlantısı değildir. Google OAuth bu akış için zorunlu değil.

**İlan taslakları**: Teslim paragrafı, başlık/açıklama/etiket hazırlığı, önce/sonra ve yerel geri alma. **Bugün → Günlük kontrol**: Salt okunur Etsy eşitlemesi, sınırlı oturumsuz klasör kontrolü ve ilk üç gerekçeli iş. Gerçek ilan, Drive paylaşımı veya müşteri mesajı kendiliğinden değiştirilmez.

Klasör sayfasının açılması dosya indirme/içerik/geometri kanıtı değildir. Gerçek yerel STL önizlemesi ve PNG isteğe bağlıdır; bütün arşiv indirilmez. Satış günü arşivi şimdilik UTC, arayüz zaman damgaları İstanbul saatidir. Tam doğrulama/sınırlar **UPGRADE_STATUS.md**, açık işler **NEXT_STEPS.md** içindedir.

---

## 1.5.0 — Önceki sürümün kurulum kaydı

Önce eski uygulamadan JSON yedek indir. Eski sunucu penceresini kapat, yeni ZIP’i ayrı klasöre çıkar ve `windows-start.cmd` dosyasını çalıştır. İlk açılışı eski kayıtlarının bulunduğu **aynı tarayıcıda, http://localhost:3000 adresinde** yap. Eski tarayıcı kayıtları ortak yerel depoya otomatik taşınır. İlk açılışı başka tarayıcıda yaptıysan eski tarayıcıdan da bir kez aç; farklı eski kayıtlar mevcut depoyu ezmeden otomatik yedek olarak korunur. Ayarlar’dan yedek seçebilirsin.

Bağlantı anahtarları Windows kullanıcı klasöründe kaldığı için yeniden girilmez. Araştırma JSON yedeğinde anahtar yoktur. Yeni sürüm tam çalışma alanı yedeği üretir; önceki düz JSON yedeklerini de yükler. Ortak kayıtlar, geçmiş ve son 30 otomatik yedek `%LOCALAPPDATA%\STLNicheLab` klasöründe bulunur. Tarayıcıyı temizlemek ortak yerel kayıtları silmez. İlk taşımadan **önce** tarayıcı verisini temizleme.

Bir kez `windows-shortcut.cmd` çalıştırarak masaüstü kısayolu oluşturabilirsin. Kısayol sunucu penceresini küçültülmüş açar; pencereyi kapatırsan takip durur. Aynı 1.5.0 sürümü zaten açıksa ikinci sunucu başlatılmaz. Daha eski pencere açıksa önce kapat. Node.js 20+ gereksinimi sürer; otomatik yükleyici veya dosya değiştiren otomatik güncelleyici eklenmedi.

- **Ürünler → Otomatik sonuçlar:** Düzenlemeler form doldurmadan izlenir; gözlem günü hariç 14 tam gün sonra sonuç değerlendirilir.
- **Ürünler → Mağaza hafızası:** Artık aktif listede bulunmayan ürünler ve toplanmış eski günler korunur.
- **Ürünler → STL dosyasını kontrol et:** Dosyayı sürükle; döndür, boyutlarını gör, temel geometri uyarılarını incele. En fazla 25 MB / 300.000 üçgen. Büyük dosyalarda topoloji kontrolü yapılmaz; birim ve baskı başarısı bilinmez. Dosya yerelde çalışır, yüklenmez.
- **Pazar gözlemi:** Başlığında STL olan dijital örnekleri, mağaza dağılımını ve fiyat aralığını incele. Talep veya arama hacmi ölçümü değildir.
- **Ayarlar → Otomatik yedekten geri yükle:** Mevcut durum önce ayrıca yedeklenir. Aynı anda açık sekmeler eski kayıtla üzerine yazamaz; çakışmada sekme kopyasını indirip yenile.

Müşteri mesajlarına otomatik erişim yok. Konu önerisi anahtar kelimelerle çalışır, çeviri yapmaz. Masaüstü bildirimini istersen Ayarlar’dan açabilirsin: yalnızca uygulama açıkken, kaydettiğin takip tarihleri için çalışır; Star Seller cevap süresini ölçmez.

---

Aşağıdaki önceki sürüm notları tarihsel kurulum ayrıntılarıdır. Güncel kullanım için yukarıdaki 1.6.0 bölümü ve RUN_LATEST.md geçerlidir.

# Windows'ta baslatma

1. https://nodejs.org/ adresinden Node.js LTS Windows kurulumunu yap. Ek ucretli arac veya npm paketi gerekmez.
2. GitHub deposunda Code > Download ZIP sec; ZIP dosyasini klasore cikart. Dosyalari ZIP icinden calistirma.
3. Cikartilan klasordeki `windows-start.cmd` dosyasina cift tikla. Panel sunucu hazir olduktan sonra varsayilan tarayicida acilir.
4. Siyah pencereyi kullanim boyunca acik tut. Kapatmak sunucuyu durdurur. Bilgisayar kapaliyken otomasyon calismaz.

Windows komut dosyasi yalnizca kendi bilgisayarindan erisilebilen localhost adresini kullanir. Etsy API baglantisi icin asagidaki Canli Etsy baglantisi adimlarini tamamla. Anahtar, secret veya token dosyalara/GitHub'a eklenmemelidir.

## Mevcut verilerini tasi

GitHub Pages panelinde Yedek indir dugmesini kullan. Yerel panelde Yedek yukle ile dosyayi sec. Iki adres farkli tarayici depolama alanlaridir; veriler kendiliginden tasinmaz. Ayni tarayiciyi ve portu kullan, duzenli yedek al. Musteri mesajlari yedege dahil edilmez.

## Sorun giderme

- Node.js bulunamadi: LTS kurulumu tamamlandiktan sonra baslaticiyi yeniden ac.
- Port kullaniliyor: acik olan diger panelin siyah penceresini kapat. Tanımadigin surecleri kapatma.
- Tarayici acilmadi: baslaticinin yazdigi yerel adresi tarayiciya yaz.
- Guncelleme: once yedek indir, GitHub'dan yeni ZIP indirip ayri klasore cikart. Eski klasordeki yerel dosyalari silmeden koru.

Bir sonraki asama: Etsy'nin destekledigi API kapsamlarini ve OAuth callback gereksinimini dogrulayip, onaylanan uygulamayi bu yerel sunucuya baglamak. Windows kurulumu veya canli Etsy erisimi mevcut Linux gelistirme ortaminda dogrulanmis sayilmaz.

## Canli Etsy baglantisi

1. Eski paneldeki arastirma verilerini JSON olarak yedekle. Siyah pencereyi kapat.
2. Guncel proje ZIP'ini ayri klasore cikart, windows-start.cmd ile ac.
3. Etsy uygulama ayarlarinda Redirect/Callback URI olarak `http://localhost:3000/oauth/callback` kaydet. Bu localhost adresinin kabul edildigi kullanici tarafindan dogrulandi.
4. Yerel panelde Canli magaza takibi > Ilk baglanti bolumunde Keystring ve Shared secret degerlerini gir. Bunlari sohbete veya GitHub'a gonderme.
5. Yerel baglantiyi kaydet > Etsy hesabimi bagla. Acilan Etsy ekraninda kendi magazana salt okunur erisim ver.
6. Etsy donusunden sonra son basarili kayit ve magaza adi gorunmeli. Yeni aktif ilanlar ilk baslatmada ve 30 dakikada bir yenilenir; Simdi guncelle de kullanilabilir.

Anahtarlar ve OAuth tokenlari `%LOCALAPPDATA%\STLNicheLab\connection.json` dosyasinda tutulur; JSON arastirma yedegine dahil degildir. Dosya sifreli degildir; baska kisilerle paylasma. Proje guncellemeleri bu dosyayi degistirmez. Kayitlar da bu dosyadadir; baglanti resetlenirse eski snapshot silinir.

Takip aktif ilanlari, son 90 gunun odenmis ve iptal edilmemis siparis satirlarini kapsar. 30/60/90 gunler kayan zaman araliklaridir; manuel deney bolumundeki ilk 30/60/90 gunlerle ayni degildir. Satis satiri sayisi benzersiz siparis sayisi degildir. Urun bedeli iadeler/vergi/ucretler dusulmus net gelir degildir. Kullanici kisisel bilgileri saklanmaz; yalnizca urun ozetleri saklanir.

Goruntulenme ve donusum olcumu bu API baglantisinda yoktur. Bu nedenle canli bolum yeterli veri olmadan tut/kaldir puani vermez. Sifir satis otomatik kaldirma nedeni degildir. Manuel deney karnesi ayri kalir. Bir guncelleme basarisizsa eski basarili ozet korunur ve hata gorunur. Ilan gorunum tarihinden cok once acilmissa tum omur satislari alinmaz; yalnizca son 90 gun gosterilir.

OAuth ve gercek magaza baglantisi gelistirme ortaminda Etsy ag erisimi olmadigi icin dogrulanamadi. Ilk Windows baglantisi bu dogrulamanin zorunlu adimidir. Yalnizca yerel localhost paneli API'yi kullanabilir; GitHub Pages salt statik arastirma panelidir.

## Localhost surumune gecis

Once eski 127.0.0.1 panelinden Yedek indir. Yeni surum localhost adresini acar; farkli adres nedeniyle tarayici arastirma kayitlarini burada yeniden Yedek yukle ile aktar. Anahtarlari ilk defa gireceksen localhost panelini kullan. Daha once 127.0.0.1 callback ile anahtar kaydettiysen yeni formda yeniden kaydet ve Etsy yetkilendirmesini tekrarla. Gercek token alimi ve ilk senkronizasyon henuz dogrulanmadi.

## Magazam urun ekrani

Sol menudeki Magazam > Urunlerim, canli API snapshot'indaki aktif ilanlari gosterir. Kartlar fiyat, favori, ilan yasi, son 30/60/90 gun adetleri ve varsa gorsel icerir. Arama, satis var/yok/yeni filtreleri ve satis/yenilik/ad siralamasi kullanilabilir. Senkronizasyon sayaclari, 0 urun yanitini filtre sonucu bos listesinden ayirir. Yeni surumu ayri klasore indirip eski sunucuyu kapattiktan sonra baslat; LOCALAPPDATA altindaki baglanti dosyasi korundugu icin tekrar anahtar girmek gerekmez. Ilk guncellemeyi bekle veya Simdi guncelle kullan. Sifir urun gorursen sayaci ve magaza adini bildir; connection.json dosyasini gonderme.

## 1.1.0 sürümüne geçiş

Yedek indir, siyah pencereyi kapat, güncel ZIP'i ayrı klasöre çıkart ve windows-start.cmd ile aç. Şimdi güncelle yaparak günlük ürün bedellerini getir. Gelir ve gider ekranından tarih aralığını seçip manuel gider/iade ekleyebilirsin. Başlıktaki Yeni sürüm var mı düğmesi bundan sonra yeni yayımlanan sürümleri kontrol eder. İndirme/güncelleme otomatik değildir; panel açıkken dosyaların üzerine yazılmaz. API anahtarlarını tekrar girmen gerekmez. Araştırma ve defter kayıtların aynı localhost adresindeki aynı tarayıcıda korunur; JSON yedeğini ayrıca sakla.

## 1.2.0 rakip takibini dene

Güncel sürüme geçtikten sonra Rakip ve kelime takibi ekranında örneğin `ballerina stl` aramasını ekle. İlk başarılı gözlemde örneklenen ilan/fiyatlar görünmeli. Erişim hatası çıkarsa yalnızca hata metnini paylaş; anahtar dosyasını gönderme. Anahtarları tekrar girmek gerekmez. Bilgisayar kapalıyken gözlem yapılmaz. İkinci başarılı gözlem fiyat/örneklem değişimini oluşturur. Yenile düğmesine arka arkaya basmak bekleme sürelerini kaldırmaz.

## 1.3.0 paylaşım takibi

Yedek indir, siyah pencereyi kapat, güncel ZIP'i ayrı klasöre çıkart ve `windows-start.cmd` ile aç. Aynı tarayıcı ve localhost adresinde kayıtların korunur; Etsy anahtarlarını tekrar girmen gerekmez.

Paylaşım takibi ekranında ürün, kanal ve tarih seçip plan ekle. Plan tarihi geldiğinde Bugün ne yapmalıyım bölümünde görünür. Pinterest veya diğer platformda paylaşımı yaptıktan sonra Düzenle / sonucu ekle ile Paylaşıldı seç. Ölçümün varsa gerçek tıklama veya ziyaret sayısı, kaynağı ve ölçümün son tarihini ekle; bilmiyorsan sayıyı boş bırak. Paylaşım sonrası 7 tam günün satış verisi tamamlanınca önce/sonra adetler gösterilir. Trafik ölçümü ve platforma paylaşım manuel yapılır.

Rakip kartında Veri çekildi sayacını kontrol et. Dijital fiyat medyanı yoksa kart artık tür/fiyat eksikliğini açıklar; alınmış ilanlar Gözlenen ilanlar altında görülebilir.

## 1.4.0 sade çalışma alanı

Yedek indir, eski siyah pencereyi kapat, güncel ZIP'i ayrı klasöre çıkart ve `windows-start.cmd` ile aç. Etsy bağlantısını yeniden kurman gerekmez. Aynı tarayıcı ve localhost adresindeki kayıtların korunur; yedeğini ayrıca sakla.

Uygulama Bugün ekranıyla açılır. Ana menüde Bugün, Ürünler, Satışlar, Ürün grupları, Pazar gözlemi ve Ayarlar bulunur; bir seferde yalnızca seçtiğin bölüm görünür. Ürünler, grafikler ve öneriler Etsy senkronizasyonundan oluşur. Günlük kullanım için veri formu doldurman gerekmez. Mobil görünümde menüyü üstteki düğmeyle açabilirsin.

Ürün grupları başlık ve etiketlerden otomatik önerilir; önceki grup adların korunur. Pazar gözlemindeki hazır aramalardan birini seçerek yazı yazmadan takibe başlayabilirsin. Bunlar ürün gruplarından türetilen aramalardır; yüksek talep veya düşük rekabet kanıtı değildir.

Başlık, fiyat, açıklama, etiket, görsel ve ilan türü değişiklikleri yeni senkronizasyonlarda otomatik karşılaştırılır. Ürün detayında veya Ürünler > Değişiklik geçmişi bölümünde görünür. İlk veri başlangıç kaydıdır; henüz gözlenmemiş geçmiş düzenlemeler oluşturulmaz. Kaydedilen saat fark edilme saatidir, Etsy'deki tam düzenleme saati değildir. Son 100 gözlem proje dışında bağlantı dosyasında korunur.

Manuel niş notları, deneyler, müşteri işleri, paylaşım ölçümleri ve gider defteri Ayarlar > İsteğe bağlı araçlar alanına taşındı. Hiçbir eski kayıt silinmedi. Ürün detayındaki isteğe bağlı formlar kapalı başlar; ihtiyacın olursa açabilirsin. Bu alanları doldurmamak otomatik ürün takibini engellemez.
