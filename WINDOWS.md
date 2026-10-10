# Windows'ta baslatma

1. https://nodejs.org/ adresinden Node.js LTS Windows kurulumunu yap. Ek ucretli arac veya npm paketi gerekmez.
2. GitHub deposunda Code > Download ZIP sec; ZIP dosyasini klasore cikart. Dosyalari ZIP icinden calistirma.
3. Cikartilan klasordeki `windows-start.cmd` dosyasina cift tikla. Panel sunucu hazir olduktan sonra varsayilan tarayicida acilir.
4. Siyah pencereyi kullanim boyunca acik tut. Kapatmak sunucuyu durdurur. Bilgisayar kapaliyken otomasyon calismaz.

Windows komut dosyasi yalnizca kendi bilgisayarindan erisilebilen 127.0.0.1 adresini kullanir. Etsy API baglantisi henuz yoktur; bu yerel panel baslaticisidir. Anahtar, secret veya token dosyalara/GitHub'a eklenmemelidir.

## Mevcut verilerini tasi

GitHub Pages panelinde Yedek indir dugmesini kullan. Yerel panelde Yedek yukle ile dosyayi sec. Iki adres farkli tarayici depolama alanlaridir; veriler kendiliginden tasinmaz. Ayni tarayiciyi ve portu kullan, duzenli yedek al. Musteri mesajlari yedege dahil edilmez.

## Sorun giderme

- Node.js bulunamadi: LTS kurulumu tamamlandiktan sonra baslaticiyi yeniden ac.
- Port kullaniliyor: acik olan diger panelin siyah penceresini kapat. Tanımadigin surecleri kapatma.
- Tarayici acilmadi: baslaticinin yazdigi yerel adresi tarayiciya yaz.
- Guncelleme: once yedek indir, GitHub'dan yeni ZIP indirip ayri klasore cikart. Eski klasordeki yerel dosyalari silmeden koru.

Bir sonraki asama: Etsy'nin destekledigi API kapsamlarini ve OAuth callback gereksinimini dogrulayip, onaylanan uygulamayi bu yerel sunucuya baglamak. Windows kurulumu veya canli Etsy erisimi mevcut Linux gelistirme ortaminda dogrulanmis sayilmaz.
