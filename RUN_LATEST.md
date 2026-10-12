# STL Atölyesi 1.8.0 — açılış ve ilk Pinterest paylaşımı

Güncel kaynak sürümü **1.8.0**. Yeni bölüm **Pinterest**; önceki araştırma, teslim/hazırlık, günlük kontrol, STL ve Etsy bağlantısı korunur. Son doğrulama ve dağıtım durumu [UPGRADE_STATUS.md](UPGRADE_STATUS.md) içinde kaydedilir. Aşağıdaki 1.7.0 açılış/araştırma kaydı tarihsel olarak korunur.

ZIP adı `STL-Atolyesi-1.8.0.zip`; yerel hedef `/workspace/etsy/dist/STL-Atolyesi-1.8.0.zip`, açılmış uygulama `/workspace/etsy/dist/latest`. Teslim dalı `codex/stl-1.8.0-pinterest-sharing`; doğrulanmış doğrudan GitHub indirme bağlantısı son teslim mesajında verilir. 1.7.0 son sağlam paket korunur; `main` birleştirilmez. ZIP hedefi veya dal adı, tek başına test/yayım tamamlandı anlamına gelmez.

## Windows’ta aç

1. Çalışma alanı yedeğini indir; Pinterest kullanıldıysa ayrıca **Pinterest geçmişini indir** kullan. Eski sunucu penceresini kapat, ZIP'i yeni boş klasöre çıkar. Eski uygulamayı ve `%LOCALAPPDATA%\STLNicheLab` veri klasörünü koru.
2. `windows-start.cmd` dosyasına çift tıkla. Node.js 20+ gerekir; ek npm çalışma paketi veya ücretli hizmet gerekmez. Tarayıcı açılmazsa `http://localhost:3000` aç. Sunucu penceresi açık kalsın; yeni klasörde `windows-shortcut.cmd` ile kısayolu güncelle.
3. `/api/health` ve `/version.json` sürümü `1.8.0` göstermeli. Başka/eski sunucu açıksa önce onun penceresini kapat. Ayrıntı: [WINDOWS.md](WINDOWS.md).

## Bir kez Pinterest’i bağla

