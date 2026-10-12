# STL Atölyesi — 1.7.0 geliştirme ve doğrulama kaydı

12 Ekim 2026. **Araştırmadan İlan Hazırla** mevcut 1.6.0 uygulamasına eklendi; önceki teslim, günlük kontrol, müşteri yardımcısı, mağaza/satış hafızası ve STL araçları korunur. Yeni ücretli API, abonelik veya AI bağlantısı eklenmedi. Araştırma ve metin hazırlama yerel kayıtlarla çalışır; Etsy’de yayımlama kullanıcıya aittir.

## 1.7.0 kapsamı

| Alan | Somut sonuç | Sınır |
| --- | --- | --- |
| Başlangıç | Mevcut ürün kartı veya Etsy ilan kimliği olmayan yeni yerel ürün; altı adım; kayıtlı çalışmaya devam | İngilizce ürün tanımı kullanıcıdan gelir. Görsel önizlemesi ürün tanıma/OCR veya baskı/lisans kanıtı değildir. |
| Kelime kaynakları | Ürün bilgisi, rakip başlığında gözlenen ifade, kullanıcı aktarımı Marketplace Insights, kullanıcı eklemesi ayrı; uygunluk, alıcı niyeti, seçim/elenme gerekçesi | Öneri gözlenmiş talep değildir; AI’nın yeni kelimeleri araştırılmış sayılmaz. SEO puanı veya satış olasılığı üretilmez. |
| Manuel gerçek veri | Metin/başlıklı tablo ve sade giriş tablosu; düzenlenebilir önizleme ve açık doğrulama; kaynak, alınma tarihi, dönem/kapsam; tekrar aktarım ayıklama, eski araştırmayı tarihiyle yeniden kullanma | Boş/bilinmiyor, gerçek `0`, `<10` eşiği ayrı. Kaynak/dönemler birleştirilmez; bölge/dil tahmin edilmez. Otomatik MI erişimi doğrulanmadı. |
| İlan örneklemi | Mevcut pazar API yolu ve eski pazar gözlemini kullanma; ilk en fazla 100 aktif ilan, yeni ilana göre sıralama; tekrar ilan ve mağaza ağırlığı; düzeltilebilir dijital STL/fiziksel/diğer/bilinmeyen sınıfı | Bütün pazar, müşteri sırası, arama hacmi, rakip özel satışları veya gerçek dosya türü kanıtı değil. |
| Yerel ilan taslağı | İngilizce başlık, en fazla iki alternatif, uygun benzersiz etiketler, açıklama, Türkçe gerekçe/eksik/uyarı; şablon düzenleme; yetersiz etiket sayısı açık | İlgisiz kelimeyle 13’e tamamlanmaz. Araştırmasız taslak açıkça etiketlidir. Güncel kategori/özellik kimliği doğrulanmadı. |
| ChatGPT aktarımı | Kullanıcının kopyaladığı ürün/araştırma/tarih/şema metni; geri yapıştırılan sıkı JSON önizlemesi; alan/tür/sınır/gizlilik/iddia kontrolleri | AI servisine bağlantı yok. Bozuk çıktı araştırmayı değiştirmez; metin ve desteklenmeyen iddialar kullanıcı incelemesi gerektirir. |
| Teslim ve sürüm | Açıklama Etsy TXT → Drive klasörü → STL yolunu anlatır; gerçek Drive URL’si ilan/prompt/rapordan çıkarılır; her taslak ilk ürün/araştırma dayanağını saklar; hazırlığa kopyalamada önce fark önizlemesi | Gerçek bağlantı teslim TXT’sinde kalır. Kopyalama/indirme yayımlama değildir; içerik/Drive/STL geometrisi ayrı kontrollerdir. |
| Yayın sonrası ilişki | Kullanıcı bağlı mağazanın canlı ilanını yerel başlangıç taslağı/hedefleri/araştırma tarihiyle ilişkilendirir; mevcut satış ve değişiklik geçmişi gösterilebilir | Başlangıç metninin Etsy’de aynı şekilde yayımlandığı doğrulanmaz. Trafik/arama terimleri bilinmiyor; satış değişimi tek başına SEO etkisi değildir. |
| Eski kayıt güvenliği | Mağazalar ayrı; Etsy bağlantısı olmadan oluşmuş eski araştırma/taslaklar açık atama sırasında yedek ve özgün kopyayla korunur | Yeni bağlı mağazaya otomatik atama yapılmaz; iki bilgisayar arasında ortak bulut depo yok. |

