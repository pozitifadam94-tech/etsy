# STL Atölyesi — 1.6.0 geliştirme ve doğrulama kaydı

11 Ekim 2026. Başlangıç 1.5.0 (`c5a9b7b`); değişiklikler tek 1.6.0 sürümünde toplandı. Önceki README/ROADMAP teslim yöntemi düzeltmeleri korundu. Gerçek hesap veya mağaza üzerinde yazma yapılmadı. Yeni ücretli hizmet, yapay zekâ API’si veya n8n bağımlılığı eklenmedi.

## Çalışan kapsam

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

## Doğrulama

- Tam otomatik test çalıştırması: `npm test` → **149/149 başarılı**, başarısız/atlanmış test yok. İşletim sistemi Linux; Node.js 24.19.0.
- Testler: eski veri taşıma ve açık atama; iki mağaza ve geç yanıt; yedek/geri yükleme; kesilen yazma; bozuk bağlantı dosyası; kota/429; sipariş/satır/adet ayrımı; Drive güvenli yönlendirme ve muhafazakâr HTML sonuçları; TXT kaynak/link/hash/sürüm; ilan/AI/gizlilik; günlük iş seçimi; güvenli ZIP ve sunucu açılışı.
- İzole Chromium temel akışı: yerel ürün → Drive klasörü → gerçek TXT indirme → yeniden açılış; yanlış Etsy teslim URL’sinin reddi; belirsiz TXT seçimi; açıklama taslağı, gizli bağlantı çıkarma, bozuk AI çıktısı, günlük yerel kontrol; 320/390/768/1440 genişliklerinde taşma kontrolü geçti.
- Hazırlık arayüzü: taslak/fark/geri alma/toplu hazırlık; yalnızca sorun metadatası; aynı ilan kimliğine sahip iki mağaza; eski formun kaydı reddi ve kaydedilmemiş eski taslağın oturum kopyası geçti.
- STL Chromium kontrolü: gerçek worker ile dosya/hash/ölçü; ön/yan/çapraz görünüm ve ışık; 1200×1050 PNG ve 1200×1400 bilgi görseli; örnekleme uyarısı; büyük analiz iptali; 25 MiB sınırı; kayıt hatası ve değişen dosya/mağaza koruması geçti. Görseller görsel olarak da incelendi.
- Kalıcı tarayıcı kontrolü `node scripts/verify-browser.cjs` geçti: mevcut Etsy ürününe teslim ekleme, kısmi Drive hatasında diğer aşamaların tamamlanması, aynı mağazada değişen kayıttan sonra eski formun reddi, eşzamanlı sekme sonrası eski geri almanın iptali ve odaktaki şablonun mağaza değişince sıfırlanması. Bu geliştirme testi mevcut Playwright/Chromium’u kullanır; çalışma paketinin bağımlılığı değildir.
- Dağıtım ZIP’i temiz `/tmp` klasörüne açıldı. CRC/yol kontrolü ve manifestteki tüm dosyaların **SHA-256** değerleri geçti. Açılmış ZIP’in sunucusu `1.6.0` sağlık yanıtını verdi; aynı tam tarayıcı akışı doğrudan bu paket dosyalarıyla da geçti. Yerel `dist/latest` ve `dist/STL-Atolyesi-1.6.0.zip` doğrulandı; kaynak ve paket çalışma dosyaları aynıdır.

Canlı Etsy, canlı müşteri Drive klasörü, Google OAuth ve Windows `.cmd` çalıştırması bu ortamda doğrulanmadı. Testler temsili/izole veriler kullandı; gerçek hesap/bağlantı test dosyalarına veya pakete alınmadı.

## Paket ve kayıtlar

Dağıtım üreticisi `node scripts/package.js`. Güvenli dosya listesi, SHA-256 manifest, ZIP bütünlüğü, JavaScript sözdizimi, HTML varlıkları ve izole sunucu sağlık kontrolü uygular. `dist/latest` ancak aday doğrulanınca değiştirilir; önceki klasör/ZIP tarihli adla korunur. `.git`, `node_modules`, kullanıcı veri deposu, bağlantı anahtarları, yedekler ve testler pakete girmez.

Kullanıcı verisi uygulama klasöründen ayrı `%LOCALAPPDATA%\STLNicheLab` altında kalır. Güncelleme bu klasörü silmez. Belirsiz eski kayıtlar saklanır; bağlı mağazaya atanması kullanıcının açık seçimini gerektirir. Yedekler kimlik bilgilerini içermez; Etsy yetkilendirmesi ayrı yerel bağlantı dosyasındadır.

Devam edilebilir açık işler ve resmî belge erişim engeli `NEXT_STEPS.md` içindedir. Yeni çalışma P0 İstanbul gün dönüşümü ve gerçek Windows/canlı kurulum kontrolünden başlamalı; yarım özellikler tamamlanmış sayılmamalı.
