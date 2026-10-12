# Pinterest paylaşımı — resmî kaynak ve doğrulama kaydı

Kontrol: **12 Ekim 2026, UTC**. Bu kayıt, ulaşılabilen resmî kaynakları ve
ulaşılamayan bilgileri ayırır. Gerçek kullanıcı tokenıyla Pinterest çağrısı,
gerçek mağaza verisiyle deneme veya herkese açık pin yayını yapılmadı.

## Kaynaklar ve erişim sonucu

| Kaynak | Tam adres | Sonuç |
|---|---|---|
| İstenen erişim katmanları belgesi | https://developers.pinterest.com/docs/key-concepts/access-tiers/ | Ağ geçidi `CONNECT 403`; gövde okunamadı |
| İstenen pano/pin oluşturma belgesi | https://developers.pinterest.com/docs/work-with-organic-content-and-users/create-boards-and-pins/ | Ağ geçidi `CONNECT 403`; gövde okunamadı |
| İstenen kimlik doğrulama belgesi | https://developers.pinterest.com/docs/getting-started/set-up-authentication-and-authorization/ | Ağ geçidi `CONNECT 403`; gövde okunamadı |
| Pinterest'in resmî OpenAPI JSON'u | https://raw.githubusercontent.com/pinterest/api-description/main/v5/openapi.json | `HTTP 200`; okundu; `info.version: 5.28.0` |
| Aynı resmî şema, YAML | https://raw.githubusercontent.com/pinterest/api-description/main/v5/openapi.yaml | `HTTP 200`; okundu |
| Şemanın sabit Git kaydı | https://github.com/pinterest/api-description/blob/51aca009f10a90283ccdf3956d509fc995ebac23/v5/openapi.json | Resmî depo Git üzerinden okundu; 4 Haziran 2026 kaydı |
| Resmî şema deposu açıklaması | https://github.com/pinterest/api-description/blob/51aca009f10a90283ccdf3956d509fc995ebac23/README.md | Okundu; şemanın Pinterest'in kendi API altyapısında kullanıldığı belirtiliyor |
| Resmî OAuth örnekleri | https://github.com/pinterest/api-quickstart/tree/592b4bacd85e5bb483bef2e2145aa841ae37ac5a | Git üzerinden okundu; son kayıt 12 Kasım 2024; güncel şema yerine geçirilmedi |
| Resmî quickstart README | https://raw.githubusercontent.com/pinterest/api-quickstart/main/README.md | `HTTP 200`; uygulama kaydı, App ID/secret ve kayıtlı redirect bağlantısı açıklanıyor |
| Sandbox belgesi | https://developers.pinterest.com/docs/developer-tools/sandbox/ | Ağ geçidi `CONNECT 403`; gövde okunamadı |
| Genel limit belgesi | https://developers.pinterest.com/docs/key-concepts/rate-limits/ | Ağ geçidi `CONNECT 403`; gövde okunamadı |
| Pinterest API Help | https://help.pinterest.com/en/business/article/pinterest-api | Ağ geçidi `CONNECT 403`; gövde okunamadı |
| Güncel Etsy API referansı | https://developers.etsy.com/documentation/reference#operation/getListingImages | Ağ geçidi `CONNECT 403`; gövde okunamadı |
| Etsy resmî README'nin işaret ettiği güncel şema | https://www.etsy.com/openapi/generated/oas/3.0.0.json | Ağ geçidi `CONNECT 403`; gövde okunamadı |
| Denenen ikinci Etsy şema adresi | https://openapi.etsy.com/v3/application/openapi.json | Ağ geçidi `CONNECT 403`; gövde okunamadı; güncel kanonik şema olduğu doğrulanmadı |
| Etsy resmî güncel README | https://raw.githubusercontent.com/etsy/open-api/main/README.md | `HTTP 200`; kanonik referans/şema bağlantıları okundu |
| Etsy resmî depo | https://github.com/etsy/open-api/tree/2ecce66e07627358a074d46188586f0283c9a6cf | Git üzerinden okundu; 29 Nisan 2026 kaydı; güncel ağaçta OpenAPI yok, belgeler developers.etsy.com'a taşınmış |
| Etsy'nin erişilen tarihsel şeması | https://raw.githubusercontent.com/etsy/open-api/6d6b1aa18f3b024e31d99083735eec7f2bf6b678/openapi.json | `HTTP 200`; **1 Haziran 2021** tarihli, alpha olarak tanımlanan geçmiş belge |

