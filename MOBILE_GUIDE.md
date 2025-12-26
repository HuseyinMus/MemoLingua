# Mobil Uygulama Çıktısı Alma Kılavuzu (Android & iOS)

Bu proje [Capacitor](https://capacitorjs.com/) kullanılarak mobil uygulamaya dönüştürülmeye hazırdır. Aşağıdaki adımları takip ederek APK (Android) ve IPA (iOS) dosyalarını oluşturabilirsiniz.

## 1. Hazırlık ve Kurulum

Öncelikle gerekli Capacitor kütüphanelerini yüklemeniz gerekmektedir. Terminalde şu komutu çalıştırın:

```bash
npm install @capacitor/core @capacitor/android @capacitor/ios
```

## 2. Projeyi Derleme (Build)

Web uygulamanızı üretim için derleyerek `dist` klasörünü oluşturun:

```bash
npm run build
```

*Not: Bu işlem sonucunda proje ana dizininde `dist` klasörü oluşmalıdır.*

## 3. Platformları Ekleme

Android ve iOS platformlarını projeye dahil edin:

```bash
npx cap add android
npx cap add ios
```

## 4. Senkronizasyon

Web kodlarını native platformlara kopyalayın:

```bash
npx cap sync
```

## 5. Uygulamayı Açma ve Çıktı Alma

### Android (Windows/Mac/Linux)
Bilgisayarınızda [Android Studio](https://developer.android.com/studio)'nun kurulu olması gerekir.

1.  Android projesini açın:
    ```bash
    npx cap open android
    ```
2.  Android Studio açılacaktır. Yüklemelerin (Gradle sync) bitmesini bekleyin.
3.  Cihazınızı USB ile bağlayın veya Emülatör başlatın.
4.  **Play Tuşu (Run)**'na basarak uygulamayı test edin.
5.  **APK Çıktısı Almak İçin**:
    *   `Build` menüsünden > `Build Bundle(s) / APK(s)` > `Build APK(s)` seçeneğine tıklayın.

### iOS (Sadece Mac)
Bilgisayarınızda [Xcode](https://developer.apple.com/xcode/)'un kurulu olması gerekir. (Windows üzerinde iOS çıktısı alınamaz).

1.  iOS projesini açın:
    ```bash
    npx cap open ios
    ```
2.  Xcode üzerinden simülatör veya gerçek cihaz seçerek uygulamayı çalıştırın.
3.  **App Store Yüklemesi İçin**: `Product` > `Archive` menüsünü kullanın.

## Sorun Giderme
*   Eğer `App.tsx` veya diğer dosyalarda değişiklik yaparsanız, her seferinde şu komutları sırasıyla çalıştırmalısınız:
    1.  `npm run build`
    2.  `npx cap sync`