## 1.7.0 son doğrulama ve dağıtım

Bu bölüm 12 Ekim 2026 tarihli 1.7.0 doğrulamasıdır; aşağıdaki 1.6.0 tarihsel sonuçlarından ayrıdır.

- Tam otomatik test: `node --test` → **199/199 başarılı**; başarısız, atlanan veya iptal edilen test yok. Node.js 24.19.0, Linux ve izole geçici veri deposu kullanıldı.
- Kalıcı Chromium kontrolleri: `node scripts/verify-browser.cjs` ve `node scripts/verify-research-browser.cjs` geçti. Gerçek yerel sunucuda altı adım, yeniden açılış, gerçek JSON/TXT/PNG indirmeleri, önizleme, eksik/sıfır/eşik, dönem ve tekrar ayrımı, AI iddia/JSON, kaynaklı sürüm, hazırlığa kopyalama, aynı kimlikli iki mağaza ve geç yanıtla kaydedilmemiş metnin korunması kontrol edildi. Arayüz 320/390/768/1440 genişliklerinde sınandı ve ekranlar görsel olarak incelendi. Etsy/Drive yanıtları temsiliydi; dış istekler kapalıydı. Tarayıcı test araçları uygulama paketinin çalışma bağımlılığı değildir.
- Temiz `STL-Atolyesi-1.7.0.zip`: ZIP temiz bir `/tmp` klasörüne açıldı; **38 uygulama dosyası + SHA-256 manifest**, tüm dosya hashleri, kaynakla birebir eşleşme ve CRC/yol kontrolleri geçti. Paket sunucusu `1.7.0` sağlık yanıtını verdi; **her iki tam Chromium akışı açılmış paket dosyaları üzerinden de geçti**. Paket kişisel veri, anahtar, `.git`, test veya npm bağımlılığı içermez. Eski 1.6.0 ZIP ve önceki uygulama klasörü korundu.
- GitHub dağıtımı: kaynak ve `STL-Atolyesi-1.7.0.zip`, `codex/stl-1.7.0-research-listing` adlı ayrı teslim dalı için hazırlandı. Gönderim ve uzak ZIP’in SHA-256 kontrolünden sonra doğrudan indirme bağlantısı teslim mesajında verilir; `main` birleştirilmez veya gerçek mağazaya yazılmaz.

Windows `.cmd`, gerçek Etsy hesabıyla yeni örneklem, eski gerçek Windows kurulumu ve geçerli canlı müşteri Drive klasörü bu ortamda doğrulanmadı. Güncel Etsy Help/Handbook/API sayfaları `CONNECT 403` nedeniyle okunamadı; resmî GitHub README/deposu erişilebildi. Güncel MI kota/dönemi, otomatik erişim, taxonomy/özellikler ve resmî alan sınırları bilinmiyor. **140/13/20 geçici yerel korumadır.** Ayrıntılı kaynak kaydı [RESEARCH_SOURCES.md](RESEARCH_SOURCES.md), açık işler [NEXT_STEPS.md](NEXT_STEPS.md) içindedir.

Paket üreticisi `node scripts/package.js`; hedef `dist/STL-Atolyesi-1.7.0.zip` ve `dist/latest`. Kullanıcı verisi/anahtarları paket dışında kalır; eski paket aday doğrulaması bitmeden değiştirilmez.

## Tarihsel kayıt — 1.6.0

Önceki 1.6.0 teslimi kullanıcı yetkilendirmesiyle GitHub’a yayımlandı. Aşağıdaki **149/149**, tarayıcı ve ZIP sonuçları yalnız 11 Ekim 2026’daki 1.6.0 doğrulamasıdır; 1.7.0’ın güncel sonucu üstte ayrı tutulur.

11 Ekim 2026. Başlangıç 1.5.0 (`c5a9b7b`); değişiklikler tek 1.6.0 sürümünde toplandı. Önceki README/ROADMAP teslim yöntemi düzeltmeleri korundu. Gerçek hesap veya mağaza üzerinde yazma yapılmadı. Yeni ücretli hizmet, yapay zekâ API’si veya n8n bağımlılığı eklenmedi.

