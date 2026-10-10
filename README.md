# STL Atölyesi

GoatDesgnShop için Türkçe, kişisel mağaza çalışma alanı. Günlük kullanımda ürünleri, satış hareketini ve pazar gözlemlerini Etsy’den otomatik alır. Ücretli AI API, n8n, harici npm paketi veya abonelik gerektirmez.

## Başlatma

Windows için [WINDOWS.md](WINDOWS.md) adımlarını kullan. Node.js 20+ kurulu olduğunda `windows-start.cmd` paneli açar. Geliştirme ortamında:

```sh
cd /workspace/etsy
npm start
```

Sunucu varsayılan olarak 3000 portunu kullanır. `npm test` veri hesaplarını, gözlemleri ve sürüm karşılaştırmasını doğrular. `npm run build:pages` statik dosyaları `docs/app` içine kopyalar. Kaynaklarda hiçbir Etsy anahtarı bulunmamalıdır.

## Günlük kullanım — 1.4.0

- **Bugün:** bağlantı durumu, aktif ürünler, son 30 gün satış adedi, inceleme önerileri ve yeni ürünler. En fazla üç öneriyle başlar; diğerleri isteğe bağlı gösterilir. Satış düşüşleri, gerçek ilan bilgisi eksikleri ve varsa kaydedilmiş işler öne çıkar. Düşük satışlı her ürüne veya içeriği tamamlanmış her yeni ilana görev üretilmez.
- **Ürünler:** Etsy’den gelen görseller, fiyat ve son 30 gün satış adedi. Detayda 30/60/90 gün sonuçları, ilan kontrolleri ve otomatik gözlenen düzenlemeler bulunur. Not formları kapalı başlar.
- **Satışlar:** iki ayrık haftanın karşılaştırması ve son 14 tam UTC gününün satış grafiği. Günlük adetler okunabilir tabloda da bulunur; tamamlanmamış bugün grafiğe girmez.
- **Ürün grupları:** başlık ve etiketlerden otomatik gruplandırma. Önceki kullanıcı atamaları korunur. Paket adayları ayrı, açılabilir alandadır.
- **Pazar gözlemi:** gruplarından türetilmiş en fazla üç hazır İngilizce arama; birini seçince yerel takip kaydı eklenir. Başka mağaza/arama ekleme formu isteğe bağlıdır.
- **Ayarlar:** bağlantı, sürüm kontrolü, yedekler ve önceki isteğe bağlı araçlar.

Yalnızca seçilen bölüm gösterilir. URL bölüm bağlantıları, tarayıcı geri/ileri ve mobil menü desteklenir. Yeni veri gelmediyse arka plan kontrolü açık tabloları veya klavye odağını sıfırlamaz. Günlük kullanım için manuel form doldurmak gerekmez.

## Etsy bağlantısı ve kapsam

Yerel panelde Etsy uygulamanın Keystring ve Shared secret değerlerini gir; OAuth ile kendi mağazanı bağla. Callback kaydı `http://localhost:3000/oauth/callback` olmalıdır. Bağlantı salt okunurdur; `listings_r shops_r transactions_r` izinleri kullanılır. Ürünler başlangıçta ve sunucu açıkken 30 dakikada bir yenilenir. Bilgisayar kapalıyken takip çalışmaz. Etsy erişimi bu bulut ortamında doğrulanamaz; kullanıcının Windows bağlantısının ve ilk ürün/satış verisinin çalıştığı bildirildi.

Yalnızca şu anda aktif ilanlar ve son 90 günün ödenmiş, iptal edilmemiş sipariş satırları hesaplanır. Satış adedi dosya/ürün miktarıdır; satış satırı benzersiz sipariş sayısı değildir. Ürün bedelleri net kâr, toplam mağaza geliri veya Etsy ödeme bakiyesi değildir. İadeler, ücretler, vergiler, görüntülenme, kaynak trafiği ve mesajlar bu bağlantıda otomatik alınmaz. Bunlar tahminle doldurulmaz. Farklı para birimleri ayrı tutulur.

Eski, eksik ve doğrulanmış sıfır veriler ayrı gösterilir. Günlük satış önerileri ve grafik için en fazla iki günlük snapshot gerekir. Trend karşılaştırması en az 60 günlük ilanlarda iki ayrık 30 günlük dönemi kullanır; küçük örnek kesin sonuç sayılmaz. Sıfır başlangıçtan yüzde artış üretilmez. Eksik ürünler grafikte/satış toplamında dışarıda tutulur ve kapsam açıklanır.

## Otomatik ilan değişikliği gözlemi

Her başarılı ürün alımı önceki snapshot ile karşılaştırılır. Bilinen başlık, açıklama, etiket, görsel kimlik/sırası, ilan türü ve fiyat alanlarındaki farklar kaydedilir. İlk gözlem ve önceki veride olmayan alanlar düzenleme sayılmaz. Yeni görülen ilan geçmişten beri var olabilir. Etiket sırası ve aynı tutarı ifade eden farklı fiyat bölenleri fark sayılmaz. Satış veya favori değişimi ilan düzenlemesi değildir.

