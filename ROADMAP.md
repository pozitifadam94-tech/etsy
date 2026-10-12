# Mağaza çalışma alanı yol haritası

## Teslim yöntemi ve planın durumu — 10 Ekim 2026

Kullanıcının doğruladığı gerçek teslim akışı: **ürün → Google Drive bağlantısı/klasörü → ürüne özel teslim TXT'si → Etsy ilanı**. STL dosyaları Drive'da tutulur; müşteri Etsy'den TXT indirip içindeki bağlantıdan modellere ulaşır. Büyük dosyalar nedeniyle STL'yi doğrudan Etsy'ye yükleme, sıkıştırma ve ZIP paketleme ana teslim yöntemi değildir; öncelikli geliştirme kapsamından çıkarılmıştır. Uygulamanın kendi güncelleme ZIP'i bu karardan bağımsızdır.

Aşağıdaki kapsam teslim yöntemi düzeltmesinde oluşturulan plandır. **1.6.0 uygulama durumu UPGRADE_STATUS.md içindedir:** yerel bağlantı/TXT/sürüm akışı uygulanmıştır; anonim klasör sayfası kontrolü sınırlıdır. Drive OAuth, klasör API listesi ve Etsy'deki teslim TXT'lerini otomatik alma henüz yoktur. Etsy'nin `download` ilan türü yalnızca dijital ilanı gösterir; doğrudan STL yüklenmiş olduğunu veya teslimin doğru olduğunu kanıtlamaz.

### 1. Önce veri güvenilirliği

- Yerel geçmişi, araştırmayı, teslim kayıtlarını ve yedekleri Etsy mağaza kimliğine göre ayır. Aynı kurulumda hesap değiştirme veya başka mağazanın yedeğini geri yükleme mevcut geçmişi karıştırmamalı. Önceki incelemede temsili verilerle doğrulanan geçmişin sıfırlanması sorunu ilk önceliktir.
- Bağlantı ayarlarının değişmesinde mevcut hesabı ve kayıtları koruyan açık geçiş; yedekte mağaza kimliği doğrulaması; iki dosyaya yayılan geri yüklemede tutarlılık ve başarısız işlem sonucu ele alınmalı.
- Eksik, eski ve başarısız veri alımını sıfır satıştan ayırmayı sürdür. Büyük geçmiş, API istek sayısı, bozuk bağlantı dosyası ve gerçek Windows kullanımı için anlamlı kontroller yap.
- Bu düzeltmeler doğrulanmadan teslim akışı veya ikinci mağaza desteği tamamlanmış sayılmamalı. Kullanıcıya otomatik silme/kaldırma önerisini kesin karar gibi sunma.

### 2. Teslim kaydı ve ürüne özel TXT

