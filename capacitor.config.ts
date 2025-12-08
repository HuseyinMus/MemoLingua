
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.memolingua.app',
  appName: 'MemoLingua',
  webDir: 'dist', // Vite/React build output directory
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
      backgroundColor: "#09090b", // Zinc 950
      showSpinner: true,
      spinnerColor: "#ffffff",
    },
  }
};

export default config;
