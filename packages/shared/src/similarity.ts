import { ReportCategory } from './types';

/**
 * Calculates geographic distance in meters between two lat/lng coordinates
 * using the Haversine formula.
 */
export function calculateHaversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

const BENGALI_STOPWORDS = new Set([
  'এই', 'এবং', 'ও', 'যে', 'না', 'হবে', 'হয়েছে', 'হচ্ছে', 'আছে', 'করে',
  'দিয়ে', 'থেকে', 'পর', 'একটি', 'খুব', 'অনেক', 'জন্য', 'এখানে', 'তা', 'যা'
]);

/**
 * Tokenizes and normalizes text for Bengali and English similarity
 */
export function tokenizeText(text: string): Set<string> {
  const clean = (text || '')
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()।?]/g, ' ')
    .trim();

  const words = clean.split(/\s+/).filter((w) => w.length > 2 && !BENGALI_STOPWORDS.has(w));
  return new Set(words);
}

/**
 * Computes Jaccard token similarity between two text strings (0.0 to 1.0)
 */
export function calculateTextSimilarity(text1: string, text2: string): number {
  const tokens1 = tokenizeText(text1);
  const tokens2 = tokenizeText(text2);

  if (tokens1.size === 0 || tokens2.size === 0) return 0;

  let intersection = 0;
  tokens1.forEach((token) => {
    if (tokens2.has(token)) intersection++;
  });

  const union = new Set([...tokens1, ...tokens2]).size;
  if (union === 0) return 0;

  return Math.round((intersection / union) * 100) / 100;
}

/**
 * Checks if two categories are identical or closely related
 */
export function getCategorySimilarity(cat1: ReportCategory, cat2: ReportCategory): number {
  if (cat1 === cat2) return 1.0;
  // DRAINAGE and WATERLOGGING are strongly interrelated
  if (
    (cat1 === 'DRAINAGE' && cat2 === 'WATERLOGGING') ||
    (cat1 === 'WATERLOGGING' && cat2 === 'DRAINAGE')
  ) {
    return 0.7;
  }
  // ROAD_DAMAGE and FOOTPATH are pedestrian/surface infrastructure
  if (
    (cat1 === 'ROAD_DAMAGE' && cat2 === 'FOOTPATH') ||
    (cat1 === 'FOOTPATH' && cat2 === 'ROAD_DAMAGE')
  ) {
    return 0.5;
  }
  return 0.0;
}

export interface DuplicateAssessmentResult {
  isPossibleDuplicate: boolean;
  similarityScore: number; // 0.0 to 1.0
  distanceMeters: number;
  categoryMatch: boolean;
  textSimilarityPercentage: number;
  matchingReasons: {
    distanceMeters: number;
    distanceExplanation: string;
    categoryMatch: boolean;
    textSimilarityPercentage: number;
    textMatchExplanation: string;
  };
}

/**
 * Assesses whether two reports are potential duplicates based on
 * distance, category relation, and text similarity.
 * Configurable max distance threshold is 300 meters.
 */
export function assessDuplicate(
  reportA: { latitude: number; longitude: number; category: ReportCategory; description: string; title: string },
  reportB: { latitude: number; longitude: number; category: ReportCategory; description: string; title: string },
  maxDistanceRadiusMeters = 300
): DuplicateAssessmentResult {
  const distance = calculateHaversineDistanceMeters(
    reportA.latitude,
    reportA.longitude,
    reportB.latitude,
    reportB.longitude
  );

  // Geographic distance score (1.0 at 0m, decaying to 0 at maxDistanceRadiusMeters)
  const distanceScore = distance <= maxDistanceRadiusMeters
    ? Math.max(0, 1 - distance / maxDistanceRadiusMeters)
    : 0;

  const categoryScore = getCategorySimilarity(reportA.category, reportB.category);
  const textScore = Math.max(
    calculateTextSimilarity(reportA.title + ' ' + reportA.description, reportB.title + ' ' + reportB.description),
    calculateTextSimilarity(reportA.description, reportB.description)
  );

  // Weighted total similarity score
  // Distance is highest signal (0.50), followed by Category (0.25) and Text (0.25)
  const similarityScore = Math.round((0.50 * distanceScore + 0.25 * categoryScore + 0.25 * textScore) * 100) / 100;

  const distanceExplanation = distance < 30
    ? `হুবহু একই জায়গায় (দূরত্ব মাত্র ${distance} মিটার)`
    : distance <= 100
    ? `খুব কাছাকাছি এলাকায় অবস্থিত (দূরত্ব ${distance} মিটার)`
    : `নিকটবর্তী এলাকায় (দূরত্ব ${distance} মিটার)`;

  const textMatchExplanation = textScore >= 0.4
    ? `বর্ণনা ও শব্দের মধ্যে উচ্চ মিল রয়েছে (${Math.round(textScore * 100)}%)`
    : textScore >= 0.15
    ? `বর্ণনায় আংশিক মিল পাওয়া গেছে (${Math.round(textScore * 100)}%)`
    : `বর্ণনায় স্বতন্ত্র বিবরণ রয়েছে`;

  // Flag as duplicate if within radius and score >= 0.45 or exact same spot with same category
  const isPossibleDuplicate =
    distance <= maxDistanceRadiusMeters &&
    ((distance <= 50 && categoryScore >= 0.7) || similarityScore >= 0.45);

  return {
    isPossibleDuplicate,
    similarityScore,
    distanceMeters: distance,
    categoryMatch: categoryScore >= 0.7,
    textSimilarityPercentage: Math.round(textScore * 100),
    matchingReasons: {
      distanceMeters: distance,
      distanceExplanation,
      categoryMatch: categoryScore >= 0.7,
      textSimilarityPercentage: Math.round(textScore * 100),
      textMatchExplanation,
    },
  };
}
