import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.stonksu.app',
  appName: 'Stonksu',
  webDir: 'dist',
  android: {
    // Same carbon as iOS, so there's no white flash before the web view paints.
    backgroundColor: '#171717',
  },
  ios: {
    // Matches --color-carbon-900 so there's no white flash before the web view paints.
    backgroundColor: '#171717',
    // Let the web view run edge-to-edge; every screen pads itself with
    // env(safe-area-inset-*). Using 'always' here would inset natively too and
    // the notch gap would be applied twice.
    contentInset: 'never',
  },
};

export default config;
