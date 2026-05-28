import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ilsenzanima.webcad',
  appName: 'WebCAD',
  webDir: 'out',
  server: {
    // Modifica questo URL con l'indirizzo reale del tuo sito Vercel (es. https://webcad-antincendio.vercel.app)
    url: 'https://webcad-antincendio.vercel.app',
    cleartext: true,
    allowNavigation: ['*']
  }
};

export default config;
