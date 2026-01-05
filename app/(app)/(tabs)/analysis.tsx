import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import {
  useGoogleAuth,
  exchangeCodeForToken,
  fetchCalendarEvents,
  countEventsByDate,
  CalendarEvent,
} from '@/lib/googleCalendar';
import { listSessionLogs, SessionLog } from '@/lib/api';

/**
 * 日付をフォーマット（MM/DD）
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}/${date.getDate()}`;
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
 *
 * Googleカレンダー連携 + セッションデータの相関分析
 */
export default function AnalysisScreen() {
  const { request, response, promptAsync, redirectUri } = useGoogleAuth();

  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [sessions, setSessions] = useState<SessionLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  // 日別のイベント数
  const [eventCountByDate, setEventCountByDate] = useState<Record<string, number>>({});

  /**
   * OAuth レスポンス処理
   */
  useEffect(() => {
    if (response?.type === 'success' && response.params.code && request?.codeVerifier) {
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
        setIsConnected(true);
        await fetchData(token);
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
  const fetchData = async (token: string) => {
    setLoading(true);
    try {
      // 過去30日のデータを取得
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // カレンダーイベント取得
      const events = await fetchCalendarEvents(token, thirtyDaysAgo, now);
      setCalendarEvents(events);
      setEventCountByDate(countEventsByDate(events));

      // セッションログ取得
      const sessionLogs = await listSessionLogs();
      setSessions(sessionLogs);
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
   * 相関データを計算
   */
  const getCorrelationData = () => {
    // セッションを日付でグループ化
    const sessionsByDate: Record<string, SessionLog[]> = {};
    sessions.forEach((session) => {
      const date = session.timestamp.split('T')[0];
      if (!sessionsByDate[date]) {
        sessionsByDate[date] = [];
      }
      sessionsByDate[date].push(session);
    });

    // 日別の相関データを作成
    const correlationData: Array<{
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

      correlationData.push({
        date,
        eventCount,
        avgArousalBefore,
        avgArousalAfter,
        sessionCount: daySessions.length,
      });
    });

    // 日付で降順ソート
    return correlationData.sort((a, b) => b.date.localeCompare(a.date));
  };

  const correlationData = getCorrelationData();

  return (
    <LinearGradient colors={['#7AD7F0', '#CDECF6']} style={styles.gradient}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* ヘッダー */}
        <View style={styles.header}>
          <Text style={styles.title}>分析</Text>
          <Text style={styles.subtitle}>忙しさと感情の相関</Text>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FF85A2" />
            <Text style={styles.loadingText}>データを取得中...</Text>
          </View>
        ) : !isConnected ? (
          /* 未連携時 */
          <View style={styles.connectContainer}>
            <View style={styles.connectCard}>
              <Ionicons name="calendar-outline" size={48} color="#4299E1" />
              <Text style={styles.connectTitle}>Googleカレンダー連携</Text>
              <Text style={styles.connectDescription}>
                カレンダーの予定と感情の{'\n'}相関を分析できます
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
              <Text style={styles.connectNote}>
                ※ カレンダーの読み取りのみ許可されます
              </Text>
            </View>
          </View>
        ) : (
          /* 連携済み */
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
          >
            {/* サマリー */}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>過去30日間</Text>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{calendarEvents.length}</Text>
                  <Text style={styles.summaryLabel}>予定</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{sessions.length}</Text>
                  <Text style={styles.summaryLabel}>セッション</Text>
                </View>
              </View>
            </View>

            {/* 日別データ */}
            <Text style={styles.sectionTitle}>日別の傾向</Text>
            {correlationData.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>
                  セッションデータがありません
                </Text>
              </View>
            ) : (
              correlationData.map((item) => {
                const busyLevel = getBusyLevel(item.eventCount);
                return (
                  <View key={item.date} style={styles.dayCard}>
                    <View style={styles.dayHeader}>
                      <Text style={styles.dayDate}>{formatDate(item.date)}</Text>
                      <View
                        style={[
                          styles.busyBadge,
                          { backgroundColor: busyLevel.color },
                        ]}
                      >
                        <Text style={styles.busyBadgeText}>{busyLevel.label}</Text>
                      </View>
                    </View>
                    <View style={styles.dayContent}>
                      <View style={styles.dayRow}>
                        <Text style={styles.dayLabel}>予定数:</Text>
                        <Text style={styles.dayValue}>{item.eventCount}件</Text>
                      </View>
                      <View style={styles.dayRow}>
                        <Text style={styles.dayLabel}>セッション前の活性度:</Text>
                        <Text style={styles.dayValue}>
                          {item.avgArousalBefore > 0 ? '高め' : '低め'}
                        </Text>
                      </View>
                      {item.avgArousalAfter !== null && (
                        <View style={styles.dayRow}>
                          <Text style={styles.dayLabel}>セッション後の活性度:</Text>
                          <Text style={styles.dayValue}>
                            {item.avgArousalAfter > 0 ? '高め' : '低め'}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        )}
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
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#4A5568',
  },
  subtitle: {
    fontSize: 14,
    color: '#718096',
    marginTop: 4,
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
    shadowColor: '#4285F4',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
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
  connectNote: {
    fontSize: 12,
    color: '#A0AEC0',
    marginTop: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  summaryCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 14,
    color: '#718096',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#4A5568',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#A0AEC0',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4A5568',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  emptyCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#A0AEC0',
  },
  dayCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dayDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4A5568',
  },
  busyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  busyBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  dayContent: {
    gap: 8,
  },
  dayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayLabel: {
    fontSize: 13,
    color: '#718096',
  },
  dayValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4A5568',
  },
});
