import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.apmart.app',
  appName: 'AP Mart',
  // Produced by `npm run build:mobile` (vite build --mode mobile).
  webDir: '.output/public',
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
