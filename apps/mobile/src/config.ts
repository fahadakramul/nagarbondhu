// Set this to the verified Render service URL when deployment completes.
// Expo embeds EXPO_PUBLIC_ variables into the app at build time.
export const APP_SERVER_BASE_URL = (
  process.env.EXPO_PUBLIC_APP_SERVER_URL || 'https://enclose-lyricism-punctured.ngrok-free.dev'
).trim().replace(/\/+$/, '');

export const API_BASE_URL = `${APP_SERVER_BASE_URL}/api/v1`;