- Etsy'den otomatik gelen ilan kimliğini ürünün sabit bağı olarak kullan. Drive bağlantısı ilk kez kullanıcı tarafından seçilir/girilir; sonraki sürümlerde aynı bilgiyi tekrar yazdırma. Mevcut Etsy alanlarından veya izinli dosya erişiminden çıkarılabilecek eşleşmeler ayrıca doğrulansın; yalnızca başlık benzerliğine dayanarak otomatik eşleştirme yapma.
- Teslim kaydı: mağaza/ilan kimliği, bağlı Drive kaynak kimliği ve bağlantısı, beklenen teslim içeriği, TXT sürümü ve ilgili kontrol kayıtları. Bir üründe birden çok kaynak veya birkaç ilanın bilinçli kullandığı ortak klasör desteklenebilmeli.
- Onaylı bağlantılardan ürüne özel UTF-8 TXT önizlemesi ve indirme üret. Ürün adı, açık dijital teslim açıklaması, bağlantı ve kısa erişim yönergesi yer alsın. TXT indirmek, Etsy'ye yüklenmiş olduğunu göstermez; ilk aşamada yükleme kullanıcı tarafından Etsy'de yapılır.
- Sürümler değiştirilmeyen kayıtlar olarak saklansın: oluşturulma zamanı, TXT içerik özeti/hash'i, kullanılan bağlantılar ve hangi ilan için hazırlandığı. Taslak, kullanıcı tarafından yüklendiği bildirilen ve Etsy üzerinden ayrıca doğrulanmış durumlar ayrı olsun. Eski sürüm silinmeden yeni sürüm oluşturulsun; eski sürüme dönüş yeni taslak oluşturabilir, Etsy dosyasını kendiliğinden değiştiremez.
- Eşleşmeyen ilan, eksik bağlantı, tanınmayan Drive adresi, aynı kaynak kimliğinin tekrar kullanılması ve eski sürüme ait bağlantı ayrı gösterilsin. Tekrarlanan bağlantı uyarıdır; paket/ortak kaynak kullanımı kullanıcı tarafından doğrulanabilir. Erişilebilir bir klasörün yanlış ürüne ait olması erişim testiyle anlaşılamaz.
- URL normalizasyonu kaynak kimliğini karşılaştırırken gerekli `resourcekey` gibi erişim parametrelerini korumalı. Teslim bağlantıları hassas kabul edilmeli; loglarda tam URL ve müşteri bilgisi tutulmamalı. Yerel yedeklerin teslim bağlantıları içerebileceği açıkça anlatılmalı.

### 3. Birbirinden bağımsız teslim kontrolleri

Her kontrol kendi zamanını, kullanılan yöntemini, incelenen kapsamı ve gerekçesini saklamalı. Genel yeşil işaretle yapılmamış kontrolü başarılı gösterme. Ortak durumlar: **kontrol edilmedi / doğrulandı / sorun bulundu / belirsiz / eski kontrol**. Kaynak veya TXT değişince ilgili eski sonuç güncelmiş gibi kullanılmamalı.

| Kontrol | Araştırılacak/doğrulanacak yöntem | Kanıtlamadığı şey |
|---|---|---|
| Müşteri erişimi | Google oturumu, çerez veya OAuth tokenı taşımayan ayrı istek/oturumla aynı teslim URL'sini açma; yönlendirme ve erişim isteği/giriş ekranını ayırma; seçilmiş örnek dosyada indirme erişimini sınırlı olarak doğrulama | Kullanıcının hesabıyla açılması, yalnızca HTTP 200 veya API'de görülen izin bilgisi müşterinin gerçekten indirebildiğini kanıtlamaz |
| Klasör içeriği | İzinli erişimle dosya listesini beklenen ürün içeriğiyle karşılaştırma; ad, tür, sayı, boyut, sürüm ve gerektiğinde seçilmiş dosyanın kimliği | Klasöre erişim doğru modelin bulunduğunu; dosya adı veya `.stl` uzantısı gerçek geometriyi kanıtlamaz |
| STL geometrisi | Kullanıcının seçtiği ve gerçekten erişilebilen dosyayı mevcut yerel parser ile inceleme; dosya kimliğini ve parser sınırlarını kaydetme | Dosya erişimi veya temel geometri kontrolü baskı başarısını, bütün klasörün doğruluğunu veya müşteriye erişimi kanıtlamaz |

- Anonim erişim testi önce yöntem prototipi ve temsili kaynaklarla doğrulanmalı; Google sayfası yapısına bağlı sonuç kesinmiş gibi sunulmamalı. Engelleme, kota, CAPTCHA ve tanınmayan yanıt “belirsiz” sonucudur. Herkese açık olmayan müşteri yetkisi de otomatik olarak bozuk bağlantı sayılmaz; mevcut akışın oturumsuz erişim gereksinimi ayrıca değerlendirilir.
- Klasörün açılması ile içindeki dosyanın indirilmesi ayrı kanıttır. Bir örnek dosya başarıyla alındıysa bütün dosyalar kontrol edildi denmez. Test zamanı ve kapsanan dosyalar gösterilsin; erişim sonradan değişebilir.
- Tarayıcının başka alan adındaki yanıtı okuyamaması (CORS) müşterinin erişemediği anlamına gelmez. Gerekirse yerel sunucu sadece izinli Google hedeflerine istek yapmalı; yönlendirmeler de doğrulanmalı, yerel/özel ağ adresleri reddedilmeli, süre ve veri boyutu sınırı olmalı. Genel URL indirme vekili oluşturulmasın.

