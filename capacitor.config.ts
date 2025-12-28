import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.memolingua.app',
  appName: 'MemoLingua',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    Keyboard: {
      resize: 'body',
      style: 'dark',
      resizeOnFullScreen: true,
    },
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#09090b",
      showSpinner: true,
      spinnerColor: "#ffffff",
    },
  }
};

export default config;