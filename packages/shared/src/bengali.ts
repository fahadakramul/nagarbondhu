import { ReportCategory, ReportStatus, PriorityLevel } from './types';

export const CATEGORY_METADATA: Record<
  ReportCategory,
  {
    nameEn: string;
    nameBn: string;
    icon: string;
    color: string;
    descriptionBn: string;
  }
> = {
  ROAD_DAMAGE: {
    nameEn: 'Road Damage & Potholes',
    nameBn: 'সড়ক ক্ষতি ও খানাখন্দ',
    icon: 'road-variant',
    color: '#D97706', // amber-600
    descriptionBn: 'ভাঙা রাস্তা, বড় গর্ত, পিচ উঠে যাওয়া অথবা বিপজ্জনক সড়ক অবস্থা।',
  },
  WATERLOGGING: {
    nameEn: 'Waterlogging',
    nameBn: 'জলাবদ্ধতা ও পানি জমা',
    icon: 'water-alert',
    color: '#0284C7', // sky-600
    descriptionBn: 'বৃষ্টির পরে বা সাধারণ অবস্থায় রাস্তায় জমে থাকা পানি ও জলাবদ্ধতা।',
  },
  DRAINAGE: {
    nameEn: 'Drainage Problem',
    nameBn: 'ড্রেনেজ ও নর্দমা সমস্যা',
    icon: 'pipe-leak',
    color: '#0D9488', // teal-600
    descriptionBn: 'ড্রেন উপচে পড়া, ময়লা জমে জ্যাম হওয়া, বা উন্মুক্ত বিপদজ্জনক ম্যানহোল।',
  },
  WASTE: {
    nameEn: 'Solid Waste & Garbage',
    nameBn: 'বর্জ্য ও ময়লার স্তূপ',
    icon: 'trash-can-outline',
    color: '#E11D48', // rose-600
    descriptionBn: 'রাস্তায় আবর্জনার স্তূপ, উপচে পড়া ডাস্টবিন বা দুর্গন্ধযুক্ত পরিবেশ।',
  },
  FOOTPATH: {
    nameEn: 'Footpath & Pedestrian Safety',
    nameBn: 'ভাঙা ফুটপাথ ও পথচারী নিরাপত্তা',
    icon: 'walk',
    color: '#7C3AED', // violet-600
    descriptionBn: 'ভাঙা বা বেদখল ফুটপাথ, যা পথচারীদের নিরাপদ চলাচলে বিঘ্ন ঘটায়।',
  },
  STREETLIGHT: {
    nameEn: 'Broken Streetlight',
    nameBn: 'অচল সড়কবাতি',
    icon: 'lightbulb-off-outline',
    color: '#CA8A04', // yellow-600
    descriptionBn: 'রাস্তার বাতি নষ্ট বা অন্ধকার সড়ক, যা রাতের নিরাপত্তা ঝুঁকিপূর্ণ করে।',
  },
  OTHER: {
    nameEn: 'Other Civic Issue',
    nameBn: 'অন্যান্য নাগরিক সমস্যা',
    icon: 'alert-circle-outline',
    color: '#64748B', // slate-500
    descriptionBn: 'অন্যান্য সার্বজনীন নাগরিক অবকাঠামোগত সমস্যা।',
  },
};

export const STATUS_METADATA: Record<
  ReportStatus,
  {
    nameEn: string;
    nameBn: string;
    color: string;
    bgColor: string;
  }
> = {
  SUBMITTED: {
    nameEn: 'Submitted',
    nameBn: 'জমা দেওয়া হয়েছে',
    color: '#64748B',
    bgColor: '#F1F5F9',
  },
  AI_ANALYZED: {
    nameEn: 'AI Analyzed',
    nameBn: 'এআই বিশ্লেষিত',
    color: '#0284C7',
    bgColor: '#E0F2FE',
  },
  UNDER_REVIEW: {
    nameEn: 'Under Review',
    nameBn: 'পর্যালোচনাধীন',
    color: '#D97706',
    bgColor: '#FEF3C7',
  },
  IN_PROGRESS: {
    nameEn: 'In Progress',
    nameBn: 'সমাধানের কাজ চলছে',
    color: '#7C3AED',
    bgColor: '#EDE9FE',
  },
  RESOLVED: {
    nameEn: 'Resolved',
    nameBn: 'সমাধান সম্পন্ন',
    color: '#059669',
    bgColor: '#D1FAE5',
  },
  REJECTED: {
    nameEn: 'Rejected',
    nameBn: 'বাতিলকৃত',
    color: '#DC2626',
    bgColor: '#FEE2E2',
  },
};

