import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.stonksu.app',
  appName: 'Stonksu',
  webDir: 'dist',
  ios: {
    // Matches --color-carbon-900 so there's no white flash before the web view paints.
    backgroundColor: '#171717',
    // The app is dark-only; keep the web view from tinting scroll edges.
    contentInset: 'always',
  },
};

export default config;