1. [Resmî uygulama panelinden](https://developers.pinterest.com/apps/) App ID/secret edin; uygulama kaydını, gerekli hesap türünü/işletme hesabı şartını ve Standard/canlı yayın onayını kontrol et. Güncel hesap/onay koşulları bu oturumda tam doğrulanmadı.
2. **Pinterest → Pinterest bağlantısı ve tek seferlik kurulum** aç. Uygulama paneli kabul ediyorsa callback `http://localhost:3000/oauth/pinterest/callback` kaydet. Kabul etmiyorsa sana ait kayıtlı HTTPS web sitesi adresini kullan ve OAuth dönüşündeki `code/state` içeren tam URL'yi **OAuth dönüşünü elle tamamla** alanına yapıştır. Adres eşleşmesi ve kod değişimi yerel sunucuda yapılır; ayrıntı [WINDOWS.md](WINDOWS.md). Ücretli tünel gerekmez.
3. App ID/secret'ı ve kayıtlı adresi yalnız yerel forma kaydet. **Pinterest hesabımı bağla** ile resmî OAuth'u tamamla; şifre veya çerez girilmez. Hesap kimliğini kontrol et, **Panoları getir → Bu panoyu seç** ile mevcut panoyu seç. Herkese açık tanıtım için `PUBLIC` seç; `PROTECTED` korumalı, `SECRET` gizlidir. Uygulama pano oluşturmaz; gizli kapsamlar varsayılan olarak istenmez.
4. Pinterest panelinde Standard/canlı onayı gördüysen bunu işaretleyip **Erişim beyanını kaydet**. Etiket **kullanıcı beyanı; API üzerinden doğrulanmadı** kalır ve hesaba bağlıdır. Erişim bilinmiyorsa, Trial ise, izinler eksikse veya API sayısal hesap kimliği döndürmezse gerçek paylaşım engellenir. Bağlı kullanıcı adı veya açık pano bunu aşmaz.

## İlk gerçek paylaşımı başlat

1. Gerçek yayın görünümünde bağlantı ve pano hazırsa **Pinterest** ekranını açınca grup kendiliğinden önizleme için hazırlanır; bu işlem pin yayımlamaz. İstersen **Grubu hazırla / Etsy’yi güncelle** düğmesiyle yeniden hazırla. En eski paylaşılmamış aktif ürünlerden kalan günlük kapasite kadar seçilir; uygun ürün yoksa durur. Önizlemede gerçek kaynak görseli, Etsy başlığı/bağlantısı, pano ve rank bilgisi görünür.
2. Görselleri kontrol et: tam bir `rank === 1` kaydı seçilir; o görselin mümkünse `url_fullxfull` kaynağı kullanılır. Eksik/belirsiz rank 1 veya alınamayan görselde başka görsele geçilmez. **Bu kuralın kaynağı 2021 tarihli Etsy şemasıdır; güncel resmî ilk görsel sırası doğrulanmadı.** JPEG/PNG özgün byte'ları kırpılmadan/düzenlenmeden gönderilir. 8 MiB/12 saniye yerel korumadır.
3. **Bugünün 3 ürününü Pinterest’te paylaş** düğmesine bas; sayı kalan kapasiteye göre 2 veya 1 olur. Bu düğme görünen grubu gönderme talimatıdır; ayrı ürün onayı gerekmez. Sonuçları geçmişten ve başarılı pin bağlantılarından kontrol et. Açılışta veya saat geldiğinde otomatik yayın yoktur.

**Dış paylaşım yapmadan dene** ayrı dry-run grubudur: Pinterest'e pin oluşturma isteği göndermez, gerçek başarıya karışmaz. Trial/Sandbox da gerçek herkese açık başarı değildir. Bu geliştirme oturumunda gerçek pin yayımlanmadı; canlı OAuth, token yenileme, görsel kabulü ve görünürlük denenmedi. Kaynak/kanıt sınırı: [PINTEREST_SOURCES.md](PINTEREST_SOURCES.md).

Gün **Europe/Istanbul**: en fazla üç gerçek başarı + belirsiz rezervasyon; uygulama yeniden açılınca sıfırlanmaz. Başlık, görsel veya pano değişmesi aynı **mağaza + listing_id + Pinterest hesabı** ürününü yeniden paylaşılabilir yapmaz. Önceki manuel pinler otomatik bilinmez; hariç tut veya **önceden paylaşıldı** kaydını ekle. Hesap değişince o hesabın geçmişi kullanılır, eski hazır grup yeni hedefe gönderilmez.

Belirsiz iş otomatik tekrar gönderilmez ve çözülene kadar kapasite tutar. Pinterest'i kontrol edip sonucu/pin URL'sini geçmişten kaydet; yalnız aynı Etsy URL'sini bulmak kesin kanıt değildir. Kısmi başarılar korunur; kimlik/izin/pano/429 hatasında yeni gönderimler durur. **Yeni gönderimleri durdur** başlamış isteği veya pini geri almaz. Tam bir kez yayımlama garantisi yoktur.

## Kayıt ve yedek

`%LOCALAPPDATA%\STLNicheLab\pinterest-sharing.json` ayrı kuyruk/geçmiş, `.backup` önceki yerel kopyadır. **Pinterest geçmişini indir** ayrı dışa aktarım sağlar; olağan çalışma alanı JSON yedeği bunu içermez. Veri klasörünü ve geçmişi koru. `pinterest-connection.json` App secret/tokenları tutar, şifreli değildir; dosyayı veya tüm veri klasörünü paylaşma. Gizli dosyalar dışa aktarım/ZIP'e girmez. **Yerel bağlantıyı kaldır** Pinterest'teki erişimi iptal etmez; hesap ayarlarından da kaldır. Statik GitHub Pages'de canlı paylaşım yoktur.

---

# Tarihsel 1.7.0 — açılış ve ilk araştırma

Güncel uygulama kaynak sürümü **1.7.0**. Yeni özellik **Araştırmadan İlan Hazırla**; önceki teslim, hazırlık, günlük kontrol ve STL araçları korunur. Son test, temiz ZIP kontrolü ve dağıtım sonucu [UPGRADE_STATUS.md](UPGRADE_STATUS.md) içinde kaydedilir; eski 1.6.0 sonuçları orada tarihsel olarak ayrılmıştır.

Dağıtım ZIP adı: `STL-Atolyesi-1.7.0.zip`. Doğrudan GitHub ZIP indirme bağlantısı teslim mesajında verilir.

Yerel paket hedefi: `/workspace/etsy/dist/STL-Atolyesi-1.7.0.zip`; açılmış uygulama: `/workspace/etsy/dist/latest`.

## Windows’ta aç

1. Eski panelin sunucu penceresini kapat. Önce yedeğini al, ZIP’i yeni ve boş bir klasöre çıkar. Eski uygulama ve `%LOCALAPPDATA%\STLNicheLab` veri klasörünü silme.
2. Çıkardığın klasörde `windows-start.cmd` dosyasına çift tıkla. Node.js 20 veya üzeri gerekir; ek npm paketi veya ücretli hizmet gerekmez.
3. Tarayıcı açılmazsa `http://localhost:3000` adresini aç. Sunucu penceresi açık kalsın. Yeni klasörde masaüstü kısayolu istersen `windows-shortcut.cmd` çalıştır.

Açıldıktan sonra `/api/health` ve `/version.json` sürümü `1.7.0` göstermeli. Eski sürüm açıksa başlatıcı onu kapatmanı ister; aynı sürüm ikinci kez açıldığında ikinci sunucu oluşturmaz. Ayrıntılı Windows yönergesi: [WINDOWS.md](WINDOWS.md).

## Tek ürünle ilk araştırma

**Araştırmadan ilan → Yeni yerel ürün** ile Etsy ilan kimliği olmadan başla. Mevcut Etsy ürünü için aynı bölümde ürünü seçip **Araştırmayı aç**, ya da ürün kartındaki **Araştırmadan İlan Hazırla** düğmesini kullan.

1. **Ürün bilgisi:** kısa İngilizce konu/görünüm, tek model/set, bilinen sayı, içerik ve formatı kaydet. Teknik bilgileri gerçekten doğruladıysan işaretle. Görseller yalnız önizlemedir; OCR veya otomatik ürün tanıma yapılmaz.
2. **Kelimeler:** ürün bilgilerinden aday oluştur; gerekli kendi ifadeni ekle. Kaynaklar ürün bilgisi, rakip örneği, kullanıcı aktarımı Marketplace Insights ve kullanıcı eklemesi olarak ayrılır.
3. **Veri aktarımı:** ifadeyi kopyalayıp Etsy’de kendin araştır. Metin/tabloyu yapıştır, **Önizleme hazırla** ile incele ve **Bu değerleri doğruladım · araştırmaya kaydet** düğmesini kullan. Düzen çözülemiyorsa **Sade giriş tablosu** aç. Boş = bilinmiyor, `0` = gerçek sıfır, `<10` = eşik altı. Dönem ve kapsam yalnız ekranda bildiriliyorsa girilir; tekrar aynı veri çoğalmaz. Önceki araştırmayı yeniden kullanmak eski tarihini korur.
4. **Karşılaştır ve seç:** uygunluk ve alıcı niyetini kontrol et; ana/destekleyici/alternatif/elenen ifadeler için Türkçe gerekçe yaz. İsteğe bağlı ilk 100 ilan örneği arama hacmi veya rakip satışları değildir.
5. **İlan taslağı:** **Yerel taslak hazırla ve sürüm kaydet** düğmesini kullan. Başlık, en fazla iki alternatif, etiketler, İngilizce açıklama, gerekçe ve eksikleri incele. Yeterli uygun etiket yoksa 13’e tamamlamak için ilgisiz kelime eklenmez. Veri olmadan taslak hazırlanabilir; arama verisiyle doğrulanmadığı açıkça gösterilir.
6. **Kaydet ve kullan:** düzenlemeyi yeni sürüm kaydet, alanları kopyala veya ilan/araştırma JSON’unu indir. Her sürümün ilk ürün/araştırma dayanağı korunur. Hazırlık alanına kopyalamada önce metin farkını kontrol et. Etsy’de yayımlamayı kendin yaparsın.

Yenileyip **Kayıtlı çalışma → Kaldığım yerden devam et** ile kayıtları yeniden aç. Yayımlanmış ilanı bağlamak istersen altıncı adımda bağlı mağazanın canlı ilanını seç. Bu başlangıç, kayıtlı **yerel taslaktır**; aynı metnin Etsy’de yayımlandığı doğrulanmaz. Trafik/arama terimleri erişilebilir değilse bilinmiyor kalır; satış değişimi tek başına SEO etkisi sayılmaz.

## İsteğe bağlı ChatGPT

Beşinci adımda **Aktarım metnini hazırla → Metni kopyala** ile bağlamı kendi ChatGPT oturumuna taşı. Yanıtı **AI yanıtı JSON** alanına yapıştır, **Alanları kontrol et ve önizle** düğmesiyle incele, sonra incelenen yerel sürümü kaydet. Uygulama AI servisine bağlanmaz. Bozuk JSON mevcut araştırmayı değiştirmez; yeni AI kelimeleri araştırılmış sayılmaz, desteklenmeyen iddialar manuel incelemeye işaretlenir. Gerçek Drive teslim bağlantısı aktarım metnine/rapora eklenmez.

## Teslim ve mevcut veriler

Müşteri Etsy’den **TXT** indirir → TXT’deki Google Drive **klasör** bağlantısını açar/yapıştırır → STL dosyalarını klasörden indirir. Gerçek link yalnız teslim TXT’sindedir. **Teslim ve hazırlık** bölümünde doğru Drive klasörünü ürünle bir kez bağlayıp TXT’yi önizle, sürüm kaydet ve indir. Etsy’ye TXT yüklemesi manueldir.

Kayıtlar aynı Windows kullanıcısında `%LOCALAPPDATA%\STLNicheLab` altında kalır. ZIP kullanıcı verisi veya anahtar içermez. Başka bilgisayar ayrı depo kullanır; kendi Etsy hesabını resmî yetkilendirmeyle bağlamalısın. Etsy bağlantısı olmadan oluşmuş eski kayıtlar yeni mağazaya otomatik atanmaz; Ayarlar’daki açık atama yedek ve özgün kopyayı korur.

## Doğrulama sınırı

Son doğrulama [UPGRADE_STATUS.md](UPGRADE_STATUS.md) içinde kaydedilir. Windows `.cmd`, gerçek Etsy hesabı, eski gerçek kurulum ve geçerli canlı müşteri Drive klasörü bu ortamda denenmedi. Drive sayfası kontrolü dosya indirmesini veya STL geometrisini kanıtlamaz. Güncel Marketplace Insights kota/dönemi, otomatik API erişimi, taxonomy ve resmî alan sınırları doğrulanmadı; güncel Etsy belge istekleri `CONNECT 403` aldı. Kategori kimliği tahmin edilmez; 140/13/20 yerel taslak kontrolleridir. Satış gün arşivi UTC, arayüz zaman damgaları İstanbul saatidir. Kaynak kaydı: [RESEARCH_SOURCES.md](RESEARCH_SOURCES.md); açık işler: [NEXT_STEPS.md](NEXT_STEPS.md).