Pinterest JSON'un SHA-256 değeri:
`b698c180678a616bf1d635b374c086ba9cb2484117035c12f2b906eebe92a3e5`.
İndirilen `main` gövdesi ile yukarıdaki Git kaydındaki dosya aynıydı. Bu,
inceleme tarihinde yayımlanan şemanın kanıtıdır; gerçek uygulamanın erişim
onayını veya gerçek hesapta çalışan API çağrısını kanıtlamaz.

403 yanıtları bu ortamın ağ geçidindendir; sitelerin kaldırıldığı veya
kullanıcının uygulamasının reddedildiği anlamına gelmez. CAPTCHA, tarayıcı
botu, oturum çerezi, ücretli servis veya erişim engelini aşan yöntem kullanılmadı.

## Güncel Pinterest şemasında doğrulanan sözleşme

API ana adresi `https://api.pinterest.com/v5`. Kullanıcı yetkilendirmesi için
`https://www.pinterest.com/oauth/`, token değişimi için
`POST https://api.pinterest.com/v5/oauth/token` tanımlı. Token endpointi HTTP
Basic kimlik doğrulaması ve `application/x-www-form-urlencoded` gövde kullanır.
Şemanın `pinterest_oauth2.flows.authorizationCode.tokenUrl` alanı tam olarak
`https://api.pinterest.com/v5/oauth/token` adresidir; Sandbox içerik ortamı
seçilse de kod değişimi ve token yenileme bu sabit OAuth adresinde yapılır.
Resmî quickstart'ta Basic değerinin App ID ve App secret'tan üretildiği görülür.
Normal API işlemlerinde OAuth erişim tokenı Bearer olarak kullanılır.

| İşlem | Güncel şemanın listelediği OAuth kapsamları |
|---|---|
| `GET /user_account` | `user_accounts:read` |
| `GET /boards`, `GET /boards/{board_id}` | `boards:read` |
| `POST /pins` | `boards:read`, `boards:write`, `pins:read`, `pins:write` |
| `GET /pins`, `GET /pins/{pin_id}`, `GET /boards/{board_id}/pins` | `boards:read`, `pins:read` |

Bu özellik için güncel şemadan çıkan birleşik kapsamlar
`user_accounts:read,boards:read,boards:write,pins:read,pins:write`.
`boards:write` kapsamı, uygulamanın pano oluşturacağı anlamına gelmez; mevcut
şema pin oluşturma işleminde bu kapsamı da listeler. Reklam, katalog, faturalama
ve business-access kapsamları bu akış için gerekli değildir. Gizli pano/pin
erişimleri ayrı `boards:read_secret`, `boards:write_secret`, `pins:read_secret`,
`pins:write_secret` kapsamları olarak tanımlanır; varsayılan açık pano akışı
için bunlar kendiliğinden istenmemelidir.

Güncel OpenAPI yetkilendirme adresinin sorgu parametrelerini ayrıntılandırmaz.
Resmî 2024 quickstart örneği `consumer_id`, `redirect_uri`, `response_type=code`,
`refreshable=true`, virgülle ayrılmış `scope` ve rastgele `state` kullanır:
https://github.com/pinterest/api-quickstart/blob/592b4bacd85e5bb483bef2e2145aa841ae37ac5a/nodejs/src/user_auth.js
Bu eski örneğin sorgu isimleri güncel web belgesi doğrulanmış gibi sunulamaz.
Redirect bağlantısı uygulama panelinde kayıtlı olmalı; dönen `state` yalnızca
başlatılan OAuth işlemiyle eşleştiğinde kod değişimi yapılmalıdır.

### Token yenileme ve bağlantıyı kaldırma

Güncel `OauthAccessTokenCreate` şeması `grant_type=authorization_code` ve
`grant_type=refresh_token` değerlerini içerir. Kod değişiminde `code` ve
`redirect_uri`, yenilemede `refresh_token` alanı kullanılır. Dönen `expires_in`,
`refresh_token_expires_in` ve `refresh_token_expires_at` süre bilgileri esas
alınmalıdır; kalıcı sabit token ömrü varsayılmamalıdır.

