# STL Atölyesi 1.7.0 — açılış ve ilk araştırma

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
