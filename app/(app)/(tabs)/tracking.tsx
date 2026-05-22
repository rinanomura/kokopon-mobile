import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Image,
  TouchableOpacity,
  Modal,
  Pressable,
  Alert,
  TextInput,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  listSessionLogs,
  SessionLog,
  listEventClassifications,
  batchCreateEventClassifications,
  createEventClassification,
  EventClassification,
  updateEventClassification,
  deleteEventClassification,
  getUserId,
  EventClassificationParticipants,
  EventClassificationRelationship,
  EventClassificationFormat,
  Person,
  listPeople,
  createPerson,
  listMealLogs,
  createMealLog,
  deleteMealLog,
  MealLog,
  createDailyHealthLog,
  deleteDailyHealthLog,
  listDailyHealthLogs,
  createWorkoutLog,
  listWorkoutLogs,
  DailyHealthLog,
  DailyHealthLogInput,
  WorkoutLog,
  WorkoutLogInput,
} from '@/lib/api';
import {
  useGoogleAuth,
  exchangeCodeForToken,
  fetchCalendarEvents,
  fetchCalendarList,
  CalendarEvent,
} from '@/lib/googleCalendar';
import { SwipeableCard } from '@/components/SwipeableCard';
import { analyzeMealPhoto, MealAnalysis, classifyCalendarEvents } from '@/lib/openRouter';
import { getTrainingContent, isValidMenuId } from '@/constants/trainingContents';
import { usePreferences } from '@/hooks/usePreferences';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useHealthKit } from '@/hooks/useHealthKit';
import { getStressColor } from '@/lib/openRouter';

// ── タブ定義 ──
type TrackingTab = 'meditation' | 'activity' | 'exercise' | 'sleep' | 'diet';

const TRACKING_TABS: { key: TrackingTab; label: string; icon: string }[] = [
  { key: 'meditation', label: '瞑想', icon: 'leaf-outline' },
  { key: 'activity', label: '活動', icon: 'calendar-outline' },
  { key: 'exercise', label: '運動', icon: 'fitness-outline' },
  { key: 'sleep', label: '睡眠', icon: 'moon-outline' },
  { key: 'diet', label: '食事', icon: 'restaurant-outline' },
];

// ── 編集用の選択肢 ──
const PARTICIPANTS_OPTIONS: { value: EventClassificationParticipants; label: string }[] = [
  { value: 'solo', label: '一人' },
  { value: 'small', label: '少人数' },
  { value: 'large', label: '大人数' },
];

const RELATIONSHIP_OPTIONS: { value: EventClassificationRelationship; label: string }[] = [
  { value: 'family', label: '家族' },
  { value: 'work', label: '仕事' },
  { value: 'friend', label: '友人' },
  { value: 'stranger', label: '初対面' },
];

const FORMAT_OPTIONS: { value: EventClassificationFormat; label: string }[] = [
  { value: 'online', label: 'オンライン' },
  { value: 'onsite', label: '対面' },
];

const STRESS_OPTIONS = [1, 2, 3, 4, 5];

// ── ヘルパー関数 ──

function getConditionLabel(value: string | undefined | null): string {
  return value || '-';
}

