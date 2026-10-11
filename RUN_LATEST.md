# STL Atölyesi 1.6.0 — açılış yönergesi

Son doğrulanmış yerel paket **1.6.0**. ZIP temiz bir klasöre çıkarılıp sağlık ve tarayıcı akışlarıyla sınandı. Windows/canlı hesap doğrulaması ayrıca gerekli; ayrıntı `UPGRADE_STATUS.md` içinde.

Paket: `/workspace/etsy/dist/STL-Atolyesi-1.6.0.zip`

Açılmış uygulama: `/workspace/etsy/dist/latest`

## Windows’ta üç adım

1. Önce eski panelin sunucu penceresini kapat. ZIP’i indir ve yeni, boş bir klasöre çıkar. Eski uygulama ve veri klasörünü silme.
2. Çıkardığın klasörde `windows-start.cmd` dosyasına çift tıkla. Node.js 20 veya üzeri gerekir; zaten kuruluysa ek paket/ücretli hizmet gerekmiyor.
3. Açılan tarayıcıda **Bugün → Günlük kontrol** düğmesini kullan. Tarayıcı açılmazsa `http://localhost:3000` adresini aç. Sunucu penceresi açık kalsın.

Sunucu `1.6.0` sürümünü `/api/health` ve `/version.json` adreslerinden bildirir. Eski sürüm hâlâ açıksa başlatıcı onu kapatmanı ister; farklı sürümü sessizce açmaz. Aynı sürüm ikinci kez açılırsa ikinci sunucu oluşturmaz.

## Mevcut veriler ve bir defalık işler

Kayıtlar `%LOCALAPPDATA%\STLNicheLab` altında kalır; ZIP kullanıcı verisi veya anahtar içermez. Mevcut kurulumun aynı Windows kullanıcısıyla açılması verileri yeniden kullanır. Başka bilgisayara kopyalanan uygulama kendi boş deposunu kullanır; kendi Etsy hesabı resmî yetkilendirme düğmesinden bir kez bağlanmalıdır. Parola paylaşılmaz.

Eski kayıtların hangi mağazaya ait olduğu güvenilir biçimde bilinmiyorsa **Ayarlar** içinde ayrı saklandığı gösterilir. Yalnızca gerçekten sana ait olduğunu biliyorsan bağlı mağazaya atama düğmesini kullan. Bu işlem öncesi yedek alınır ve özgün kopya korunur.

Her ürün için doğru Drive klasörü bir kez bağlanmalı. Mevcut teslim TXT’lerin varsa **Teslim ve hazırlık → Mevcut TXT’leri toplu eşleştir** alanında dosyaları seç, ilan ve klasör önerilerini kendin doğrula. Google OAuth veya yeni ücretli hizmet şimdiki akış için gerekli değil.

## İlk beş dakika

**Teslim ve hazırlık** bölümünde bir Etsy ürününü aç; Drive **klasör** bağlantısını kaydet. **TXT önizlemesini hazırla → Sürüm olarak kaydet ve indir** ile gerçek teslim TXT’sini indir. Programı yenileyip ürünü yeniden aç: link ve TXT sürümü durmalı. **İlan taslakları** içinden teslim paragrafını ekle, önce/sonra farkını gör ve yerel taslağı kaydet. Sonra **Bugün → Günlük kontrol** ile öncelikli işlerini gör.

Etsy bağlı değilse **Yerel hazırlık ürünü ekle** ile aynı TXT akışını deneyebilirsin. Etsy’ye TXT yükleme, ilan düzenleme ve müşteri yanıtı gönderme işlemlerini kendin yaparsın.

## Doğrulama sınırı

Linux/Chromium ve izole verilerle test edildi. Windows başlatıcısı, gerçek Etsy/Drive hesapları ve eski gerçek kurulum bu oturumda denenmedi. Oturumsuz Drive kontrolü klasör sayfasıyla sınırlıdır; dosya indirmesini veya STL geometrisini kanıtlamaz. Satış gün arşivi şimdilik UTC; arayüz zaman damgaları İstanbul saatidir. Ayrıntılı açık işler `NEXT_STEPS.md` içinde.
