import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Modal,
  Alert,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { api } from './src/services/api';
import {
  Report,
  ReportCategory,
  ReportStatus,
  PriorityLevel,
  DashboardSummary,
  AiAnalysisData,
  CATEGORY_METADATA,
  STATUS_METADATA,
  PRIORITY_METADATA,
  RAJSHAHI_WARDS,
} from '@nagarbondhu/shared';

type Tab = 'home' | 'report' | 'map' | 'reports_list' | 'dashboard';

export default function App() {
  const [currentTab, setCurrentTab] = useState<Tab>('home');
  const [isAdminMode, setIsAdminMode] = useState<boolean>(false);

  // Home & Dashboard state
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // Report creation form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedWard, setSelectedWard] = useState(RAJSHAHI_WARDS[3]); // Shaheb Bazar by default
  const [latitude, setLatitude] = useState(24.3636);
  const [longitude, setLongitude] = useState(88.6241);
  const [addressLabel, setAddressLabel] = useState('সাহেব বাজার জিরো পয়েন্ট, রাজশাহী');
  const [imageUrl, setImageUrl] = useState('');
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [selectedImageBase64, setSelectedImageBase64] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [userSelectedCategory, setUserSelectedCategory] = useState<ReportCategory | null>(null);

  // AI analysis preview state
  const [aiPreview, setAiPreview] = useState<AiAnalysisData | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Detail modal state
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [statusUpdateNote, setStatusUpdateNote] = useState('');

  // Map state
  const [mapCategoryFilter, setMapCategoryFilter] = useState<string>('ALL');
  const [mapPriorityFilter, setMapPriorityFilter] = useState<string>('ALL');
  const [selectedMapMarker, setSelectedMapMarker] = useState<any | null>(null);

  // Fetch initial data
  useEffect(() => {
    loadData();
  }, [isAdminMode]);

  const loadData = async () => {
    try {
      setLoading(true);
      // If admin mode, login as demo admin to authenticate requests
      if (isAdminMode) {
        await api.login('admin@nagarbondhu.gov.bd', 'DemoAdmin123!').catch(() => {});
      } else {
        api.setAuthToken(null);
      }

      const [summaryRes, reportsRes] = await Promise.all([
        api.getDashboardSummary().catch(() => ({ data: null })),
        api.getReports().catch(() => ({ reports: [] })),
      ]);

      if (summaryRes.data) setSummary(summaryRes.data);
      if (reportsRes.reports) setReports(reportsRes.reports);
    } catch (e) {
      console.error('Error fetching data:', e);
    } finally {
      setLoading(false);
    }
  };

  // Run AI analysis preview
  const handleAnalyzeWithAi = async () => {
    if (!description.trim()) {
      alert('অনুগ্রহ করে আগে সমস্যার বর্ণনা লিখুন।');
      return;
    }

    try {
      setIsAnalyzing(true);
      const res = await api.analyzeComplaint(description);
      setAiPreview(res.data);
      if (!title) {
        setTitle(res.data.summary.slice(0, 40));
      }
    } catch (e: any) {
      alert(e.message || 'এআই বিশ্লেষণ চালানো যায়নি');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Submit report
  const handleSubmitReport = async () => {
    if (!title.trim() || !description.trim()) {
      alert('শিরোনাম ও বিস্তারিত বিবরণ পূরণ করুন।');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await api.createReport({
        title,
        description,
        userCategory: userSelectedCategory || undefined,
        latitude,
        longitude,
        addressLabel,
        wardId: `ward-${selectedWard.wardNumber}`,
        imageUrl: imageUrl.trim() || null,
      });

      alert(
        `সফলভাবে জমা হয়েছে!\nএআই ক্যাটাগরি: ${
          CATEGORY_METADATA[res.report.category]?.nameBn
        }\nপ্রায়োরিটি স্কোর: ${res.report.priorityAssessment?.score || 'স্বাভাবিক'}`
      );

      // Reset form
      setTitle('');
      setDescription('');
      setImageUrl('');
      setAiPreview(null);
      setUserSelectedCategory(null);
      loadData();
      setCurrentTab('reports_list');
    } catch (e: any) {
      alert(e.message || 'রিপোর্ট জমা দিতে ব্যর্থ হয়েছে');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Admin status update
  const handleStatusUpdate = async (newStatus: ReportStatus) => {
    if (!selectedReport) return;
    try {
      await api.updateReportStatus(selectedReport.id, newStatus, statusUpdateNote);
      alert(`স্ট্যাটাস আপডেট হয়েছে: ${STATUS_METADATA[newStatus].nameBn}`);
      setStatusUpdateNote('');
      setSelectedReport(null);
      loadData();
    } catch (e: any) {
      alert(e.message || 'স্ট্যাটাস আপডেট ব্যর্থ');
    }
  };

  // Admin priority override
  const handlePriorityOverride = async (newPriority: PriorityLevel) => {
    if (!selectedReport) return;
    try {
      await api.overridePriority(
        selectedReport.id,
        newPriority,
        'প্ল্যানার কর্তৃক মাঠ পর্যায়ের পর্যবেক্ষণে প্রায়োরিটি পরিবর্তন'
      );
      alert(`প্রায়োরিটি পরিবর্তন হয়েছে: ${PRIORITY_METADATA[newPriority].nameBn}`);
      setSelectedReport(null);
      loadData();
    } catch (e: any) {
      alert(e.message || 'প্রায়োরিটি পরিবর্তন ব্যর্থ');
    }
  };

  // Admin duplicate confirm/dismiss
  const handleReviewDuplicate = async (dupId: string, status: 'CONFIRMED_DUPLICATE' | 'DISMISSED') => {
    try {
      await api.reviewDuplicate(dupId, status);
      alert(status === 'CONFIRMED_DUPLICATE' ? 'ডুপ্লিকেট নিশ্চিত করা হয়েছে' : 'ডুপ্লিকেট বাতিল করা হয়েছে');
      loadData();
    } catch (e: any) {
      alert(e.message || 'ডুপ্লিকেট পর্যালোচনা ব্যর্থ');
    }
  };

  // Render navigation bar
  const renderNavBar = () => (
    <View style={styles.navBar}>
      <TouchableOpacity
        style={[styles.navItem, currentTab === 'home' && styles.navItemActive]}
        onPress={() => setCurrentTab('home')}
      >
        <Text style={[styles.navText, currentTab === 'home' && styles.navTextActive]}>হোম</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.navItem, currentTab === 'report' && styles.navItemActive]}
        onPress={() => setCurrentTab('report')}
      >
        <Text style={[styles.navText, currentTab === 'report' && styles.navTextActive]}>রিপোর্ট</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.navItem, currentTab === 'map' && styles.navItemActive]}
        onPress={() => setCurrentTab('map')}
      >
        <Text style={[styles.navText, currentTab === 'map' && styles.navTextActive]}>ম্যাপ</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.navItem, currentTab === 'reports_list' && styles.navItemActive]}
        onPress={() => setCurrentTab('reports_list')}
      >
        <Text style={[styles.navText, currentTab === 'reports_list' && styles.navTextActive]}>তালিকা</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.navItem, currentTab === 'dashboard' && styles.navItemActive]}
        onPress={() => setCurrentTab('dashboard')}
      >
        <Text style={[styles.navText, currentTab === 'dashboard' && styles.navTextActive]}>ড্যাশবোর্ড</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F766E" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.logoTitle}>নগরবন্ধু এআই</Text>
          <Text style={styles.logoSubtitle}>NagarBondhu AI • রাজশাহী</Text>
        </View>

        {/* Role Toggle Switch for Competition Judges */}
        <TouchableOpacity
          style={[styles.roleBadge, isAdminMode ? styles.roleBadgeAdmin : styles.roleBadgeCitizen]}
          onPress={() => setIsAdminMode(!isAdminMode)}
        >
          <Text style={styles.roleBadgeText}>
            {isAdminMode ? '🛡️ অ্যাডমিন / প্ল্যানার' : '👤 নাগরিক ভিউ'}
          </Text>
          <Text style={styles.roleSwitchHint}>ট্যাপ করে পরিবর্তন</Text>
        </TouchableOpacity>
      </View>

      {/* Main Content Area */}
      <View style={styles.content}>
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#0F766E" />
            <Text style={styles.loadingText}>ডাটা লোড হচ্ছে...</Text>
          </View>
        )}

        {/* TAB 1: HOME */}
        {currentTab === 'home' && (
          <ScrollView style={styles.scrollArea}>
            {/* Banner */}
            <View style={styles.heroCard}>
              <Text style={styles.heroBadge}>BIP Apps4Solutions MVP</Text>
              <Text style={styles.heroTitle}>স্মার্ট নগর পরিকল্পনা ও নাগরিক সমস্যা সমাধান</Text>
              <Text style={styles.heroDesc}>
                রাজশাহী শহরের ভাঙা সড়ক, জলাবদ্ধতা, উন্মুক্ত বর্জ্য ও সড়কবাতির অভিযোগ এআই প্রযুক্তিতে স্বয়ংক্রিয়ভাবে
                বিশ্লেষণ ও প্রায়োরিটাইজ করুন।
              </Text>

              <View style={styles.heroActionRow}>
                <TouchableOpacity
                  style={styles.heroBtnPrimary}
                  onPress={() => setCurrentTab('report')}
                >
                  <Text style={styles.heroBtnPrimaryText}>সমস্যা রিপোর্ট করুন ➕</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.heroBtnSecondary}
                  onPress={() => setCurrentTab('map')}
                >
                  <Text style={styles.heroBtnSecondaryText}>সমস্যার ম্যাপ 🗺️</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Live Stats */}
            <Text style={styles.sectionHeading}>রিয়েল-টাইম নাগরিক পরিসংখ্যান</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>{summary?.totalReports || reports.length}</Text>
                <Text style={styles.statLabel}>মোট রিপোর্ট</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statNumber, { color: '#EF4444' }]}>
                  {summary?.highPriorityReports || 0}
                </Text>
                <Text style={styles.statLabel}>উচ্চ অগ্রাধিকার</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statNumber, { color: '#059669' }]}>
                  {summary?.resolvedReports || 1}
                </Text>
                <Text style={styles.statLabel}>সমাধান সম্পন্ন</Text>
              </View>
            </View>

            {/* Categories Quick Overview */}
            <Text style={styles.sectionHeading}>প্রধান ক্যাটাগরিসমূহ</Text>
            <View style={styles.categoriesGrid}>
              {(Object.keys(CATEGORY_METADATA) as ReportCategory[]).map((cat) => {
                const meta = CATEGORY_METADATA[cat];
                return (
                  <View key={cat} style={[styles.catCard, { borderLeftColor: meta.color }]}>
                    <Text style={styles.catNameBn}>{meta.nameBn}</Text>
                    <Text style={styles.catNameEn}>{meta.nameEn}</Text>
                  </View>
                );
              })}
            </View>

            {/* Disclaimer */}
            <View style={styles.disclaimerBox}>
              <Text style={styles.disclaimerTitle}>সতর্কবার্তা ও ঘোষণা</Text>
              <Text style={styles.disclaimerText}>
                নগরবন্ধু এআই একটি স্বতন্ত্র সিদ্ধান্ত-সহায়ক প্ল্যাটফর্ম। এটি রাজশাহী সিটি কর্পোরেশনের অভ্যন্তরীণ
                দাপ্তরিক ব্যবস্থা নয়। প্রদর্শিত তথ্য নাগরিক রিপোর্ট ও কৃত্রিম বুদ্ধিমত্তা বিশ্লেষণের ভিত্তিতে উপস্থাপিত।
              </Text>
            </View>
            <View style={{ height: 40 }} />
          </ScrollView>
        )}

        {/* TAB 2: REPORT A PROBLEM */}
        {currentTab === 'report' && (
          <ScrollView style={styles.scrollArea}>
            <View style={styles.formContainer}>
              <Text style={styles.screenTitle}>নাগরিক সমস্যা রিপোর্ট করুন</Text>
              <Text style={styles.screenSubtitle}>
                বাংলা বা ইংরেজিতে সমস্যার বিবরণ দিন; এআই স্বয়ংক্রিয়ভাবে ক্যাটাগরি ও তীব্রতা নির্ধারণ করবে।
              </Text>

              {/* Description Input */}
              <Text style={styles.inputLabel}>সমস্যার বিস্তারিত বর্ণনা *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="যেমন: তালাইমারী শহীদ মিনারের সামনে ড্রেন উপচে কোমর সমান নোংরা পানি জমে আছে..."
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={4}
                value={description}
                onChangeText={setDescription}
              />

              {/* AI Trigger Button */}
              <TouchableOpacity
                style={styles.aiAnalyzeBtn}
                onPress={handleAnalyzeWithAi}
                disabled={isAnalyzing}
              >
                {isAnalyzing ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.aiAnalyzeBtnText}>✨ এআই বিশ্লেষণ চালান (AI Preview)</Text>
                )}
              </TouchableOpacity>

              {/* AI Analysis Preview Card */}
              {aiPreview && (
                <View style={styles.aiCard}>
                  <View style={styles.aiCardHeader}>
                    <Text style={styles.aiCardTitle}>🤖 এআই বিশ্লেষণ ফলাফল</Text>
                    <View style={styles.aiBadge}>
                      <Text style={styles.aiBadgeText}>
                        {CATEGORY_METADATA[aiPreview.category]?.nameBn}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.aiSummaryText}>{aiPreview.summary}</Text>

                  <View style={styles.aiSeverityRow}>
                    <Text style={styles.aiSeverityLabel}>অনুমানিত তীব্রতা (Severity):</Text>
                    <Text style={styles.aiSeverityValue}>{aiPreview.severity} / ৫</Text>
                  </View>

                  <Text style={styles.aiReasonsHeader}>কারণসমূহ:</Text>
                  {aiPreview.reasons.map((r, i) => (
                    <Text key={i} style={styles.aiReasonItem}>
                      • {r}
                    </Text>
                  ))}

                  {aiPreview.missing_information && aiPreview.missing_information.length > 0 && (
                    <View style={styles.missingInfoBox}>
                      <Text style={styles.missingInfoTitle}>অনুপস্থিত তথ্য:</Text>
                      {aiPreview.missing_information.map((m, i) => (
                        <Text key={i} style={styles.missingInfoItem}>
                          ? {m}
                        </Text>
                      ))}
                    </View>
                  )}

                  {/* Option to override AI category */}
                  <Text style={styles.overrideLabel}>ক্যাটাগরি পরিবর্তন করতে চান?</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.overrideScroll}>
                    {(Object.keys(CATEGORY_METADATA) as ReportCategory[]).map((cat) => (
                      <TouchableOpacity
                        key={cat}
                        style={[
                          styles.catPill,
                          userSelectedCategory === cat && styles.catPillSelected,
                        ]}
                        onPress={() => setUserSelectedCategory(cat)}
                      >
                        <Text
                          style={[
                            styles.catPillText,
                            userSelectedCategory === cat && styles.catPillTextSelected,
                          ]}
                        >
                          {CATEGORY_METADATA[cat].nameBn}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Title Input */}
              <Text style={styles.inputLabel}>সংক্ষিপ্ত শিরোনাম *</Text>
              <TextInput
                style={styles.input}
                placeholder="যেমন: রাস্তায় বড় গর্ত ও পানি জমে থাকা"
                placeholderTextColor="#94A3B8"
                value={title}
                onChangeText={setTitle}
              />

              {/* Rajshahi Location Selector */}
              <Text style={styles.inputLabel}>রাজশাহীর এলাকা / ওয়ার্ড নির্বাচন *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.wardScroll}>
                {RAJSHAHI_WARDS.map((w) => (
                  <TouchableOpacity
                    key={w.wardNumber}
                    style={[
                      styles.wardPill,
                      selectedWard.wardNumber === w.wardNumber && styles.wardPillActive,
                    ]}
                    onPress={() => {
                      setSelectedWard(w);
                      setLatitude(w.centerLatitude);
                      setLongitude(w.centerLongitude);
                      setAddressLabel(`${w.wardName}, রাজশাহী`);
                    }}
                  >
                    <Text
                      style={[
                        styles.wardPillText,
                        selectedWard.wardNumber === w.wardNumber && styles.wardPillTextActive,
                      ]}
                    >
                      {w.wardName}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.locationCoords}>
                স্থানাঙ্ক: {latitude.toFixed(4)}, {longitude.toFixed(4)} ({addressLabel})
              </Text>

              {/* Image URL / Photo field */}
              <Text style={styles.inputLabel}>ছবির লিঙ্ক (ঐচ্ছিক)</Text>
              <TextInput
                style={styles.input}
                placeholder="https://example.com/pothole.jpg"
                placeholderTextColor="#94A3B8"
                value={imageUrl}
                onChangeText={setImageUrl}
              />

              {/* Submit Button */}
              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleSubmitReport}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitBtnText}>রিপোর্ট জমা দিন 🚀</Text>
                )}
              </TouchableOpacity>
            </View>
            <View style={{ height: 40 }} />
          </ScrollView>
        )}

        {/* TAB 3: URBAN PROBLEM MAP */}
        {currentTab === 'map' && (
          <View style={styles.mapContainer}>
            {/* Map Filters */}
            <View style={styles.mapFilterBar}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <TouchableOpacity
                  style={[styles.filterChip, mapCategoryFilter === 'ALL' && styles.filterChipActive]}
                  onPress={() => setMapCategoryFilter('ALL')}
                >
                  <Text style={styles.filterChipText}>সব ক্যাটাগরি</Text>
                </TouchableOpacity>

                {(Object.keys(CATEGORY_METADATA) as ReportCategory[]).map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[
                      styles.filterChip,
                      mapCategoryFilter === c && styles.filterChipActive,
                    ]}
                    onPress={() => setMapCategoryFilter(c)}
                  >
                    <Text style={styles.filterChipText}>{CATEGORY_METADATA[c].nameBn}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Interactive Problem Points List & Grid */}
            <ScrollView style={styles.mapPointsList}>
              <View style={styles.mapBanner}>
                <Text style={styles.mapBannerTitle}>🗺️ রাজশাহী নগর সমস্যা হটস্পট ম্যাপ</Text>
                <Text style={styles.mapBannerDesc}>
                  মোট চিহ্নিত মার্কার: {reports.length}টি | জিরো পয়েন্ট, তালাইমারী ও মতিহার ক্লাস্টার
                </Text>
              </View>

              {reports
                .filter((r) => mapCategoryFilter === 'ALL' || r.category === mapCategoryFilter)
                .map((r) => {
                  const meta = CATEGORY_METADATA[r.category];
                  const prioMeta = PRIORITY_METADATA[r.priorityAssessment?.priorityLevel || 'MEDIUM'];
                  return (
                    <TouchableOpacity
                      key={r.id}
                      style={[styles.mapPointCard, { borderLeftColor: meta.color }]}
                      onPress={() => setSelectedReport(r)}
                    >
                      <View style={styles.pointHeader}>
                        <Text style={styles.pointCategory}>{meta.nameBn}</Text>
                        <View style={[styles.prioBadge, { backgroundColor: prioMeta.badgeColor }]}>
                          <Text style={[styles.prioBadgeText, { color: prioMeta.color }]}>
                            {prioMeta.nameBn}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.pointTitle}>{r.title}</Text>
                      <Text style={styles.pointAddress}>📍 {r.addressLabel || 'রাজশাহী'}</Text>
                      <Text style={styles.pointCoords}>
                        GPS: {r.latitude.toFixed(4)}, {r.longitude.toFixed(4)}
                      </Text>

                      {r.possibleDuplicates && r.possibleDuplicates.length > 0 && (
                        <View style={styles.dupAlertPill}>
                          <Text style={styles.dupAlertPillText}>
                            ⚠️ সম্ভাব্য ডুপ্লিকেট চিহ্নিত ({r.possibleDuplicates.length}টি)
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
            </ScrollView>
          </View>
        )}

        {/* TAB 4: MY REPORTS / PUBLIC FEED */}
        {currentTab === 'reports_list' && (
          <ScrollView style={styles.scrollArea}>
            <View style={styles.feedHeader}>
              <Text style={styles.screenTitle}>সকল নাগরিক রিপোর্ট ও ট্র্যাকিং</Text>
              <Text style={styles.screenSubtitle}>
                প্রতিটি রিপোর্টের এআই বিশ্লেষণ, প্রায়োরিটি স্কোর ও সমাধান অগ্রগতি
              </Text>
            </View>

            {reports.map((r) => {
              const meta = CATEGORY_METADATA[r.category];
              const statMeta = STATUS_METADATA[r.status];
              const prioMeta = PRIORITY_METADATA[r.priorityAssessment?.priorityLevel || 'MEDIUM'];

              return (
                <TouchableOpacity
                  key={r.id}
                  style={styles.reportFeedCard}
                  onPress={() => setSelectedReport(r)}
                >
                  <View style={styles.feedCardTop}>
                    <View style={[styles.statusBadge, { backgroundColor: statMeta.bgColor }]}>
                      <Text style={[styles.statusBadgeText, { color: statMeta.color }]}>
                        {statMeta.nameBn}
                      </Text>
                    </View>
                    <View style={[styles.prioBadge, { backgroundColor: prioMeta.badgeColor }]}>
                      <Text style={[styles.prioBadgeText, { color: prioMeta.color }]}>
                        স্কোর {r.priorityAssessment?.score || 50} • {prioMeta.nameBn}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.feedTitle}>{r.title}</Text>
                  <Text style={styles.feedDesc} numberOfLines={2}>
                    {r.description}
                  </Text>

                  <View style={styles.feedFooter}>
                    <Text style={styles.feedLocation}>📍 {r.addressLabel || 'রাজশাহী'}</Text>
                    <Text style={styles.feedDate}>
                      {new Date(r.createdAt).toLocaleDateString('bn-BD')}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
            <View style={{ height: 40 }} />
          </ScrollView>
        )}

        {/* TAB 5: ADMIN / URBAN PLANNING DASHBOARD */}
        {currentTab === 'dashboard' && (
          <ScrollView style={styles.scrollArea}>
            <View style={styles.dashboardContainer}>
              <View style={styles.dashHeaderCard}>
                <Text style={styles.dashBadge}>অ্যাডমিন ও নগর পরিকল্পনাবিদ ড্যাশবোর্ড</Text>
                <Text style={styles.dashTitle}>রাজশাহী আরবান প্রবলেম ইন্টেলিজেন্স</Text>
                <Text style={styles.dashDesc}>
                  প্রকৃত ডাটাবেজ কোয়েরির ওপর ভিত্তি করে সমস্যা বিশ্লেষণ ও অগ্রাধিকার সুপারিশ
                </Text>
              </View>

              {/* KPI Cards */}
              <View style={styles.kpiRow}>
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiNum}>{summary?.totalReports || reports.length}</Text>
                  <Text style={styles.kpiLabel}>মোট অভিযোগ</Text>
                </View>
                <View style={styles.kpiCard}>
                  <Text style={[styles.kpiNum, { color: '#D97706' }]}>
                    {summary?.openReports || 0}
                  </Text>
                  <Text style={styles.kpiLabel}>উন্মুক্ত / প্রক্রিয়াধীন</Text>
                </View>
                <View style={styles.kpiCard}>
                  <Text style={[styles.kpiNum, { color: '#EF4444' }]}>
                    {summary?.criticalPriorityReports || 0}
                  </Text>
                  <Text style={styles.kpiLabel}>জরুরি সতর্কতা</Text>
                </View>
              </View>

              {/* Recommended Action Section */}
              <Text style={styles.sectionHeading}>🚨 অবিলম্বে তদন্তযোগ্য সুপারিশকৃত রিপোর্ট</Text>
              {summary?.recommendedActions.map((rec) => (
                <View key={rec.reportId} style={styles.recCard}>
                  <View style={styles.recHeader}>
                    <Text style={styles.recTitle}>{rec.title}</Text>
                    <Text style={styles.recScore}>স্কোর: {rec.score}</Text>
                  </View>
                  <Text style={styles.recReason}>💡 {rec.reason}</Text>
                  <Text style={styles.recLocation}>📍 {rec.location}</Text>
                </View>
              ))}

              {/* Category Breakdown */}
              <Text style={styles.sectionHeading}>📊 ক্যাটাগরিভিত্তিক বণ্টন</Text>
              <View style={styles.cardContainer}>
                {summary?.byCategory.map((cat) => (
                  <View key={cat.category} style={styles.catStatRow}>
                    <View style={styles.catStatLabels}>
                      <Text style={styles.catStatName}>{cat.categoryLabelBn}</Text>
                      <Text style={styles.catStatCount}>{cat.count}টি ({cat.percentage}%)</Text>
                    </View>
                    <View style={styles.progressBarTrack}>
                      <View
                        style={[
                          styles.progressBarFill,
                          {
                            width: `${Math.max(5, cat.percentage)}%`,
                            backgroundColor: CATEGORY_METADATA[cat.category]?.color || '#0F766E',
                          },
                        ]}
                      />
                    </View>
                  </View>
                ))}
              </View>

              {/* Hotspots */}
              <Text style={styles.sectionHeading}>🔥 চিহ্নিত সমস্যা হটস্পট (Hotspots)</Text>
              {summary?.hotspots.map((h, i) => (
                <View key={i} style={styles.hotspotCard}>
                  <Text style={styles.hotspotName}>📍 {h.areaName}</Text>
                  <Text style={styles.hotspotDetail}>
                    রিপোর্ট সংখ্যা: {h.reportCount}টি • প্রধান সমস্যা:{' '}
                    {CATEGORY_METADATA[h.primaryCategory]?.nameBn} • সর্বোচ্চ তীব্রতা: {h.topSeverity}/৫
                  </Text>
                </View>
              ))}

              {/* Duplicate Detection Moderation Queue */}
              <Text style={styles.sectionHeading}>👥 ডুপ্লিকেট সনাক্তকরণ কিউ</Text>
              {reports
                .filter((r) => r.possibleDuplicates && r.possibleDuplicates.length > 0)
                .map((r) => (
                  <View key={r.id} style={styles.dupQueueCard}>
                    <Text style={styles.dupQueueTitle}>রিপোর্ট: {r.title}</Text>
                    {r.possibleDuplicates?.map((d) => (
                      <View key={d.id} style={styles.dupInnerBox}>
                        <Text style={styles.dupReason}>
                          সম্ভাব্য ডুপ্লিকেট: {d.matchingReasons.distanceExplanation} |{' '}
                          {d.matchingReasons.textMatchExplanation}
                        </Text>
                        <Text style={styles.dupSimScore}>
                          সাদৃশ্য স্কোর: {Math.round(d.similarityScore * 100)}% | স্ট্যাটাস:{' '}
                          {d.reviewStatus}
                        </Text>
                        {isAdminMode && d.reviewStatus === 'PENDING' && (
                          <View style={styles.dupActionRow}>
                            <TouchableOpacity
                              style={styles.dupConfirmBtn}
                              onPress={() => handleReviewDuplicate(d.id, 'CONFIRMED_DUPLICATE')}
                            >
                              <Text style={styles.dupConfirmText}>✓ নিশ্চিত করুন</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.dupDismissBtn}
                              onPress={() => handleReviewDuplicate(d.id, 'DISMISSED')}
                            >
                              <Text style={styles.dupDismissText}>✕ বাতিল করুন</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                ))}
            </View>
            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </View>

      {/* DETAIL MODAL */}
      <Modal visible={!!selectedReport} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView>
              {selectedReport && (
                <>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalCategory}>
                      {CATEGORY_METADATA[selectedReport.category]?.nameBn}
                    </Text>
                    <TouchableOpacity onPress={() => setSelectedReport(null)}>
                      <Text style={styles.modalCloseText}>✕ বন্ধ করুন</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.modalTitle}>{selectedReport.title}</Text>
                  <Text style={styles.modalAddress}>📍 {selectedReport.addressLabel}</Text>

                  <Text style={styles.modalDescTitle}>বর্ণনা:</Text>
                  <Text style={styles.modalDesc}>{selectedReport.description}</Text>

                  {/* AI Analysis section */}
                  {selectedReport.aiAnalysis && (
                    <View style={styles.modalAiBox}>
                      <Text style={styles.modalAiTitle}>🤖 এআই বিশ্লেষণ ও যুক্তি</Text>
                      <Text style={styles.modalAiSummary}>
                        সারসংক্ষেপ: {selectedReport.aiAnalysis.summary}
                      </Text>
                      <Text style={styles.modalAiSeverity}>
                        তীব্রতা: {selectedReport.aiAnalysis.severity}/৫ (কনফিডেন্স:{' '}
                        {Math.round((selectedReport.aiAnalysis.confidence || 0.8) * 100)}%)
                      </Text>
                      {selectedReport.aiAnalysis.reasons.map((r, i) => (
                        <Text key={i} style={styles.modalAiReason}>
                          • {r}
                        </Text>
                      ))}
                    </View>
                  )}

                  {/* Priority Breakdown */}
                  {selectedReport.priorityAssessment && (
                    <View style={styles.modalPrioBox}>
                      <Text style={styles.modalPrioTitle}>
                        ⚖️ ব্যাখ্যাযোগ্য প্রায়োরিটি স্কোর:{' '}
                        {selectedReport.priorityAssessment.score}/১০০ (
                        {
                          PRIORITY_METADATA[selectedReport.priorityAssessment.priorityLevel]
                            ?.nameBn
                        }
                        )
                      </Text>
                      <Text style={styles.modalPrioExpl}>
                        {selectedReport.priorityAssessment.explanation?.summary}
                      </Text>
                    </View>
                  )}

                  {/* Admin Controls */}
                  {isAdminMode && (
                    <View style={styles.adminControlsBox}>
                      <Text style={styles.adminControlTitle}>
                        🛡️ অ্যাডমিন অ্যাকশন (স্ট্যাটাস ও প্রায়োরিটি)
                      </Text>

                      <Text style={styles.controlSubLabel}>স্ট্যাটাস পরিবর্তন করুন:</Text>
                      <View style={styles.actionBtnGrid}>
                        <TouchableOpacity
                          style={[styles.actionBtn, { backgroundColor: '#0284C7' }]}
                          onPress={() => handleStatusUpdate('IN_PROGRESS')}
                        >
                          <Text style={styles.actionBtnText}>কাজ শুরু</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.actionBtn, { backgroundColor: '#059669' }]}
                          onPress={() => handleStatusUpdate('RESOLVED')}
                        >
                          <Text style={styles.actionBtnText}>সমাধান সম্পন্ন</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.actionBtn, { backgroundColor: '#DC2626' }]}
                          onPress={() => handleStatusUpdate('REJECTED')}
                        >
                          <Text style={styles.actionBtnText}>বাতিল</Text>
                        </TouchableOpacity>
                      </View>

                      <Text style={styles.controlSubLabel}>অগ্রাধিকার ওভাররাইড:</Text>
                      <View style={styles.actionBtnGrid}>
                        <TouchableOpacity
                          style={[styles.actionBtn, { backgroundColor: '#EF4444' }]}
                          onPress={() => handlePriorityOverride('CRITICAL')}
                        >
                          <Text style={styles.actionBtnText}>জরুরি (Critical)</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actionBtn, { backgroundColor: '#F59E0B' }]}
                          onPress={() => handlePriorityOverride('HIGH')}
                        >
                          <Text style={styles.actionBtnText}>উচ্চ (High)</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Bottom Navigation */}
      {renderNavBar()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    backgroundColor: '#0F766E',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logoTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  logoSubtitle: {
    fontSize: 12,
    color: '#CCFBF1',
  },
  roleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
  },
  roleBadgeCitizen: {
    backgroundColor: '#0D9488',
  },
  roleBadgeAdmin: {
    backgroundColor: '#B45309',
  },
  roleBadgeText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
  roleSwitchHint: {
    color: '#FEF3C7',
    fontSize: 9,
  },
  content: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollArea: {
    flex: 1,
    padding: 16,
  },
  loadingOverlay: {
    padding: 12,
    backgroundColor: '#E0F2FE',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginLeft: 8,
    color: '#0369A1',
    fontWeight: 'bold',
  },
  heroCard: {
    backgroundColor: '#0F766E',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  heroBadge: {
    color: '#A7F3D0',
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  heroDesc: {
    color: '#E6FFFA',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  heroActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  heroBtnPrimary: {
    backgroundColor: '#F59E0B',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  heroBtnPrimaryText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  heroBtnSecondary: {
    backgroundColor: '#115E59',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  heroBtnSecondaryText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 12,
    marginTop: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0F766E',
  },
  statLabel: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
  },
  categoriesGrid: {
    marginBottom: 20,
  },
  catCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  catNameBn: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  catNameEn: {
    fontSize: 11,
    color: '#64748B',
  },
  disclaimerBox: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  disclaimerTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#92400E',
    marginBottom: 4,
  },
  disclaimerText: {
    fontSize: 11,
    color: '#78350F',
    lineHeight: 16,
  },
  // Form styles
  formContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  screenTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  screenSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: '#1E293B',
  },
  textArea: {
    height: 90,
    textAlignVertical: 'top',
  },
  aiAnalyzeBtn: {
    backgroundColor: '#7C3AED',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  aiAnalyzeBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  aiCard: {
    backgroundColor: '#F5F3FF',
    borderRadius: 12,
    padding: 14,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  aiCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  aiCardTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#5B21B6',
  },
  aiBadge: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  aiBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  aiSummaryText: {
    fontSize: 13,
    color: '#4C1D95',
    marginBottom: 8,
  },
  aiSeverityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  aiSeverityLabel: {
    fontSize: 12,
    color: '#6D28D9',
  },
  aiSeverityValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#DC2626',
    marginLeft: 6,
  },
  aiReasonsHeader: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#5B21B6',
    marginBottom: 4,
  },
  aiReasonItem: {
    fontSize: 12,
    color: '#4C1D95',
    lineHeight: 16,
  },
  missingInfoBox: {
    backgroundColor: '#FFFBEB',
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
  },
  missingInfoTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#B45309',
  },
  missingInfoItem: {
    fontSize: 11,
    color: '#92400E',
  },
  overrideLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6D28D9',
    marginTop: 10,
    marginBottom: 6,
  },
  overrideScroll: {
    flexDirection: 'row',
  },
  catPill: {
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 6,
  },
  catPillSelected: {
    backgroundColor: '#7C3AED',
  },
  catPillText: {
    fontSize: 11,
    color: '#5B21B6',
  },
  catPillTextSelected: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  wardScroll: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  wardPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  wardPillActive: {
    backgroundColor: '#0F766E',
    borderColor: '#0F766E',
  },
  wardPillText: {
    fontSize: 12,
    color: '#334155',
  },
  wardPillTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  locationCoords: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 8,
  },
  submitBtn: {
    backgroundColor: '#0F766E',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 16,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
  // Map Screen
  mapContainer: {
    flex: 1,
  },
  mapFilterBar: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  filterChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#0F766E',
  },
  filterChipText: {
    fontSize: 11,
    color: '#1E293B',
  },
  mapPointsList: {
    flex: 1,
    padding: 12,
  },
  mapBanner: {
    backgroundColor: '#E0F2FE',
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  mapBannerTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0369A1',
  },
  mapBannerDesc: {
    fontSize: 11,
    color: '#0284C7',
    marginTop: 2,
  },
  mapPointCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 5,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pointHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  pointCategory: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#475569',
  },
  prioBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  prioBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  pointTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 4,
  },
  pointAddress: {
    fontSize: 12,
    color: '#475569',
  },
  pointCoords: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },
  dupAlertPill: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  dupAlertPillText: {
    fontSize: 10,
    color: '#B45309',
    fontWeight: '600',
  },
  // Feed List
  feedHeader: {
    marginBottom: 12,
  },
  reportFeedCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  feedCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  feedTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 4,
  },
  feedDesc: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
    marginBottom: 8,
  },
  feedFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
  },
  feedLocation: {
    fontSize: 11,
    color: '#64748B',
  },
  feedDate: {
    fontSize: 11,
    color: '#94A3B8',
  },
  // Dashboard
  dashboardContainer: {
    marginBottom: 20,
  },
  dashHeaderCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  dashBadge: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  dashTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginVertical: 4,
  },
  dashDesc: {
    color: '#94A3B8',
    fontSize: 11,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  kpiNum: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0F766E',
  },
  kpiLabel: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
    textAlign: 'center',
  },
  recCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
  },
  recHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#991B1B',
    flex: 1,
  },
  recScore: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#DC2626',
  },
  recReason: {
    fontSize: 11,
    color: '#7F1D1D',
    marginTop: 4,
  },
  recLocation: {
    fontSize: 10,
    color: '#B91C1C',
    marginTop: 2,
  },
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  catStatRow: {
    marginBottom: 10,
  },
  catStatLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  catStatName: {
    fontSize: 12,
    color: '#1E293B',
    fontWeight: '500',
  },
  catStatCount: {
    fontSize: 11,
    color: '#64748B',
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 6,
    borderRadius: 3,
  },
  hotspotCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  hotspotName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  hotspotDetail: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
  },
  dupQueueCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dupQueueTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 6,
  },
  dupInnerBox: {
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 6,
  },
  dupReason: {
    fontSize: 11,
    color: '#475569',
  },
  dupSimScore: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  dupActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  dupConfirmBtn: {
    backgroundColor: '#059669',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  dupConfirmText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  dupDismissBtn: {
    backgroundColor: '#DC2626',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  dupDismissText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalCategory: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0F766E',
  },
  modalCloseText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: 'bold',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 4,
  },
  modalAddress: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 12,
  },
  modalDescTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#334155',
    marginBottom: 4,
  },
  modalDesc: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 14,
  },
  modalAiBox: {
    backgroundColor: '#F5F3FF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  modalAiTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#6D28D9',
    marginBottom: 4,
  },
  modalAiSummary: {
    fontSize: 12,
    color: '#5B21B6',
    marginBottom: 4,
  },
  modalAiSeverity: {
    fontSize: 12,
    fontWeight: '600',
    color: '#7C3AED',
    marginBottom: 6,
  },
  modalAiReason: {
    fontSize: 11,
    color: '#4C1D95',
  },
  modalPrioBox: {
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  modalPrioTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#92400E',
    marginBottom: 4,
  },
  modalPrioExpl: {
    fontSize: 11,
    color: '#78350F',
  },
  adminControlsBox: {
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  adminControlTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 8,
  },
  controlSubLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
    marginTop: 6,
    marginBottom: 4,
  },
  actionBtnGrid: {
    flexDirection: 'row',
    gap: 6,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 11,
  },
  // Bottom Navigation
  navBar: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    paddingVertical: 10,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  navItemActive: {
    borderTopWidth: 2,
    borderTopColor: '#14B8A6',
  },
  navText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '500',
  },
  navTextActive: {
    color: '#14B8A6',
    fontWeight: 'bold',
  },
});
