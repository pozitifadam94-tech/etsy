# Windows'ta baslatma

1. https://nodejs.org/ adresinden Node.js LTS Windows kurulumunu yap. Ek ucretli arac veya npm paketi gerekmez.
2. GitHub deposunda Code > Download ZIP sec; ZIP dosyasini klasore cikart. Dosyalari ZIP icinden calistirma.
3. Cikartilan klasordeki `windows-start.cmd` dosyasina cift tikla. Panel sunucu hazir olduktan sonra varsayilan tarayicida acilir.
4. Siyah pencereyi kullanim boyunca acik tut. Kapatmak sunucuyu durdurur. Bilgisayar kapaliyken otomasyon calismaz.

Windows komut dosyasi yalnizca kendi bilgisayarindan erisilebilen localhost adresini kullanir. Etsy API baglantisi icin asagidaki Canli Etsy baglantisi adimlarini tamamla. Anahtar, secret veya token dosyalara/GitHub'a eklenmemelidir.

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
3. Etsy uygulama ayarlarinda Redirect/Callback URI olarak `http://localhost:3000/oauth/callback` kaydet. Bu localhost adresinin kabul edildigi kullanici tarafindan dogrulandi.
4. Yerel panelde Canli magaza takibi > Ilk baglanti bolumunde Keystring ve Shared secret degerlerini gir. Bunlari sohbete veya GitHub'a gonderme.
5. Yerel baglantiyi kaydet > Etsy hesabimi bagla. Acilan Etsy ekraninda kendi magazana salt okunur erisim ver.
6. Etsy donusunden sonra son basarili kayit ve magaza adi gorunmeli. Yeni aktif ilanlar ilk baslatmada ve 30 dakikada bir yenilenir; Simdi guncelle de kullanilabilir.

Anahtarlar ve OAuth tokenlari `%LOCALAPPDATA%\STLNicheLab\connection.json` dosyasinda tutulur; JSON arastirma yedegine dahil degildir. Dosya sifreli degildir; baska kisilerle paylasma. Proje guncellemeleri bu dosyayi degistirmez. Kayitlar da bu dosyadadir; baglanti resetlenirse eski snapshot silinir.

Takip aktif ilanlari, son 90 gunun odenmis ve iptal edilmemis siparis satirlarini kapsar. 30/60/90 gunler kayan zaman araliklaridir; manuel deney bolumundeki ilk 30/60/90 gunlerle ayni degildir. Satis satiri sayisi benzersiz siparis sayisi degildir. Urun bedeli iadeler/vergi/ucretler dusulmus net gelir degildir. Kullanici kisisel bilgileri saklanmaz; yalnizca urun ozetleri saklanir.

Goruntulenme ve donusum olcumu bu API baglantisinda yoktur. Bu nedenle canli bolum yeterli veri olmadan tut/kaldir puani vermez. Sifir satis otomatik kaldirma nedeni degildir. Manuel deney karnesi ayri kalir. Bir guncelleme basarisizsa eski basarili ozet korunur ve hata gorunur. Ilan gorunum tarihinden cok once acilmissa tum omur satislari alinmaz; yalnizca son 90 gun gosterilir.

OAuth ve gercek magaza baglantisi gelistirme ortaminda Etsy ag erisimi olmadigi icin dogrulanamadi. Ilk Windows baglantisi bu dogrulamanin zorunlu adimidir. Yalnizca yerel localhost paneli API'yi kullanabilir; GitHub Pages salt statik arastirma panelidir.

## Localhost surumune gecis

Once eski 127.0.0.1 panelinden Yedek indir. Yeni surum localhost adresini acar; farkli adres nedeniyle tarayici arastirma kayitlarini burada yeniden Yedek yukle ile aktar. Anahtarlari ilk defa gireceksen localhost panelini kullan. Daha once 127.0.0.1 callback ile anahtar kaydettiysen yeni formda yeniden kaydet ve Etsy yetkilendirmesini tekrarla. Gercek token alimi ve ilk senkronizasyon henuz dogrulanmadi.

## Magazam urun ekrani

Sol menudeki Magazam > Urunlerim, canli API snapshot'indaki aktif ilanlari gosterir. Kartlar fiyat, favori, ilan yasi, son 30/60/90 gun adetleri ve varsa gorsel icerir. Arama, satis var/yok/yeni filtreleri ve satis/yenilik/ad siralamasi kullanilabilir. Senkronizasyon sayaclari, 0 urun yanitini filtre sonucu bos listesinden ayirir. Yeni surumu ayri klasore indirip eski sunucuyu kapattiktan sonra baslat; LOCALAPPDATA altindaki baglanti dosyasi korundugu icin tekrar anahtar girmek gerekmez. Ilk guncellemeyi bekle veya Simdi guncelle kullan. Sifir urun gorursen sayaci ve magaza adini bildir; connection.json dosyasini gonderme.

## 1.1.0 sürümüne geçiş

Yedek indir, siyah pencereyi kapat, güncel ZIP'i ayrı klasöre çıkart ve windows-start.cmd ile aç. Şimdi güncelle yaparak günlük ürün bedellerini getir. Gelir ve gider ekranından tarih aralığını seçip manuel gider/iade ekleyebilirsin. Başlıktaki Yeni sürüm var mı düğmesi bundan sonra yeni yayımlanan sürümleri kontrol eder. İndirme/güncelleme otomatik değildir; panel açıkken dosyaların üzerine yazılmaz. API anahtarlarını tekrar girmen gerekmez. Araştırma ve defter kayıtların aynı localhost adresindeki aynı tarayıcıda korunur; JSON yedeğini ayrıca sakla.
