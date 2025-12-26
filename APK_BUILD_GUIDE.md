# 📱 APK Oluşturma Rehberi - MemoLingua

## 🎯 İki Seçenek Var:

### 1️⃣ **Debug APK** (Hızlı Test - Önerilen)
Telefonunuzda hızlıca test etmek için idealdir.

### 2️⃣ **Release APK** (Production - İmzalı)
Google Play Store'a yüklemek veya dağıtmak için gereklidir.

---

## 🚀 Seçenek 1: Debug APK (Basit ve Hızlı)

### Adım 1: Build Komutu
```bash
cd "C:\Users\Eser Medya\Desktop\MEMOYENİ\MemoLingua"
npm run build
npx cap sync
```

### Adım 2: Android Studio ile Build
```bash
npx cap open android
```

**Android Studio'da:**
1. `Build` → `Build Bundle(s) / APK(s)` → `Build APK(s)`
2. Build tamamlanınca "locate" linkine tıklayın
3. APK konumu: `android/app/build/outputs/apk/debug/app-debug.apk`

### Adım 3: APK'yı Telefonunuza Aktarın

**Yöntem A - USB ile:**
```bash
# APK'yı telefonunuza kopyalayın
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

**Yöntem B - Manuel:**
1. `app-debug.apk` dosyasını bulun
2. Telefonunuza e-posta/WhatsApp/Google Drive ile gönderin
3. Telefonunuzda APK'yı açıp yükleyin
4. "Bilinmeyen kaynaklardan yükleme" iznini verin

---

## 🏆 Seçenek 2: Release APK (İmzalı - Production)

### Ön Hazırlık: Keystore Oluşturma

```bash
# Keystore oluştur (bir kez yapılır)
keytool -genkey -v -keystore memolingua-release.keystore -alias memolingua -keyalg RSA -keysize 2048 -validity 10000
```

**Sorulacak bilgiler:**
- Şifre: [güçlü bir şifre seçin]
- İsim: [Adınız]
- Organizasyon: [Şirket adı]
- Şehir, Ülke vb.

### Adım 1: Keystore Yapılandırması

`android/key.properties` dosyası oluşturun:
```properties
storePassword=YOUR_KEYSTORE_PASSWORD
keyPassword=YOUR_KEY_PASSWORD
keyAlias=memolingua
storeFile=../memolingua-release.keystore
```

⚠️ **ÖNEMLİ:** `key.properties` dosyasını `.gitignore`'a ekleyin!

### Adım 2: build.gradle Güncellemesi

`android/app/build.gradle` dosyasına ekleyin:

```gradle
// Keystore yapılandırması
def keystorePropertiesFile = rootProject.file("key.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

android {
    ...
    
    signingConfigs {
        release {
            if (keystorePropertiesFile.exists()) {
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
                storeFile file(keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
            }
        }
    }
    
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}
```

### Adım 3: Release Build

```bash
cd android
./gradlew assembleRelease
```

**veya Windows için:**
```bash
cd android
gradlew.bat assembleRelease
```

### Adım 4: APK Konumu

Release APK burada olacak:
```
android/app/build/outputs/apk/release/app-release.apk
```

---

## 📦 Hızlı Komutlar (Kopyala-Yapıştır)

### Debug APK için:
```bash
cd "C:\Users\Eser Medya\Desktop\MEMOYENİ\MemoLingua"
npm run build
npx cap sync
npx cap open android
```

### Release APK için:
```bash
cd "C:\Users\Eser Medya\Desktop\MEMOYENİ\MemoLingua"
npm run build
npx cap sync
cd android
gradlew.bat assembleRelease
```

---

## 📲 APK'yı Telefonunuza Yükleme

### Yöntem 1: ADB (USB Kablo)
```bash
# Telefonunuzu USB ile bağlayın
# USB Debugging'i açın (Ayarlar → Geliştirici Seçenekleri)

# Debug APK için:
adb install android/app/build/outputs/apk/debug/app-debug.apk

# Release APK için:
adb install android/app/build/outputs/apk/release/app-release.apk
```

### Yöntem 2: Manuel Transfer
1. APK dosyasını bulun
2. Google Drive/Dropbox'a yükleyin
3. Telefonunuzdan indirin
4. APK'yı açın ve yükleyin
5. "Bilinmeyen kaynaklardan yükleme" iznini verin

### Yöntem 3: QR Code
1. APK'yı bir web sunucusuna yükleyin
2. QR kod oluşturun
3. Telefonunuzla QR kodu tarayın
4. APK'yı indirip yükleyin

---

## 🔍 APK Bilgilerini Kontrol Etme

```bash
# APK boyutunu görüntüle
dir android\app\build\outputs\apk\debug\app-debug.apk

# APK detaylarını görüntüle (aapt gerekli)
aapt dump badging android/app/build/outputs/apk/debug/app-debug.apk
```

---

## ⚠️ Önemli Notlar

### Debug APK:
- ✅ Hızlı test için ideal
- ✅ Kolay oluşturulur
- ❌ Google Play Store'a yüklenemez
- ❌ Optimize edilmemiş (büyük boyut)

### Release APK:
- ✅ Production kullanımı için
- ✅ Optimize edilmiş (küçük boyut)
- ✅ Google Play Store'a yüklenebilir
- ❌ Keystore gerektirir
- ❌ İmzalama süreci var

---

## 🎯 Önerilen Akış

### İlk Test İçin:
1. Debug APK oluştur
2. Telefonunuza yükle
3. Test et

### Production İçin:
1. Keystore oluştur
2. Release APK build et
3. İmzala
4. Google Play Store'a yükle

---

## 📊 APK Boyut Optimizasyonu

Release APK için boyutu küçültmek:

```gradle
android {
    buildTypes {
        release {
            minifyEnabled true
            shrinkResources true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt')
        }
    }
}
```

---

## 🆘 Sorun Giderme

### "Bilinmeyen kaynaklardan yükleme" hatası:
1. Ayarlar → Güvenlik
2. "Bilinmeyen kaynaklardan yükleme" iznini açın

### ADB bulunamadı:
```bash
# Android SDK platform-tools'u PATH'e ekleyin
# veya tam yolu kullanın:
C:\Users\[KULLANICI]\AppData\Local\Android\Sdk\platform-tools\adb.exe
```

### Gradle build hatası:
```bash
# Gradle cache temizle
cd android
./gradlew clean
./gradlew assembleDebug
```

---

## 📱 APK Konumları Özet

| Tip | Konum |
|-----|-------|
| **Debug** | `android/app/build/outputs/apk/debug/app-debug.apk` |
| **Release** | `android/app/build/outputs/apk/release/app-release.apk` |

---

**Başarılar!** 🚀

Sorularınız olursa çekinmeyin!
