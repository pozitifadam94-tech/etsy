# Mağaza çalışma alanı yol haritası

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
