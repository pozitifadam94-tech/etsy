# STL Atölyesi — 1.8.0

**Pinterest paylaşımı**, uygulamanın geçmişinde daha önce paylaşılmamış en fazla üç aktif Etsy ürününü, seçtiğin mevcut Pinterest panosuna ayrı görsel pinler olarak gönderir. İşlem **Pinterest → Grubu hazırla / Etsy’yi güncelle** ile hazırlanır; önizlemeleri gördükten sonra **Bugünün 3 ürününü Pinterest’te paylaş** düğmesiyle başlar. Kalan kapasiteye göre düğme 2 veya 1 ürün gösterir. Açılışta, yenilemede veya saat geldiğinde kendiliğinden pin yayımlanmaz. Önceki araştırma, TXT → Drive teslimi, kayıtlar ve Etsy bağlantısı korunur; yeni ücretli hizmet, bot veya çalışma bağımlılığı eklenmez.

Güncel açılış ve ilk paylaşım adımları: [RUN_LATEST.md](RUN_LATEST.md). Windows kurulumu: [WINDOWS.md](WINDOWS.md). Aday sürümün test/paket/yayım sonucu: [UPGRADE_STATUS.md](UPGRADE_STATUS.md). **1.7.0 ve 1.6.0 test sayıları aşağıda tarihsel kayıttır; 1.8.0 doğrulaması sayılmaz.**

## Pinterest için tek seferlik kurulum