### 1.6.0 çalışan kapsam

| Alan | Somut sonuç | Sınır |
| --- | --- | --- |
| Mağaza ve veri güvenliği | Mağaza kimliğine göre ayrı yerel bölümler; geç API yanıtlarının reddi; eski sekme/geri alma koruması; sürümlü geçiş; atomik yazma; bozuk dosyayı koruyarak geri yükleme | İki bilgisayar arasında bulut ortak depo yok. Mağazası belirsiz eski kayıt otomatik atanmaz. |
| İstatistik kaynağı | Benzersiz sipariş, işlem satırı ve adet ayrıldı; para birimleri karıştırılmaz; eksik bedel bilinmiyor kalır; son deneme, başarılı ürün/satış kaydı ve hata ayrıldı; kota/bekleme bilgisi | Günlük satış arşivi **UTC**. İstanbul satış günü geçişi tamamlanmadı. Son 90 gün oluşturulma kapsamı, tam iade/net kâr muhasebesi değil. |
| Teslim hazırlığı | Mevcut Etsy ürünü yanında ayrı Drive klasörü; bağlantı/resource key korunması; çevrimdışı yerel hazırlık ürünü; ürün arama | Etsy ilan adresi teslim bağlantısı olamaz. Etsy’de TXT yüklemesi manuel. |
| Mevcut TXT ve sürümler | Birden çok TXT’yi seçme; ilan ve klasörü açık seçimle eşleştirme; öneri/kesin eşleşme ayrımı; kaynak metni koruma; SHA-256; önce/sonra; eski sürümü yeni sürüm olarak geri alma | Kaynak TXT/dosya değiştirilmez. Ortak klasör bilgi olarak gösterilir; aynı dosyanın kanıtı sayılmaz. |
| Drive erişim kontrolü | Google oturumu/çerez/token olmadan sınırlı klasör HTML kontrolü; izin, erişilemez, belirsiz ve kontrol edilmedi ayrı | Yalnızca klasör sayfası. Dosya indirme, içerik doğruluğu ve geometri sonuçları ayrıca gösterilir. Gerçek Drive hesabıyla doğrulanmadı. |
| İlan hazırlığı | Metindeki teslim çelişkileri, yer tutucular, doğrulanmış dosya sayısı ve kanıtsız iddialar için gerekçeli denetim; başlık/açıklama/etiket taslağı, fark ve geri alma; toplu teslim paragrafı | OCR/SEO başarı puanı yok. Şimdiki 140/13/20 sınırları güncel resmî kural diye sunulmaz. Etsy’ye yazılmaz. |
| Günlük kontrol | Tek düğmeyle Etsy okuma, en fazla üç vadesi gelen klasör kontrolü, açıklanabilir ilk üç iş; kaynak değişirse yeniden değerlendirme; inceleme/erteleme, iptal ve kısmi hata | Uygulama açıkken çalışır; günlük işlemleri gerçek mağazaya otomatik uygulamaz. |
| Müşteri ve ChatGPT yardımı | Teslim sorununa düzenlenebilir İngilizce şablon ve Türkçe açıklama; yalnızca ürün/konu/tarih/çözüm kaydı; beş görev için gizlilik kontrollü bağlam; sıkı AI JSON doğrulaması | Etsy mesaj kutusunu okumaz/göndermez. Genel otomatik çeviri yok. Ham müşteri metni varsayılan bağlama alınmaz ve sorun kaydında saklanmaz. |
| Değişiklik hafızası | Yeni gözlemlerde başlık/açıklama/etiket için eski ve yeni içerik; geçmiş ürünler korunur; mevcut karşılaştırma modülü sürer | Eski gözlemlerde saklanmamış metin uydurulmaz. Karşılaştırma nedensel satış etkisi veya trafik/dönüşüm kanıtı değil. |
| STL ve görsel | Kullanıcının seçtiği gerçek yerel STL’den ön/yan/çapraz görünüm, ışık/yakınlık, PNG ve bilgi görseli; ilerleme/iptal/boyut sınırı; hash ile seçilmiş ürün/model ilişkileri | En fazla 2.500 yüz önizlemesi; yüksek ayrıntılı satış renderı, baskı fotoğrafı, çok model kolajı veya Drive indirmesi değil. |

