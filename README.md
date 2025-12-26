# 🎓 MemoLingua - AI-Powered Language Learning App

> **Bilimsel hafıza tekniklerini yapay zeka ile birleştiren, yeni nesil dil öğrenme platformu.**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB)](https://reactjs.org/)
[![Firebase](https://img.shields.io/badge/Firebase-12.6-orange)](https://firebase.google.com/)
[![Gemini AI](https://img.shields.io/badge/Gemini-AI-purple)](https://ai.google.dev/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

## ✨ Özellikler

### 🧠 Bilimsel Hafıza Sistemi
- **Spaced Repetition System (SRS)**: Bilimsel olarak kanıtlanmış aralıklı tekrar algoritması
- **Hafıza Sağlığı Takibi**: Gerçek zamanlı performans metrikleri
- **Adaptif Öğrenme**: Kullanıcının performansına göre otomatik zorluk ayarı

### 🤖 AI Destekli Öğrenme
- **Gemini AI Entegrasyonu**: Google'ın en gelişmiş AI modeli
- **Kişiselleştirilmiş İçerik**: Seviye ve hedefe özel kelime üretimi
- **Sesli Koç**: Gerçek zamanlı konuşma pratiği ve geri bildirim
- **Akıllı Hikayeler**: Bağlamsal öğrenme için AI-üretimli hikayeler

### 🎮 Etkileşimli Oyunlar
- **Hangman**: Klasik adam asmaca oyunu
- **Memory Match**: Hafıza eşleştirme
- **Word Scramble**: Kelime bulmaca
- **Speed Quiz**: Hızlı kelime testi
- **Audio Challenge**: Dinleme pratiği

### 📱 Mobil Uyumlu
- **Capacitor**: Native iOS ve Android desteği
- **PWA**: Progressive Web App özellikleri
- **Offline Mod**: İnternet olmadan çalışma
- **Dark Mode**: Göz dostu karanlık tema

## 🚀 Kurulum

### Gereksinimler
- Node.js 18+ 
- npm veya yarn
- Firebase hesabı
- Google Gemini API anahtarı

### Adımlar

1. **Projeyi klonlayın**
```bash
git clone https://github.com/yourusername/MemoLingua.git
cd MemoLingua
```

2. **Bağımlılıkları yükleyin**
```bash
npm install
```

3. **Environment variables ayarlayın**
```bash
cp .env.example .env.local
```

`.env.local` dosyasını düzenleyin:
```env
VITE_FIREBASE_API_KEY=your_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_GEMINI_API_KEY=your_gemini_key
```

4. **Geliştirme sunucusunu başlatın**
```bash
npm run dev
```

5. **Tarayıcıda açın**
```
http://localhost:3000
```

## 🧪 Testler

```bash
# Tüm testleri çalıştır
npm test

# Test UI'ı aç
npm run test:ui

# Coverage raporu oluştur
npm run test:coverage
```

## 📦 Production Build

```bash
# Web için build
npm run build

# Android için build
npm run build
npx cap sync android
npx cap open android

# iOS için build (macOS gerekli)
npm run build
npx cap sync ios
npx cap open ios
```

## 🏗️ Proje Yapısı

```
MemoLingua/
├── components/          # React bileşenleri
│   ├── Auth.tsx        # Kimlik doğrulama
│   ├── StudyCard.tsx   # Çalışma kartları
│   ├── Games.tsx       # Oyunlar
│   ├── VoiceTalk.tsx   # Sesli koç
│   ├── ErrorBoundary.tsx  # Hata yönetimi
│   └── Toast.tsx       # Bildirimler
├── services/           # API servisleri
│   ├── firebase.ts     # Firebase yapılandırması
│   └── geminiService.ts # AI servisi
├── hooks/              # Custom React hooks
│   └── useSRS.ts       # SRS algoritması
├── tests/              # Test dosyaları
│   ├── setup.ts
│   ├── useSRS.test.ts
│   └── types.test.ts
├── types.ts            # TypeScript tipleri
├── App.tsx             # Ana uygulama
└── index.tsx           # Giriş noktası
```

## 🔒 Güvenlik

- ✅ API anahtarları `.env.local` dosyasında saklanır
- ✅ `.gitignore` ile hassas veriler korunur
- ✅ Firebase Security Rules uygulanır
- ✅ HTTPS zorunlu
- ⚠️ Production'da rate limiting ekleyin

## 📊 Teknoloji Stack

### Frontend
- **React 18.3**: UI kütüphanesi
- **TypeScript 5.8**: Type safety
- **Vite 6.2**: Build tool
- **TailwindCSS**: Styling
- **Lucide React**: İkonlar

### Backend & Services
- **Firebase 12.6**: Authentication, Firestore, Hosting
- **Google Gemini AI**: Content generation, TTS, STT
- **Capacitor 6.0**: Mobile deployment

### Testing
- **Vitest**: Unit testing
- **Testing Library**: Component testing
- **jsdom**: DOM simulation

## 🎯 Roadmap

### v1.1 (Yakında)
- [ ] E2E testler (Playwright)
- [ ] Performance monitoring
- [ ] Analytics entegrasyonu
- [ ] Sentry error tracking

### v1.2 (Planlanan)
- [ ] Sosyal özellikler (arkadaş ekleme)
- [ ] Liderlik tablosu
- [ ] Başarı rozetleri
- [ ] Özel kurslar

### v2.0 (Gelecek)
- [ ] Çoklu dil desteği
- [ ] Video içerikler
- [ ] Canlı dersler
- [ ] Premium abonelik

## 🤝 Katkıda Bulunma

1. Fork edin
2. Feature branch oluşturun (`git checkout -b feature/AmazingFeature`)
3. Değişikliklerinizi commit edin (`git commit -m 'Add some AmazingFeature'`)
4. Branch'inizi push edin (`git push origin feature/AmazingFeature`)
5. Pull Request açın

## 📝 Lisans

Bu proje MIT lisansı altında lisanslanmıştır. Detaylar için [LICENSE](LICENSE) dosyasına bakın.

## 👨‍💻 Geliştirici

**MemoLingua Team**
- Website: [memolingua.com](https://memolingua.com)
- Email: support@memolingua.com

## 🙏 Teşekkürler

- [Google Gemini](https://ai.google.dev/) - AI capabilities
- [Firebase](https://firebase.google.com/) - Backend infrastructure
- [Lucide](https://lucide.dev/) - Beautiful icons
- [TailwindCSS](https://tailwindcss.com/) - Styling framework

---

**⭐ Projeyi beğendiyseniz yıldız vermeyi unutmayın!**

