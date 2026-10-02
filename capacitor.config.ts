import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'eu.postgresql.pgconfscanner',
  appName: 'PGConf Scanner',
  webDir: 'build',
  android: {
    // Keep the WebView clear of the status and navigation bars, which
    // Android 15+ draws over the app by default (edge-to-edge)
    adjustMarginsForEdgeToEdge: 'auto',
  },
};

export default config;
