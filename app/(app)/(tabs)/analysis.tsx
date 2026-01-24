import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  TextInput,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  useGoogleAuth,
  exchangeCodeForToken,
  fetchCalendarEvents,
  fetchCalendarList,
  countEventsByDate,
  CalendarEvent,
  CalendarInfo,
} from '@/lib/googleCalendar';
import {
  listSessionLogs,
  SessionLog,
  listEventClassifications,
  batchCreateEventClassifications,
  updateEventClassification,
  deleteEventClassification,
  getUserId,
  EventClassification,
  EventClassificationParticipants,
  EventClassificationRelationship,
  EventClassificationFormat,
  Person,
  listPeople,
  createPerson,
  listEventChatIds,
  listEventChats,
  listEventChangeLogs,
} from '@/lib/api';
import {
  classifyCalendarEvents,
  getStressColor,
  analyzeStressPatterns,
  StressAnalysisResult,
} from '@/lib/openRouter';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// タブの種類
type TabType = 'check' | 'chart' | 'aiAnalysis';

const TABS: { key: TabType; label: string; icon: string }[] = [
  { key: 'check', label: 'チェック', icon: 'list' },
  { key: 'chart', label: 'チャート', icon: 'bar-chart' },
  { key: 'aiAnalysis', label: 'AI分析', icon: 'sparkles' },
];

// 編集用の選択肢
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

/**
 * 日時をフォーマット（MM/DD HH:mm）
 */
