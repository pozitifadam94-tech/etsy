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

## Canli Etsy baglantisi

1. Eski paneldeki arastirma verilerini JSON olarak yedekle. Siyah pencereyi kapat.
2. Guncel proje ZIP'ini ayri klasore cikart, windows-start.cmd ile ac.
3. Etsy uygulama ayarlarinda Redirect/Callback URI olarak `http://127.0.0.1:3000/oauth/callback` kaydetmeyi dene. Etsy HTTP/loopback adresini kabul etmezse baglanti tamamlanamaz; HTTPS callback alternatifi arastirilmalidir. Anahtarlari paylasmadan hata metnini bildir.
4. Yerel panelde Canli magaza takibi > Ilk baglanti bolumunde Keystring ve Shared secret degerlerini gir. Bunlari sohbete veya GitHub'a gonderme.
5. Yerel baglantiyi kaydet > Etsy hesabimi bagla. Acilan Etsy ekraninda kendi magazana salt okunur erisim ver.
6. Etsy donusunden sonra son basarili kayit ve magaza adi gorunmeli. Yeni aktif ilanlar ilk baslatmada ve 30 dakikada bir yenilenir; Simdi guncelle de kullanilabilir.

Anahtarlar ve OAuth tokenlari `%LOCALAPPDATA%\STLNicheLab\connection.json` dosyasinda tutulur; JSON arastirma yedegine dahil degildir. Dosya sifreli degildir; baska kisilerle paylasma. Proje guncellemeleri bu dosyayi degistirmez. Kayitlar da bu dosyadadir; baglanti resetlenirse eski snapshot silinir.

Takip aktif ilanlari, son 90 gunun odenmis ve iptal edilmemis siparis satirlarini kapsar. 30/60/90 gunler kayan zaman araliklaridir; manuel deney bolumundeki ilk 30/60/90 gunlerle ayni degildir. Satis satiri sayisi benzersiz siparis sayisi degildir. Urun bedeli iadeler/vergi/ucretler dusulmus net gelir degildir. Kullanici kisisel bilgileri saklanmaz; yalnizca urun ozetleri saklanir.

Goruntulenme ve donusum olcumu bu API baglantisinda yoktur. Bu nedenle canli bolum yeterli veri olmadan tut/kaldir puani vermez. Sifir satis otomatik kaldirma nedeni degildir. Manuel deney karnesi ayri kalir. Bir guncelleme basarisizsa eski basarili ozet korunur ve hata gorunur. Ilan gorunum tarihinden cok once acilmissa tum omur satislari alinmaz; yalnizca son 90 gun gosterilir.

OAuth ve gercek magaza baglantisi gelistirme ortaminda Etsy ag erisimi olmadigi icin dogrulanamadi. Ilk Windows baglantisi bu dogrulamanin zorunlu adimidir. Yalnizca yerel 127.0.0.1 paneli API'yi kullanabilir; GitHub Pages salt statik arastirma panelidir.
