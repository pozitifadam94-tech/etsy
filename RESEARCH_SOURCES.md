# Araştırmadan İlan Hazırla — kaynak ve doğrulama kaydı

Kontrol tarihi: **12 Ekim 2026 (İstanbul)**. Bu dosya erişilen resmî kaynakları,
erişim engellerini ve uygulamanın kanıt sınırlarını kaydeder. Mağaza anahtarları,
müşteri bilgileri ve gerçek Drive teslim bağlantıları içermez.

## Güncel resmî kaynak denemeleri

| Kaynak | Tam adres | Bu ortamda sonuç | Çıkarılabilecek sonuç |
|---|---|---|---|
| Marketplace Insights Help | https://help.etsy.com/hc/en-us/articles/35122361353239-How-Do-I-Use-Etsy-s-Marketplace-Insights-Tool | Ağ geçidinde `CONNECT 403`; kaynak gövdesi alınamadı | Güncel ücretsiz kota, veri dönemi, bölge/dil kapsamı ve izinli otomatik erişim **doğrulanamadı** |
| Etsy Search Seller Handbook | https://www.etsy.com/seller-handbook/article/how-etsy-search-works/375461474487 | Ağ geçidinde `CONNECT 403`; kaynak gövdesi alınamadı | Güncel editoryal başlık/etiket önerileri ve zorunlu sınırlar **doğrulanamadı** |
| Open API reference | https://developers.etsy.com/documentation/reference/ | Ağ geçidinde `CONNECT 403`; kaynak gövdesi alınamadı | Güncel taxonomy/attributes ve Marketplace Insights API erişimi **doğrulanamadı** |
| Resmî README'nin gösterdiği OpenAPI JSON | https://www.etsy.com/openapi/generated/oas/3.0.0.json | Ağ geçidinde `CONNECT 403`; kaynak gövdesi alınamadı | Güncel endpoint ve alan şeması **doğrulanamadı** |
| Resmî OpenAPI deposu README | https://raw.githubusercontent.com/etsy/open-api/main/README.md | `HTTP 200`; okunabildi | Yukarıdaki OpenAPI reference ve JSON bağlantıları resmî depoda bulunuyor |
| Resmî OpenAPI deposu | https://github.com/etsy/open-api | Git üzerinden okunabildi | Güncel depo `2ecce66e07627358a074d46188586f0283c9a6cf` (29 Nisan 2026); v3 belgelerinin developers.etsy.com'a taşındığı belirtiliyor |

Engelleri aşmak için CAPTCHA çözümü, oturum kazıma, üçüncü taraf proxy,
alternatif gizli endpoint veya kullanıcı hesabıyla sayfa otomasyonu kullanılmadı.
Marketplace Insights'ın otomatik erişimi **doğrulanmamıştır**; bu, "kesinlikle
hiçbir desteklenen API yoktur" hükmü değildir. Güncel resmî kaynak erişilebilir
olduğunda yeniden değerlendirme gerekir.

## Geçmiş belge: güncel doğrulama yerine geçmez

Resmî deponun geçmişindeki `openapi.json`, şu kayıt üzerinden okunabildi:

https://github.com/etsy/open-api/blob/6d6b1aa18f3b024e31d99083735eec7f2bf6b678/openapi.json

Bu, 3 Haziran 2021'de belgelerin taşınmasından **önceki**, kendisini
**alpha / access-controlled** olarak tanımlayan belgedir. Seller taxonomy nodes
ve taxonomy properties GET yolları içerir. Tarihsel resmî kaynak olması,
2026'da aynı endpoint/şema/izinlerin geçerli olduğunu kanıtlamaz. Bu nedenle
bu sürümde yeni taxonomy veya properties endpointi eklenmedi; kategori
kimlikleri ya da zorunlu özellikler uydurulmadı.

Geçmiş belgede Marketplace Insights yolu bulunmaması, sonradan bir yol
eklenmediğini kanıtlamaz. Başlık/etiket açıklamaları güncel **140 / 13 / 20**
sayılarını bu incelemede doğrulamamıştır.

## Çalışan veri yolları ve dürüst etiketler

- **Marketplace Insights:** kullanıcı resmî Help bağlantısını veya
  https://www.etsy.com/your/shops/me/dashboard adresinden Shop Manager'ı açar.
  Doğrulanmamış bir Marketplace Insights derin bağlantısı verilmez. Metin/tablo
  yapıştırma ve sade elle giriş, kayıt önizlemesinden sonra kullanılabilir.
  Kaynak etiketi: **kullanıcının aktardığı Marketplace Insights verisi**.
- **Ücretsiz kota ve dönem:** güncel kaynaktan doğrulanmadığı için kota rakamı,
  varsayılan gün sayısı veya bölge/dil kapsamı otomatik olarak atanmaz. Kullanıcı
  kendi ekranının bildirdiği kapsamı ve dönemi kaydeder. Eski kaydın tarihi
  gösterilir; farklı kaynak veya dönemler sessizce birleştirilmez.
- **Rakip örneklemi:** mevcut `market.observe` / `publicApi` kod yolu yeniden
  kullanılır. Tek seferlik salt okuma örneklemi en fazla 100 aktif ilanı,
  `created` azalan sıralamayla alır; tekrar eden ilan kimlikleri ayıklanır.
  Sorgu, alınma tarihi, sıralama, örnek sınırı, gelen kayıt sayısı ve API'nin
  bildirdiği ilan sayısı ayrı tutulur. Bu, Etsy müşterisinin kişiselleştirilmiş
  arama sırası, bütün pazar, gerçek arama hacmi veya özel rakip satışları değildir.
- **Yerel alan kontrolleri:** 140 başlık karakteri, en fazla 13 etiket ve
  etiket başına 20 karakter bu sürümde **geçici yerel kontrollerdir**; güncel
  resmî doğrulama tamamlandı gibi sunulmaz. Editoryal uzunluk önerisi zorunlu
  yayımlama engeline dönüştürülmez. Uygun etiket eksikse ilgisiz etiket eklenmez.

## Test ve erişim sınırı

Kaynak incelemesi hiçbir gerçek Etsy mağazasında yazma işlemi yapmadı.
Yeni örneklem akışı temsili API yanıtlarıyla test edilir; bu geliştirmede gerçek
anahtarla canlı Etsy isteği veya Marketplace Insights oturum okuması yapılmaz.
Alan sınırları, otomatik MI erişimi ve taxonomy için güncel dış doğrulama
eksikleri kullanıcıya açıkça gösterilmelidir.

Araştırma sırasında yanıt başlıkları/README ve geçmiş spec `/tmp/stl-etsy-*`
dosyalarında tutuldu. Bunlar geçici çalışma kanıtlarıdır; kalıcı kaynak kaydı
bu belgedir.