En fazla 100 gözlem saklanır. Kayıt önceki ve yeni gözlem zamanını gösterir; tam Etsy düzenleme zamanı bilinmez. Gözlem, değişikliğin satışa etkisini veya nedenini kanıtlamaz. Otomatik gözlemler manuel değişiklik değerlendirmelerine karıştırılmaz. Satış izni başarısız olsa da alınmış ürün bilgileri ve gözlem kaydı korunur.

## Otomatik gruplar ve pazar takibi

Gruplar basit başlık/etiket kurallarıyla önerilir; dosya içeriği veya yapay zekâ değerlendirmesi değildir. Tanınmayanlar Diğer modeller olur. Kullanıcının önceki grup ataması önceliklidir. Grup tablosu yalnızca satış verisi olan aktif ürünleri toplar; ürün sayısı, yaşı, sezon ve trafik farklarını talep/kârlılık olarak yorumlamaz.

Hazır aramalar, bilinen 90 günlük satış adedine göre sıralanan ürün gruplarından türetilir; talep veya düşük rekabet önerisi değildir. Zaten takip edilen kelimeler tekrar önerilmez. API erişimi sağlanıyorsa en fazla 10 takip, her takipte ilk 100 ilan ve son 30 başarılı gözlem tutulur. Sunucu açıkken 6 saati dolan takipler yenilenir. Manuel yenilemede en az 10 dakika, hata sonrası bir saat, 429 sonrası altı saat beklenir. Önceki başarılı veri hatada korunur.

API sonuç sayısı arama hacmi veya dijital STL toplamı değildir. Yeni gözlenen ilan yeni yayımlanmış, örneklemden çıkan ilan silinmiş sayılmaz. Fiyat farkı ortak ilanlarda aynı para birimiyle hesaplanır. Dijital fiyat medyanı yalnızca `type=download` ilanlarda hesaplanır; boş örneklem, tür eksikliği ve fiyat eksikliği ayrı açıklanır. Rakiplerin özel satışlarına erişilmez.

## Önceki manuel araçlar

Niş notları, rakip ilan kayıtları, adaylar, 30/60/90 günlük deneyler, manuel ürün karnesi, müşteri işleri, paylaşım ölçümleri ve gider defteri Ayarlar’dan açılır. Eski JSON yedekleri desteklenir; bu araçlar silinmedi, ana günlük akıştan çıkarıldı. Kaydedilmiş müşteri işleri ve paylaşım planları varsa günlük listede görünebilir. Formları doldurmamak canlı takibi engellemez.

Mesaj yardımcısı ücretsiz İngilizce/Türkçe şablonlar ve mevcut ChatGPT kullanımına kopyalanabilir profil metni sağlar. AI API, otomatik çeviri veya Etsy mesaj erişimi içermez. Müşteri mesajı saklanmaz, yedeğe eklenmez veya sunucuya gönderilmez. Paylaşımlar platforma otomatik gönderilmez.

Manuel değişiklik notlarında önce/sonra 14 tam UTC gün ve diğer uygun aktif ürünler karşılaştırılır; küçük örnek, eşzamanlı düzenleme ve yetersiz tarih kapsamı belirtilir. Paylaşım kayıtlarında önce/sonra 7 günlük tüm kaynaklardan gelen satış adetleri gösterilir; kaynak dönüşümü veya nedensellik çıkarılmaz. Gider defteri yalnızca kayıtlı gelir eksi gider/iade bakiyesidir; otomatik net kâr sunmaz. İnceledim işareti trend aynı kaldığı sürece yedi gün, erteleme seçilen üç/yedi gün öneriyi gizler.

## Veriler ve güncelleme

Araştırma, not, manuel grup, inceleme ve isteğe bağlı kayıtlar tarayıcı `localStorage` alanında kalır; JSON olarak yedeklenebilir. Aynı tarayıcı ve aynı adres/port gerekir. GitHub Pages ile yerel panel farklı depolama alanlarıdır. Aday görselleri en fazla 5 MB PNG/JPEG/WebP’den 640 piksel JPEG’e küçültülür; yedeğe dahildir.

Anahtarlar, OAuth tokenları, ürün snapshot’ı, otomatik gözlemler ve pazar takibi `%LOCALAPPDATA%\STLNicheLab\connection.json` dosyasında tutulur. Dosya proje dışındadır; ZIP güncellemesi bağlantıyı değiştirmez. Dosya şifreli değildir ve anahtar içerir; paylaşılmaz. Güvenli bağlantı değerleri kaynak koduna, GitHub’a, tarayıcıya veya araştırma JSON yedeğine eklenmez. Pazar gözlem geçmişi ayrı düğmeyle anahtar içermeyen JSON olarak indirilebilir; otomatik geri yüklemesi yoktur.

Sürüm kontrolü yalnızca resmi GitHub raw `package.json` adresine gider; Etsy kimlik bilgilerini göndermez. Dosyalar otomatik değiştirilmez. Güncelleme: yedek indir, eski sunucuyu kapat, ZIP’i ayrı klasöre çıkart ve başlat. GitHub Pages statik arayüzü gösterir; canlı API bağlantısı veya gizli anahtar deposu değildir.

Hiçbir Etsy ilanı otomatik değiştirilmez, yayımlanmaz veya silinmez. Uygulama ürün tut/kaldır, kâr veya satış garantisi vermez.
