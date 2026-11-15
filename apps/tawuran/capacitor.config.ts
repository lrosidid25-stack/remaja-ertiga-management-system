import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'id.remajaertiga.tawuran',
  appName: 'Tawuran: Jalanan Sore',
  webDir: 'dist',
  // Semua aset di-bundel ke dalam APK → game tetap jalan tanpa internet.
  android: {
    allowMixedContent: false,
    // Warna latar WebView, mencegah layar putih saat start.
    backgroundColor: '#09090b',
    webContentsDebuggingEnabled: false,
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;