function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${month}/${day} ${hours}:${minutes}`;
}

/**
 * 時間範囲をフォーマット（HH:mm - HH:mm）
 */
function formatTimeRange(startStr: string, endStr: string): string {
  const start = new Date(startStr);
  const end = new Date(endStr);
  const startTime = `${start.getHours().toString().padStart(2, '0')}:${start.getMinutes().toString().padStart(2, '0')}`;
  const endTime = `${end.getHours().toString().padStart(2, '0')}:${end.getMinutes().toString().padStart(2, '0')}`;
  return `${startTime} - ${endTime}`;
}

/**
 * 日付ヘッダー用フォーマット（M月D日（曜日））
 */
function formatDateHeader(dateStr: string): string {
  const date = new Date(dateStr);
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekday = weekdays[date.getDay()];
  return `${month}月${day}日（${weekday}）`;
}

/**
 * 日付をフォーマット（MM/DD）
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

/**
 * 日付キーを取得（YYYY-MM-DD）
 */
function getDateKey(dateStr: string): string {
  return dateStr.split('T')[0];
}

/**
 * 忙しさレベルを取得
 */
function getBusyLevel(eventCount: number): { label: string; color: string } {
  if (eventCount >= 5) return { label: '忙しい', color: '#E53E3E' };
  if (eventCount >= 3) return { label: 'やや忙しい', color: '#ED8936' };
  if (eventCount >= 1) return { label: '普通', color: '#48BB78' };
  return { label: 'ゆとり', color: '#4299E1' };
}

/**
 * AnalysisScreen - 分析画面
 */
export default function AnalysisScreen() {
  const { request, response, promptAsync, redirectUri } = useGoogleAuth();

  const [activeTab, setActiveTab] = useState<TabType>('check');
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [sessions, setSessions] = useState<SessionLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [savedClassifications, setSavedClassifications] = useState<EventClassification[]>([]);

  // 編集モーダル
  const [editingEvent, setEditingEvent] = useState<EventClassification | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);

  // 削除モーダル
  const [deletingEvent, setDeletingEvent] = useState<EventClassification | null>(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);

  // 3点メニューモーダル
  const [menuEvent, setMenuEvent] = useState<EventClassification | null>(null);
  const [menuModalVisible, setMenuModalVisible] = useState(false);

  // 参加者（Person）関連
  const [people, setPeople] = useState<Person[]>([]);
  const [newPersonName, setNewPersonName] = useState('');

  // カレンダー選択関連
  const [calendars, setCalendars] = useState<CalendarInfo[]>([]);
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[]>([]);
  const [calendarModalVisible, setCalendarModalVisible] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // チャート拡大/縮小（デフォルトは30日表示）
  const [isChartExpanded, setIsChartExpanded] = useState(false);

  // チャート詳細モーダル
  const [selectedDayData, setSelectedDayData] = useState<{
    date: string;
    events: { score: number; summary: string }[];
    totalStress: number;
    hasSession: boolean;
  } | null>(null);

  // AI分析
  const [analysisResult, setAnalysisResult] = useState<StressAnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  // 日別のイベント数
  const [eventCountByDate, setEventCountByDate] = useState<Record<string, number>>({});

  // チャット保存済みのイベントID
  const [chatSavedEventIds, setChatSavedEventIds] = useState<Set<string>>(new Set());

  // 認証コードの重複使用を防ぐためのRef
  const processedCodeRef = useRef<string | null>(null);

  /**
   * アプリ起動時に保存済みトークンを読み込む
   */
  useEffect(() => {
    const loadSavedSession = async () => {
      try {
        const savedToken = await AsyncStorage.getItem('googleAccessToken');
        const savedCalendars = await AsyncStorage.getItem('googleCalendars');
        const savedCalendarIds = await AsyncStorage.getItem('selectedCalendarIds');

        if (savedToken && savedCalendars) {
          setAccessToken(savedToken);
          setCalendars(JSON.parse(savedCalendars));
          setIsConnected(true);

          const calendarIds = savedCalendarIds ? JSON.parse(savedCalendarIds) : undefined;
          if (calendarIds) {
            setSelectedCalendarIds(calendarIds);
          }

          await fetchData(savedToken, calendarIds);
        }
      } catch (error) {
        console.error('Load saved session error:', error);
      }
    };

    loadSavedSession();
  }, []);

  /**
   * 画面がフォーカスされた時に分類データとチャット情報を再取得
   */
  useFocusEffect(
    useCallback(() => {
      const refreshData = async () => {
        try {
          // 分類データを取得
          const classifications = await listEventClassifications();
          setSavedClassifications(classifications);

          // チャット保存済みのイベントIDを取得
          const chatIds = await listEventChatIds();
          setChatSavedEventIds(chatIds);
        } catch (error) {
          console.error('Refresh data error:', error);
        }
      };
      refreshData();
    }, [])
  );

  /**
   * OAuth レスポンス処理
   */
  useEffect(() => {
    if (response?.type === 'success' && response.params.code && request?.codeVerifier) {
      // 同じ認証コードを2回処理しないようにチェック
      if (processedCodeRef.current === response.params.code) {
        console.log('Code already processed, skipping...');
        return;
      }
      processedCodeRef.current = response.params.code;
      handleAuthSuccess(response.params.code, request.codeVerifier);
    }
  }, [response]);

  /**
   * 認証成功時の処理
   */
  const handleAuthSuccess = async (code: string, codeVerifier: string) => {
    setLoading(true);
    try {
      const token = await exchangeCodeForToken(code, codeVerifier, redirectUri);
      if (token) {
        setAccessToken(token);
        setIsConnected(true);

        // アクセストークンを保存
        await AsyncStorage.setItem('googleAccessToken', token);

        // カレンダー一覧を取得
        const calendarList = await fetchCalendarList(token);
        setCalendars(calendarList);

        // カレンダー一覧を保存
        await AsyncStorage.setItem('googleCalendars', JSON.stringify(calendarList));

        // 保存済みの選択カレンダーを読み込む
        const savedCalendarIds = await AsyncStorage.getItem('selectedCalendarIds');
        let calendarIdsToUse: string[];

        if (savedCalendarIds) {
          calendarIdsToUse = JSON.parse(savedCalendarIds);
        } else {
          // 初回はprimaryカレンダーのみ選択
          const primaryCalendar = calendarList.find(c => c.primary);
          calendarIdsToUse = primaryCalendar ? [primaryCalendar.id] : [];
        }
        setSelectedCalendarIds(calendarIdsToUse);

        await fetchData(token, calendarIdsToUse);
      } else {
        Alert.alert('エラー', '認証に失敗しました');
      }
    } catch (error) {
      console.error('Auth error:', error);
      Alert.alert('エラー', '認証処理中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  /**
   * カレンダーとセッションデータを取得
   */
  const fetchData = async (token: string, calendarIds?: string[]) => {
    setLoading(true);
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const events = await fetchCalendarEvents(token, thirtyDaysAgo, now, calendarIds);
      setCalendarEvents(events);
      setEventCountByDate(countEventsByDate(events));

      const sessionLogs = await listSessionLogs();
      setSessions(sessionLogs);

      // 保存済みの分類を取得
      const classifications = await listEventClassifications();
      setSavedClassifications(classifications);

      // Personリストを取得
      const peopleList = await listPeople();
      setPeople(peopleList);
    } catch (error) {
      console.error('Fetch data error:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Googleログインボタン
   */
  const handleConnect = useCallback(() => {
    promptAsync();
  }, [promptAsync]);

  /**
   * カレンダーイベントをAIで分類してDBに保存
   */
  const handleClassify = useCallback(async () => {
    if (calendarEvents.length === 0) {
      Alert.alert('エラー', '分類するイベントがありません');
      return;
    }

    // 既に分類済みのイベントIDを取得
    const classifiedEventIds = new Set(savedClassifications.map(c => c.eventId));

    // 未分類のイベントのみ抽出
    const unclassifiedEvents = calendarEvents.filter(e => !classifiedEventIds.has(e.id));

    if (unclassifiedEvents.length === 0) {
      Alert.alert('情報', 'すべてのイベントは分類済みです');
      return;
    }

    setClassifying(true);
    try {
      const userId = await getUserId();
      const classified = await classifyCalendarEvents(unclassifiedEvents);

      // 保存直前に最新の分類済みリストを再取得して重複を防ぐ
      const latestClassifications = await listEventClassifications();
      const latestClassifiedIds = new Set(latestClassifications.map(c => c.eventId));

      // まだ保存されていないイベントのみをフィルタリング
      const newClassified = classified.filter(event => !latestClassifiedIds.has(event.id));

      if (newClassified.length === 0) {
        // 全て既に保存済みだった場合はstateを更新して終了
        setSavedClassifications(latestClassifications);
        Alert.alert('情報', 'すべてのイベントは既に分類済みです');
        return;
      }

      // DBに保存
      const inputs = newClassified.map((event) => ({
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

      // 最新のリストに新しく保存したものを追加
      setSavedClassifications([...latestClassifications, ...saved]);

      Alert.alert('完了', `${saved.length}件のイベントを分類しました`);
    } catch (error) {
      console.error('Classification error:', error);
      Alert.alert('エラー', 'AI分類中にエラーが発生しました');
    } finally {
      setClassifying(false);
    }
  }, [calendarEvents, savedClassifications]);

  /**
   * すべてのイベントを再分類（既存の分類を削除して再度AI分類）
   */
  const handleReclassifyAll = useCallback(async () => {
    if (calendarEvents.length === 0) {
      Alert.alert('エラー', '分類するイベントがありません');
      return;
    }

    // Web環境ではwindow.confirmを使用
    const confirmed = window.confirm(
      `${savedClassifications.length}件の分類データを削除して、${calendarEvents.length}件を再分類します。よろしいですか？`
    );

    if (!confirmed) return;

    setClassifying(true);
    try {
      // 既存の分類をすべて削除
      for (const classification of savedClassifications) {
        await deleteEventClassification(classification.eventId);
      }
      setSavedClassifications([]);

      // 全イベントをAI分類
      const userId = await getUserId();
      const classified = await classifyCalendarEvents(calendarEvents);

      // DBに保存
      const inputs = classified.map((event) => ({
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
      setSavedClassifications(saved);

      Alert.alert('完了', `${saved.length}件のイベントを再分類しました`);
    } catch (error) {
      console.error('Reclassify error:', error);
      Alert.alert('エラー', '再分類中にエラーが発生しました');
    } finally {
      setClassifying(false);
    }
  }, [calendarEvents, savedClassifications]);

  /**
   * 3点メニューを開く
   */
  const handleMenuOpen = (event: EventClassification) => {
    setMenuEvent(event);
    setMenuModalVisible(true);
  };

  /**
   * 編集を開始
   */
  const handleEditStart = (event: EventClassification) => {
    setMenuModalVisible(false);
    setEditingEvent({ ...event });
    setEditModalVisible(true);
  };

  /**
   * 削除を開始
   */
  const handleDeleteStart = (event: EventClassification) => {
    setMenuModalVisible(false);
    setDeletingEvent(event);
    setDeleteModalVisible(true);
  };

  /**
   * AIレビューを開始
   */
  const handleAIReviewStart = (event: EventClassification) => {
    router.push({
      pathname: '/event-chat',
      params: {
        eventId: event.eventId,
        eventSummary: event.eventSummary,
        eventStart: event.eventStart,
        eventEnd: event.eventEnd,
        stressScore: event.stressScore?.toString() || '',
        participants: event.participants || '',
        relationships: event.relationships?.join(',') || '',
        format: event.format || '',
      },
    });
  };

  /**
   * 削除を確認
   */
  const handleDeleteConfirm = async () => {
    if (!deletingEvent) return;

    try {
      await deleteEventClassification(deletingEvent.eventId);
      setSavedClassifications(prev =>
        prev.filter(c => c.eventId !== deletingEvent.eventId)
      );
      setDeleteModalVisible(false);
      setDeletingEvent(null);
    } catch (error) {
      console.error('Delete error:', error);
      Alert.alert('エラー', '削除に失敗しました');
    }
  };

  /**
   * 新しい人を追加
   */
  const handleAddPerson = async () => {
    if (!newPersonName.trim()) return;

    try {
      const userId = await getUserId();
      const newPerson = await createPerson({
        personId: userId,
        name: newPersonName.trim(),
      });
      setPeople(prev => [...prev, newPerson]);
      setNewPersonName('');

      // 追加した人を選択状態にする
      if (editingEvent) {
        const currentAttendees = editingEvent.attendeeIds || [];
        setEditingEvent({
          ...editingEvent,
          attendeeIds: [...currentAttendees, newPerson.id],
        });
      }
    } catch (error) {
      console.error('Add person error:', error);
      Alert.alert('エラー', '追加に失敗しました');
    }
  };

  /**
   * 参加者の選択をトグル
   */
  const toggleAttendee = (personId: string) => {
    if (!editingEvent) return;

    const currentAttendees = editingEvent.attendeeIds || [];
    const isSelected = currentAttendees.includes(personId);

    let newAttendees: string[];
    if (isSelected) {
      newAttendees = currentAttendees.filter(id => id !== personId);
    } else {
      newAttendees = [...currentAttendees, personId];
    }

    setEditingEvent({
      ...editingEvent,
      attendeeIds: newAttendees.length > 0 ? newAttendees : null,
    });
  };

  /**
   * 編集を保存
   */
  const handleEditSave = async () => {
    if (!editingEvent) return;

    try {
      const updated = await updateEventClassification(editingEvent.eventId, {
        eventSummary: editingEvent.eventSummary,
        participants: editingEvent.participants,
        relationships: editingEvent.relationships,
        format: editingEvent.format,
        stressScore: editingEvent.stressScore,
        attendeeIds: editingEvent.attendeeIds,
        isManuallyEdited: true,
      });

      setSavedClassifications(prev =>
        prev.map(c => c.eventId === updated.eventId ? updated : c)
      );
      setEditModalVisible(false);
      setEditingEvent(null);
    } catch (error) {
      console.error('Update error:', error);
      Alert.alert('エラー', '更新に失敗しました');
    }
  };

  /**
   * カレンダーの選択をトグル
   */
  const toggleCalendar = (calendarId: string) => {
    setSelectedCalendarIds(prev => {
      if (prev.includes(calendarId)) {
        return prev.filter(id => id !== calendarId);
      } else {
        return [...prev, calendarId];
      }
    });
  };

  /**
   * カレンダー選択を保存して再取得
   */
  const saveCalendarSelection = async () => {
    if (selectedCalendarIds.length === 0) {
      Alert.alert('エラー', '少なくとも1つのカレンダーを選択してください');
      return;
    }

    try {
      await AsyncStorage.setItem('selectedCalendarIds', JSON.stringify(selectedCalendarIds));
      setCalendarModalVisible(false);

      if (accessToken) {
        await fetchData(accessToken, selectedCalendarIds);
      }
    } catch (error) {
      console.error('Save calendar selection error:', error);
      Alert.alert('エラー', 'カレンダー設定の保存に失敗しました');
    }
  };

  /**
   * 関係性の選択をトグル
   */
  const toggleRelationship = (value: EventClassificationRelationship) => {
    if (!editingEvent) return;

    const currentRelationships = editingEvent.relationships || [];
    const isSelected = currentRelationships.includes(value);

    let newRelationships: EventClassificationRelationship[];
    if (isSelected) {
      newRelationships = currentRelationships.filter(r => r !== value);
    } else {
      newRelationships = [...currentRelationships, value];
    }

    setEditingEvent({
      ...editingEvent,
      relationships: newRelationships.length > 0 ? newRelationships : null,
    });
  };

  /**
   * 参加者タイプのラベル
   */
  const getParticipantsLabel = (p?: string): string => {
    switch (p) {
      case 'solo': return '一人';
      case 'small': return '少人数';
      case 'large': return '大人数';
      default: return '-';
    }
  };

  /**
   * 関係性のラベル（配列対応）
   */
  const getRelationshipLabel = (r?: string | null): string => {
    if (!r) return '';
    switch (r) {
      case 'family': return '家族';
      case 'work': return '仕事';
      case 'friend': return '友人';
      case 'stranger': return '初対面';
      default: return r;
    }
  };

  /**
   * 関係性配列からラベル配列を取得
   */
  const getRelationshipsLabels = (relationships?: EventClassificationRelationship[] | null): string[] => {
    if (!relationships || relationships.length === 0) return [];
    return relationships.map(r => getRelationshipLabel(r));
  };

  /**
   * フォーマットのラベル
   */
  const getFormatLabel = (f?: string): string => {
    return f === 'online' ? 'オンライン' : '対面';
  };

  /**
   * 日別ストレスデータを計算
   */
  const dailyStressData = useMemo(() => {
    // 過去30日間の日付を生成（今日から30日前まで）
    const days: string[] = [];
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().split('T')[0]);
    }

    // 日付ごとにイベントをグループ化（ストレススコアの配列を保持）
    const byDate: Record<string, { events: { score: number; summary: string }[]; hasSession: boolean }> = {};
    days.forEach(date => {
      byDate[date] = { events: [], hasSession: false };
    });

    savedClassifications.forEach((event) => {
      const dateStr = event.eventStart.split('T')[0];
      if (byDate[dateStr] && event.stressScore) {
        byDate[dateStr].events.push({
          score: event.stressScore,
          summary: event.eventSummary,
        });
      }
    });

    sessions.forEach((session) => {
      const dateStr = session.timestamp.split('T')[0];
      if (byDate[dateStr]) {
        byDate[dateStr].hasSession = true;
      }
    });

    return days.map(date => ({
      date,
      events: byDate[date].events,
      totalStress: byDate[date].events.reduce((sum, e) => sum + e.score, 0),
      hasSession: byDate[date].hasSession,
    }));
  }, [savedClassifications, sessions]);

  /**
   * 相関データを計算
   */
  const correlationData = useMemo(() => {
    const sessionsByDate: Record<string, SessionLog[]> = {};
    sessions.forEach((session) => {
      const date = session.timestamp.split('T')[0];
      if (!sessionsByDate[date]) {
        sessionsByDate[date] = [];
      }
      sessionsByDate[date].push(session);
    });

    const data: Array<{
      date: string;
      eventCount: number;
      avgArousalBefore: number;
      avgArousalAfter: number | null;
      sessionCount: number;
    }> = [];

    Object.keys(sessionsByDate).forEach((date) => {
      const daySessions = sessionsByDate[date];
      const eventCount = eventCountByDate[date] || 0;

      const avgArousalBefore =
        daySessions.reduce((sum, s) => sum + s.beforeArousal, 0) / daySessions.length;

      const afterSessions = daySessions.filter(
        (s) => s.afterArousal !== null && s.afterArousal !== undefined
      );
      const avgArousalAfter =
        afterSessions.length > 0
          ? afterSessions.reduce((sum, s) => sum + (s.afterArousal ?? 0), 0) / afterSessions.length
          : null;

      data.push({
        date,
        eventCount,
        avgArousalBefore,
        avgArousalAfter,
        sessionCount: daySessions.length,
      });
    });

    return data.sort((a, b) => b.date.localeCompare(a.date));
  }, [sessions, eventCountByDate]);

  /**
   * 全イベント（分類済み + 未分類）を日付でグループ化
   * 未分類のイベントはデフォルト値で表示
   */
  const groupedByDate = useMemo(() => {
    const groups: Record<string, EventClassification[]> = {};

    // 重複を防ぐため、eventIdごとに最新のものだけを保持
    const latestByEventId = new Map<string, EventClassification>();

    // 各eventIdについて最新のレコード（updatedAtが最新）を選択
    savedClassifications.forEach((event) => {
      const existing = latestByEventId.get(event.eventId);
      if (!existing) {
        latestByEventId.set(event.eventId, event);
      } else {
        // updatedAtで比較して新しい方を保持
        const existingDate = new Date(existing.updatedAt || existing.createdAt || 0);
        const currentDate = new Date(event.updatedAt || event.createdAt || 0);
        if (currentDate > existingDate) {
          latestByEventId.set(event.eventId, event);
        }
      }
    });

    // 分類済みイベントのIDをセットに
    const classifiedEventIds = new Set(latestByEventId.keys());

    // 分類済みイベントを追加（重複なし、最新のみ）
    latestByEventId.forEach((event) => {
      const dateKey = getDateKey(event.eventStart);
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(event);
    });

    // 未分類のカレンダーイベントもデフォルト値で追加
    calendarEvents.forEach((event) => {
      if (!classifiedEventIds.has(event.id)) {
        const startStr = event.start.dateTime || event.start.date || '';
        const endStr = event.end.dateTime || event.end.date || '';
        const dateKey = getDateKey(startStr);
        if (!groups[dateKey]) {
          groups[dateKey] = [];
        }
        // 未分類イベントをデフォルト分類で追加
        groups[dateKey].push({
          id: `unclassified-${event.id}`,
          userId: '',
          eventId: event.id,
          eventSummary: event.summary,
          eventStart: startStr,
          eventEnd: endStr,
          participants: null,
          relationships: null,
          format: null,
          eventType: null,
          stressScore: null,
          isManuallyEdited: false,
          attendeeIds: null,
          source: 'manual',
          createdAt: '',
          updatedAt: '',
        } as unknown as EventClassification);
      }
    });

    // 各グループ内を時間順にソート
    Object.values(groups).forEach((events) => {
      events.sort((a, b) => new Date(a.eventStart).getTime() - new Date(b.eventStart).getTime());
    });

    // 日付を新しい順にソート
    return Object.entries(groups)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, events]) => ({ date, events }));
  }, [savedClassifications, calendarEvents]);

  /**
   * 未分類のイベント数
   */
  const unclassifiedCount = useMemo(() => {
    const classifiedEventIds = new Set(savedClassifications.map(c => c.eventId));
    return calendarEvents.filter(e => !classifiedEventIds.has(e.id)).length;
  }, [calendarEvents, savedClassifications]);

  /**
   * ストレスチェックタブ
   */
  const renderCheckTab = () => {
    return (
      <ScrollView style={styles.tabContent} contentContainerStyle={styles.tabContentContainer}>
        {/* ボタンエリア */}
        <View style={styles.buttonArea}>
          {/* AI分類ボタン（未分類がある場合のみ表示） */}
          {unclassifiedCount > 0 && (
            <TouchableOpacity
              style={styles.classifyButton}
              onPress={handleClassify}
              disabled={classifying}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={classifying ? ['#A0AEC0', '#A0AEC0'] : ['#9F7AEA', '#805AD5']}
                style={styles.classifyButtonGradient}
              >
                {classifying ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Ionicons name="sparkles" size={18} color="#FFF" />
                )}
                <Text style={styles.classifyButtonText}>
                  {classifying ? 'AI分類中...' : `${unclassifiedCount}件を分析`}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* 再分類ボタン（分類済みがある場合に表示） */}
          {savedClassifications.length > 0 && (
            <TouchableOpacity
              style={styles.reclassifyButton}
              onPress={handleReclassifyAll}
              disabled={classifying}
              activeOpacity={0.8}
            >
              <Ionicons name="refresh" size={16} color={classifying ? '#A0AEC0' : '#805AD5'} />
              <Text style={[styles.reclassifyButtonText, classifying && { color: '#A0AEC0' }]}>
                すべて再分類
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* 分類結果（日付グループ） */}
        {groupedByDate.length > 0 ? (
          groupedByDate.map(({ date, events }) => (
            <View key={date}>
              {/* 日付ヘッダー */}
              <View style={styles.dateHeader}>
                <Text style={styles.dateHeaderText}>{formatDateHeader(date)}</Text>
              </View>

              {/* イベントカード */}
              {events.map((event) => {
                const isUnclassified = event.stressScore === null;
                return (
                  <View
                    key={event.eventId}
                    style={[styles.eventCard, isUnclassified && styles.eventCardUnclassified]}
                  >
                    <View style={styles.eventHeader}>
                      <View style={styles.eventTitleRow}>
                        <Text style={styles.eventTime}>
                          {formatTimeRange(event.eventStart, event.eventEnd)}
                        </Text>
                        <View style={styles.eventBadges}>
                          {event.isManuallyEdited && (
                            <View style={styles.editedBadge}>
                              <Text style={styles.editedBadgeText}>編集済</Text>
                            </View>
                          )}
                          {isUnclassified ? (
                            <View style={styles.unclassifiedBadge}>
                              <Text style={styles.unclassifiedBadgeText}>未分類</Text>
                            </View>
                          ) : (
                            <View
                              style={[
                                styles.stressBadge,
                                { backgroundColor: getStressColor(event.stressScore || 3) },
                              ]}
                            >
                              <Text style={styles.stressBadgeText}>
                                {event.stressScore}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                      <Text style={styles.eventTitle} numberOfLines={1}>
                        {event.eventSummary}
                      </Text>
                    </View>
                    <View style={styles.eventTagsRow}>
                      <View style={styles.eventTags}>
                        {isUnclassified ? (
                          <Text style={styles.unclassifiedHint}>
                            AIで分析するとストレススコアが付きます
                          </Text>
                        ) : (
                          <>
                            <View style={styles.tag}>
                              <Text style={styles.tagText}>
                                {getParticipantsLabel(event.participants)}
                              </Text>
                            </View>
                            {/* 一人以外の場合のみ関係性を表示 */}
                            {event.participants !== 'solo' && (
                              event.relationships && event.relationships.length > 0 ? (
                                event.relationships.map((rel, idx) => (
                                  <View key={idx} style={styles.tag}>
                                    <Text style={styles.tagText}>
                                      {getRelationshipLabel(rel)}
                                    </Text>
                                  </View>
                                ))
                              ) : (
                                <View style={styles.warningTag}>
                                  <Ionicons name="alert-circle" size={12} color="#ED8936" />
                                  <Text style={styles.warningTagText}>関係性を設定</Text>
                                </View>
                              )
                            )}
                            {/* 一人以外の場合のみ形式を表示 */}
                            {event.participants !== 'solo' && (
                              <View style={styles.tag}>
                                <Text style={styles.tagText}>
                                  {getFormatLabel(event.format)}
                                </Text>
                              </View>
                            )}
                          </>
                        )}
                      </View>
                      {!isUnclassified && (
                        <View style={styles.eventActions}>
                          {/* AIレビューボタン */}
                          <TouchableOpacity
                            style={styles.aiReviewButton}
                            onPress={(e) => {
                              e.stopPropagation();
                              handleAIReviewStart(event);
                            }}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <View style={styles.rinawanIconContainer}>
                              <Image
                                source={require('@/assets/images/rinawan_tilting_head.gif')}
                                style={styles.rinawanIcon}
                              />
                              {chatSavedEventIds.has(event.eventId) && (
                                <View style={styles.chatSavedBadge}>
                                  <Ionicons name="checkmark" size={10} color="#FFF" />
                                </View>
                              )}
                            </View>
                          </TouchableOpacity>
                          {/* 3点メニューボタン */}
                          <TouchableOpacity
                            style={styles.menuButton}
                            onPress={(e) => {
                              e.stopPropagation();
                              handleMenuOpen(event);
                            }}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Ionicons name="ellipsis-vertical" size={18} color="#718096" />
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={48} color="#A0AEC0" style={{ marginBottom: 12 }} />
            <Text style={styles.emptyText}>
              {unclassifiedCount > 0
                ? `${unclassifiedCount}件の予定があります\n上のボタンで分析してください`
                : 'カレンダーに予定がありません'}
            </Text>
          </View>
        )}
      </ScrollView>
    );
  };

  /**
   * チャートタブ
   */
  const renderChartTab = () => {
    const maxTotalStress = Math.max(
      ...dailyStressData.map(d => d.totalStress),
      5 // 最低でも5を上限とする
    );
    // 拡大時: 10日分が1画面、縮小時: 30日全て1画面
    // 縮小時: コンテナパディング(32) + タブパディング(32) + Y軸(24) を引く
    const shrunkChartWidth = SCREEN_WIDTH - 32 - 32 - 24;
    const barWidth = isChartExpanded
      ? (SCREEN_WIDTH - 60) / 10
      : shrunkChartWidth / 30;
    const chartHeight = 140;
    const segmentHeight = isChartExpanded ? 16 : 8; // 縮小時はセグメント高さも小さく

    const renderBars = () => (
      <View style={isChartExpanded ? styles.expandedBarsContainer : styles.shrunkBarsContainer}>
        {dailyStressData.map((item) => (
          <TouchableOpacity
            key={item.date}
            style={[styles.barWrapper, { width: barWidth }]}
            onPress={() => item.events.length > 0 && setSelectedDayData(item)}
            activeOpacity={item.events.length > 0 ? 0.7 : 1}
          >
            <View style={[styles.barColumn, { height: chartHeight }]}>
              {item.events.length > 0 ? (
                <View style={styles.stackedBar}>
                  {item.events.map((event, idx) => {
                    const height = Math.max(
                      (event.score / maxTotalStress) * chartHeight,
                      segmentHeight
                    );
                    return (
                      <View
                        key={idx}
                        style={[
                          styles.barSegment,
                          {
                            height,
                            backgroundColor: getStressColor(event.score),
                          },
                        ]}
                      />
                    );
                  })}
                </View>
              ) : (
                <View style={styles.emptyBar} />
              )}
            </View>
            {item.hasSession && (
              <View style={styles.sessionMarker}>
                <Text style={styles.sessionMarkerText}>●</Text>
              </View>
            )}
            {isChartExpanded ? (
              <Text style={styles.barLabel}>{formatDate(item.date)}</Text>
            ) : (
              // 縮小時は5日おきにラベル表示
              parseInt(item.date.slice(8)) % 5 === 0 && (
                <Text style={styles.barLabelSmall}>{item.date.slice(8)}</Text>
              )
            )}
          </TouchableOpacity>
        ))}
      </View>
    );

    return (
      <ScrollView style={styles.tabContent} contentContainerStyle={styles.tabContentContainer}>
        <View style={styles.chartContainer}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>日別ストレスレベル（直近30日）</Text>
            <TouchableOpacity
              style={styles.chartToggleButton}
              onPress={() => setIsChartExpanded(!isChartExpanded)}
            >
              <Ionicons
                name={isChartExpanded ? 'contract-outline' : 'expand-outline'}
                size={20}
                color="#805AD5"
              />
            </TouchableOpacity>
          </View>

          <View style={styles.chartWrapper}>
            <View style={styles.yAxis}>
              {[maxTotalStress, Math.floor(maxTotalStress * 0.75), Math.floor(maxTotalStress * 0.5), Math.floor(maxTotalStress * 0.25), 0].map((n, i) => (
                <Text key={i} style={styles.yAxisLabel}>{n}</Text>
              ))}
            </View>

            {isChartExpanded ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={true}
                contentContainerStyle={styles.horizontalBarsContainer}
              >
                {renderBars()}
              </ScrollView>
            ) : (
              renderBars()
            )}
          </View>

          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: '#4CAF50' }]} />
              <Text style={styles.legendText}>低</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: '#FFC107' }]} />
              <Text style={styles.legendText}>中</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: '#F44336' }]} />
              <Text style={styles.legendText}>高</Text>
            </View>
            <View style={styles.legendItem}>
              <Text style={styles.sessionDot}>●</Text>
              <Text style={styles.legendText}>セッション実施日</Text>
            </View>
          </View>

          {isChartExpanded && <Text style={styles.chartHint}>← 左右にスワイプ →</Text>}
        </View>
      </ScrollView>
    );
  };

  /**
   * AI分析を実行
   */
  const handleAnalyze = async () => {
    if (savedClassifications.length === 0) {
      Alert.alert('エラー', '分析するデータがありません。先に「チェック」タブでAI分類を実行してください。');
      return;
    }

    setAnalyzing(true);
    try {
      // EventChatsとEventChangeLogsを取得
      const [eventChats, eventChangeLogs] = await Promise.all([
        listEventChats(),
        listEventChangeLogs(),
      ]);

      // イベントIDからサマリーを取得するマップを作成
      const eventSummaryMap = new Map<string, string>();
      savedClassifications.forEach(e => {
        eventSummaryMap.set(e.eventId, e.eventSummary);
      });

      // チャットデータを分析用に整形
      const chatsForAnalysis = eventChats.map(chat => ({
        eventId: chat.eventId,
        eventSummary: eventSummaryMap.get(chat.eventId),
        messages: (chat.messages || []).map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      }));

      // 変更ログを分析用に整形
      const changeLogsForAnalysis = eventChangeLogs.map(log => ({
        eventId: log.eventId,
        eventSummary: eventSummaryMap.get(log.eventId),
        timestamp: log.timestamp,
        changedBy: log.changedBy as 'ai' | 'user',
        oldStressScore: log.oldStressScore,
        newStressScore: log.newStressScore,
        oldParticipants: log.oldParticipants,
        newParticipants: log.newParticipants,
      }));

      const result = await analyzeStressPatterns({
        events: savedClassifications.map(e => ({
          date: e.eventStart,
          summary: e.eventSummary,
          stressScore: e.stressScore || 3,
          participants: e.participants,
          relationships: e.relationships || undefined,
          format: e.format,
        })),
        sessions: sessions.map(s => ({
          date: s.timestamp,
          beforeArousal: s.beforeArousal,
          afterArousal: s.afterArousal ?? undefined,
        })),
        totalDays: 30,
        chats: chatsForAnalysis,
        changeLogs: changeLogsForAnalysis,
      });
      setAnalysisResult(result);
    } catch (error) {
      console.error('Analysis error:', error);
      Alert.alert('エラー', 'AI分析中にエラーが発生しました');
    } finally {
      setAnalyzing(false);
    }
  };

  /**
   * AI分析タブ
   */
  const renderAiAnalysisTab = () => (
    <ScrollView style={styles.tabContent} contentContainerStyle={styles.tabContentContainer}>
      {/* 分析ボタン */}
      <TouchableOpacity
        style={styles.analyzeButton}
        onPress={handleAnalyze}
        disabled={analyzing || savedClassifications.length === 0}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={analyzing ? ['#A0AEC0', '#A0AEC0'] : ['#9F7AEA', '#805AD5']}
          style={styles.analyzeButtonGradient}
        >
          {analyzing ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Ionicons name="sparkles" size={18} color="#FFF" />
          )}
          <Text style={styles.analyzeButtonText}>
            {analyzing ? 'AI分析中...' : 'AIでストレス傾向を分析'}
          </Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* 分析結果 */}
      {analysisResult ? (
        <View style={styles.analysisResultContainer}>
          {/* サマリー */}
          <View style={styles.analysisCard}>
            <View style={styles.analysisCardHeader}>
              <Ionicons name="analytics-outline" size={20} color="#805AD5" />
              <Text style={styles.analysisCardTitle}>分析サマリー</Text>
            </View>
            <Text style={styles.analysisSummaryText}>{analysisResult.summary}</Text>
          </View>

          {/* インサイト */}
          {analysisResult.insights.length > 0 && (
            <View style={styles.analysisCard}>
              <View style={styles.analysisCardHeader}>
                <Ionicons name="bulb-outline" size={20} color="#ED8936" />
                <Text style={styles.analysisCardTitle}>気づき</Text>
              </View>
              {analysisResult.insights.map((insight, idx) => (
                <View key={idx} style={styles.analysisListItem}>
                  <Text style={styles.analysisListBullet}>•</Text>
                  <Text style={styles.analysisListText}>{insight}</Text>
                </View>
              ))}
            </View>
          )}

          {/* アドバイス */}
          {analysisResult.advice.length > 0 && (
            <View style={styles.analysisCard}>
              <View style={styles.analysisCardHeader}>
                <Ionicons name="heart-outline" size={20} color="#48BB78" />
                <Text style={styles.analysisCardTitle}>アドバイス</Text>
              </View>
              {analysisResult.advice.map((advice, idx) => (
                <View key={idx} style={styles.analysisListItem}>
                  <Text style={styles.analysisListBullet}>✓</Text>
                  <Text style={styles.analysisListText}>{advice}</Text>
                </View>
              ))}
            </View>
          )}

          {/* リスクの高い日 */}
          {analysisResult.riskDays.length > 0 && (
            <View style={styles.analysisCard}>
              <View style={styles.analysisCardHeader}>
                <Ionicons name="warning-outline" size={20} color="#E53E3E" />
                <Text style={styles.analysisCardTitle}>注意が必要な日</Text>
              </View>
              <View style={styles.analysisTagsRow}>
                {analysisResult.riskDays.map((day, idx) => (
                  <View key={idx} style={styles.analysisRiskTag}>
                    <Text style={styles.analysisRiskTagText}>{day}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ポジティブなパターン */}
          {analysisResult.positivePatterns.length > 0 && (
            <View style={styles.analysisCard}>
              <View style={styles.analysisCardHeader}>
                <Ionicons name="sunny-outline" size={20} color="#4299E1" />
                <Text style={styles.analysisCardTitle}>良いパターン</Text>
              </View>
              {analysisResult.positivePatterns.map((pattern, idx) => (
                <View key={idx} style={styles.analysisListItem}>
                  <Text style={styles.analysisListBullet}>★</Text>
                  <Text style={styles.analysisListText}>{pattern}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      ) : (
        <View style={styles.adviceContainer}>
          <Ionicons name="sparkles-outline" size={48} color="#9F7AEA" />
          <Text style={styles.adviceTitle}>AI分析</Text>
          <Text style={styles.adviceDescription}>
            ストレス傾向や人間関係のパターンを{'\n'}AIが分析してアドバイスを提供します
          </Text>
          <Text style={styles.analysisDataInfo}>
            {savedClassifications.length}件のデータがあります
          </Text>
        </View>
      )}
    </ScrollView>
  );

  /**
   * タブコンテンツをレンダリング
   */
  const renderTabContent = () => {
    switch (activeTab) {
      case 'check':
        return renderCheckTab();
      case 'chart':
        return renderChartTab();
      case 'aiAnalysis':
        return renderAiAnalysisTab();
      default:
        return null;
    }
  };

  /**
   * 編集モーダル
   */
  const renderEditModal = () => (
    <Modal
      visible={editModalVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setEditModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>分類を編集</Text>
            <TouchableOpacity onPress={() => setEditModalVisible(false)}>
              <Ionicons name="close" size={24} color="#4A5568" />
            </TouchableOpacity>
          </View>

          {editingEvent && (
            <ScrollView style={styles.modalBody}>
              <Text style={styles.modalLabel}>タイトル</Text>
              <TextInput
                style={styles.titleInput}
                value={editingEvent.eventSummary}
                onChangeText={(text) => setEditingEvent({ ...editingEvent, eventSummary: text })}
                placeholder="イベントタイトル"
              />
              <Text style={styles.modalEventTime}>
                {formatDateTime(editingEvent.eventStart)}
              </Text>

              {/* 参加者 */}
              <Text style={styles.modalLabel}>参加者</Text>
              <View style={styles.optionRow}>
                {PARTICIPANTS_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.optionButton,
                      editingEvent.participants === opt.value && styles.optionButtonActive,
                    ]}
                    onPress={() => setEditingEvent({ ...editingEvent, participants: opt.value })}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        editingEvent.participants === opt.value && styles.optionTextActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* 誰と一緒？ - 一人の場合は非表示 */}
              {editingEvent.participants !== 'solo' && (
                <>
                  <Text style={styles.modalLabel}>誰と一緒？</Text>
                  {people.length > 0 && (
                    <View style={styles.attendeeList}>
                      {people.map((person) => {
                        const isSelected = editingEvent.attendeeIds?.includes(person.id) ?? false;
                        return (
                          <TouchableOpacity
                            key={person.id}
                            style={[
                              styles.attendeeChip,
                              isSelected && styles.attendeeChipActive,
                            ]}
                            onPress={() => toggleAttendee(person.id)}
                          >
                            <Text
                              style={[
                                styles.attendeeChipText,
                                isSelected && styles.attendeeChipTextActive,
                              ]}
                            >
                              {person.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                  <View style={styles.addPersonRow}>
                    <TextInput
                      style={styles.addPersonInput}
                      value={newPersonName}
                      onChangeText={setNewPersonName}
                      placeholder="新しい人を追加"
                      placeholderTextColor="#A0AEC0"
                    />
                    <TouchableOpacity
                      style={[
                        styles.addPersonButton,
                        !newPersonName.trim() && styles.addPersonButtonDisabled,
                      ]}
                      onPress={handleAddPerson}
                      disabled={!newPersonName.trim()}
                    >
                      <Ionicons name="add" size={20} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {/* 関係性（複数選択）- 一人の場合は非表示 */}
              {editingEvent.participants !== 'solo' && (
                <>
                  <Text style={styles.modalLabel}>関係性（複数選択可）</Text>
                  <View style={styles.optionRow}>
                    {RELATIONSHIP_OPTIONS.map((opt) => {
                      const isSelected = editingEvent.relationships?.includes(opt.value) ?? false;
                      return (
                        <TouchableOpacity
                          key={opt.value}
                          style={[
                            styles.optionButton,
                            isSelected && styles.optionButtonActive,
                          ]}
                          onPress={() => toggleRelationship(opt.value)}
                        >
                          <View style={styles.checkboxRow}>
                            <Ionicons
                              name={isSelected ? 'checkbox' : 'square-outline'}
                              size={16}
                              color={isSelected ? '#FFFFFF' : '#4A5568'}
                            />
                            <Text
                              style={[
                                styles.optionText,
                                isSelected && styles.optionTextActive,
                              ]}
                            >
                              {opt.label}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}

              {/* 形式 - 一人の場合は非表示 */}
              {editingEvent.participants !== 'solo' && (
                <>
                  <Text style={styles.modalLabel}>形式</Text>
                  <View style={styles.optionRow}>
                    {FORMAT_OPTIONS.map((opt) => (
                      <TouchableOpacity
                        key={opt.value}
                        style={[
                          styles.optionButton,
                          editingEvent.format === opt.value && styles.optionButtonActive,
                        ]}
                        onPress={() => setEditingEvent({ ...editingEvent, format: opt.value })}
                      >
                        <Text
                          style={[
                            styles.optionText,
                            editingEvent.format === opt.value && styles.optionTextActive,
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {/* ストレススコア */}
              <Text style={styles.modalLabel}>ストレスレベル</Text>
              <View style={styles.stressRow}>
                {STRESS_OPTIONS.map((score) => (
                  <TouchableOpacity
                    key={score}
                    style={[
                      styles.stressButton,
                      { backgroundColor: getStressColor(score) },
                      editingEvent.stressScore === score && styles.stressButtonActive,
                    ]}
                    onPress={() => setEditingEvent({ ...editingEvent, stressScore: score })}
                  >
                    <Text style={styles.stressButtonText}>{score}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.stressLabels}>
                <Text style={styles.stressLabelText}>リラックス</Text>
                <Text style={styles.stressLabelText}>高ストレス</Text>
              </View>
            </ScrollView>
          )}

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setEditModalVisible(false)}
            >
              <Text style={styles.cancelButtonText}>キャンセル</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleEditSave}
            >
              <Text style={styles.saveButtonText}>保存</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  /**
   * 3点メニューモーダル
   */
  const renderMenuModal = () => (
    <Modal
      visible={menuModalVisible}
      animationType="fade"
      transparent={true}
      onRequestClose={() => setMenuModalVisible(false)}
    >
      <TouchableOpacity
        style={styles.menuModalOverlay}
        activeOpacity={1}
        onPress={() => setMenuModalVisible(false)}
      >
        <View style={styles.menuModalContent}>
          {/* 変更ボタン */}
          <TouchableOpacity
            style={styles.menuModalItem}
            onPress={() => menuEvent && handleEditStart(menuEvent)}
          >
            <Ionicons name="create-outline" size={20} color="#4A5568" />
            <Text style={styles.menuModalItemText}>変更</Text>
          </TouchableOpacity>

          <View style={styles.menuModalDivider} />

          {/* 削除ボタン */}
          <TouchableOpacity
            style={styles.menuModalItem}
            onPress={() => menuEvent && handleDeleteStart(menuEvent)}
          >
            <Ionicons name="trash-outline" size={20} color="#E53E3E" />
            <Text style={styles.menuModalItemTextDanger}>この活動を除外</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  /**
   * チャート詳細モーダル
   */
  const renderChartDetailModal = () => (
    <Modal
      visible={selectedDayData !== null}
      animationType="fade"
      transparent={true}
      onRequestClose={() => setSelectedDayData(null)}
    >
      <View style={styles.chartDetailOverlay}>
        <View style={styles.chartDetailContent}>
          <View style={styles.chartDetailHeader}>
            <Text style={styles.chartDetailTitle}>
              {selectedDayData ? formatDateHeader(selectedDayData.date) : ''}
            </Text>
            <TouchableOpacity onPress={() => setSelectedDayData(null)}>
              <Ionicons name="close" size={24} color="#4A5568" />
            </TouchableOpacity>
          </View>

          {selectedDayData && (
            <ScrollView style={styles.chartDetailBody}>
              {selectedDayData.events.map((event, idx) => (
                <View key={idx} style={styles.chartDetailItem}>
                  <View
                    style={[
                      styles.chartDetailStressBadge,
                      { backgroundColor: getStressColor(event.score) },
                    ]}
                  >
                    <Text style={styles.chartDetailStressText}>{event.score}</Text>
                  </View>
                  <Text style={styles.chartDetailEventText} numberOfLines={2}>
                    {event.summary}
                  </Text>
                </View>
              ))}

              <View style={styles.chartDetailSummary}>
                <Text style={styles.chartDetailSummaryLabel}>合計ストレス</Text>
                <Text style={styles.chartDetailSummaryValue}>
                  {selectedDayData.totalStress}
                </Text>
              </View>

              {selectedDayData.hasSession && (
                <View style={styles.chartDetailSession}>
                  <Ionicons name="checkmark-circle" size={16} color="#805AD5" />
                  <Text style={styles.chartDetailSessionText}>
                    この日は瞑想セッションを実施しました
                  </Text>
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );

  /**
   * 削除確認モーダル
   */
  const renderDeleteModal = () => (
    <Modal
      visible={deleteModalVisible}
      animationType="fade"
      transparent={true}
      onRequestClose={() => setDeleteModalVisible(false)}
    >
      <View style={styles.deleteModalOverlay}>
        <View style={styles.deleteModalContent}>
          <Ionicons name="trash-outline" size={40} color="#E53E3E" style={{ marginBottom: 12 }} />
          <Text style={styles.deleteModalTitle}>削除しますか？</Text>
          {deletingEvent && (
            <Text style={styles.deleteModalText} numberOfLines={2}>
              {deletingEvent.eventSummary}
            </Text>
          )}
          <View style={styles.deleteModalButtons}>
            <TouchableOpacity
              style={styles.deleteModalCancelButton}
              onPress={() => {
                setDeleteModalVisible(false);
                setDeletingEvent(null);
              }}
            >
              <Text style={styles.deleteModalCancelText}>キャンセル</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.deleteModalConfirmButton}
              onPress={handleDeleteConfirm}
            >
              <Text style={styles.deleteModalConfirmText}>削除</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  /**
   * カレンダー選択モーダル
   */
  const renderCalendarModal = () => (
    <Modal
      visible={calendarModalVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setCalendarModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.calendarModalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>カレンダーを選択</Text>
            <TouchableOpacity onPress={() => setCalendarModalVisible(false)}>
              <Ionicons name="close" size={24} color="#4A5568" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.calendarListContainer}>
            {calendars.map((calendar) => {
              const isSelected = selectedCalendarIds.includes(calendar.id);
              return (
                <TouchableOpacity
                  key={calendar.id}
                  style={styles.calendarItem}
                  onPress={() => toggleCalendar(calendar.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.calendarItemLeft}>
                    <View
                      style={[
                        styles.calendarColorDot,
                        { backgroundColor: calendar.backgroundColor || '#4285F4' },
                      ]}
                    />
                    <View style={styles.calendarItemInfo}>
                      <Text style={styles.calendarItemName} numberOfLines={1}>
                        {calendar.summary}
                      </Text>
                      {calendar.primary && (
                        <Text style={styles.calendarItemPrimary}>メイン</Text>
                      )}
                    </View>
                  </View>
                  <Ionicons
                    name={isSelected ? 'checkbox' : 'square-outline'}
                    size={24}
                    color={isSelected ? '#805AD5' : '#A0AEC0'}
                  />
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.calendarModalFooter}>
            <Text style={styles.calendarModalHint}>
              {selectedCalendarIds.length}個のカレンダーを選択中
            </Text>
            <TouchableOpacity
              style={styles.calendarSaveButton}
              onPress={saveCalendarSelection}
            >
              <Text style={styles.calendarSaveButtonText}>適用</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <LinearGradient colors={['#7AD7F0', '#CDECF6']} style={styles.gradient}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* ヘッダー */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>分析</Text>
            {isConnected && calendars.length > 1 && (
              <TouchableOpacity
                style={styles.calendarSelectButton}
                onPress={() => setCalendarModalVisible(true)}
              >
                <Ionicons name="calendar" size={16} color="#805AD5" />
                <Text style={styles.calendarSelectText}>
                  {selectedCalendarIds.length}個
                </Text>
              </TouchableOpacity>
            )}
          </View>
          {isConnected && (
            <Text style={styles.summaryText}>
              {calendarEvents.length}予定 / {savedClassifications.length}分類済
            </Text>
          )}
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FF85A2" />
            <Text style={styles.loadingText}>データを取得中...</Text>
          </View>
        ) : !isConnected ? (
          <View style={styles.connectContainer}>
            <View style={styles.connectCard}>
              <Ionicons name="calendar-outline" size={48} color="#4299E1" />
              <Text style={styles.connectTitle}>Googleカレンダー連携</Text>
              <Text style={styles.connectDescription}>
                カレンダーの予定からストレスを{'\n'}AI分析できます
              </Text>
              <TouchableOpacity
                style={styles.connectButton}
                onPress={handleConnect}
                disabled={!request}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#4285F4', '#5A9CF4']}
                  style={styles.connectButtonGradient}
                >
                  <Ionicons name="logo-google" size={20} color="#FFF" />
                  <Text style={styles.connectButtonText}>Googleでログイン</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.mainContent}>
            {/* タブナビゲーション */}
            <View style={styles.tabBar}>
              {TABS.map((tab) => (
                <TouchableOpacity
                  key={tab.key}
                  style={[
                    styles.tabItem,
                    activeTab === tab.key && styles.tabItemActive,
                  ]}
                  onPress={() => setActiveTab(tab.key)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={tab.icon as any}
                    size={18}
                    color={activeTab === tab.key ? '#805AD5' : '#A0AEC0'}
                  />
                  <Text
                    style={[
                      styles.tabLabel,
                      activeTab === tab.key && styles.tabLabelActive,
                    ]}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {renderTabContent()}
          </View>
        )}

        {renderEditModal()}
        {renderDeleteModal()}
        {renderChartDetailModal()}
        {renderCalendarModal()}
        {renderMenuModal()}
      </SafeAreaView>
    </LinearGradient>
  );
}

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
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#4A5568',
  },
  summaryText: {
    fontSize: 12,
    color: '#718096',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#718096',
  },
  connectContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  connectCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  connectTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#4A5568',
    marginTop: 16,
    marginBottom: 8,
  },
  connectDescription: {
    fontSize: 14,
    color: '#718096',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  connectButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  connectButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    gap: 10,
  },
  connectButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  mainContent: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 4,
    marginBottom: 12,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 4,
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
    fontSize: 12,
    color: '#A0AEC0',
    fontWeight: '500',
  },
  tabLabelActive: {
    color: '#805AD5',
    fontWeight: '600',
  },
  tabContent: {
    flex: 1,
  },
  tabContentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  classifyButton: {
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  classifyButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 8,
  },
  classifyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  buttonArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  reclassifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 6,
  },
  reclassifyButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#805AD5',
  },
  dateHeader: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginTop: 8,
  },
  dateHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4A5568',
  },
  eventCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  eventCardUnclassified: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  eventHeader: {
    marginBottom: 8,
  },
  eventTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  eventBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  editedBadge: {
    backgroundColor: '#EDF2F7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  editedBadgeText: {
    fontSize: 10,
    color: '#718096',
  },
  unclassifiedBadge: {
    backgroundColor: '#EDF2F7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  unclassifiedBadgeText: {
    fontSize: 11,
    color: '#A0AEC0',
    fontWeight: '500',
  },
  unclassifiedHint: {
    fontSize: 11,
    color: '#A0AEC0',
    fontStyle: 'italic',
  },
  eventTime: {
    fontSize: 11,
    color: '#718096',
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4A5568',
  },
  stressBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
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
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  eventTags: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  deleteButton: {
    padding: 4,
    marginLeft: 8,
  },
  eventActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  aiReviewButton: {
    padding: 2,
  },
  rinawanIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#7AD7F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rinawanIcon: {
    width: 32,
    height: 32,
  },
  chatSavedBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#B794F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuButton: {
    padding: 4,
  },
  // 3点メニューモーダル
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
  tag: {
    backgroundColor: '#EDF2F7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 11,
    color: '#4A5568',
  },
  warningTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFAF0',
    borderWidth: 1,
    borderColor: '#ED8936',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  warningTagText: {
    fontSize: 11,
    color: '#ED8936',
    fontWeight: '500',
  },
  editHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 8,
    gap: 4,
  },
  editHintText: {
    fontSize: 10,
    color: '#A0AEC0',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 14,
    color: '#A0AEC0',
    textAlign: 'center',
    lineHeight: 22,
  },
  // チャートスタイル
  chartContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    padding: 16,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4A5568',
  },
  chartToggleButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F3E8FF',
  },
  chartWrapper: {
    flexDirection: 'row',
    height: 180,
  },
  yAxis: {
    width: 20,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingRight: 4,
    paddingBottom: 20,
  },
  yAxisLabel: {
    fontSize: 10,
    color: '#A0AEC0',
  },
  barsContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingBottom: 20,
  },
  horizontalBarsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingBottom: 20,
    paddingRight: 16,
  },
  expandedBarsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  shrunkBarsContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingBottom: 20,
  },
  stackedBar: {
    width: '100%',
    justifyContent: 'flex-end',
    gap: 1,
  },
  barSegment: {
    width: '100%',
    borderRadius: 3,
    marginBottom: 1,
  },
  emptyBar: {
    width: '100%',
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
  },
  barWrapper: {
    alignItems: 'center',
  },
  barColumn: {
    width: '60%',
    height: 140,
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderRadius: 4,
    minHeight: 4,
  },
  sessionMarker: {
    position: 'absolute',
    bottom: 22,
  },
  sessionMarkerText: {
    fontSize: 8,
    color: '#805AD5',
  },
  barLabel: {
    fontSize: 9,
    color: '#A0AEC0',
    marginTop: 4,
  },
  barLabelSmall: {
    fontSize: 7,
    color: '#A0AEC0',
    marginTop: 2,
    position: 'absolute',
    bottom: -14,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#EDF2F7',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 11,
    color: '#718096',
  },
  sessionDot: {
    fontSize: 10,
    color: '#805AD5',
  },
  chartHint: {
    fontSize: 11,
    color: '#A0AEC0',
    textAlign: 'center',
    marginTop: 12,
  },
  // 相関スタイル
  correlationCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  correlationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  correlationDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4A5568',
  },
  busyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  busyBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  correlationContent: {
    gap: 4,
  },
  correlationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  correlationLabel: {
    fontSize: 12,
    color: '#718096',
  },
  correlationValue: {
    fontSize: 12,
    fontWeight: '500',
    color: '#4A5568',
  },
  // アドバイススタイル
  adviceContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
  },
  adviceTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4A5568',
    marginTop: 16,
    marginBottom: 8,
  },
  adviceDescription: {
    fontSize: 14,
    color: '#718096',
    textAlign: 'center',
    lineHeight: 22,
  },
  comingSoon: {
    marginTop: 16,
    fontSize: 12,
    color: '#A0AEC0',
    fontStyle: 'italic',
  },
  // AI分析スタイル
  analyzeButton: {
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  analyzeButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 8,
  },
  analyzeButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  analysisDataInfo: {
    marginTop: 16,
    fontSize: 13,
    color: '#805AD5',
    fontWeight: '500',
  },
  analysisResultContainer: {
    gap: 12,
  },
  analysisCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 16,
  },
  analysisCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  analysisCardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4A5568',
  },
  analysisSummaryText: {
    fontSize: 14,
    color: '#4A5568',
    lineHeight: 22,
  },
  analysisListItem: {
    flexDirection: 'row',
    paddingVertical: 6,
    gap: 8,
  },
  analysisListBullet: {
    fontSize: 14,
    color: '#805AD5',
    width: 16,
  },
  analysisListText: {
    flex: 1,
    fontSize: 14,
    color: '#4A5568',
    lineHeight: 20,
  },
  analysisTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  analysisRiskTag: {
    backgroundColor: '#FED7D7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  analysisRiskTagText: {
    fontSize: 13,
    color: '#C53030',
    fontWeight: '500',
  },
  // モーダルスタイル
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF2F7',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4A5568',
  },
  modalBody: {
    padding: 16,
  },
  modalEventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4A5568',
    marginBottom: 4,
  },
  titleInput: {
    fontSize: 15,
    color: '#4A5568',
    backgroundColor: '#F7FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 4,
  },
  modalEventTime: {
    fontSize: 13,
    color: '#718096',
    marginBottom: 20,
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4A5568',
    marginBottom: 8,
    marginTop: 16,
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
  // 参加者選択
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
  modalFooter: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#EDF2F7',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#EDF2F7',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4A5568',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#805AD5',
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // 削除モーダル
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
  // チャート詳細モーダル
  chartDetailOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  chartDetailContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxWidth: 340,
    maxHeight: '70%',
  },
  chartDetailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF2F7',
  },
  chartDetailTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4A5568',
  },
  chartDetailBody: {
    padding: 16,
  },
  chartDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF2F7',
    gap: 12,
  },
  chartDetailStressBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartDetailStressText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  chartDetailEventText: {
    flex: 1,
    fontSize: 14,
    color: '#4A5568',
  },
  chartDetailSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#EDF2F7',
  },
  chartDetailSummaryLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#718096',
  },
  chartDetailSummaryValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4A5568',
  },
  chartDetailSession: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F3E8FF',
    borderRadius: 8,
  },
  chartDetailSessionText: {
    fontSize: 13,
    color: '#805AD5',
  },
  // ヘッダー用スタイル
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  calendarSelectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  calendarSelectText: {
    fontSize: 12,
    color: '#805AD5',
    fontWeight: '500',
  },
  // カレンダー選択モーダル
  calendarModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  calendarListContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 400,
  },
  calendarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF2F7',
  },
  calendarItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  calendarColorDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  calendarItemInfo: {
    flex: 1,
  },
  calendarItemName: {
    fontSize: 15,
    color: '#4A5568',
    fontWeight: '500',
  },
  calendarItemPrimary: {
    fontSize: 11,
    color: '#805AD5',
    marginTop: 2,
  },
  calendarModalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#EDF2F7',
  },
  calendarModalHint: {
    fontSize: 13,
    color: '#718096',
  },
  calendarSaveButton: {
    backgroundColor: '#805AD5',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  calendarSaveButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
