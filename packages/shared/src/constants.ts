export const APP_CONFIG = {
  appName: 'NagarBondhu AI',
  appNameBn: 'নগরবন্ধু এআই',
  tagline: 'AI-Powered Urban Problem Intelligence Platform',
  taglineBn: 'নাগরিক সমস্যা সমাধান ও স্মার্ট নগর পরিকল্পনা সহায়ক প্ল্যাটফর্ম',
  targetCity: 'Rajshahi, Bangladesh',
  targetCityBn: 'রাজশাহী সিটি কর্পোরেশন এলাকা',
  rajshahiCoordinates: {
    latitude: 24.3636,
    longitude: 88.6241, // Shaheb Bazar Zero Point
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  },
  disclaimerBn: 'সতর্কবার্তা: নগরবন্ধু এআই একটি স্বতন্ত্র সিদ্ধান্ত-সহায়ক প্ল্যাটফর্ম। এটি রাজশাহী সিটি কর্পোরেশনের অভ্যন্তরীণ ব্যবস্থা নয়।',
  priorityThresholds: {
    critical: 85,
    high: 65,
    medium: 45,
  },
  duplicateRadiusMeters: 300,
  maxImageSizeBytes: 5 * 1024 * 1024, // 5MB
  allowedImageMimes: ['image/jpeg', 'image/png', 'image/webp'],
};
