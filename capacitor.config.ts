import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.vercel.mobinquran.twa',
  appName: 'قرآن مبین',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