1. [Resmî uygulama panelinde](https://developers.pinterest.com/apps/) uygulamanı kaydet; App ID, App secret ve canlı yayın onayını edin. İşletme hesabı gereksinimini ve güncel hesap/onay şartlarını panelden kontrol et: bu oturumda güncel web belgeleri okunamadığı için hesap türü şartı kesin doğrulanmadı.
2. **Pinterest → Pinterest bağlantısı ve tek seferlik kurulum** alanına App ID/secret'ı yalnız yerel panelde gir. OAuth dönüş adresini uygulama kaydına birebir ekle. Panel kabul ediyorsa `http://localhost:3000/oauth/pinterest/callback` kullan; kabul etmiyorsa sana ait kayıtlı HTTPS web sitesi adresi ve **OAuth dönüşünü elle tamamla** yolunu kullan. Ücretli tünel gerekmez. Ayrıntı [WINDOWS.md](WINDOWS.md) içindedir.
3. **Pinterest hesabımı bağla** ile resmî OAuth iznini ver; şifre veya oturum çerezi girilmez. API'nin döndürdüğü hesabı kontrol et, **Panoları getir → Bu panoyu seç** ile erişilebilen mevcut panoyu seç. Uygulama pano oluşturmaz. Herkese açık tanıtım için `PUBLIC` pano seç; `PROTECTED` korumalıdır, `SECRET` gizlidir ve ayrı gizli kapsamlar gerektirir.
4. Uygulama panelinde Standard/canlı yayın onayını gerçekten gördüysen **Erişim beyanını kaydet**. Etiket **kullanıcı beyanı; API üzerinden doğrulanmadı** kalır ve bağlı hesaba aittir. Varsayılan **erişim türü doğrulanmadı** durumu, Trial veya eksik sayısal hesap kimliği gerçek gönderimi engeller. Başarılı OAuth, açık pano veya işletme hesabı tek başına Standard kanıtı değildir.
5. **Grubu hazırla / Etsy’yi güncelle** ile güncel aktif ilanları getir. Görseli, başlığı, Etsy hedefini ve panoyu incele; günlük paylaşım düğmesi o ekrandaki grubu gönderme talimatıdır. Her ürün için ek onay istenmez. **Dış paylaşım yapmadan dene** içindeki dry-run hiçbir pin oluşturma isteği göndermez; gerçek başarı sayılmaz.

Varsayılan OAuth kapsamları `user_accounts:read,boards:read,boards:write,pins:read,pins:write` ile sınırlıdır; güncel resmî şema pin oluşturmak için bu beş kapsamın birleşimini gerektirir. Gizli pano, reklam, katalog ve faturalama izinleri kendiliğinden istenmez. Yerel bağlantıyı kaldırmak yerel tokenları siler; Pinterest hesabındaki uygulama erişimini ayrıca hesap ayarlarından kaldırmalısın.

## Görsel, günlük sınır ve geçmiş

Yalnız **tam olarak bir açık `rank === 1` kaydı** seçilir; mümkünse o görselin `url_fullxfull` adresi kullanılır. Dizi sırası, en küçük rank veya ikinci görsel yedek seçim değildir. Eksik/belirsiz rank 1, alınamayan görsel veya artık aktif olmayan ilan engelli gösterilir. Rank 1 kuralının kanıtı Etsy'nin **2021 tarihli resmî şemasıdır; güncel resmî ilk görsel sırası doğrulanmadı**. Kaynak ve görsel kimliği önizleme/kayıtta gösterilir; bunu güncel doğrulanmış ilk görsel iddiası olarak okumamalısın. [PINTEREST_SOURCES.md](PINTEREST_SOURCES.md) kaynakları ve erişim engellerini kaydeder.

İndirilen JPEG/PNG'nin özgün byte'ları Base64 görsel medyası olarak iletilir; düzenleme, kırpma, yazı/logo veya yeniden üretim yapılmaz. 8 MiB ve 12 saniye, güvenli HTTPS/uzak adres/yönlendirme/MIME kontrolleriyle birlikte **yerel indirme korumalarıdır; Pinterest kotası değildir**. Pinterest'in kendi görüntüleme işlemi byte'ları koruma garantisi vermez. Başlık Etsy başlığından, kısa İngilizce açıklama doğrulanmış dijital STL bilgisinden gelir; bilinmeyen baskı/lisans iddiaları eklenmez. Pin hedefi `https://www.etsy.com/listing/<listing_id>` olur; Drive bağlantısı, teslim TXT'si, STL veya müşteri bilgisi pin içeriğine girmez.

**Europe/Istanbul gününde en fazla üç gerçek başarı** ve çözümlenmemiş belirsiz isteklerin kapasite rezervasyonu birlikte sayılır. Bu uygulamanın politikasıdır. Kalıcı kayıt ve tek işlem kilidi yeniden açılış, çift tıklama ve ikinci sekmede sınırı korur; geçmiş günlerden belirsiz işler de çözülene kadar kapasite tutar. Tekrar kimliği **mağaza + listing_id + Pinterest hesabı**dır; başlık/görsel/pano değişmesi aynı ürünü yeniden açmaz. En eski paylaşılmamış aktif ürünler önce seçilir; ürün kalmayınca liste başa sarmaz. Hariç tutma ve **önceden dışarıdan paylaşıldı** kaydı aynı bağlama aittir; uygulama eski manuel pinlerin tamamını otomatik bilmez.

Kısmi başarılar korunur. Kimlik, izin, pano veya 429 hatası yeni gönderimleri durdurur; ürün hatası ayrı gösterilir. Zaman aşımı veya yorumlanamayan gönderim sonucu **kontrol gerekli** olur ve otomatik tekrar POST edilmez. Okuma sonuçları olası eşleşmelerdir; aynı Etsy bağlantısı tek başına kesin başarı kanıtı değildir. Pinterest'i kontrol edip pin bağlantısı/sonucunu açıkça kaydet; yeniden deneme ayrı kullanıcı işlemidir. **Yeni gönderimleri durdur** başlamış isteği veya oluşmuş pini geri almaz. Her koşulda tam bir kez yayımlama garantisi yoktur.

## Pinterest kayıtlarını koru

Windows kullanıcı veri klasöründe `%LOCALAPPDATA%\STLNicheLab\pinterest-sharing.json` kuyruk/geçmişi, `pinterest-sharing.json.backup` önceki yerel kayıt kopyasını tutar. **Pinterest geçmişini indir** kimlik bilgisi içermeyen ayrı dışa aktarımdır. Olağan çalışma alanı JSON yedeği Pinterest kuyruğunu içermez; güncelleme öncesi ikisini de indir ve veri klasörünü silme. Bozuk Pinterest dosyası sessizce sıfırlanmaz; gönderim engellenir ve özgün dosya korunur.

`pinterest-connection.json` App secret ve tokenları ayrı tutar; şifreli değildir. Bu dosyayı, Etsy `connection.json` dosyasını veya tüm veri klasörünü sohbete/GitHub'a gönderme. Gizli dosyalar normal dışa aktarıma veya dağıtım ZIP'ine girmez. Statik GitHub Pages görünümünde yerel API/bağlantı ve canlı Pinterest paylaşımı yoktur.

Bu geliştirme oturumunda gerçek Pinterest hesabıyla OAuth, token yenileme, görsel kabulü veya herkese açık pin yayını denenmedi; gerçek pin oluşturulmadı. Yerel/temsili testler uygulama davranışını doğrular, kullanıcının canlı erişimini kanıtlamaz. İlk gerçek yayın yalnız sen yerel uygulamadaki günlük düğmeye bastığında başlar.

---

# Tarihsel sürüm kaydı — 1.7.0

GoatDesgnShop için ücretsiz, kişisel ve Türkçe çalışma alanı. **1.7.0**, ürünün gerçek bilgileri ve kaynakları ayrı tutulan araştırmadan İngilizce Etsy ilan taslağı hazırlama akışını ekler. Önceki ürün eleme, değişiklik/satış takibi, teslim hazırlığı ve STL kontrolü korunur. Ücretli AI API, n8n, harici npm paketi veya abonelik gerekmez.

**Gerçek teslim yöntemi:** müşteri Etsy'den TXT indirir; TXT'deki bağlantıyı açarak Google Drive **klasörüne** gider ve STL dosyalarını oradan indirir. Etsy ilan URL'si yönetim adresidir, teslim bağlantısı değildir. Gerçek Drive bağlantısı teslim TXT’sinde kalır; herkese açık ilan metnine, araştırma raporuna veya ChatGPT aktarımına eklenmez. STL sıkıştırma/ZIP paketleme ana teslim yöntemi değildir.

## Tek ürünle ilk araştırma

**Araştırmadan ilan** bölümünde mevcut ürününü seçip **Araştırmayı aç** düğmesine bas; ürün kartındaki **Araştırmadan İlan Hazırla** düğmesini de kullanabilirsin. Henüz Etsy ilanı yoksa **Yeni yerel ürün** ile başla. Kayıtlı çalışmayı **Kaldığım yerden devam et** ile yeniden aç.

1. **Ürün bilgisi:** İngilizce konu/görünüm, tek model veya set, bilinen model sayısı, içerik ve formatları kaydet. Teknik özellikleri yalnız gerçekten doğruladıysan işaretle. İsteğe bağlı görsel önizlemeleri saklanabilir; görsel tanıma/OCR yapılmaz, dosya adından baskı testi, destek, ölçek veya lisans çıkarılmaz.
2. **Kelimeler:** ürün bilgilerinden aday oluştur veya kendi ifadeni ekle. Ürün önerisi, rakip başlığında gözlenen ifade, kullanıcının aktardığı Marketplace Insights kanıtı ve kullanıcı eklemesi ayrı kaynaklardır; aday olmak arama hacmi kanıtı değildir.
3. **Veri aktarımı:** ifadeyi kopyala, resmî yardım/Shop Manager bağlantısından kendi Marketplace Insights ekranını aç. Başlıklı metin/tabloyu yapıştır veya **Sade giriş tablosu** kullan. **Önizleme** içindeki değerleri kontrol edip açıkça doğrulayarak kaydet. Boş alan bilinmiyor, `0` gerçek sıfır, `<10` eşik altıdır. Yalnız kaynağın bildirdiği dönem/bölge/dili yaz. Aynı veri tekrar aktarılırsa çoğalmaz; farklı dönemler ayrı kalır. Önceki aynı mağaza araştırmasını yeniden kullanmak eski tarihini korur.
4. **Karşılaştır ve seç:** ürün uygunluğu ve dijital/fiziksel alıcı niyetini incele; ana hedef, destekleyici, alternatif veya elenen ifadeyi Türkçe gerekçeyle kaydet. İsteğe bağlı API örneklemi, en fazla ilk 100 aktif ilanı yeni ilana göre sıralar; dijital STL/fiziksel/diğer dijital/bilinmeyen ayrımı düzeltilebilir, tekrar ilanlar ve mağaza yoğunlaşması gösterilir. Örneklem bütün pazar, müşteri sırası, arama hacmi veya rakip özel satışları değildir.
5. **İlan taslağı:** **Yerel taslak hazırla ve sürüm kaydet** ile İngilizce ana başlık, en fazla iki alternatif, uygun etiketler ve doğal açıklama oluştur. Yerel yöntem şablondur; AI üretimi gibi sunulmaz. 13 uygun etiket bulunamazsa eksik sayı gösterilir. Araştırma yoksa taslak açıkça **ürün bilgilerine dayalı, arama verisiyle doğrulanmamış** olarak etiketlenir. Gerekçe, eksik bilgi ve manuel inceleme uyarılarını kontrol et.
6. **Kaydet ve kullan:** düzenlemeyi yeni sürüm kaydet; başlık/etiket/açıklamayı kopyala veya ilan/araştırma JSON’unu indir. Her sürümün ürün bilgileri, seçimi, kaynakları ve araştırma tarihi ilk dayanağıyla korunur. Hazırlık alanına kopyalama önce fark önizlemesi açar. Metni Etsy’ye kendin uygularsın; kopyalama veya indirme yayımlama sayılmaz.

İsteğe bağlı **ChatGPT aktarımı**: aktarım metnini hazırla ve kendi ChatGPT oturumuna kopyala; yanıtın yalnız istenen JSON alanlarını içermesini iste. **AI yanıtı JSON → Alanları kontrol et ve önizle** adımından sonra incelenen sonucu yerel sürüm kaydet. Uygulama AI servisine bağlanmaz. Bozuk JSON araştırmayı değiştirmez; desteklenmeyen iddialar incelemeye işaretlenir. AI’nın yeni kelimeleri araştırılmış sayılmaz; istersen yalnız aday olarak açıkça eklersin. Görsel göndermek istersen ChatGPT’ye kendin ayrıca eklersin.

Yayımladıktan sonra **Yayımladığım Etsy ilanıyla ilişkilendir** alanında bağlı mağazanın canlı ilanını seçebilirsin. Saklanan başlangıç, yerel taslak ve onun araştırma dayanağıdır; Etsy’de aynı metnin yayımlandığı doğrulanmaz. Mevcut satış/değişiklik takibi gösterilebilir; trafik ve arama terimleri bilinmiyorsa açıkça belirtilir. Satış farkı tek başına SEO etkisi veya kelimenin başarısızlığı değildir.

## Araştırma verisinin sınırı

Marketplace Insights bu sürümde kullanıcı aktarımıyla çalışır; otomatik erişimi doğrulanmış bir API bağlantısı yoktur. 12 Ekim 2026’daki güncel Help/Handbook/API belge istekleri `CONNECT 403` ile engellendi; resmî GitHub README’si okunabildi. Ücretsiz kota, varsayılan veri dönemi, güncel taxonomy/özellikler ve resmî alan sınırları doğrulanmış sayılmaz. Şimdiki **140/13/20** kontrolleri yerel taslak korumasıdır; kategori kimliği tahmin edilmez, kategori/özellik önerisi yayın ekranında incelenir. SEO puanı, başarı olasılığı veya arama/ilan oranından satış garantisi üretilmez. Ayrıntılı kaynak kaydı: [RESEARCH_SOURCES.md](RESEARCH_SOURCES.md).

1.7.0’ın son test, temiz ZIP ve dağıtım sonuçları [UPGRADE_STATUS.md](UPGRADE_STATUS.md) içinde kaydedilir. Açılış: [RUN_LATEST.md](RUN_LATEST.md). Önceki 1.6.0 tesliminin tarihsel doğrulama kaydı aynı dosyada korunur.

## 1.6.0’dan korunan çalışma akışı

- **Teslim ve hazırlık:** Etsy ürününü seçip Drive klasörünü bir kez bağla. İstersen mevcut TXT'leri toplu seç; bağlantı/ilan önerisini kontrol et. Birden fazla link veya belirsiz ad eşleşmesi otomatik kabul edilmez. Kaynak TXT değişmez.
- **Teslim TXT'si:** İngilizce şablonu önizle/düzenle, sürüm olarak kaydet ve indir; sonra Etsy'ye kendin yükle. Eski sürümü incele ve yeni sürüm olarak geri al. Uygulama yerel TXT'yi Etsy'ye yüklenmiş gibi göstermez.
- **İlan taslakları:** başlık/açıklama/etiket bulguları, düzenlenebilir taslak, fark ve geri alma. Seçili ürünlere TXT → Drive teslim açıklaması toplu hazırlanabilir. Yerel taslak Etsy'ye gönderilmez.
- **Günlük kontrol:** mağaza eşitlemesi, en fazla üç zamanı gelmiş klasör kontrolü ve yerel hazırlık birlikte değerlendirilir. Kısmi hata diğer işleri durdurmaz. En fazla üç öncelikli iş gösterilir; erteleme/inceleme aynı kaynak değişmedikçe tekrarı önler. İptal, başlamış uzak okumayı her durumda durduramaz.
- **Ürüne bağlı müşteri yardımcısı:** TXT/link/izin/eksik dosya/ZIP/ölçek için düzenlenebilir İngilizce şablon; mesaj gönderilmez. Yalnız ürün–sorun–tarih kaydı saklanır. ChatGPT bağlamı varsayılan olarak gerçek Drive linklerini ve ham müşteri mesajını dışarıda bırakır. AI JSON yalnız desteklenen alanlarla yerel taslağa alınır.
- **Etsy hesabı bağlamadan:** yerel hazırlık ürünü ekleyip bilgileri, araştırmayı ve TXT taslağını saklayabilirsin. Drive sayfasını kontrol etmek ağ gerektirir. Google OAuth zorunlu değildir; Drive hesabının arşivi taranmaz/indirilmez. Yerel model kontrolü isteğe bağlıdır.

### Güncellemede kayıt güvenliği

Mağazalar `shop_id` ile ayrılır. Geç yanıt ve yanlış mağazaya yazma reddedilir. Mağazası bilinmeyen eski kayıt silinmez veya otomatik atanmaz; Ayarlar'da yalnız kullanıcı açıkça doğrularsa bağlı mağazaya birleştirilir. Özgün kopya ve işlem öncesi yedek korunur. Bozuk bağlantı dosyası paneli durdurmaz; yeniden ayarlama yalnız kullanıcı işlemidir. Pazar kayıtlarının asıl deposu workspace.json'dır; geri yüklemede iki ayrı dosyaya yazma gerekmez.

### Kontrollerin sınırı

Oturumsuz Drive kontrolü çerez veya sahibin tokenını kullanmadan, en fazla 512 KiB HTML ve 12 saniyelik istekle **klasör sayfasını** inceler. HTTP 200 tek başına başarı değildir; tanınmayan görünüm/kota/engellenmiş yanıt doğrulanamadı olarak gösterilebilir. Klasör sayfasının açılması dosyaların indirilebildiğini, doğru içeriği veya STL kalitesini kanıtlamaz. Paket içeriği beyanı ve yerel geometri ayrı sonuçlardır. Gerçek Drive/Windows doğrulaması yapılmadı. Güncel Google/Etsy OAuth, biçim ve kota koşullarına dış erişim engellendiğinden kesin güncel koşul iddiası yok; taslak sınırları yerel doğrulama kurallarıdır.

Zaman damgaları İstanbul saatinde gösterilir; eski satış günlerini yanlış dönüştürmemek için analiz takvimi açıkça **UTC tam günleri** olarak kalır. İstanbul satış günü geçişi tamamlanmış değildir. Sonradan iptal/değişen sipariş düzeltmeleri son 90 günlük oluşturulma penceresi içinde alınır. Brüt ürün bedeli ücret/iade sonrası net kâr değildir.

Son teslim ve doğrulama: [RUN_LATEST.md](RUN_LATEST.md), [UPGRADE_STATUS.md](UPGRADE_STATUS.md), açık işler: [NEXT_STEPS.md](NEXT_STEPS.md).

## Başlatma ve güncelleme

Windows adımları [WINDOWS.md](WINDOWS.md) içindedir. Node.js 20+ ile `windows-start.cmd` paneli açar. `windows-shortcut.cmd` masaüstü kısayolu oluşturur. Aynı sürümü tekrar açmak ikinci sunucu başlatmaz. Güncelleme hâlâ yedek + ZIP’i yeni klasöre çıkartma ile yapılır; program dosyaları otomatik değiştirilmez. Kısayol yeni klasörde tekrar oluşturulmalıdır.

```sh
cd /workspace/etsy
npm start
npm test
npm run build:pages
```

Sunucu varsayılan olarak yalnızca localhost:3000 dinler. API okuma/yazma istekleri yerel socket ve Host kontrolünden geçer; POST aynı Origin gerektirir. Bu bulut ortamında gerçek mağaza anahtarları kullanılmaz. Etsy verisiyle çalışan tarayıcı testleri temsili API yanıtları kullanır; gerçek HTTP ve dosya deposu ayrıca sınanır.

## Günlük akış

1. **Bugün:** Sıradaki ürün işi ve hazır otomatik karşılaştırmalar. “Uygulama senin için ne yaptı?” alanı fark edilen düzenlemeleri, okunmamış sonuçları ve geçmişi korunan ürünleri sayar; zaman kazancı veya satış artışı uydurmaz.
2. **Ürünler:** Otomatik Etsy ürünleri, kanıt gücü açıklanan karar durumları. Kaldırma/yayımlama/değiştirme yapılmaz. Otomatik sonuçlar, mağaza hafızası ve STL kontrolü buradan açılır.
3. **Satışlar:** Destekleyici haftalık özet ve 14 tam UTC gün grafiği. Aktif ürün örneklemi mağazanın tüm geçmişi sayılmaz.
4. **Ürün grupları:** Başlık/etiket kuralları ve varsa önceki kullanıcı atamaları. Aynı siparişte birlikte alınan modeller paket araştırmasına aday olabilir; satış garantisi yoktur.
5. **Pazar gözlemi:** Ürün seçmeden önce dijital STL uygunluğu, farklı mağaza sayısı, örneklem yoğunlaşması ve para birimine göre fiyat aralığı. Yakın kullanım alanları kural tabanlı araştırma fikirleridir; ölçülmüş talep değildir.
6. **Ayarlar:** Ortak kayıt durumu, yedekler, bağlantı, sürüm ve isteğe bağlı önceki araçlar. Ana günlük akışta manuel ölçüm girmek zorunlu değildir.

## Ürün kararları

Güncel satış verisi ve tamamlanmış günler kullanılır. “Deneme aşamasında”, “Satış sinyali var”, “Gerileme izleniyor”, “Karar verilemiyor” durumları ve gerekçeleri gösterilir. Düzenli sinyal için son 14 günde en az 5 adet ve 3 farklı satış günü gerekir. Güçlü olmayan iki satıştan bire düşüş günlük iş yaratmaz. Gerileme, üç ayrık 14 günlük dönemde yeterli örnek ve süren düşüş gerektirir. Bu eşikler istatistiksel güven aralığı veya Etsy standardı değildir; trafik, sezon ve giderler bilinmez. Satışsızlık tek başına kaldırma önerisi değildir.

Yeni ürünlerin ilk yayın sonrası 14/30/60/90 tam gün değerlendirmesi form doldurmadan oluşur. Eski ürünün ilk dönemi toplanmış veri kapsamı dışındaysa sonuç üretilmez. Günlük “İnceledim” ve erteleme eski kayıtlarla uyumludur.

## Mağaza hafızası ve otomatik sonuçlar

Her ürün eşitlemesinde başlık, açıklama, etiket, görsel kimlik/sıra, fiyat ve ilan türü farkları gözlenir. İlk gözlem, yeni ID, önceki bilinmeyen alan, etiket sırası ve eşdeğer fiyat böleni değişiklik sayılmaz. Gözlem zamanı tam düzenleme zamanı değildir.

Düzenleme otomatik izlenir: önceki gözlemin gününden önceki 14 tam gün ile yeni gözlemin **ertesi gününden** başlayan 14 tam gün karşılaştırılır. İki gözlem arası iki günden fazlaysa düzenleme zamanı yeterince bilinmez. Eksik günler, eski satış kaydı, küçük örnek veya çakışan değişiklikler ayrı belirtilir. En az üç uygun diğer aktif ürünün hareketi ayrıca gösterilir. Manuel değişiklik notları da çakışma kontrolüne girer. Önce/sonra farkı nedensellik kanıtlamaz. “Sonucu gördüm” günlük kartı kaldırır, geçmişi silmez. Ekran son 24 değerlendirmeyi gösterir; günlük sonuç listesi son 100 gözlemden türetilir. Daha eski gözlemler tam yedekte korunur.

Yerel geçmiş aktif listeden çıkan ürünleri ve makbuzlarda bulunan aktif olmayan ürün satışlarını korur. “Aktif listede yok” silinmiş anlamına gelmez. Son 90 günlük alınan günler her başarılı satış eşitlemesinde güncellenir, tekrar toplanmaz. Daha eski **toplanmış** günler kalır. En eski kısmi gün ve tamamlanmamış bugün tam gün kapsamına girmez. Satış aşaması başarısızsa önceki geçmiş ve kapsam korunur. Geçmişi hiç toplanmamış günler uydurulmaz; bir yıl veri birikmeden yıllık sezon analizi sunulmaz.

## STL dosya kontrolü

Dosyayı sürükleyerek ikili/ASCII STL aç, döndür ve boyutları gör. En fazla 25 MB / 300.000 üçgen. Web Worker dosyayı yerelde analiz eder; dosya sunucuya veya Etsy’ye gönderilmez. Önizleme en fazla 2.500 yüz örnekler, tüm geometri ölçülür. 100.000 üçgenden büyük modellerde kenar/topoloji analizi yapılmaz ve bunun bilinmediği gösterilir.

Temel açık kenar, ikiden fazla yüz birleşimi, tutarsız yüz yönü ve sıfıra yakın alanlı üçgen kontrolleri yapılır. STL birim içermez; mm/cm/inç seçimi kullanıcının yorumudur. Kendi kendini kesme, destek ihtiyacı, malzeme veya baskı başarısı doğrulanmaz. Dosya düzenlenmez. İsteğe bağlı kontrol özeti saklanır; ham dosya saklanmaz. Aynı dosya içeriği SHA-256 ile tekrar tanınır; farklı kodlanmış aynı geometrinin eşleştiği iddia edilmez. Dosya adından kullanıcı tıklamasıyla Etsy araması açılabilir; başlık dosya içeriğinden çıkarılmaz.

## Etsy bağlantısı ve sınırlar

Anahtarları yalnızca yerel formda gir; OAuth callback `http://localhost:3000/oauth/callback`. Kullanılan izinler `listings_r shops_r transactions_r`. Salt okunur bağlantı, başlangıçta ve sunucu açıkken 30 dakikada bir mağaza eşitlemesi. Bilgisayar/uygulama kapalıyken takip yoktur.

Son 90 günlük ödenmiş, iptal edilmemiş sipariş satırları alınır. Adet, ürün miktarıdır. Benzersiz sipariş ve işlem satırı ayrıca tutulur; eski kayıtta olmayan sayılar uydurulmaz. Ürün bedeli net kâr, Etsy bakiyesi veya ücret/iade sonrası gelir değildir. Görüntülenme, kaynak trafiği, reklam, iadeler ve Etsy ücretleri bu bağlantıda otomatik alınmaz. Para birimleri ayrı tutulur.

Pazar takipleri en fazla 10 mağaza/arama, her gözlem ilk 100 ilan ve son 30 başarılı pazar gözlemiyle sınırlıdır. Aramalar yeni ilana göre sıralanır; tüm pazarın temsilî örneklemi değildir. Sunucu açıkken altı saatlik yenileme, manuel en az 10 dakika, hata sonrası 1 saat/429 sonrası 6 saat bekleme sürer. Başlığında STL geçen `download` ilanlar ayrı incelenir. Dosya türünün gerçekten STL olduğu doğrulanmaz. Sonuç sayısı arama hacmi değildir; rakip özel satışlarına erişilmez. Yeni gözlenen ilan yeni yayımlanmış, örneklemden çıkan ilan kaldırılmış sayılmaz.

## Müşteri yardımcısı

İngilizce/Türkçe şablonlar mağazanın sınırlarını korur: fiziksel ürün/baskı hizmeti, özel tasarım/model değişikliği ve baskı garantisi sunulmaz. Yapıştırılan mesajda anahtar kelimelerden konu önerilir; belirsizlikte kullanıcı seçer. Yapay zekâ anlayışı veya otomatik çeviri yoktur. Karmaşık mesaj mevcut ChatGPT kullanımına profil ile kopyalanabilir. Mesaj metni kaydedilmez, yedeğe girmez, sunucuya gönderilmez. Kullanıcı isterse kişisel bilgileri çıkarır.

İsteğe bağlı masaüstü bildirimi yalnızca uygulama açıkken **elle kaydedilmiş** müşteri takip tarihleri içindir. Etsy gelen kutusu otomatik okunmaz; Star Seller cevap süresi hesaplanmaz, müşteriye mesaj gönderilmez. Gelen kutusuna doğrudan bağlantı vardır.

## Ortak depo, taşıma ve yedek

Yerel kayıtlar `%LOCALAPPDATA%\STLNicheLab\workspace.json` içinde; günlük ve geri yükleme öncesi yedekler `backups` klasöründedir. Son 30 yedek saklanır. Tarayıcı ilk açılışta eski kayıtları taşır; farklı eski kayıt varsa mevcut depoyu ezmeden ayrıca yedekler. İlk taşıma eski tarayıcı ve aynı localhost adresinde yapılmalı; sonrasında tarayıcı temizlense de ortak kayıtlar kalır. Birden fazla sekmede eski revizyonla kayıt üzerine yazılmaz; hata alan sekmenin kopyası dışa aktarılabilir.

Tam yedek ilan araştırmaları ve dayanaklı taslak sürümleri, notlar, dosya kontrol özetleri, mağaza geçmişi, pazar gözlemleri ve okunmuş sonuçları içerir. Önceki düz araştırma yedekleri desteklenir. Geçersiz yedek mevcut veriyi değiştirmez; başarılı geri yükleme öncesinde mevcut durum ayrıca yedeklenir. Etsy anahtarları/tokens tam yedeğe girmez. Dosya depo sınırı 32 MB; aşılırsa kaydetme hatası açıkça gösterilir. Bozuk yerel depo sessizce sıfırlanmaz: kaydetme durur, Ayarlar’dan geçerli yedek geri yüklenebilir; özgün bozuk dosya `recovery` klasöründe korunur.

Etsy anahtarları, OAuth tokenları ve güncel snapshot ayrı `connection.json` içinde kalır; pazar kaydının asıl deposu `workspace.json` olmuştur; şifreli değildir ve paylaşılmamalıdır. ZIP değişimi bu dosyaları değiştirmez. Statik GitHub Pages önizlemesi yerel API/depo içermez; orada eski tarayıcı depolaması kullanılır. STL yerel dosya görüntüleme statik arayüzde de çalışabilir.

## Doğrulama ve sonraki değerlendirme

`npm test` geçmiş, karar, otomatik sonuç, pazar, STL, ilan araştırması ve gerçek HTTP depo akışını doğrular. Kalıcı Chromium kontrolleri önceki teslim/STL akışları yanında yeni araştırma, manuel aktarım, AI önizlemesi, sürüm dayanağı ve yeniden açılışı kapsar. Son çalıştırmanın sonucu [UPGRADE_STATUS.md](UPGRADE_STATUS.md) içinde tutulur; test varlığı başarılı son çalıştırma yerine geçmez. Windows COM kısayolu bu Linux ortamında çalıştırılamaz.

Genel ürün değerlendirmesi, ulaşılabilen/engellenen araştırma kaynakları ve kalan eksikler [REVIEW.md](REVIEW.md) içinde. Yeni özellik sayısı başarı ölçüsü değildir; hedef daha az tekrar kayıt ve daha sağlam ürün kararlarıdır.