Güncel `/oauth/token` açıklaması: **25 Eylül 2025'ten önce oluşturulan
uygulamalarda `continuous_refresh=true`**, 60 günlük geçerlilik penceresi olan
ve süresiz yenilenebilen continuous refresh token için gereklidir. Bu tarihte
veya sonra oluşturulan uygulamalar bu tür tokenı otomatik alır. Eski 365 günlük
legacy refresh token artık desteklenmez. Eski quickstart'taki `refresh_on`
parametresi güncel şemadaki `continuous_refresh` yerine kaynak kabul edilmez.
Her yenilemenin döndürdüğü yeni tokenlar güvenli saklamaya yazılmalıdır.

`POST /oauth/token/revoke` güncel şemada vardır, fakat açıklaması açıkça
**yalnızca system user tokenlarının şu an desteklendiğini** belirtir. Bu
endpointi sıradan kullanıcı OAuth tokenı için kullanıp "Pinterest'te yetki
iptal edildi" demek doğrulanmış değildir. Yerel bağlantıyı kaldırma yerel
tokenları siler; kullanıcı, Pinterest hesap ayarlarındaki uygulama erişimini
de kaldırmalıdır. Haricî iptal veya yenileme reddinde yeniden OAuth bağlantısı
gerekir. Bir `401/403` yanıtı erişim katmanını kanıtlamaz; token, scope, kaynak
yetkisi ve onay ayrı sebepler olabilir.

### Pano ve hesap bilgisi

`Account` şeması `id`, `username`, `account_type` ve profil bilgilerini içerir;
`account_type` değerleri `PINNER` ve `BUSINESS`. Bu bilgi okunabildiğinde bağlı
hesabın gerçek kimliği gösterilebilir. Şema, bu alanın varlığından hareketle
bütün uygulamalar için hangi hesap türünün zorunlu olduğunu açıklamaz.

`Board.privacy` değerleri `PUBLIC`, `PROTECTED`, `SECRET`. `GET /boards`
hesabın sahip olduğu ve katıldığı grup panolarını, tokenın kapsamının izin
verdiği ölçüde döndürür; panolarda sayfalama `bookmark` ile devam eder. Pano
gizliliği yoksa "doğrulanmadı", `SECRET` ise "gizli", `PROTECTED` ise
"korumalı" gösterilmelidir. Yalnızca `PUBLIC`, açık pano olduğunu kanıtlar;
bu bilgi uygulamanın Standard erişimini kanıtlamaz. Pano oluşturma bu
özelliğin parçası değildir.

### Gerçek görsel pinin medya ve metin alanları

`POST /pins` kullanıcının oluşturduğu yeni içerik yayımlama işlemi olarak
açıklanır. Kullanıcının kendi Etsy ürünü bu niyetle uyumludur; API başkasının
içeriğini yeniden kaydetme akışıyla karıştırılmamalıdır.

`PinMediaSource` iki ayrı tek-görsel yöntemi tanımlar:

- `{"source_type":"image_url","url":"https://…"}`: Pinterest uzak görseli alır.
- `{"source_type":"image_base64","content_type":"image/jpeg","data":"…"}`:
  uygulama indirdiği özgün görselin byte'larını Base64 olarak iletir.
  `data` saf Base64'tür; data-URL öneki içermez.

`ContentType` enum'u **`image/jpeg` ve `image/png`**. Görsel URL'si yolu için
şemada ayrıca MIME veya byte sınırı yazmıyor. İndirme öncesi ve sonrasında MIME,
byte sınırı, süre, yönlendirme ve uzak adres kontrolleri uygulama sorumluluğudur.
Özgün görseli indirip Base64 göndermek aynı byte'ları önizleme ve gönderimde
kullanmayı sağlar; Pinterest'in kendi depolama/görüntüleme işleminin byte'ları
değiştirmediği garantisi verilemez. `is_standard` medya alanı standart pin
biçimini seçer; **Standard API erişim katmanı değildir**.

| `PinCreate` alanı | Güncel şema sınırı |
|---|---|
| `title` | 100 karakter |
| `description` | 800 karakter |
| `alt_text` | 500 karakter |
| `link` | 2048 karakter |

