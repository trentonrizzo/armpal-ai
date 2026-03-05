import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.armpal.app',
  appName: 'ArmPal',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