### 1.6.0 doğrulama

- Tam otomatik test çalıştırması: `npm test` → **149/149 başarılı**, başarısız/atlanmış test yok. İşletim sistemi Linux; Node.js 24.19.0.
- Testler: eski veri taşıma ve açık atama; iki mağaza ve geç yanıt; yedek/geri yükleme; kesilen yazma; bozuk bağlantı dosyası; kota/429; sipariş/satır/adet ayrımı; Drive güvenli yönlendirme ve muhafazakâr HTML sonuçları; TXT kaynak/link/hash/sürüm; ilan/AI/gizlilik; günlük iş seçimi; güvenli ZIP ve sunucu açılışı.
- İzole Chromium temel akışı: yerel ürün → Drive klasörü → gerçek TXT indirme → yeniden açılış; yanlış Etsy teslim URL’sinin reddi; belirsiz TXT seçimi; açıklama taslağı, gizli bağlantı çıkarma, bozuk AI çıktısı, günlük yerel kontrol; 320/390/768/1440 genişliklerinde taşma kontrolü geçti.
- Hazırlık arayüzü: taslak/fark/geri alma/toplu hazırlık; yalnızca sorun metadatası; aynı ilan kimliğine sahip iki mağaza; eski formun kaydı reddi ve kaydedilmemiş eski taslağın oturum kopyası geçti.
- STL Chromium kontrolü: gerçek worker ile dosya/hash/ölçü; ön/yan/çapraz görünüm ve ışık; 1200×1050 PNG ve 1200×1400 bilgi görseli; örnekleme uyarısı; büyük analiz iptali; 25 MiB sınırı; kayıt hatası ve değişen dosya/mağaza koruması geçti. Görseller görsel olarak da incelendi.
- Kalıcı tarayıcı kontrolü `node scripts/verify-browser.cjs` geçti: mevcut Etsy ürününe teslim ekleme, kısmi Drive hatasında diğer aşamaların tamamlanması, aynı mağazada değişen kayıttan sonra eski formun reddi, eşzamanlı sekme sonrası eski geri almanın iptali ve odaktaki şablonun mağaza değişince sıfırlanması. Bu geliştirme testi mevcut Playwright/Chromium’u kullanır; çalışma paketinin bağımlılığı değildir.
- Dağıtım ZIP’i temiz `/tmp` klasörüne açıldı. CRC/yol kontrolü ve manifestteki tüm dosyaların **SHA-256** değerleri geçti. Açılmış ZIP’in sunucusu `1.6.0` sağlık yanıtını verdi; aynı tam tarayıcı akışı doğrudan bu paket dosyalarıyla da geçti. Yerel `dist/latest` ve `dist/STL-Atolyesi-1.6.0.zip` doğrulandı; kaynak ve paket çalışma dosyaları aynıdır.

Canlı Etsy, canlı müşteri Drive klasörü, Google OAuth ve Windows `.cmd` çalıştırması bu ortamda doğrulanmadı. Testler temsili/izole veriler kullandı; gerçek hesap/bağlantı test dosyalarına veya pakete alınmadı.

### 1.6.0 paket ve kayıtlar

Dağıtım üreticisi `node scripts/package.js`. Güvenli dosya listesi, SHA-256 manifest, ZIP bütünlüğü, JavaScript sözdizimi, HTML varlıkları ve izole sunucu sağlık kontrolü uygular. `dist/latest` ancak aday doğrulanınca değiştirilir; önceki klasör/ZIP tarihli adla korunur. `.git`, `node_modules`, kullanıcı veri deposu, bağlantı anahtarları, yedekler ve testler pakete girmez.

Kullanıcı verisi uygulama klasöründen ayrı `%LOCALAPPDATA%\STLNicheLab` altında kalır. Güncelleme bu klasörü silmez. Belirsiz eski kayıtlar saklanır; bağlı mağazaya atanması kullanıcının açık seçimini gerektirir. Yedekler kimlik bilgilerini içermez; Etsy yetkilendirmesi ayrı yerel bağlantı dosyasındadır.

Bu tarihsel kayıttaki İstanbul gün dönüşümü ve gerçek Windows/canlı kurulum eksikleri sürer; güncel devam listesi [NEXT_STEPS.md](NEXT_STEPS.md) içindedir.