Şemada bu tek-görsel işlemi için doğrulanmış MB sınırı veya zorunlu görüntü
oranı yok. Güncel web belgesi alınamadığından örneğin "Pinterest API'nin
20 MB sınırı" gibi bir rakam bu incelemede doğrulanmamıştır. Uygulamanın
seçeceği konservatif byte/timeout sınırı **yerel teknik sınır** olarak
belirtilmelidir. Kare veya yatay Etsy görselini önerilen Pinterest oranına
uydurmak için kırpma/yeniden üretim yapılmamalıdır.

### 429, yeniden deneme ve belirsiz sonuç

Şema `429` yanıtını "too many requests … being rate limited" olarak tanımlar.
Organik pin/board endpointleri için sayısal kota, `Retry-After` başlığı veya
reset başlığı sözleşmesi içermez. Dolayısıyla bir gün için 3 ürün uygulamanın
yerel politikasıdır; Pinterest kotası veya güvenli hacim garantisi değildir.
Gelen `Retry-After` değerini (saniye veya HTTP tarihi) dikkate almak genel HTTP
bekleme davranışıdır; Pinterest'e özgü güncel başlık garantisi olarak
sunulmamalıdır. Başlık yoksa konservatif gecikme/durdurma yerel uygulama
politikasıdır. 429'u peş peşe POST ile aşmaya çalışma yapılmamalıdır.

İncelenen güncel şemada **idempotency mekanizması/başlığı yok**. Bu gözlem,
belgelenmemiş hiçbir mekanizma olmadığı iddiası değildir; bu özellikte özel
bir `Idempotency-Key` icat etmek için dayanak bulunmamıştır. Pin oluşmuş
olabileceği için zaman aşımı, bağlantı kesilmesi veya sonucu yorumlanamayan
yanıt sonrası otomatik ikinci POST güvenli değildir.

İzin verilen uzlaştırma yolları `GET /pins/{pin_id}`, `GET /boards/{board_id}/pins`
ve `GET /pins`. Bunlarda `bookmark` sayfalaması, `page_size` için 1–250
(varsayılan 25) tanımlı. `GET /pins` için `domain` filtresi de tanımlı.
`PinRead/PinBase`, pinin `id`, `board_id`, `created_at`, `link`, `title`,
`description`, `media` ve `is_owner` bilgilerini içerir. Etsy `listing_id`
alanı veya yerel iş kimliği alanı yoktur.

Aynı Etsy bağlantısı/başlık tek başına, belirsiz isteğin o pini oluşturduğunu
kanıtlamaz; pin daha önce dışarıdan oluşturulmuş olabilir. Eksik veya birden
çok eşleşme kesin başarıya çevrilmemelidir. Kullanıcının belirttiği pin
bağlantısı okuma endpointiyle hesap/pano/Etsy hedefi açısından kontrol
edilebilir. Kesin sonuç alınamayan işler "kontrol gerekli" kalmalı ve günlük
kapasiteyi tutmalıdır. Hiç eşleşme bulunmaması da otomatik yeniden gönderim
izni değildir. Tam bir kez yayımlama garantisi verilmez.

## Erişim onayı, Trial/Sandbox ve canlı paylaşımın kanıt sınırı

Resmî quickstart, `https://developers.pinterest.com/apps/` panelindeki
"Connect app" ve "Manage" akışını, App ID/secret'ı, kayıtlı OAuth redirect'i
ve Trial erişimi başvurusunu gösterir. Güncel hesap türü şartı, Trial/Standard
onay kriterleri, Trial içerik görünürlüğü, allowed-user sayısı ve organik
çağrı kotaları, istenen güncel web belgelerine erişilemediği için **bu oturumda
tam olarak doğrulanamadı**. İşletme hesabı ve canlı organik yayın için gereken
uygulama onayı kullanıcı tarafından güncel uygulama panelinden kontrol
edilmelidir; 2024 quickstart'tan 2026 onay koşulu çıkarılmamalıdır.

Güncel şemada Sandbox'ın `https://api-sandbox.pinterest.com/v5` adresi olduğu
resmî endpoint açıklaması/örneği içinde görülür. Sandbox ayrı test ortamıdır.
Trial ise uygulamanın erişim türüdür; bunlar aynı kavram değildir. Test/dry-run,
Sandbox ve Trial kayıtları gerçek herkese açık başarı sayılmamalıdır.

