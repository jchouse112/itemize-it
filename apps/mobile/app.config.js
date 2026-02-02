module.exports = {
  expo: {
    name: "Itemize-It",
    slug: "itemize-it",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    scheme: "itemize-it",
    userInterfaceStyle: "dark",
    newArchEnabled: true,
    splash: {
      image: "./assets/II_splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#0F1115"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.recevity.itemize-it"
    },
    android: {
      jsEngine: "hermes",
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#0F1115"
      },
      package: "com.recevity.itemize_it"
    },
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/favicon.png"
    },
    plugins: [
      "expo-router",
      [
        "expo-camera",
        {
          cameraPermission: "Allow Itemize-It to access your camera to scan receipts."
        }
      ],
      [
        "expo-image-picker",
        {
          photosPermission: "Allow Itemize-It to access your photos to import receipts."
        }
      ],
      [
        "expo-build-properties",
        {
          android: {
            compileSdkVersion: 35,
            targetSdkVersion: 35,
            minSdkVersion: 24
          }
        }
      ],
      [
        "expo-notifications",
        {
          icon: "./assets/notification-icon.png",
          color: "#FF5F00"
        }
      ],
      // Custom plugin to fix Gradle plugin resolution in pnpm monorepos
      "../../plugins/withMonorepoGradle"
    ],
    experiments: {
      typedRoutes: true
    },
    extra: {
      router: {
        origin: false
      },
      // Supabase credentials available via Constants.expoConfig.extra
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      // Backend API URL for AI extraction calls
      apiUrl: process.env.EXPO_PUBLIC_API_URL || 'https://itemize-it.com'
    }
  }
};