export const PRIORITY_METADATA: Record<
  PriorityLevel,
  {
    nameEn: string;
    nameBn: string;
    color: string;
    badgeColor: string;
  }
> = {
  LOW: {
    nameEn: 'Low Priority',
    nameBn: 'স্বাভাবিক অগ্রাধিকার',
    color: '#10B981',
    badgeColor: '#D1FAE5',
  },
  MEDIUM: {
    nameEn: 'Medium Priority',
    nameBn: 'মধ্যম অগ্রাধিকার',
    color: '#F59E0B',
    badgeColor: '#FEF3C7',
  },
  HIGH: {
    nameEn: 'High Priority',
    nameBn: 'উচ্চ অগ্রাধিকার',
    color: '#EF4444',
    badgeColor: '#FEE2E2',
  },
  CRITICAL: {
    nameEn: 'Critical Safety Alert',
    nameBn: 'জরুরি নিরাপত্তা সতর্কতা',
    color: '#B91C1C',
    badgeColor: '#FCA5A5',
  },
};

export const RAJSHAHI_WARDS = [
  {
    wardNumber: 1,
    wardName: 'ওয়ার্ড ০১ (কাজীহাটা - কোর্ট চত্বর)',
    areaDescription: 'কাজীহাটা, কোর্ট স্টেশন, সিপাইপাড়া এলাকা',
    centerLatitude: 24.3820,
    centerLongitude: 88.5895,
  },
  {
    wardNumber: 2,
    wardName: 'ওয়ার্ড ০২ (মহিষবাথান - রাজপাড়া)',
    areaDescription: 'রাজপাড়া থানা, মহিষবাথান ও সংলগ্ন এলাকা',
    centerLatitude: 24.3785,
    centerLongitude: 88.5760,
  },
  {
    wardNumber: 9,
    wardName: 'ওয়ার্ড ০৯ (বোয়ালিয়া - সাগরপাড়া)',
    areaDescription: 'সাগরপাড়া, ঘোড়ামারা, বোয়ালিয়া মডেল থানা সংলগ্ন',
    centerLatitude: 24.3685,
    centerLongitude: 88.6015,
  },
  {
    wardNumber: 12,
    wardName: 'ওয়ার্ড ১২ (সাহেব বাজার - জিরো পয়েন্ট)',
    areaDescription: 'জিরো পয়েন্ট, সাহেব বাজার আরডিএ মার্কেট এলাকা',
    centerLatitude: 24.3636,
    centerLongitude: 88.6241,
  },
  {
    wardNumber: 14,
    wardName: 'ওয়ার্ড ১৪ (উপশহর - সেনানিবাস সংলগ্ন)',
    areaDescription: 'উপশহর হাউজিং এস্টেট ও নিউমার্কেট এলাকা',
    centerLatitude: 24.3752,
    centerLongitude: 88.6045,
  },
  {
    wardNumber: 21,
    wardName: 'ওয়ার্ড ২১ (শিরোইল - রেলওয়ে স্টেশন)',
    areaDescription: 'শিরোইল বাস টার্মিনাল, রাজশাহী রেলওয়ে স্টেশন চত্বর',
    centerLatitude: 24.3735,
    centerLongitude: 88.6130,
  },
  {
    wardNumber: 25,
    wardName: 'ওয়ার্ড ২৫ (তালাইমারী - ভদ্রা)',
    areaDescription: 'ভদ্রা মোড়, তালাইমারী শহীদ মিনার সংলগ্ন এলাকা',
    centerLatitude: 24.3708,
    centerLongitude: 88.6368,
  },
  {
    wardNumber: 28,
    wardName: 'ওয়ার্ড ২৮ (মতিহার - রাজশাহী বিশ্ববিদ্যালয়)',
    areaDescription: 'কাজলা, মতিহার চত্বর ও রাবি প্রধান ফটক এলাকা',
    centerLatitude: 24.3680,
    centerLongitude: 88.6430,
  },
  {
    wardNumber: 30,
    wardName: 'ওয়ার্ড ৩০ (বিনোদপুর - রুয়েট চত্বর)',
    areaDescription: 'বিনোদপুর বাজার ও রুয়েট ক্যাম্পাস সংলগ্ন সড়ক',
    centerLatitude: 24.3640,
    centerLongitude: 88.6480,
  },
];