function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${month}/${day} ${hours}:${minutes}`;
}

function formatDateOnly(isoString: string): string {
  const date = new Date(isoString);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  const weekday = weekdays[date.getDay()];
  return `${month}/${day}（${weekday}）`;
}

function formatDuration(
  actualDuration: number | undefined | null,
  settingDuration: number | undefined | null
): string {
  const formatSeconds = (seconds: number): string => {
    if (seconds >= 60) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return secs > 0 ? `${mins}分${secs}秒` : `${mins}分`;
    }
    return `${seconds}秒`;
  };

  if (!settingDuration) return '';

  const actual = actualDuration ?? settingDuration;
  const setting = settingDuration;

  if (actual < setting) {
    return `${formatSeconds(actual)} / ${formatSeconds(setting)}`;
  }
  return formatSeconds(setting);
}

function getMenuName(
  meditationMode: string | undefined,
  meditationType: string | undefined,
  trainingMode: 'intuitive' | 'verbal'
): string {
  if (meditationMode === 'timer') return 'タイマー';
  if (meditationMode === 'ambient') return '環境音';
  if (meditationMode === 'guided' && meditationType && isValidMenuId(meditationType)) {
    const content = getTrainingContent(meditationType);
    return content.title[trainingMode];
  }
  return meditationMode || '';
}

/** スコアに応じた色（1=赤, 3=黄, 5=緑） */
function getScoreColor(score: number): string {
  if (score >= 4) return '#4CAF50';
  if (score >= 3) return '#FFC107';
  if (score >= 2) return '#FF9800';
  return '#F44336';
}

/** 参加者ラベル */
function getParticipantsLabel(p?: string): string {
  if (p === 'solo') return '一人';
  if (p === 'small') return '少人数';
  if (p === 'large') return '大人数';
  return '';
}

/** 関係性ラベル */
function getRelationshipLabel(r: string): string {
  const map: Record<string, string> = { work: '仕事', family: '家族', friend: '友人', stranger: '初対面' };
  return map[r] || r;
}

// ── メインコンポーネント ──

export default function TrackingScreen() {
  const { trainingMode } = usePreferences();
  const colors = useThemeColors();
  const { request, response, promptAsync, redirectUri } = useGoogleAuth();
  const [activeTab, setActiveTab] = useState<TrackingTab>('meditation');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // 瞑想タブ
  const [sessions, setSessions] = useState<SessionLog[]>([]);

  // 活動タブ
  const [events, setEvents] = useState<EventClassification[]>([]);

  // カレンダー連携
  const [syncing, setSyncing] = useState(false);
  const processedCodeRef = useRef<string | null>(null);

  // 運動・睡眠タブ
  const {
    healthData,
    isAvailable: healthKitAvailable,
    isAuthorized: healthKitAuthorized,
    requestAuthorization: requestHealthKitAuth,
    fetchHealthData,
  } = useHealthKit();

  // 活動タブ: 個別編集ピッカー（各項目ごとにミニモーダル）
  type PickerType = 'title' | 'participants' | 'relationships' | 'format' | 'stress' | 'time';
  const [pickerEvent, setPickerEvent] = useState<EventClassification | null>(null);
  const [pickerType, setPickerType] = useState<PickerType | null>(null);
  const [pickerTitleText, setPickerTitleText] = useState('');
  const [pickerStartHour, setPickerStartHour] = useState('');
  const [pickerStartMin, setPickerStartMin] = useState('');
  const [pickerEndHour, setPickerEndHour] = useState('');
  const [pickerEndMin, setPickerEndMin] = useState('');
  const [people, setPeople] = useState<Person[]>([]);
  const [newPersonName, setNewPersonName] = useState('');

  // 食事タブ
  const [mealLogs, setMealLogs] = useState<MealLog[]>([]);
  const [analyzingMeal, setAnalyzingMeal] = useState(false);
  const [mealAnalysisResult, setMealAnalysisResult] = useState<MealAnalysis | null>(null);
  const [mealImageBase64, setMealImageBase64] = useState<string | null>(null);
  const [showMealModal, setShowMealModal] = useState(false);

  // 活動タブ: 手動追加モーダル
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDate, setNewEventDate] = useState(() => {
    const now = new Date();
    return now.toISOString().slice(0, 10);
  });
  const [newEventParticipants, setNewEventParticipants] = useState<EventClassificationParticipants | null>(null);
  const [newEventRelationships, setNewEventRelationships] = useState<EventClassificationRelationship[]>([]);
  const [newEventFormat, setNewEventFormat] = useState<EventClassificationFormat | null>(null);
  const [newEventStress, setNewEventStress] = useState<number | null>(null);
  const [showTimeInput, setShowTimeInput] = useState(false);
  const [newEventStartHour, setNewEventStartHour] = useState('');
  const [newEventStartMin, setNewEventStartMin] = useState('');
  const [newEventDuration, setNewEventDuration] = useState('60');

  // 運動タブ: DynamoDB保存済みデータ
  const [savedHealthLogs, setSavedHealthLogs] = useState<DailyHealthLog[]>([]);
  const [savedWorkoutLogs, setSavedWorkoutLogs] = useState<WorkoutLog[]>([]);
  const [syncingHealth, setSyncingHealth] = useState(false);

  // 睡眠タブ: 同期中フラグ
  const [syncingSleep, setSyncingSleep] = useState(false);

  // りなわんメッセージ（シンプルモードでは非表示）
  const encouragementMessage = useMemo(() => {
    if (!colors.showMascot) return null;
    const total = sessions.length;
    if (total === 0) return null;
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);
    const weeklyCount = sessions.filter(session => {
      const sessionDate = new Date(session.timestamp);
      return sessionDate >= sevenDaysAgo;
    }).length;
    if (total === 1) return '最初の一歩だね！\nまた会えるの楽しみにしてるよ';
    if (total <= 3) return `${total}回も来てくれたんだね！\nうれしいな`;
    if (weeklyCount >= 3) return `今週${weeklyCount}回も会えたね！\nいつもありがとう`;
    if (weeklyCount >= 1) return 'また会えてうれしいな！\nいつでも待ってるからね';
    return 'ひさしぶり！\nまた気が向いたら遊びに来てね';
  }, [sessions, colors.showMascot]);

  // ── データ取得 ──

  const fetchAllData = useCallback(async () => {
    try {
      const [sessionItems, eventItems, mealItems, peopleList, healthLogs, workoutLogs] = await Promise.all([
        listSessionLogs(),
        listEventClassifications().catch(() => []),
        listMealLogs(),
        listPeople().catch(() => []),
        listDailyHealthLogs().catch(() => []),
        listWorkoutLogs().catch(() => []),
      ]);
      setSessions(sessionItems.sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      ));
      setEvents(eventItems.filter((e: EventClassification) => !e.isDeleted).sort((a: EventClassification, b: EventClassification) =>
        new Date(b.eventStart).getTime() - new Date(a.eventStart).getTime()
      ));
      setMealLogs(mealItems);
      setPeople(peopleList);
      setSavedHealthLogs(healthLogs);
      setSavedWorkoutLogs(workoutLogs);
    } catch (error) {
      console.error('データ取得エラー:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  useEffect(() => {
    if (healthKitAvailable && healthKitAuthorized) {
      fetchHealthData(30);
    }
  }, [healthKitAvailable, healthKitAuthorized, fetchHealthData]);

  // ── 初回自動同期 ──
  const hasAutoSynced = useRef(false);
  useEffect(() => {
    if (loading || hasAutoSynced.current) return;
    hasAutoSynced.current = true;

    const autoSync = async () => {
      // カレンダー自動同期（トークンがあれば）
      try {
        const savedToken = await AsyncStorage.getItem('googleAccessToken');
        if (savedToken) {
          const isValid = await validateToken(savedToken);
          if (isValid) {
            const savedCalendarIds = await AsyncStorage.getItem('selectedCalendarIds');
            const calendarIds = savedCalendarIds ? JSON.parse(savedCalendarIds) : undefined;
            await syncCalendarEvents(savedToken, calendarIds, true);
          }
        }
      } catch (e) {
        console.log('Auto calendar sync skipped:', e);
      }

      // HealthKit自動同期（認証済みなら）
      try {
        if (healthKitAvailable && healthKitAuthorized) {
          await handleSyncHealthKit(true);
          await handleSyncSleep(true);
        }
      } catch (e) {
        console.log('Auto HealthKit sync skipped:', e);
      }
    };

    autoSync();
  }, [loading, healthKitAvailable, healthKitAuthorized]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAllData();
    if (healthKitAvailable && healthKitAuthorized) {
      fetchHealthData(30);
    }
  }, [fetchAllData, healthKitAvailable, healthKitAuthorized, fetchHealthData]);

  // ── カレンダー連携 ──

  // OAuthレスポンス処理
  useEffect(() => {
    if (response?.type === 'success' && response.params.code && request?.codeVerifier) {
      if (processedCodeRef.current === response.params.code) return;
      processedCodeRef.current = response.params.code;
      handleCalendarSync(response.params.code, request.codeVerifier);
    }
  }, [response]);

  const handleCalendarSync = async (code: string, codeVerifier: string) => {
    setSyncing(true);
    try {
      const token = await exchangeCodeForToken(code, codeVerifier, redirectUri);
      if (!token) {
        Alert.alert('エラー', 'カレンダー認証に失敗しました');
        return;
      }

      // トークンを保存
      await AsyncStorage.setItem('googleAccessToken', token);

      // カレンダー一覧を取得
      const calendarList = await fetchCalendarList(token);
      await AsyncStorage.setItem('googleCalendars', JSON.stringify(calendarList));

      // 保存済みの選択カレンダーを使う、なければprimary
      const savedCalendarIds = await AsyncStorage.getItem('selectedCalendarIds');
      let calendarIds: string[];
      if (savedCalendarIds) {
        calendarIds = JSON.parse(savedCalendarIds);
      } else {
        const primary = calendarList.find(c => c.primary);
        calendarIds = primary ? [primary.id] : [];
      }

      await syncCalendarEvents(token, calendarIds);
    } catch (error) {
      console.error('Calendar sync error:', error);
      Alert.alert('エラー', 'カレンダー連携中にエラーが発生しました');
    } finally {
      setSyncing(false);
    }
  };

  const syncCalendarEvents = async (token: string, calendarIds?: string[], silent = false) => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // カレンダーイベントを取得
    const calendarEvents = await fetchCalendarEvents(token, thirtyDaysAgo, now, calendarIds);
    console.log(`Fetched ${calendarEvents.length} calendar events`);

    if (calendarEvents.length === 0) {
      if (!silent) Alert.alert('情報', 'カレンダーにイベントがありません\n（過去30日間）');
      return;
    }

    // 既存の保存済みイベントIDを除外
    const existingClassifications = await listEventClassifications();
    const classifiedEventIds = new Set(existingClassifications.map(c => c.eventId));
    const unclassifiedEvents = calendarEvents.filter(e => !classifiedEventIds.has(e.id));

    if (unclassifiedEvents.length === 0) {
      if (!silent) Alert.alert('情報', `${calendarEvents.length}件のイベントはすべて取り込み済みです`);
      return;
    }

    // AI分類してDBに即保存
    const userId = await getUserId();
    const classified = await classifyCalendarEvents(unclassifiedEvents);

    const inputs = classified
      .filter((event) => event.start && event.end)
      .map((event) => ({
        userId,
        eventId: event.id,
        eventSummary: event.summary,
        eventStart: event.start,
        eventEnd: event.end,
        participants: event.classification.participants as EventClassificationParticipants,
        relationships: event.classification.relationships as EventClassificationRelationship[] | null,
        format: event.classification.format as EventClassificationFormat,
        eventType: event.classification.eventType,
        stressScore: event.classification.stressScore,
        isManuallyEdited: false,
        source: 'ai' as const,
      }));

    const saved = await batchCreateEventClassifications(inputs);

    setEvents(prev =>
      [...prev, ...saved].sort((a, b) =>
        new Date(b.eventStart).getTime() - new Date(a.eventStart).getTime()
      )
    );

    if (!silent) Alert.alert('完了', `${saved.length}件のイベントを取り込みました`);
  };

  // ── 活動タブ: 手動追加 ──
  const handleAddManualEvent = async () => {
    const title = newEventTitle.trim();
    if (!title) {
      Alert.alert('エラー', '活動名を入力してください');
      return;
    }
    try {
      const userId = await getUserId();
      const eventId = `manual_${Date.now()}`;
      const startDate = new Date(newEventDate);
      const sH = parseInt(newEventStartHour, 10);
      const sM = parseInt(newEventStartMin, 10);
      startDate.setHours(
        isNaN(sH) ? 12 : Math.min(Math.max(sH, 0), 23),
        isNaN(sM) ? 0 : Math.min(Math.max(sM, 0), 59),
        0, 0,
      );
      const durationMin = parseInt(newEventDuration, 10);
      const endDate = new Date(startDate.getTime() + (isNaN(durationMin) || durationMin <= 0 ? 60 : durationMin) * 60 * 1000);

      const input = {
        userId,
        eventId,
        eventSummary: title,
        eventStart: startDate.toISOString(),
        eventEnd: endDate.toISOString(),
        participants: newEventParticipants ?? undefined,
        relationships: newEventRelationships.length > 0 ? newEventRelationships : undefined,
        format: newEventFormat ?? undefined,
        stressScore: newEventStress ?? undefined,
        isManuallyEdited: true,
        source: 'manual' as const,
      };
      const saved = await createEventClassification(input);
      setEvents(prev =>
        [saved, ...prev].sort((a, b) =>
          new Date(b.eventStart).getTime() - new Date(a.eventStart).getTime()
        )
      );
      setShowAddEventModal(false);
      setNewEventTitle('');
      setNewEventParticipants(null);
      setNewEventRelationships([]);
      setNewEventFormat(null);
      setNewEventStress(null);
      setShowTimeInput(false);
      setNewEventStartHour('');
      setNewEventStartMin('');
      setNewEventDuration('60');
    } catch (e) {
      console.error('Manual event creation error:', e);
      Alert.alert('エラー', '活動の追加に失敗しました');
    }
  };

  /** トークンが有効か検証（CalendarList APIで確認） */
  const validateToken = async (token: string): Promise<boolean> => {
    try {
      const res = await fetch(
        'https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=1',
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log('Token validation status:', res.status);
      return res.ok;
    } catch {
      return false;
    }
  };

  const handleCalendarSyncButton = useCallback(async () => {
    const savedToken = await AsyncStorage.getItem('googleAccessToken');
    if (savedToken) {
      setSyncing(true);
      // まずトークンの有効性を確認
      const isValid = await validateToken(savedToken);
      if (!isValid) {
        console.log('Token expired, re-authenticating...');
        await AsyncStorage.removeItem('googleAccessToken');
        setSyncing(false);
        promptAsync();
        return;
      }
      try {
        const savedCalendarIds = await AsyncStorage.getItem('selectedCalendarIds');
        const calendarIds = savedCalendarIds ? JSON.parse(savedCalendarIds) : undefined;
        await syncCalendarEvents(savedToken, calendarIds);
      } catch (error) {
        console.error('Sync error:', error);
        Alert.alert('エラー', 'イベントの取り込み中にエラーが発生しました');
      } finally {
        setSyncing(false);
      }
    } else {
      // トークンがない場合、OAuth認証を開始
      promptAsync();
    }
  }, [promptAsync]);

  // ── 食事写真撮影・分析 ──

  const handleTakePhoto = useCallback(async () => {
    try {
      const ImagePicker = require('expo-image-picker');
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('カメラへのアクセスが必要です', '設定からカメラへのアクセスを許可してください。');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        base64: true,
        quality: 0.5,
      });
      if (!result.canceled && result.assets[0].base64) {
        analyzeMealImage(result.assets[0].base64);
      }
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('エラー', 'カメラの起動に失敗しました');
    }
  }, []);

  const handlePickImage = useCallback(async () => {
    try {
      const ImagePicker = require('expo-image-picker');
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('写真ライブラリへのアクセスが必要です', '設定からアクセスを許可してください。');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        base64: true,
        quality: 0.5,
      });
      if (!result.canceled && result.assets[0].base64) {
        analyzeMealImage(result.assets[0].base64);
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('エラー', '写真の選択に失敗しました');
    }
  }, []);

  const analyzeMealImage = useCallback(async (base64: string) => {
    setAnalyzingMeal(true);
    setMealImageBase64(base64);
    try {
      const analysis = await analyzeMealPhoto(base64);
      setMealAnalysisResult(analysis);
      setShowMealModal(true);
    } catch (error) {
      console.error('Meal analysis error:', error);
      Alert.alert('分析エラー', '食事の分析に失敗しました。もう一度お試しください。');
    } finally {
      setAnalyzingMeal(false);
    }
  }, []);

  const handleSaveMealLog = useCallback(async () => {
    if (!mealAnalysisResult) return;
    try {
      await createMealLog({
        mealName: mealAnalysisResult.mealName,
        imageBase64: mealImageBase64 || undefined,
        bloodSugarStability: mealAnalysisResult.bloodSugarStability,
        antiInflammation: mealAnalysisResult.antiInflammation,
        bdnfSupport: mealAnalysisResult.bdnfSupport,
        serotoninSupply: mealAnalysisResult.serotoninSupply,
        hpaAxisImpact: mealAnalysisResult.hpaAxisImpact,
        overallScore: mealAnalysisResult.overallScore,
        comment: mealAnalysisResult.comment,
        detectedFoods: mealAnalysisResult.detectedFoods,
      });
      setShowMealModal(false);
      setMealAnalysisResult(null);
      setMealImageBase64(null);
      // リフレッシュ
      const updated = await listMealLogs();
      setMealLogs(updated);
    } catch (error) {
      console.error('Save meal log error:', error);
      Alert.alert('エラー', '保存に失敗しました');
    }
  }, [mealAnalysisResult, mealImageBase64]);

  const handleDeleteMealLog = useCallback(async (id: string) => {
    Alert.alert('削除確認', 'この食事記録を削除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: async () => {
          await deleteMealLog(id);
          const updated = await listMealLogs();
          setMealLogs(updated);
        },
      },
    ]);
  }, []);

  const showPhotoOptions = useCallback(() => {
    Alert.alert('食事を記録', '写真を選択してください', [
      { text: 'カメラで撮影', onPress: handleTakePhoto },
      { text: 'ライブラリから選択', onPress: handlePickImage },
      { text: 'キャンセル', style: 'cancel' },
    ]);
  }, [handleTakePhoto, handlePickImage]);

  // ── 活動タブ: 編集・削除ハンドラ ──

  // ── 活動タブ: 個別ピッカーの開閉 ──

  const openPicker = (event: EventClassification, type: PickerType) => {
    setPickerEvent({ ...event });
    setPickerType(type);
    if (type === 'title') {
      setPickerTitleText(event.eventSummary);
    }
    if (type === 'time') {
      const s = new Date(event.eventStart);
      const e = new Date(event.eventEnd);
      setPickerStartHour(String(s.getHours()).padStart(2, '0'));
      setPickerStartMin(String(s.getMinutes()).padStart(2, '0'));
      setPickerEndHour(String(e.getHours()).padStart(2, '0'));
      setPickerEndMin(String(e.getMinutes()).padStart(2, '0'));
    }
  };

  const closePicker = () => {
    setPickerEvent(null);
    setPickerType(null);
    setPickerTitleText('');
    setPickerStartHour('');
    setPickerStartMin('');
    setPickerEndHour('');
    setPickerEndMin('');
  };

  /** 個別項目の即時保存 */
  const savePickerField = async (eventId: string, updates: Record<string, any>) => {
    try {
      const updated = await updateEventClassification(eventId, {
        ...updates,
        isManuallyEdited: true,
      });
      setEvents(prev => prev.map(e => e.eventId === updated.eventId ? updated : e));
    } catch (error) {
      console.error('Update error:', error);
      Alert.alert('エラー', '更新に失敗しました');
    }
    closePicker();
  };

  // ── 活動タブ: 日付グループ ──
  const eventsByDate = useMemo(() => {
    const grouped: Record<string, EventClassification[]> = {};
    events.forEach(event => {
      const dateKey = event.eventStart.split('T')[0];
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(event);
    });
    return Object.entries(grouped).sort((a, b) => b[0].localeCompare(a[0]));
  }, [events]);

  // ── 運動タブ: データを日付降順 ──
  // DynamoDB保存済みの運動データを日付グループ化
  const exerciseData = useMemo(() => {
    // 運動データのあるhealthLogのみ抽出
    const exerciseLogs = savedHealthLogs.filter(
      log => (log.steps && log.steps > 0) || (log.exerciseMinutes && log.exerciseMinutes > 0)
    );
    // 日付ごとにworkoutLogsを紐付け（同一時刻の重複を除去）
    return exerciseLogs
      .map(log => {
        const dayWorkouts = savedWorkoutLogs.filter(w => w.startDate.split('T')[0] === log.date);
        // startDateが同じワークアウトは重複とみなし、最新のレコードのみ残す
        const uniqueWorkouts = dayWorkouts.reduce((acc, w) => {
          const existing = acc.find(a => a.startDate === w.startDate);
          if (!existing) {
            acc.push(w);
          } else if (new Date(w.updatedAt) > new Date(existing.updatedAt)) {
            const idx = acc.indexOf(existing);
            acc[idx] = w;
          }
          return acc;
        }, [] as WorkoutLog[]);
        return { ...log, workouts: uniqueWorkouts };
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [savedHealthLogs, savedWorkoutLogs]);

  // ── 睡眠タブ: DynamoDB保存済みデータを日付降順 ──
  const sleepData = useMemo(() => {
    return savedHealthLogs
      .filter(log => log.sleepHours && log.sleepHours > 0)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [savedHealthLogs]);

  // ── 睡眠タブ: HealthKit取り込み＆スワイプ削除 ──

  const handleSyncSleep = useCallback(async (silent = false) => {
    if (!healthKitAvailable) {
      if (!silent) Alert.alert('HealthKit未対応', 'この端末ではHealthKitを利用できません');
      return;
    }
    if (!healthKitAuthorized) {
      if (!silent) await requestHealthKitAuth();
      return;
    }
    setSyncingSleep(true);
    try {
      await fetchHealthData(30);
      const userId = await getUserId();
      const existingDates = new Set(savedHealthLogs.map(l => l.date));

      const newDays = healthData.filter(
        d => !existingDates.has(d.date) && d.sleepHours && d.sleepHours > 0
      );

      if (newDays.length === 0) {
        if (!silent) Alert.alert('情報', 'すべてのデータは取り込み済みです');
        return;
      }

      for (const day of newDays) {
        const dailyInput: DailyHealthLogInput = {
          userId,
          date: day.date,
          sleepHours: day.sleepHours,
          avgHeartRate: day.avgHeartRate,
          avgHRV: day.avgHRV,
        };
        await createDailyHealthLog(dailyInput);
      }

      // 再取得して表示更新
      const newHealthLogs = await listDailyHealthLogs();
      setSavedHealthLogs(newHealthLogs);

      if (!silent) Alert.alert('完了', `${newDays.length}日分の睡眠データを取り込みました`);
    } catch (error) {
      console.error('Sleep sync error:', error);
      if (!silent) Alert.alert('エラー', '睡眠データの取り込みに失敗しました');
    } finally {
      setSyncingSleep(false);
    }
  }, [healthKitAvailable, healthKitAuthorized, healthData, savedHealthLogs, requestHealthKitAuth, fetchHealthData]);

  const handleSwipeDeleteSleep = useCallback(async (log: DailyHealthLog) => {
    try {
      await deleteDailyHealthLog(log.id);
      setSavedHealthLogs(prev => prev.filter(l => l.id !== log.id));
    } catch (error) {
      console.error('Delete sleep error:', error);
      Alert.alert('エラー', '削除に失敗しました');
    }
  }, []);

  // ── 活動タブ: スワイプ削除ハンドラ ──

  const handleSwipeDeleteEvent = useCallback(async (event: EventClassification) => {
    try {
      await deleteEventClassification(event.eventId);
      setEvents(prev => prev.filter(e => e.eventId !== event.eventId));
    } catch (error) {
      console.error('Delete event error:', error);
      Alert.alert('エラー', '削除に失敗しました');
    }
  }, []);

  // ── 運動タブ: HealthKit連携＆スワイプ削除 ──

  const handleSyncHealthKit = useCallback(async (silent = false) => {
    if (!healthKitAvailable) {
      if (!silent) Alert.alert('HealthKit未対応', 'この端末ではHealthKitを利用できません');
      return;
    }
    if (!healthKitAuthorized) {
      if (!silent) await requestHealthKitAuth();
      return;
    }
    setSyncingHealth(true);
    try {
      await fetchHealthData(30);
      const userId = await getUserId();
      const existingDates = new Set(savedHealthLogs.map(l => l.date));

      // 未保存の日のみ抽出
      const newDays = healthData.filter(
        d => !existingDates.has(d.date) &&
          ((d.steps && d.steps > 0) || (d.exerciseMinutes && d.exerciseMinutes > 0))
      );

      if (newDays.length === 0) {
        if (!silent) Alert.alert('情報', 'すべてのデータは取り込み済みです');
        return;
      }

      for (const day of newDays) {
        const dailyInput: DailyHealthLogInput = {
          userId,
          date: day.date,
          steps: day.steps,
          activeCalories: day.activeCalories,
          exerciseMinutes: day.exerciseMinutes,
          avgHeartRate: day.avgHeartRate,
          avgHRV: day.avgHRV,
        };
        await createDailyHealthLog(dailyInput);

        if (day.workouts && day.workouts.length > 0) {
          // 既存のワークアウトのstartDateセットを作成（重複保存を防ぐ）
          const existingStartDates = new Set(savedWorkoutLogs.map(w => w.startDate));
          const newWorkouts = day.workouts.filter(w => !existingStartDates.has(w.startDate.toISOString()));
          await Promise.all(newWorkouts.map(w => {
            const workoutInput: WorkoutLogInput = {
              userId,
              activityType: w.activityType,
              activityName: w.activityName,
              startDate: w.startDate.toISOString(),
              endDate: w.endDate.toISOString(),
              durationMinutes: w.durationMinutes,
              totalEnergyBurned: w.totalEnergyBurned,
              totalDistance: w.totalDistance,
            };
            return createWorkoutLog(workoutInput);
          }));
        }
      }

      // 再取得して表示更新
      const [newHealthLogs, newWorkoutLogs] = await Promise.all([
        listDailyHealthLogs(),
        listWorkoutLogs(),
      ]);
      setSavedHealthLogs(newHealthLogs);
      setSavedWorkoutLogs(newWorkoutLogs);

      if (!silent) Alert.alert('完了', `${newDays.length}日分のデータを取り込みました`);
    } catch (error) {
      console.error('HealthKit sync error:', error);
      if (!silent) Alert.alert('エラー', 'HealthKitデータの取り込みに失敗しました');
    } finally {
      setSyncingHealth(false);
    }
  }, [healthKitAvailable, healthKitAuthorized, healthData, savedHealthLogs, requestHealthKitAuth, fetchHealthData]);

  const handleSwipeDeleteExercise = useCallback(async (log: DailyHealthLog) => {
    try {
      await deleteDailyHealthLog(log.id);
      setSavedHealthLogs(prev => prev.filter(l => l.id !== log.id));
    } catch (error) {
      console.error('Delete exercise error:', error);
      Alert.alert('エラー', '削除に失敗しました');
    }
  }, []);

  // ── タブコンテンツ描画 ──

  const renderMeditationTab = () => {
    if (sessions.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="leaf-outline" size={48} color={colors.textMuted} />
          <Text style={[styles.emptyText, { color: colors.textPrimary }]}>まだ瞑想記録がありません</Text>
          <Text style={[styles.emptyHint, { color: colors.textSecondary }]}>セッションを始めると{'\n'}ここに履歴が表示されます</Text>
        </View>
      );
    }
    return (
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        {encouragementMessage && (
          <View style={styles.mascotSection}>
            <Image
              source={require('@/assets/images/rinawan_talking.gif')}
              style={styles.mascotImage}
              resizeMode="contain"
            />
            <View style={styles.speechBubbleContainer}>
              <View style={[styles.speechBubbleTail, { borderRightColor: colors.bubbleBg[0] }]} />
              <LinearGradient
                colors={[...colors.bubbleBg]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.speechBubble, { borderColor: colors.bubbleBorder }]}
              >
                <Text style={[styles.sparkle, styles.sparkleTopRight, { color: colors.sparkleColor }]}>✧</Text>
                <Text style={[styles.sparkle, styles.sparkleTopLeft, { color: colors.sparkleColor }]}>✦</Text>
                <Text style={[styles.sparkle, styles.sparkleBottomRight, { color: colors.sparkleColor }]}>⋆</Text>
                <Text style={[styles.speechBubbleText, { color: colors.textSecondary }]}>{encouragementMessage}</Text>
              </LinearGradient>
            </View>
          </View>
        )}
        {sessions.map((session) => (
          <View key={session.id} style={[styles.sessionCard, { backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1 }]}>
            <Text style={[styles.sessionDate, { color: colors.textMuted }]}>{formatDateTime(session.timestamp)}</Text>
            <View style={styles.conditionRow}>
              <View style={styles.conditionItem}>
                <Text style={[styles.conditionLabel, { color: colors.textMuted }]}>からだ</Text>
                <Text style={[styles.conditionValue, { color: colors.textPrimary }]}>{getConditionLabel(session.body)}</Text>
              </View>
              <View style={[styles.conditionDivider, { backgroundColor: colors.cardBorder }]} />
              <View style={styles.conditionItem}>
                <Text style={[styles.conditionLabel, { color: colors.textMuted }]}>こころ</Text>
                <Text style={[styles.conditionValue, { color: colors.textPrimary }]}>{getConditionLabel(session.mind)}</Text>
              </View>
              <View style={[styles.conditionDivider, { backgroundColor: colors.cardBorder }]} />
              <View style={styles.conditionItem}>
                <Text style={[styles.conditionLabel, { color: colors.textMuted }]}>呼吸</Text>
                <Text style={[styles.conditionValue, { color: colors.textPrimary }]}>{getConditionLabel(session.breath)}</Text>
              </View>
            </View>
            <Text style={[styles.sessionMeta, { color: colors.textMuted }]}>
              {getMenuName(session.meditationMode, session.meditationType, trainingMode)}
              {session.settingDuration ? ` / ${formatDuration(session.actualDuration, session.settingDuration)}` : ''}
            </Text>
          </View>
        ))}
      </ScrollView>
    );
  };

  const renderActivityTab = () => {
    if (events.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="calendar-outline" size={48} color={colors.textMuted} />
          <Text style={[styles.emptyText, { color: colors.textPrimary }]}>まだ活動記録がありません</Text>
          <Text style={[styles.emptyHint, { color: colors.textSecondary }]}>上部のカレンダーアイコンから{'\n'}取り込めます</Text>
        </View>
      );
    }
    return (
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        {eventsByDate.map(([dateKey, dayEvents]) => (
          <View key={dateKey}>
            <Text style={[styles.dateGroupHeader, { color: colors.textPrimary }]}>{formatDateOnly(dateKey)}</Text>
            {dayEvents.map((event) => (
              <SwipeableCard
                key={event.eventId}
                onDelete={() => handleSwipeDeleteEvent(event)}
                hideLeftActions
              >
                <View style={[styles.eventCard, { backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1 }]}>
                  <View style={styles.eventHeader}>
                    <TouchableOpacity style={{ flex: 1 }} onPress={() => openPicker(event, 'title')} activeOpacity={0.7}>
                      <Text style={[styles.eventTitle, { color: colors.textPrimary }]} numberOfLines={1}>{event.eventSummary}</Text>
                      {event.eventStart && (
                        <TouchableOpacity onPress={() => openPicker(event, 'time')} activeOpacity={0.7}>
                          <Text style={[styles.eventTime, { color: colors.textMuted }]}>
                            {new Date(event.eventStart).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                            {event.eventEnd ? ` 〜 ${new Date(event.eventEnd).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}` : ''}
                            {event.eventEnd ? ` (${(Math.round((new Date(event.eventEnd).getTime() - new Date(event.eventStart).getTime()) / 60000) / 60).toFixed(1).replace(/\.0$/, '')}H)` : ''}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => openPicker(event, 'stress')} activeOpacity={0.7}>
                      <View style={[styles.stressBadge, { backgroundColor: getStressColor(event.stressScore || 3) }]}>
                        <Text style={styles.stressBadgeText}>{event.stressScore || '-'}</Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.eventTagsRow}>
                    <TouchableOpacity
                      style={[styles.eventTag, { backgroundColor: colors.card }]}
                      onPress={() => openPicker(event, 'participants')}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.eventTagText, { color: colors.textSecondary }]}>{getParticipantsLabel(event.participants) || '人数'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.eventTag, { backgroundColor: colors.card }]}
                      onPress={() => openPicker(event, 'relationships')}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.eventTagText, { color: colors.textSecondary }]}>
                        {event.relationships && event.relationships.length > 0
                          ? event.relationships.map((r: string) => getRelationshipLabel(r)).join('・')
                          : '関係性'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.eventTag, { backgroundColor: colors.card }]}
                      onPress={() => openPicker(event, 'format')}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.eventTagText, { color: colors.textSecondary }]}>
                        {event.format ? (event.format === 'online' ? 'オンライン' : '対面') : '形式'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </SwipeableCard>
            ))}
          </View>
        ))}
      </ScrollView>
    );
  };

  const renderExerciseTab = () => {
    if (exerciseData.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="fitness-outline" size={48} color={colors.textMuted} />
          <Text style={[styles.emptyText, { color: colors.textPrimary }]}>運動データがありません</Text>
          <Text style={[styles.emptyHint, { color: colors.textSecondary }]}>右上のアイコンからHealthKitの{'\n'}データを取り込めます</Text>
        </View>
      );
    }
    return (
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        {exerciseData.map((day) => (
          <SwipeableCard
            key={day.date}
            onDelete={() => handleSwipeDeleteExercise(day)}
            hideLeftActions
          >
            <View style={[styles.healthCard, { backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1 }]}>
              <Text style={[styles.healthDateText, { color: colors.textPrimary }]}>{formatDateOnly(day.date)}</Text>
              <View style={styles.healthStatsRow}>
                {day.steps !== undefined && day.steps > 0 && (
                  <View style={styles.healthStat}>
                    <Ionicons name="footsteps-outline" size={16} color="#4ea892" />
                    <Text style={[styles.healthStatValue, { color: colors.textPrimary }]}>{day.steps.toLocaleString()}</Text>
                    <Text style={[styles.healthStatLabel, { color: colors.textSecondary }]}>歩</Text>
                  </View>
                )}
                {day.activeCalories !== undefined && day.activeCalories > 0 && (
                  <View style={styles.healthStat}>
                    <Ionicons name="flame-outline" size={16} color="#d08540" />
                    <Text style={[styles.healthStatValue, { color: colors.textPrimary }]}>{day.activeCalories}</Text>
                    <Text style={[styles.healthStatLabel, { color: colors.textSecondary }]}>kcal</Text>
                  </View>
                )}
                {day.exerciseMinutes !== undefined && day.exerciseMinutes > 0 && (
                  <View style={styles.healthStat}>
                    <Ionicons name="time-outline" size={16} color="#5a8fc0" />
                    <Text style={[styles.healthStatValue, { color: colors.textPrimary }]}>{day.exerciseMinutes}</Text>
                    <Text style={[styles.healthStatLabel, { color: colors.textSecondary }]}>分</Text>
                  </View>
                )}
              </View>
              {day.workouts && day.workouts.length > 0 && (
                <View style={[styles.workoutList, { borderTopColor: colors.cardBorder }]}>
                  {day.workouts.map((w, i) => (
                    <View key={i} style={styles.workoutItem}>
                      <Text style={[styles.workoutName, { color: colors.textPrimary }]}>{w.activityName}</Text>
                      <Text style={[styles.workoutDuration, { color: colors.textSecondary }]}>{w.durationMinutes}分</Text>
                      {w.totalEnergyBurned !== undefined && (
                        <Text style={[styles.workoutCalories, { color: colors.textMuted }]}>{w.totalEnergyBurned}kcal</Text>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>
          </SwipeableCard>
        ))}
      </ScrollView>
    );
  };

  const renderSleepTab = () => {
    if (sleepData.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="moon-outline" size={48} color={colors.textMuted} />
          <Text style={[styles.emptyText, { color: colors.textPrimary }]}>睡眠データがありません</Text>
          <Text style={[styles.emptyHint, { color: colors.textSecondary }]}>右上のアイコンからHealthKitの{'\n'}データを取り込めます</Text>
        </View>
      );
    }
    return (
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        {sleepData.map((day) => (
          <SwipeableCard
            key={day.date}
            onDelete={() => handleSwipeDeleteSleep(day)}
            hideLeftActions
          >
            <View style={[styles.healthCard, { backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1 }]}>
              <View style={styles.sleepRow}>
                <View>
                  <Text style={[styles.healthDateText, { color: colors.textPrimary }]}>{formatDateOnly(day.date)}</Text>
                  <Text style={[styles.sleepHoursText, { color: colors.textPrimary }]}>{day.sleepHours?.toFixed(1)} 時間</Text>
                </View>
                <View style={[styles.sleepBarContainer, { backgroundColor: colors.progressRingBg }]}>
                  <View
                    style={[
                      styles.sleepBar,
                      {
                        width: `${Math.min((day.sleepHours || 0) / 10 * 100, 100)}%`,
                        backgroundColor: (day.sleepHours || 0) >= 7 ? '#4ea892' : (day.sleepHours || 0) >= 6 ? '#FFC107' : '#F44336',
                      },
                    ]}
                  />
                </View>
              </View>
            </View>
          </SwipeableCard>
        ))}
      </ScrollView>
    );
  };

  const renderDietTab = () => {
    return (
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        {analyzingMeal && (
          <View style={[styles.analyzingBanner, { backgroundColor: colors.accent }]}>
            <ActivityIndicator size="small" color="#FFFFFF" />
            <Text style={styles.analyzingText}>AI分析中...</Text>
          </View>
        )}

        {mealLogs.length === 0 && !analyzingMeal ? (
          <View style={styles.emptyContainerInline}>
            <Ionicons name="restaurant-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textPrimary }]}>まだ食事記録がありません</Text>
            <Text style={[styles.emptyHint, { color: colors.textSecondary }]}>右上のカメラアイコンから{'\n'}食事を撮影してAI分析しましょう</Text>
          </View>
        ) : (
          mealLogs.map((log) => (
            <TouchableOpacity
              key={log.id}
              style={[styles.mealCard, { backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1 }]}
              onLongPress={() => handleDeleteMealLog(log.id)}
              activeOpacity={0.8}
            >
              <View style={styles.mealCardHeader}>
                <Text style={[styles.mealCardName, { color: colors.textPrimary }]}>{log.mealName}</Text>
                <View style={styles.mealCardScoreRow}>
                  <View style={[styles.mealOverallScore, { backgroundColor: getScoreColor(log.overallScore) }]}>
                    <Text style={styles.mealOverallScoreText}>{log.overallScore}</Text>
                  </View>
                </View>
              </View>
              <Text style={[styles.mealCardDate, { color: colors.textMuted }]}>{formatDateTime(log.timestamp)}</Text>
              <View style={styles.mealCardRow}>
                {(log.imageBase64 || log.imageUrl) && (
                  <Image
                    source={{ uri: log.imageBase64 ? `data:image/jpeg;base64,${log.imageBase64}` : log.imageUrl }}
                    style={styles.mealCardImage}
                  />
                )}
                <View style={styles.mealCardContent}>
                  <View style={styles.mealScoreBarsCompact}>
                    {[
                      { label: '血糖', score: log.bloodSugarStability },
                      { label: '抗炎', score: log.antiInflammation },
                      { label: 'BDNF', score: log.bdnfSupport },
                      { label: 'セロ', score: log.serotoninSupply },
                      { label: 'HPA', score: log.hpaAxisImpact },
                    ].map(({ label, score }) => (
                      <View key={label} style={styles.mealScoreBarCompact}>
                        <Text style={[styles.mealScoreBarLabelCompact, { color: colors.textSecondary }]}>{label}</Text>
                        <View style={[styles.mealScoreBarTrackCompact, { backgroundColor: colors.progressRingBg }]}>
                          <View
                            style={[
                              styles.mealScoreBarFillCompact,
                              { width: `${(score / 5) * 100}%`, backgroundColor: getScoreColor(score) },
                            ]}
                          />
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
              {log.comment ? <Text style={[styles.mealCardComment, { color: colors.textSecondary }]}>{log.comment}</Text> : null}
              <View style={styles.mealFoodChips}>
                {log.detectedFoods.slice(0, 5).map((food, i) => (
                  <View key={i} style={[styles.foodChip, { backgroundColor: colors.card }]}>
                    <Text style={[styles.foodChipText, { color: colors.textPrimary }]}>{food}</Text>
                  </View>
                ))}
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    );
  };

  const renderTabContent = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      );
    }
    switch (activeTab) {
      case 'meditation': return renderMeditationTab();
      case 'activity': return renderActivityTab();
      case 'exercise': return renderExerciseTab();
      case 'sleep': return renderSleepTab();
      case 'diet': return renderDietTab();
    }
  };

  // ── 食事分析結果モーダル ──

  const renderMealAnalysisModal = () => {
    if (!mealAnalysisResult) return null;

    const scoreItems = [
      { label: '血糖安定度', score: mealAnalysisResult.bloodSugarStability },
      { label: '抗炎症', score: mealAnalysisResult.antiInflammation },
      { label: 'BDNF支援', score: mealAnalysisResult.bdnfSupport },
      { label: 'セロトニン原料', score: mealAnalysisResult.serotoninSupply },
      { label: 'HPA軸安定度', score: mealAnalysisResult.hpaAxisImpact },
    ];

    return (
      <Modal
        visible={showMealModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMealModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowMealModal(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: colors.modalBg }]} onPress={() => {}}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* 写真サムネイル */}
              {mealImageBase64 && (
                <Image
                  source={{ uri: `data:image/jpeg;base64,${mealImageBase64}` }}
                  style={styles.modalImage}
                  resizeMode="cover"
                />
              )}

              {/* 料理名 */}
              <Text style={[styles.modalMealName, { color: colors.textPrimary }]}>{mealAnalysisResult.mealName}</Text>

              {/* 総合スコア */}
              <View style={styles.modalOverallRow}>
                <Text style={[styles.modalOverallLabel, { color: colors.textSecondary }]}>総合スコア</Text>
                <View style={[styles.modalOverallBadge, { backgroundColor: getScoreColor(mealAnalysisResult.overallScore) }]}>
                  <Text style={styles.modalOverallValue}>{mealAnalysisResult.overallScore}</Text>
                  <Text style={styles.modalOverallMax}>/5</Text>
                </View>
              </View>

              {/* 5つのスコアバー */}
              <View style={styles.modalScoreBars}>
                {scoreItems.map(({ label, score }) => (
                  <View key={label} style={styles.modalScoreRow}>
                    <Text style={[styles.modalScoreLabel, { color: colors.textPrimary }]}>{label}</Text>
                    <View style={[styles.modalScoreBarTrack, { backgroundColor: colors.progressRingBg }]}>
                      <View
                        style={[
                          styles.modalScoreBarFill,
                          { width: `${(score / 5) * 100}%`, backgroundColor: getScoreColor(score) },
                        ]}
                      />
                    </View>
                    <Text style={[styles.modalScoreValue, { color: colors.textPrimary }]}>{score}</Text>
                  </View>
                ))}
              </View>

              {/* AIコメント */}
              <View style={[styles.modalCommentBox, { backgroundColor: colors.card }]}>
                <Ionicons name="chatbubble-outline" size={14} color={colors.textSecondary} />
                <Text style={[styles.modalCommentText, { color: colors.textPrimary }]}>{mealAnalysisResult.comment}</Text>
              </View>

              {/* 検出された食材 */}
              <View style={styles.modalFoodChips}>
                {mealAnalysisResult.detectedFoods.map((food, i) => (
                  <View key={i} style={[styles.foodChip, { backgroundColor: colors.card }]}>
                    <Text style={[styles.foodChipText, { color: colors.textPrimary }]}>{food}</Text>
                  </View>
                ))}
              </View>

              {/* ボタン */}
              <View style={styles.modalButtonRow}>
                <TouchableOpacity
                  style={[styles.modalButtonCancel, { backgroundColor: colors.card }]}
                  onPress={() => {
                    setShowMealModal(false);
                    setMealAnalysisResult(null);
                    setMealImageBase64(null);
                  }}
                >
                  <Text style={[styles.modalButtonCancelText, { color: colors.textSecondary }]}>閉じる</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButtonSave, { backgroundColor: colors.accent }]}
                  onPress={handleSaveMealLog}
                >
                  <Text style={styles.modalButtonSaveText}>保存</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    );
  };

  // ── レンダリング ──

  return (
    <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={styles.gradient}>
      <StatusBar barStyle={colors.statusBarStyle} />
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* ヘッダー */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>履歴</Text>
          {activeTab === 'activity' && (
            <>
              <TouchableOpacity
                style={styles.headerAddButton}
                onPress={() => setShowAddEventModal(true)}
              >
                <Ionicons name="add-circle-outline" size={24} color={colors.accent} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerActionButton}
                onPress={handleCalendarSyncButton}
                disabled={syncing}
              >
                {syncing ? (
                  <ActivityIndicator size="small" color={colors.accent} />
                ) : (
                  <Ionicons name="calendar-outline" size={24} color={colors.accent} />
                )}
              </TouchableOpacity>
            </>
          )}
          {activeTab === 'exercise' && (
            <TouchableOpacity
              style={styles.headerActionButton}
              onPress={handleSyncHealthKit}
              disabled={syncingHealth}
            >
              {syncingHealth ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <Ionicons name="heart-outline" size={24} color={colors.accent} />
              )}
            </TouchableOpacity>
          )}
          {activeTab === 'sleep' && (
            <TouchableOpacity
              style={styles.headerActionButton}
              onPress={handleSyncSleep}
              disabled={syncingSleep}
            >
              {syncingSleep ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <Ionicons name="moon-outline" size={24} color={colors.accent} />
              )}
            </TouchableOpacity>
          )}
          {activeTab === 'diet' && (
            <TouchableOpacity
              style={styles.headerCameraButton}
              onPress={showPhotoOptions}
              disabled={analyzingMeal}
            >
              <Ionicons name="camera-outline" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          )}
        </View>

        {/* タブバー */}
        <View style={[styles.tabBar, { backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1 }]}>
          {TRACKING_TABS.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tabItem,
                activeTab === tab.key && [styles.tabItemActive, { backgroundColor: colors.accent + '20' }],
              ]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={tab.icon as any}
                size={16}
                color={activeTab === tab.key ? colors.accent : colors.textMuted}
              />
              <Text
                style={[
                  styles.tabLabel,
                  { color: colors.textMuted },
                  activeTab === tab.key && [styles.tabLabelActive, { color: colors.accent }],
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* タブコンテンツ */}
        {renderTabContent()}

        {/* 食事分析モーダル */}
        {renderMealAnalysisModal()}

        {/* 活動手動追加モーダル */}
        <Modal
          visible={showAddEventModal}
          animationType="fade"
          transparent
          onRequestClose={() => setShowAddEventModal(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setShowAddEventModal(false)}>
            <Pressable style={[styles.addEventModalCard, { backgroundColor: colors.modalBg }]} onPress={() => {}}>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={[styles.addEventModalTitle, { color: colors.textPrimary }]}>活動を追加</Text>
              <TextInput
                style={[styles.addEventInput, { color: colors.textPrimary, borderColor: colors.cardBorder, backgroundColor: colors.card }]}
                placeholder="活動名を入力"
                placeholderTextColor={colors.textMuted}
                value={newEventTitle}
                onChangeText={setNewEventTitle}
                autoFocus
              />
              <TextInput
                style={[styles.addEventInput, { color: colors.textPrimary, borderColor: colors.cardBorder, backgroundColor: colors.card }]}
                placeholder="日付 (YYYY-MM-DD)"
                placeholderTextColor={colors.textMuted}
                value={newEventDate}
                onChangeText={setNewEventDate}
              />

              {/* 時間（オプション） */}
              <TouchableOpacity
                style={styles.addEventTimeToggle}
                onPress={() => setShowTimeInput(!showTimeInput)}
              >
                <Ionicons name={showTimeInput ? 'chevron-up' : 'time-outline'} size={16} color={colors.accent} />
                <Text style={[styles.addEventTimeToggleText, { color: colors.accent }]}>
                  {showTimeInput ? '時間を閉じる' : '時間を設定（任意）'}
                </Text>
              </TouchableOpacity>
              {showTimeInput && (
                <View style={styles.addEventTimeContainer}>
                  <View style={styles.addEventTimeRow}>
                    <Text style={[styles.addEventTimeLabel, { color: colors.textSecondary }]}>開始</Text>
                    <TextInput
                      style={[styles.addEventTimeInput, { color: colors.textPrimary, borderColor: colors.cardBorder, backgroundColor: colors.card }]}
                      placeholder="時"
                      placeholderTextColor={colors.textMuted}
                      value={newEventStartHour}
                      onChangeText={setNewEventStartHour}
                      keyboardType="number-pad"
                      maxLength={2}
                    />
                    <Text style={[styles.addEventTimeColon, { color: colors.textPrimary }]}>:</Text>
                    <TextInput
                      style={[styles.addEventTimeInput, { color: colors.textPrimary, borderColor: colors.cardBorder, backgroundColor: colors.card }]}
                      placeholder="分"
                      placeholderTextColor={colors.textMuted}
                      value={newEventStartMin}
                      onChangeText={setNewEventStartMin}
                      keyboardType="number-pad"
                      maxLength={2}
                    />
                  </View>
                  <View style={styles.addEventTimeRow}>
                    <Text style={[styles.addEventTimeLabel, { color: colors.textSecondary }]}>所要</Text>
                    <TextInput
                      style={[styles.addEventTimeInput, { color: colors.textPrimary, borderColor: colors.cardBorder, backgroundColor: colors.card, width: 56 }]}
                      placeholder="60"
                      placeholderTextColor={colors.textMuted}
                      value={newEventDuration}
                      onChangeText={setNewEventDuration}
                      keyboardType="number-pad"
                      maxLength={4}
                    />
                    <Text style={[styles.addEventTimeSuffix, { color: colors.textSecondary }]}>分</Text>
                  </View>
                </View>
              )}

              {/* 人数 */}
              <Text style={[styles.addEventSectionLabel, { color: colors.textSecondary }]}>人数</Text>
              <View style={styles.addEventChipRow}>
                {PARTICIPANTS_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.addEventChip,
                      { borderColor: colors.cardBorder },
                      newEventParticipants === opt.value && { backgroundColor: colors.accent, borderColor: colors.accent },
                    ]}
                    onPress={() => setNewEventParticipants(newEventParticipants === opt.value ? null : opt.value)}
                  >
                    <Text style={[
                      styles.addEventChipText,
                      { color: colors.textSecondary },
                      newEventParticipants === opt.value && { color: '#fff' },
                    ]}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* 関係性 */}
              <Text style={[styles.addEventSectionLabel, { color: colors.textSecondary }]}>関係性</Text>
              <View style={styles.addEventChipRow}>
                {RELATIONSHIP_OPTIONS.map((opt) => {
                  const selected = newEventRelationships.includes(opt.value);
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[
                        styles.addEventChip,
                        { borderColor: colors.cardBorder },
                        selected && { backgroundColor: colors.accent, borderColor: colors.accent },
                      ]}
                      onPress={() => setNewEventRelationships(
                        selected
                          ? newEventRelationships.filter(r => r !== opt.value)
                          : [...newEventRelationships, opt.value]
                      )}
                    >
                      <Text style={[
                        styles.addEventChipText,
                        { color: colors.textSecondary },
                        selected && { color: '#fff' },
                      ]}>{opt.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* 形式 */}
              <Text style={[styles.addEventSectionLabel, { color: colors.textSecondary }]}>形式</Text>
              <View style={styles.addEventChipRow}>
                {FORMAT_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.addEventChip,
                      { borderColor: colors.cardBorder },
                      newEventFormat === opt.value && { backgroundColor: colors.accent, borderColor: colors.accent },
                    ]}
                    onPress={() => setNewEventFormat(newEventFormat === opt.value ? null : opt.value)}
                  >
                    <Text style={[
                      styles.addEventChipText,
                      { color: colors.textSecondary },
                      newEventFormat === opt.value && { color: '#fff' },
                    ]}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* ストレス */}
              <Text style={[styles.addEventSectionLabel, { color: colors.textSecondary }]}>ストレス</Text>
              <View style={styles.addEventChipRow}>
                {STRESS_OPTIONS.map((score) => (
                  <TouchableOpacity
                    key={score}
                    style={[
                      styles.addEventStressChip,
                      { backgroundColor: newEventStress === score ? getStressColor(score) : colors.card, borderColor: colors.cardBorder },
                    ]}
                    onPress={() => setNewEventStress(newEventStress === score ? null : score)}
                  >
                    <Text style={[
                      styles.addEventChipText,
                      { color: newEventStress === score ? '#fff' : colors.textSecondary },
                    ]}>{score}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.addEventButtonRow}>
                <TouchableOpacity
                  style={[styles.addEventCancelButton, { backgroundColor: colors.card }]}
                  onPress={() => {
                    setShowAddEventModal(false);
                    setNewEventTitle('');
                    setNewEventParticipants(null);
                    setNewEventRelationships([]);
                    setNewEventFormat(null);
                    setNewEventStress(null);
      setShowTimeInput(false);
      setNewEventStartHour('');
      setNewEventStartMin('');
      setNewEventDuration('60');
                  }}
                >
                  <Text style={[styles.addEventCancelText, { color: colors.textSecondary }]}>キャンセル</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.addEventSaveButton, { backgroundColor: colors.accent }]}
                  onPress={handleAddManualEvent}
                >
                  <Text style={styles.addEventSaveText}>追加</Text>
                </TouchableOpacity>
              </View>
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>

        {/* 個別ピッカーモーダル */}
        <Modal
          visible={pickerEvent !== null}
          animationType="fade"
          transparent={true}
          onRequestClose={closePicker}
        >
          <Pressable style={styles.scorePickerOverlay} onPress={closePicker}>
            <Pressable style={[styles.scorePickerContent, { backgroundColor: colors.modalBg }]} onPress={() => {}}>

              {/* タイトル編集 */}
              {pickerType === 'title' && pickerEvent && (
                <>
                  <Text style={[styles.scorePickerTitle, { color: colors.textPrimary }]}>タイトル</Text>
                  <TextInput
                    style={[styles.titleInput, { color: colors.textPrimary, borderColor: colors.cardBorder, backgroundColor: colors.card }]}
                    value={pickerTitleText}
                    onChangeText={setPickerTitleText}
                    placeholder="イベントタイトル"
                    placeholderTextColor={colors.textMuted}
                    autoFocus
                  />
                  <TouchableOpacity
                    style={[styles.pickerSaveButton, { backgroundColor: colors.accent }]}
                    onPress={() => savePickerField(pickerEvent.eventId, { eventSummary: pickerTitleText })}
                  >
                    <Text style={styles.pickerSaveButtonText}>保存</Text>
                  </TouchableOpacity>
                </>
              )}

              {/* 時間編集 */}
              {pickerType === 'time' && pickerEvent && (
                <>
                  <Text style={[styles.scorePickerTitle, { color: colors.textPrimary }]}>時間</Text>
                  <View style={styles.timePickerSection}>
                    <View style={styles.addEventTimeRow}>
                      <Text style={[styles.addEventTimeLabel, { color: colors.textSecondary }]}>開始</Text>
                      <TextInput
                        style={[styles.addEventTimeInput, { color: colors.textPrimary, borderColor: colors.cardBorder, backgroundColor: colors.card }]}
                        value={pickerStartHour}
                        onChangeText={setPickerStartHour}
                        keyboardType="number-pad"
                        maxLength={2}
                        placeholder="00"
                        placeholderTextColor={colors.textMuted}
                      />
                      <Text style={[styles.addEventTimeColon, { color: colors.textPrimary }]}>:</Text>
                      <TextInput
                        style={[styles.addEventTimeInput, { color: colors.textPrimary, borderColor: colors.cardBorder, backgroundColor: colors.card }]}
                        value={pickerStartMin}
                        onChangeText={setPickerStartMin}
                        keyboardType="number-pad"
                        maxLength={2}
                        placeholder="00"
                        placeholderTextColor={colors.textMuted}
                      />
                    </View>
                    <View style={styles.addEventTimeRow}>
                      <Text style={[styles.addEventTimeLabel, { color: colors.textSecondary }]}>終了</Text>
                      <TextInput
                        style={[styles.addEventTimeInput, { color: colors.textPrimary, borderColor: colors.cardBorder, backgroundColor: colors.card }]}
                        value={pickerEndHour}
                        onChangeText={setPickerEndHour}
                        keyboardType="number-pad"
                        maxLength={2}
                        placeholder="00"
                        placeholderTextColor={colors.textMuted}
                      />
                      <Text style={[styles.addEventTimeColon, { color: colors.textPrimary }]}>:</Text>
                      <TextInput
                        style={[styles.addEventTimeInput, { color: colors.textPrimary, borderColor: colors.cardBorder, backgroundColor: colors.card }]}
                        value={pickerEndMin}
                        onChangeText={setPickerEndMin}
                        keyboardType="number-pad"
                        maxLength={2}
                        placeholder="00"
                        placeholderTextColor={colors.textMuted}
                      />
                    </View>
                  </View>
                  <TouchableOpacity
                    style={[styles.pickerSaveButton, { backgroundColor: colors.accent }]}
                    onPress={() => {
                      const sH = parseInt(pickerStartHour, 10);
                      const sM = parseInt(pickerStartMin, 10);
                      const eH = parseInt(pickerEndHour, 10);
                      const eM = parseInt(pickerEndMin, 10);
                      if (isNaN(sH) || isNaN(eH)) return;
                      const base = new Date(pickerEvent.eventStart);
                      const startDate = new Date(base);
                      startDate.setHours(Math.min(Math.max(sH, 0), 23), isNaN(sM) ? 0 : Math.min(Math.max(sM, 0), 59), 0, 0);
                      const endDate = new Date(base);
                      endDate.setHours(Math.min(Math.max(eH, 0), 23), isNaN(eM) ? 0 : Math.min(Math.max(eM, 0), 59), 0, 0);
                      savePickerField(pickerEvent.eventId, {
                        eventStart: startDate.toISOString(),
                        eventEnd: endDate.toISOString(),
                      });
                    }}
                  >
                    <Text style={styles.pickerSaveButtonText}>保存</Text>
                  </TouchableOpacity>
                </>
              )}

              {/* 参加者ピッカー */}
              {pickerType === 'participants' && pickerEvent && (
                <>
                  <Text style={[styles.scorePickerTitle, { color: colors.textPrimary }]}>参加者</Text>
                  <View style={styles.scorePickerRow}>
                    {PARTICIPANTS_OPTIONS.map((opt) => (
                      <TouchableOpacity
                        key={opt.value}
                        style={[
                          styles.optionButton,
                          pickerEvent.participants === opt.value && styles.optionButtonActive,
                        ]}
                        onPress={() => savePickerField(pickerEvent.eventId, { participants: opt.value })}
                      >
                        <Text style={[
                          styles.optionText,
                          pickerEvent.participants === opt.value && styles.optionTextActive,
                        ]}>{opt.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {/* 関係性ピッカー（複数選択 → 決定ボタン） */}
              {pickerType === 'relationships' && pickerEvent && (
                <>
                  <Text style={[styles.scorePickerTitle, { color: colors.textPrimary }]}>関係性</Text>
                  <View style={styles.scorePickerRow}>
                    {RELATIONSHIP_OPTIONS.map((opt) => {
                      const isSelected = pickerEvent.relationships?.includes(opt.value) ?? false;
                      return (
                        <TouchableOpacity
                          key={opt.value}
                          style={[styles.optionButton, isSelected && styles.optionButtonActive]}
                          onPress={() => {
                            const current = pickerEvent.relationships || [];
                            const next = isSelected
                              ? current.filter(r => r !== opt.value)
                              : [...current, opt.value];
                            const newRelationships = next.length > 0 ? next as EventClassificationRelationship[] : null;
                            savePickerField(pickerEvent.eventId, { relationships: newRelationships });
                          }}
                        >
                          <Text style={[styles.optionText, isSelected && styles.optionTextActive]}>{opt.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}

              {/* 形式ピッカー */}
              {pickerType === 'format' && pickerEvent && (
                <>
                  <Text style={[styles.scorePickerTitle, { color: colors.textPrimary }]}>形式</Text>
                  <View style={styles.scorePickerRow}>
                    {FORMAT_OPTIONS.map((opt) => (
                      <TouchableOpacity
                        key={opt.value}
                        style={[
                          styles.optionButton,
                          pickerEvent.format === opt.value && styles.optionButtonActive,
                        ]}
                        onPress={() => savePickerField(pickerEvent.eventId, { format: opt.value })}
                      >
                        <Text style={[
                          styles.optionText,
                          pickerEvent.format === opt.value && styles.optionTextActive,
                        ]}>{opt.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {/* ストレスレベルピッカー */}
              {pickerType === 'stress' && pickerEvent && (
                <>
                  <Text style={[styles.scorePickerTitle, { color: colors.textPrimary }]}>ストレスレベル</Text>
                  <View style={styles.scorePickerRow}>
                    {STRESS_OPTIONS.map((score) => (
                      <TouchableOpacity
                        key={score}
                        style={[
                          styles.scorePickerButton,
                          { backgroundColor: getStressColor(score) },
                          pickerEvent.stressScore === score && styles.scorePickerButtonActive,
                        ]}
                        onPress={() => savePickerField(pickerEvent.eventId, { stressScore: score })}
                      >
                        <Text style={styles.scorePickerButtonText}>{score}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View style={styles.stressLabels}>
                    <Text style={styles.stressLabelText}>リラックス</Text>
                    <Text style={styles.stressLabelText}>高ストレス</Text>
                  </View>
                </>
              )}
            </Pressable>
          </Pressable>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}

// ── スタイル ──

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 12,
    position: 'relative',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#4A5568',
    textAlign: 'center',
  },
  headerAddButton: {
    position: 'absolute',
    right: 56,
    top: 20,
    padding: 4,
  },
  headerActionButton: {
    position: 'absolute',
    right: 24,
    top: 20,
    padding: 4,
  },
  headerCameraButton: {
    position: 'absolute',
    right: 24,
    top: 20,
    padding: 4,
  },

  // ── タブバー ──
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 3,
    marginBottom: 12,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 2,
  },
  tabItemActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabLabel: {
    fontSize: 10,
    color: '#A0AEC0',
    fontWeight: '500',
  },
  tabLabelActive: {
    color: '#2B6CB0',
    fontWeight: '600',
  },

  // ── 共通 ──
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 8,
  },
  emptyContainerInline: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
    gap: 8,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4A5568',
  },
  emptyHint: {
    fontSize: 13,
    color: '#718096',
    textAlign: 'center',
    lineHeight: 20,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  connectButton: {
    marginTop: 16,
    backgroundColor: '#2B6CB0',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  connectButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },

  // ── 瞑想タブ ──
  mascotSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  mascotImage: {
    width: 70,
    height: 70,
  },
  speechBubbleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  speechBubbleTail: {
    width: 0,
    height: 0,
    borderTopWidth: 8,
    borderBottomWidth: 8,
    borderRightWidth: 10,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRightColor: '#FFF5F7',
    marginRight: -1,
  },
  speechBubble: {
    flex: 1,
    position: 'relative',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 182, 193, 0.5)',
    shadowColor: '#FFB6C1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  sparkle: {
    position: 'absolute',
    fontSize: 14,
    color: '#FF69B4',
    textShadowColor: '#FF69B4',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  sparkleTopRight: { top: -8, right: -6, fontSize: 16 },
  sparkleTopLeft: { top: 0, left: -10, fontSize: 14, color: '#FF85A2' },
  sparkleBottomRight: { bottom: -6, right: -2, fontSize: 12, color: '#FFB6C1' },
  speechBubbleText: {
    fontSize: 12,
    color: '#5A6B7C',
    fontWeight: '600',
    lineHeight: 18,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  sessionCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    position: 'relative',
  },
  sessionDate: {
    fontSize: 11,
    color: '#A0AEC0',
    marginBottom: 10,
  },
  conditionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  conditionItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  conditionLabel: {
    fontSize: 11,
    color: '#A0AEC0',
  },
  conditionValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4A5568',
  },
  conditionDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  sessionMeta: { marginTop: 12, fontSize: 11, color: '#A0AEC0' },

  // ── 活動タブ ──
  dateGroupHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4A5568',
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  eventCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eventTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#2D3748',
    marginRight: 8,
  },
  eventTime: {
    fontSize: 12,
    marginTop: 2,
  },
  stressBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stressBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  eventTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 8,
  },
  eventTag: {
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  eventTagText: {
    fontSize: 11,
    color: '#718096',
  },

  // ── 運動タブ・睡眠タブ ──
  healthCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  healthDateText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4A5568',
    marginBottom: 8,
  },
  healthStatsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  healthStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  healthStatValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2D3748',
  },
  healthStatLabel: {
    fontSize: 11,
    color: '#718096',
  },
  workoutList: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
    paddingTop: 8,
    gap: 4,
  },
  workoutItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  workoutName: {
    fontSize: 12,
    color: '#4A5568',
    fontWeight: '500',
  },
  workoutDuration: {
    fontSize: 12,
    color: '#718096',
  },
  workoutCalories: {
    fontSize: 12,
    color: '#A0AEC0',
  },

  // ── 睡眠バー ──
  sleepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sleepHoursText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2D3748',
    marginTop: 2,
  },
  sleepBarContainer: {
    flex: 1,
    height: 12,
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: 6,
    marginLeft: 16,
    overflow: 'hidden',
  },
  sleepBar: {
    height: 12,
    borderRadius: 6,
  },

  // ── 食事タブ ──
  analyzingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2B6CB0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    gap: 8,
  },
  analyzingText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  mealCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  mealCardRow: {
    flexDirection: 'row',
    gap: 12,
  },
  mealCardImage: {
    width: 72,
    height: 72,
    borderRadius: 10,
  },
  mealCardContent: {
    flex: 1,
  },
  mealCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  mealCardName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3748',
    flex: 1,
  },
  mealCardScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mealOverallScore: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealOverallScoreText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  mealCardDate: {
    fontSize: 11,
    color: '#A0AEC0',
    marginBottom: 8,
  },
  mealScoreBarsCompact: {
    gap: 4,
    marginBottom: 8,
  },
  mealScoreBarCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mealScoreBarLabelCompact: {
    fontSize: 10,
    color: '#718096',
    width: 32,
  },
  mealScoreBarTrackCompact: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  mealScoreBarFillCompact: {
    height: 6,
    borderRadius: 3,
  },
  mealCardComment: {
    fontSize: 12,
    color: '#718096',
    lineHeight: 18,
    marginBottom: 6,
  },
  mealFoodChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  foodChip: {
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  foodChipText: {
    fontSize: 11,
    color: '#4A5568',
  },

  // ── 食事分析モーダル ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  modalImage: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    marginBottom: 14,
  },
  modalMealName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2D3748',
    textAlign: 'center',
    marginBottom: 12,
  },
  modalOverallRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 16,
  },
  modalOverallLabel: {
    fontSize: 14,
    color: '#718096',
    fontWeight: '500',
  },
  modalOverallBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  modalOverallValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  modalOverallMax: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.8)',
  },
  modalScoreBars: {
    gap: 10,
    marginBottom: 16,
  },
  modalScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalScoreLabel: {
    fontSize: 12,
    color: '#4A5568',
    width: 90,
    fontWeight: '500',
  },
  modalScoreBarTrack: {
    flex: 1,
    height: 10,
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: 5,
    overflow: 'hidden',
  },
  modalScoreBarFill: {
    height: 10,
    borderRadius: 5,
  },
  modalScoreValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2D3748',
    width: 20,
    textAlign: 'right',
  },
  modalCommentBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#F7FAFC',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  modalCommentText: {
    flex: 1,
    fontSize: 13,
    color: '#4A5568',
    lineHeight: 20,
  },
  modalFoodChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 16,
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modalButtonCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F7FAFC',
    alignItems: 'center',
  },
  modalButtonCancelText: {
    fontSize: 14,
    color: '#718096',
    fontWeight: '600',
  },
  modalButtonSave: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#2B6CB0',
    alignItems: 'center',
  },
  modalButtonSaveText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },

  // ── 活動タブ: メニュー・編集・削除モーダル ──
  eventHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  menuButton: {
    padding: 4,
  },
  menuButtonText: {
    fontSize: 18,
    color: '#A0AEC0',
    fontWeight: '700',
  },
  menuModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    width: 200,
    overflow: 'hidden',
  },
  menuModalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  menuModalItemText: {
    fontSize: 15,
    color: '#4A5568',
  },
  menuModalItemTextDanger: {
    fontSize: 15,
    color: '#E53E3E',
  },
  menuModalDivider: {
    height: 1,
    backgroundColor: '#EDF2F7',
  },
  // 編集モーダル
  editModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  editModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  editModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF2F7',
  },
  editModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4A5568',
  },
  editModalBody: {
    padding: 16,
  },
  editModalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4A5568',
    marginBottom: 8,
    marginTop: 16,
  },
  editModalEventTime: {
    fontSize: 13,
    color: '#718096',
    marginBottom: 20,
  },
  titleInput: {
    fontSize: 15,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 4,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#EDF2F7',
  },
  optionButtonActive: {
    backgroundColor: '#805AD5',
  },
  optionText: {
    fontSize: 13,
    color: '#4A5568',
  },
  optionTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  stressButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    opacity: 0.6,
  },
  stressButtonActive: {
    opacity: 1,
    borderWidth: 2,
    borderColor: '#4A5568',
  },
  stressButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  stressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  stressLabelText: {
    fontSize: 11,
    color: '#A0AEC0',
  },
  attendeeList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  attendeeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#EDF2F7',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  attendeeChipActive: {
    backgroundColor: '#805AD5',
    borderColor: '#805AD5',
  },
  attendeeChipText: {
    fontSize: 13,
    color: '#4A5568',
  },
  attendeeChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  addPersonRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  addPersonInput: {
    flex: 1,
    fontSize: 14,
    color: '#4A5568',
    backgroundColor: '#F7FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  addPersonButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#805AD5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPersonButtonDisabled: {
    backgroundColor: '#A0AEC0',
  },
  editModalFooter: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#EDF2F7',
  },
  editCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#EDF2F7',
    alignItems: 'center',
  },
  editCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4A5568',
  },
  editSaveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#805AD5',
    alignItems: 'center',
  },
  editSaveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // スコアピッカーモーダル
  scorePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scorePickerContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: 280,
  },
  scorePickerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4A5568',
    textAlign: 'center',
    marginBottom: 14,
  },
  scorePickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  scorePickerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.6,
  },
  scorePickerButtonActive: {
    opacity: 1,
    borderWidth: 2,
    borderColor: '#4A5568',
  },
  scorePickerButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  pickerSaveButton: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 32,
    borderRadius: 8,
    alignSelf: 'center',
  },
  pickerSaveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  // 削除確認モーダル
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  deleteModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
  },
  deleteModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4A5568',
    marginBottom: 8,
  },
  deleteModalText: {
    fontSize: 14,
    color: '#718096',
    textAlign: 'center',
    marginBottom: 20,
  },
  deleteModalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  deleteModalCancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#EDF2F7',
    alignItems: 'center',
  },
  deleteModalCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4A5568',
  },
  deleteModalConfirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#E53E3E',
    alignItems: 'center',
  },
  deleteModalConfirmText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // ── 活動手動追加モーダル ──
  addEventModalCard: {
    width: '85%',
    maxHeight: '80%',
    borderRadius: 16,
    padding: 24,
  },
  addEventModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  addEventInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  timePickerSection: {
    gap: 12,
    marginBottom: 16,
  },
  addEventTimeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  addEventTimeToggleText: {
    fontSize: 14,
    fontWeight: '600',
  },
  addEventTimeContainer: {
    gap: 8,
    marginBottom: 14,
  },
  addEventTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addEventTimeLabel: {
    fontSize: 13,
    fontWeight: '600',
    width: 32,
  },
  addEventTimeInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 16,
    width: 48,
    textAlign: 'center',
  },
  addEventTimeColon: {
    fontSize: 18,
    fontWeight: '700',
  },
  addEventTimeSuffix: {
    fontSize: 14,
    fontWeight: '600',
  },
  addEventSectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  addEventChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  addEventChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
  },
  addEventStressChip: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addEventChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  addEventButtonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  addEventCancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  addEventCancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
  addEventSaveButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  addEventSaveText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
