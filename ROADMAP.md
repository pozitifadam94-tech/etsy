# Mağaza çalışma alanı yol haritası

Amaç: günlük işleri tek çalışma alanından incelemek; Etsy'de değişiklikleri başlangıçta kullanıcı yapar. Ücretli AI API veya n8n zorunlu değildir. Her aşama çalışan veriyle doğrulanıp kullanıcı tarafından denenir.

Tamamlandı: salt okunur Etsy ürün/satış bağlantısı, ürün görünümü, günlük öncelik ve erteleme, haftalık özet, ürün detayları/değişiklik günlüğü, paket adayları, ürün aileleri, satış–destek yükü ve açık müşteri işleri.

Sıradaki aşamalar:

1. Tamamlandı — satış–destek yükü. Ürün başına olay türü, harcanan dakika ve çözüldü durumu. Müşteri kişisel verilerini kaydetmeden destek zamanı/satış oranı. Mesaj API erişimi varsayılmaz.
2. Tamamlandı — değişiklik değerlendirmesi. Önce/sonra ürün hareketiyle karşılaştırılabilir aktif ürün grubunun genel hareketini ayrı göster. Küçük örnek, eşzamanlı değişiklik, sezon etkisi ve veri kapsamını belirt; nedensellik iddiası yapma.
3. Tamamlandı — yeni ürün kontrol listesi. API'den erişilebilir başlık, etiket, görsel ve açıklama verileriyle eksik bilgi işaretleri. Teknik baskı garantisi veya SEO sıralama garantisi verme. Yeni yayımlama takvimi ve aday eşleştirmesi.
4. İlk sürüm tamamlandı — gelir/gider defteri. API ürün bedelleri, manuel ek gelir/gider/iade ve para birimi ayrımı var. Otomatik ücret/iade bağlantısı henüz yok. Gerçekten erişilen Etsy ücret/iade verilerini kullanıcı girdisinden ayır; aynı para birimi/dönemle net gelir. Eksik maliyetle net kâr sunma.
5. İlk sürüm tamamlandı — sürüm bildirimi ve güvenli indirme yönlendirmesi. Dosyalar otomatik değiştirilmez. Yeni sürüm bildirimi, kullanıcı onaylı güvenilir güncelleme, bağlantı/veri yedeğini koruma. Anahtarlar paylaşılabilir JSON yedeğine girmez.
6. İlk sürüm tamamlandı — rakip/anahtar kelime takibi. Halka açık ilk 100 ilan gözlemi, fiyat farkı, yeni gözlenen ilanlar ve API erişim hataları desteklenir. İlk veri alımının çalıştığı kullanıcı tarafından bildirildi. API izinlerini ve metrik erişimini doğrula, yalnızca desteklenen verilerle periyodik gözlem. Kesin rakip satışları ve arama hacmi uydurulmaz.
7. İlk sürüm tamamlandı — paylaşım takibi. Plan, günlük hatırlatma, manuel kaynağı/tarihi belirtilmiş tıklama veya ziyaret ölçümü ve önce/sonra 7 günlük satış adetleri var. Otomatik paylaşım/trafik bağlantısı henüz yok. Pinterest gibi kaynaklarda paylaşım tarihi, gerçek erişim/ziyaret verisi varsa kaynağıyla sonuç takibi. Etsy'ye günlük giriş veya yapay etkinlik tek başına sıralama faydası sayılmaz.

İleride ayrı değerlendirilecek: yazma erişimi, ilan değişikliği/yayımlama, Pinterest paylaşımı ve tek tuşla onaylı işlemler. Şu an hiçbir ilan otomatik değiştirilmez/silinmez, paylaşım veya müşteri mesajı gönderilmez. Önce değişikliklerin önizlemesi, onay, geri alma ve denetim kaydı tasarlanmalıdır.