Güncel `Account`, OAuth token ve Pin şemalarında `access_tier` veya uygulama
onay durumu alanı; bunu otomatik okuyan uygulama-onay endpointi bulunamadı.
Başarılı OAuth, hesap/pano okuma, `account_type=BUSINESS`, `privacy=PUBLIC`,
`Pin.is_standard=true` ve üretim API adresini kullanma, tek başına gerçek
herkese açık erişimin kanıtı değildir.

Kullanıcı uygulama panelinde Standard/canlı onayı gördüğünü bildirirse kaynak
etiketi **"kullanıcı beyanı; API üzerinden doğrulanmadı"** olmalıdır. Bu,
otomatik "doğrulandı" durumuna çevrilmemelidir. Beyan veya dış onay kanıtı
yokken durum **"erişim türü doğrulanmadı"** kalmalıdır. Bağlantı, pano seçimi,
ürün seçimi, önizleme, kalıcı kuyruk ve tekrar önleme bu engelden bağımsız
hazırlanabilir. Bu geliştirme oturumunda canlı erişim veya pin görünürlüğü
doğrulanmamıştır.

## Etsy ilk görsel sırası: tarihsel kanıt, güncel doğrulama eksikliği

Güncel Etsy belgeleri ve kanonik şema erişilemedi. Resmî güncel Git ağacında
şema olmadığı doğrulandı; Git geçmişindeki son erişilebilir `openapi.json`
**1 Haziran 2021** kaydıdır. Bu kaynak güncel şema diye sunulamaz.

Tarihsel `ListingImage.rank` açıklamasının tam metni:

> The positive non-zero numeric position in the images displayed in a listing,
> with rank 1 images appearing in the left-most position in a listing.

Bu tarihsel sözleşmeye göre birinci görsel **`rank === 1`** olan görseldir;
dizinin ilk elemanı veya mevcut dizideki en küçük rank değildir. `rank: 2`
ve `rank: 3` varken rank 1 yoksa başka görsele geçilmemelidir. Eksik, sıfır,
geçersiz veya aynı ilanda birden çok rank 1 bulunan veri ilk görseli kesin
belirlemek için yeterli değildir.

Aynı tarihsel kaynakta `listing_image_id` görsel kimliği, `url_fullxfull`
tam boy görsel URL'si; `url_570xN`, `url_170x135`, `url_75x75` küçültülmüş
görsellerdir. Tarihsel metin `url_fullxfull` için her boyutta 3000 piksele
kadar der; bu 2026 için güncel API kalite limiti olarak aktarılmamalıdır.
Mümkünse rank 1 kaydının `url_fullxfull` adresi kullanılmalı; farklı görsele
geçiş yapılmamalıdır. Görselin kimliği, seçilen kaynak URL ve sıra verisinin
kaynağı kayıt altında tutulmalıdır.

**Uygulama sınırı:** exact rank 1 seçimi tarihsel sözleşmeyle uygulanıp temsili
veriyle test edilebilir. Güncel Etsy sıralama sözleşmesi dışarıdan doğrulanana
kadar arayüz/belge bunu "güncel resmî sırası doğrulanmış gerçek ilk görsel"
olarak adlandıramaz. Sıra, kaynak ve veri güncelliği ayrı gösterilmelidir.
Kullanıcı doğrulaması kullanılırsa bu da açıkça kullanıcı beyanı olarak
kaydedilmelidir. Başka görsele sessiz geçiş, doğrulanamayan sıralamayı kesin
başarı gibi gösterme veya eski aktiflik bilgisiyle gönderim uygun değildir.

## Dış doğrulama ile yerel testin ayrımı

Bu dosyadaki güncel Pinterest alan/scope/endpoint bilgileri yayımlanmış resmî
şemadan okunmuştur. Kuyruk, günlük İstanbul sınırı, tek işlem kilidi, gizli
bilgi ayıklama, mock OAuth ve temsili API testleri uygulama doğrulamasıdır.
Gerçek hesabın uygulama onayı, gerçek token yenilemesi, gerçek Etsy ilan sırası,
canlı görsel kabulü ve herkese açık pin görünürlüğü bu oturumda denenmemiştir.
Kullanıcı ilk gerçek yayını uygulamadaki günlük paylaşım düğmesiyle başlatır.
