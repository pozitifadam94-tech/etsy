# STL Atölyesi — 1.6.0

GoatDesgnShop için ücretsiz, kişisel ve Türkçe çalışma alanı. Amaç Etsy Stats’ı yeniden göstermekten öte **ürün seçmeden önce elemek, değişikliklerin sonucunu takip etmek ve STL dosyasını incelemek**. Ücretli AI API, n8n, harici npm paketi veya abonelik gerekmez.

**Gerçek teslim yöntemi:** müşteri Etsy'den TXT indirir; TXT'deki bağlantıyı açarak Google Drive **klasörüne** gider ve STL dosyalarını oradan indirir. Etsy ilan URL'si yönetim adresidir, teslim bağlantısı değildir. STL sıkıştırma/ZIP paketleme ana teslim yöntemi değildir.

## 1.6.0 ile günlük kullanım

- **Teslim ve hazırlık:** Etsy ürününü seçip Drive klasörünü bir kez bağla. İstersen mevcut TXT'leri toplu seç; bağlantı/ilan önerisini kontrol et. Birden fazla link veya belirsiz ad eşleşmesi otomatik kabul edilmez. Kaynak TXT değişmez.
- **Teslim TXT'si:** İngilizce şablonu önizle/düzenle, sürüm olarak kaydet ve indir; sonra Etsy'ye kendin yükle. Eski sürümü incele ve yeni sürüm olarak geri al. Uygulama yerel TXT'yi Etsy'ye yüklenmiş gibi göstermez.
- **İlan taslakları:** başlık/açıklama/etiket bulguları, düzenlenebilir taslak, fark ve geri alma. Seçili ürünlere TXT → Drive teslim açıklaması toplu hazırlanabilir. Yerel taslak Etsy'ye gönderilmez.
- **Günlük kontrol:** mağaza eşitlemesi, en fazla üç zamanı gelmiş klasör kontrolü ve yerel hazırlık birlikte değerlendirilir. Kısmi hata diğer işleri durdurmaz. En fazla üç öncelikli iş gösterilir; erteleme/inceleme aynı kaynak değişmedikçe tekrarı önler. İptal, başlamış uzak okumayı her durumda durduramaz.
- **Ürüne bağlı müşteri yardımcısı:** TXT/link/izin/eksik dosya/ZIP/ölçek için düzenlenebilir İngilizce şablon; mesaj gönderilmez. Yalnız ürün–sorun–tarih kaydı saklanır. ChatGPT bağlamı varsayılan olarak gerçek Drive linklerini ve ham müşteri mesajını dışarıda bırakır. AI JSON yalnız desteklenen alanlarla yerel taslağa alınır.
- **Bağlantı olmadan:** yerel hazırlık ürünü ekleyip Drive/TXT akışını kullanabilirsin. Google OAuth zorunlu değildir; Drive hesabının arşivi taranmaz/indirilmez. Yerel model kontrolü isteğe bağlıdır.

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

Tam yedek araştırma, notlar, dosya kontrol özetleri, mağaza geçmişi, pazar gözlemleri ve okunmuş sonuçları içerir. Önceki düz araştırma yedekleri desteklenir. Geçersiz yedek mevcut veriyi değiştirmez; başarılı geri yükleme öncesinde mevcut durum ayrıca yedeklenir. Etsy anahtarları/tokens tam yedeğe girmez. Dosya depo sınırı 32 MB; aşılırsa kaydetme hatası açıkça gösterilir. Bozuk yerel depo sessizce sıfırlanmaz: kaydetme durur, Ayarlar’dan geçerli yedek geri yüklenebilir; özgün bozuk dosya `recovery` klasöründe korunur.

Etsy anahtarları, OAuth tokenları ve güncel snapshot ayrı `connection.json` içinde kalır; pazar kaydının asıl deposu `workspace.json` olmuştur; şifreli değildir ve paylaşılmamalıdır. ZIP değişimi bu dosyaları değiştirmez. Statik GitHub Pages önizlemesi yerel API/depo içermez; orada eski tarayıcı depolaması kullanılır. STL yerel dosya görüntüleme statik arayüzde de çalışabilir.

## Doğrulama ve sonraki değerlendirme

`npm test` geçmiş, karar, otomatik sonuç, pazar, STL ve gerçek HTTP depo akışını doğrular. Ayrıca Chromium’da kayıt taşıma/koruma, sonuç okuma, dosya Worker/görüntüleme/aynı içerik, müşteri konu önerisi, statik önizleme ve 320–1440 piksel kullanım akışları kontrol edilir. Windows COM kısayolu bu Linux ortamında çalıştırılamaz.

Genel ürün değerlendirmesi, ulaşılabilen/engellenen araştırma kaynakları ve kalan eksikler [REVIEW.md](REVIEW.md) içinde. Yeni özellik sayısı başarı ölçüsü değildir; hedef daha az tekrar kayıt ve daha sağlam ürün kararlarıdır.