### 4. Gerekiyorsa en az yetkili Drive bağlantısı

- Önce mevcut araçlarla ve oturumsuz testle neyin yapılabildiğini belirle. Drive API ancak klasör listesi, izin bilgisi veya seçilmiş dosyaya erişim gerçekten gerektiriyorsa eklensin. Google hesabı şifresi istenmez; resmî OAuth ve kullanıcı tarafından seçilmiş kaynaklar esas alınır.
- Dosyaları taşıma/silme, paylaşım izni değiştirme, klasör oluşturma veya bütün arşivi tarama işlemleri bu kapsamda yoktur. En dar izin ve kodda yalnızca okuma işlemleri hedeflenir. Seçilen izin teknik olarak yazmaya da elveriyorsa bunu gizleme ve uygulamada yazma yolu ekleme.
- `drive.file` seçilmiş kaynak erişimi, salt okunur metadata izinleri ve salt okunur içerik izinleri resmî belgelerle karşılaştırılmalı. Bir klasör seçmenin bütün alt dosyalara erişim sağlayacağı varsayılmamalı. Geniş hesap izni kolaylık için istenmemeli; hangi işin hangi izni gerektirdiği ve Google inceleme gereksinimleri doğrulanmadan izin kararı kesinleştirilmemeli.
- OAuth masaüstü dönüş adresi/PKCE, token saklama, izin iptali, kaynak anahtarları, kısayollar, miras alınan izinler ve varsa ortak Drive davranışı doğrulanmalı. Sahibin API üzerinden gördüğü paylaşım kaydı anonim müşteri erişim testinin yerine geçmez.
- Drive API güncel kota/ücret koşulları ve olası OAuth incelemesi resmî kaynaklardan doğrulanmalı. Yeni abonelik, ücretli API/aracı, ücretli barındırma veya n8n zorunluluğu eklenmez. Mevcut yerel kayıt/TXT işlevi entegrasyon olmadığı için çalışamaz duruma gelmemeli.

### 5. Seçilmiş dosyadan önizleme ve günlük kontrol

- STL görseli üretmek için dosyanın gerçek içeriğine erişim gerekir. Mevcut Etsy görseli, dosya adı veya Drive klasör kapağı STL'den üretilmiş önizleme olarak sunulmaz.
- Yalnızca kullanıcının seçtiği dosya, bilinen boyut ve açık indirme onayıyla işlenir. Bütün arşiv kendiliğinden indirilmez. Mevcut 25 MiB/300.000 üçgen sınırları korunur; büyük model için “desteklenmiyor/kontrol edilmedi” sonucu gösterilir. Drive'da teslim edilebilmesi yerel görüntüleyicide açılabileceği anlamına gelmez.
- Teslim altyapısı doğrulandıktan sonra günlük kontrol; mağaza eşitlemesi, eksik eşleşmeler, eski TXT sürümleri ve vadesi gelen seçilmiş erişim kontrollerini birleştirebilir. Ayrı kontrollerin sonuçları ve tamamlanmayan işler tek yerde görünmeli. İlanı/Drive izinlerini değiştirme ve müşteriye mesaj gönderme ilk kapsam değildir.

### Resmî kaynak araştırmasının sonucu

