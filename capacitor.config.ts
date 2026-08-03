import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.godj.app",
  appName: "Go DJ!",
  webDir: "dist",
  android: {
    backgroundColor: "#090b12",
  },
  server: {
    cleartext: false,
  },
};

export default config;
