# Mağaza çalışma alanı yol haritası

Amaç: günlük işleri tek çalışma alanından incelemek; Etsy'de değişiklikleri başlangıçta kullanıcı yapar. Ücretli AI API veya n8n zorunlu değildir. Her aşama çalışan veriyle doğrulanıp kullanıcı tarafından denenir.

Tamamlandı: salt okunur Etsy ürün/satış bağlantısı, ürün görünümü, günlük öncelik ve erteleme, haftalık özet, ürün detayları/değişiklik günlüğü, paket adayları, ürün aileleri.

Sıradaki aşamalar:

1. Satış–destek yükü. Ürün başına olay türü, harcanan dakika ve çözüldü durumu. Müşteri kişisel verilerini kaydetmeden destek zamanı/satış oranı. Mesaj API erişimi varsayılmaz.
2. Değişiklik değerlendirmesi. Önce/sonra ürün hareketiyle karşılaştırılabilir aktif ürün grubunun genel hareketini ayrı göster. Küçük örnek, eşzamanlı değişiklik, sezon etkisi ve veri kapsamını belirt; nedensellik iddiası yapma.
3. Yeni ürün kontrolü. API'den erişilebilir başlık, etiket, görsel ve açıklama verileriyle eksik bilgi işaretleri. Teknik baskı garantisi veya SEO sıralama garantisi verme. Yeni yayımlama takvimi ve aday eşleştirmesi.
4. Gelir/gider. Gerçekten erişilen Etsy ücret/iade verilerini kullanıcı girdisinden ayır; aynı para birimi/dönemle net gelir. Eksik maliyetle net kâr sunma.
5. Sürüm ve yedek. Yeni sürüm bildirimi, kullanıcı onaylı güvenilir güncelleme, bağlantı/veri yedeğini koruma. Anahtarlar paylaşılabilir JSON yedeğine girmez.
6. Rakip/anahtar kelime takibi. API izinlerini ve metrik erişimini doğrula, yalnızca desteklenen verilerle periyodik gözlem. Kesin rakip satışları ve arama hacmi uydurulmaz.
7. Paylaşım takibi. Pinterest gibi kaynaklarda paylaşım tarihi, gerçek erişim/ziyaret verisi varsa kaynağıyla sonuç takibi. Etsy'ye günlük giriş veya yapay etkinlik tek başına sıralama faydası sayılmaz.

İleride ayrı değerlendirilecek: yazma erişimi, ilan değişikliği/yayımlama, Pinterest paylaşımı ve tek tuşla onaylı işlemler. Şu an hiçbir ilan otomatik değiştirilmez/silinmez, paylaşım veya müşteri mesajı gönderilmez. Önce değişikliklerin önizlemesi, onay, geri alma ve denetim kaydı tasarlanmalıdır.