10 Ekim 2026'da kullanılabilir araç kataloğunda Google Drive hesabını okuyabilen bir bağlayıcı veya araç arama aracı bulunamadı. Hesaba bağlantı kurulmadı; şifre veya anahtar istenmedi. Google'ın aşağıdaki resmî adreslerine salt okunur erişim denendi; tamamı ağ geçidinde **HTTP CONNECT 403** ile engellendi. İçerikler okunamadığı için güncel fiyat/kota, izin kapsamı ve OAuth koşulları doğrulanmış değildir. Bu durum kullanıcının Drive hesabında sorun olduğunu göstermez.

- İzinler: https://developers.google.com/workspace/drive/api/guides/api-specific-auth
- Paylaşım: https://developers.google.com/workspace/drive/api/guides/manage-sharing
- Kota/koşullar: https://developers.google.com/workspace/drive/api/guides/limits
- Masaüstü OAuth: https://developers.google.com/identity/protocols/oauth2/native-app
- İzinleri okuma: https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions/list

Kabul kontrolleri geliştirme sırasında yapılmalı: sahibi açabiliyor ama oturumsuz müşteri açamıyor; klasör açılıyor ama örnek dosya inmiyor; erişilebilir yanlış klasör; bilinçli ortak bağlantı; eski TXT; kontrol edilmemiş geometri; kota/engellenmiş yanıt; büyük STL; mağaza değiştirme. Bunların hiçbiri bugün yapılmış canlı Drive testi olarak sunulmaz.

## 1.5.0 mevcut kapasite ve diğer sonraki işler

1.5.0 tek sürüm olarak günlük işi azaltmaya odaklanır. Ücretli AI/n8n gerektirmez, Etsy’ye yazmaz.

Tamamlananlar: ortak yerel kayıt deposu ve tarayıcıdan taşıma; günlük/geri yükleme öncesi yedek; kalıcı ürün/satış kapsamı ve aktif listeden çıkan ürün geçmişi; küçük örnekte temkinli karar durumları; otomatik düzenleme → 14 tam gün sonra sonuç karşılaştırması; yeni ürünlerin ilk yayın dönemleri; dijital STL pazar örneği elemesi ve yakın kullanım fikirleri; yerel STL görüntüleme/temel geometri kontrolü/aynı dosya tespiti; mesaj konu önerisi ve isteğe bağlı kayıtlı iş bildirimi; masaüstü kısayolu ve ikinci sunucu koruması.

Gerçek veri veya dış doğrulama gerektiren sonraki işler:

1. Kullanım sonrası ölç: hazır karşılaştırma kaç kez incelendi, kullanıcı hangi öneriyi uyguladı, tekrar kayıt azaldı mı? Zaman veya satış artışı tahmini uydurma; yalnızca gerçek geri bildirimle değerlendir.
2. Trafik erişimi doğrulanırsa görünmeme ile dönüşüm sorununu ayır. Erişilemiyorsa zorunlu manuel alan açma.
3. Biriken geçmişle grup bazlı sezon ve daha uzun dönem değerlendirmeleri. Eksik önceki yıl verisini üretme.
4. Gerçek ücret/iade verisi erişimi doğrulanırsa kapsamı belirtilmiş finans hesabı. Mevcut ürün bedelini net kâr sayma.
5. Mesaj/bildirim erişimini güncel Etsy belgeleri ve izinlerle ayrıca doğrula. Mevcut şablon/iş bildirimi Star Seller otomasyonu değildir.
6. Topluluk ve benzer araç araştırmasını ağ erişimi sağlandığında gerçek kaynaklarla tamamla. Kısıtlı ilan örneklemini talep veya kesin satış verisine dönüştürme.
7. Kolay yükleyici ve kullanıcı başlattığı doğrulanmış güncelleme paketi. Mevcut sürüm ZIP’le güncellenir; otomatik dosya değişimi yok.

İlan değiştirme/yayımlama/silme, sosyal paylaşım ve müşteri mesajı otomasyonu ayrı ileriki kapsamdır. Önce önizleme, kullanıcı onayı, geri alma ve denetim kaydı gerekir. Günlük girişin veya yapay etkinliğin tek başına Etsy sıralamasını artırdığı varsayılmaz.
