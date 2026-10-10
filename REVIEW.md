# 1.5.0 sonrası ürün değerlendirmesi

## Uygulama neden açılsın?

Etsy Stats satış sayılarını gösterir. Bu çalışma alanının ek değeri üç somut akıştır:

- **Ürün seçmeden önce:** STL dosyasını aç, ölçü/topoloji uyarılarını ve aynı dosya kaydını gör; dosya adıyla pazar araştırmasına geç. Pazar örnekleminde gerçekten dijital STL olup olmadığını, mağaza dağılımını ve fiyatları ayır. Bu akış tasarım yapamayan/yazıcısı olmayan satıcı için kontrol ve eleme sağlar; talep veya baskı garantisi sunmaz.
- **Etsy’de değişiklik yaptıktan sonra:** Yeniden form doldurma. Düzenleme gözlensin, yeterli tam gün geçince karşılaştırma günlük listeye gelsin. Aynı dönemin mağaza hareketi ve çakışan değişiklikleri ayrı gösterilsin.
- **Günlük takipte:** Önemli işleri incele, sonuçları okundu işaretle; eski kayıtları her tarayıcıya yeniden taşıma. Aktif listeden çıkan ürünlerin geçmişi ve otomatik yedekler korunsun.

Satış grafiği destekleyici bilgi olarak kalır. Ana ekranı daha fazla sayıyla doldurmak bu amaçlara hizmet etmez. Fark edilen düzenleme ve korunan ürün sayısı gerçek işlemlerdir; kaydedilmeyen emek veya satış artışı ölçülmüş sayılmaz.

## Genel taramada düzeltilenler

Küçük satış farkları güçlü eğilim sayılmıyor. Eksik tarih ile bilinen sıfır ayrılıyor. Tek gün toplu satış düzenli sinyal sayılmıyor. Otomatik değişiklikler manuel kayıt zorunluluğuna bağlanmıyor. Gözlem gününün satışları düzenleme öncesi/sonrasına keyfî dağıtılmıyor. Aktif olmayan ürünler geçmişten kaybolmuyor. Geri yükleme ve farklı sekmeler eski kayıtla üzerine yazmıyor. Dosya kontrolü arka planda çalışıyor ve birim bilinmiyorsa açıkça belirtiliyor.

## Dış araştırma: ne doğrulandı, ne doğrulanamadı?

10 Ekim 2026’da şu kaynaklara salt okunur erişim denendi:

- Reddit EtsySellers: https://www.reddit.com/r/EtsySellers/
- eRank yardım: https://help.erank.com/
- Etsy geliştirici belgeleri: https://developers.etsy.com/documentation/
- Resmî GitHub issue API: https://api.github.com/repos/etsy/open-api/issues

Bu adresler ortamın ağ geçidinde HTTP CONNECT 403 ile engellendi. İçerikleri okunmadı; bu sürüm bir Reddit/benzer araç karşılaştırması yapılmış gibi sunulmaz. Yerelde mevcut resmî https://github.com/etsy/open-api deposunun README’si okundu: ilan yönetimi, satın alma sonrası sipariş yönetimi ve mağaza yönetimi kullanım alanlarını tarif ediyor. Eski README güncel endpoint/mesaj izni veya üçüncü taraf ürün özelliği kanıtı sayılmadı. Bağlantı kapsamını aşan özellik varsayılmadı.

## Hâlâ eksik olanlar

Talep hacmi, ürün görüntülenmesi ve dönüşümü bilinmiyor; “yüksek talep/düşük rekabet” garantili niş motoru henüz yok. Müşteri mesajlarını otomatik okuyup Star Seller sorununu çözmüyor. Net kâr veya bütün geçmiş mağaza geliri hesaplamıyor. Tam baskı testi ve STL onarımı yapmıyor. Bilgisayar kapalıyken izlemez. Windows için tam yükleyici/otomatik güncelleyici yok; kısayol ve açılış kolaylığı var.

Bunların yerine çok sayıda manuel alan açmak kullanıcının hedefiyle çelişir. Sonraki özellik, erişilebilen veriye ve belirli bir günlük işi azaltmaya dayanmalıdır. Olası iyi sonraki adımlar: yeterli geçmiş birikince grup bazlı sezon değerlendirmesi; farklı ürün denemelerinin aynı yaşta karşılaştırılması; gerçekten erişilebilen bildirim/veri kaynakları. Önce kaynak ve kapsam doğrulanmalıdır.
