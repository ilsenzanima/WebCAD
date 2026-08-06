import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ilsenzanima.webcad',
  appName: 'Finanza Privata',
  webDir: 'out',
  server: {
    // Modifica questo URL con l'indirizzo reale del sito Vercel su cui e' pubblicato il gestionale
    url: 'https://web-cad-lac.vercel.app',
    cleartext: true,
    allowNavigation: ['*']
  }
};

export default config;
