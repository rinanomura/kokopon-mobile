import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { listSessionLogs, SessionLog } from '@/lib/api';

/**
 * 活性度を日本語ラベルに変換
 * arousal: -1（不活性）〜 1（活性）
 */
function getArousalLabel(arousal: number): string {
  if (arousal > 0.5) return '高め';
  if (arousal > 0) return 'やや高め';
  if (arousal > -0.5) return 'やや低め';
  return '低め';
}

/**
 * 快・不快を日本語ラベルに変換
 * valence: -1（不快）〜 1（快）
 */
function getValenceLabel(valence: number): string {
  if (valence > 0.5) return '快';
  if (valence > 0) return 'やや快';
  if (valence > -0.5) return 'やや不快';
  return '不快';
}

/**
 * 日時をフォーマット
 */
function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${month}/${day} ${hours}:${minutes}`;
}

/**
 * TrackingScreen - トラッキング画面
 *
 * 過去のセッション履歴を表示
 */
export default function TrackingScreen() {
  const [sessions, setSessions] = useState<SessionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  /**
   * 最近1週間（今日を含む過去7日間）のセッション数を集計
   */
  const weeklyCount = useMemo(() => {
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 6); // 今日を含む7日間
    sevenDaysAgo.setHours(0, 0, 0, 0);

    return sessions.filter(session => {
      const sessionDate = new Date(session.timestamp);
      return sessionDate >= sevenDaysAgo;
    }).length;
  }, [sessions]);

  /**
   * セッション履歴を取得
   */
  const fetchSessions = useCallback(async () => {
    try {
      const items = await listSessionLogs();
      // 新しい順にソート
      const sorted = items.sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      setSessions(sorted);
    } catch (error) {
      console.error('セッション取得エラー:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  /**
   * プルダウンで更新
   */
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchSessions();
  }, [fetchSessions]);

  return (
    <LinearGradient colors={['#7AD7F0', '#CDECF6']} style={styles.gradient}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* ヘッダー */}
        <View style={styles.header}>
          <Text style={styles.title}>セッション履歴</Text>
          {sessions.length > 0 && (
            <Text style={styles.subtitle}>全{sessions.length}件の記録</Text>
          )}
        </View>

        {/* ローディング */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FF85A2" />
          </View>
        ) : sessions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>まだ記録がありません</Text>
            <Text style={styles.emptyHint}>
              セッションを始めると{'\n'}ここに履歴が表示されます
            </Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#FF85A2"
              />
            }
          >
            {/* 最近1週間の利用状況 */}
            {weeklyCount > 0 && (
              <View style={styles.weeklySummaryBox}>
                <Text style={styles.weeklySummaryIcon}>🐾</Text>
                <Text style={styles.weeklySummaryText}>
                  最近1週間で{weeklyCount}回、ここに戻ってきました
                </Text>
              </View>
            )}

            {sessions.map((session) => (
              <View key={session.id} style={styles.sessionCard}>
                {/* 日時 */}
                <Text style={styles.sessionDate}>
                  {formatDateTime(session.timestamp)}
                </Text>

                {/* Before / After */}
                <View style={styles.emotionRow}>
                  {/* Before */}
                  <View style={styles.emotionBlock}>
                    <Text style={styles.emotionLabel}>はじめ</Text>
                    <View style={styles.emotionValues}>
                      <Text style={styles.emotionValue}>
                        {getValenceLabel(session.beforeValence)}
                      </Text>
                      <Text style={styles.emotionDivider}>・</Text>
                      <Text style={styles.emotionValue}>
                        活性{getArousalLabel(session.beforeArousal)}
                      </Text>
                    </View>
                  </View>

                  {/* 矢印 */}
                  <Text style={styles.arrow}>→</Text>

                  {/* After */}
                  <View style={styles.emotionBlock}>
                    <Text style={styles.emotionLabel}>あと</Text>
                    {session.afterValence !== null && session.afterValence !== undefined ? (
                      <View style={styles.emotionValues}>
                        <Text style={styles.emotionValue}>
                          {getValenceLabel(session.afterValence)}
                        </Text>
                        <Text style={styles.emotionDivider}>・</Text>
                        <Text style={styles.emotionValue}>
                          活性{getArousalLabel(session.afterArousal ?? 0)}
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.emotionValueMissing}>未記録</Text>
                    )}
                  </View>
                </View>

                {/* 瞑想タイプ・時間 */}
                <View style={styles.sessionMeta}>
                  <Text style={styles.sessionMetaText}>
                    {session.meditationType === 'breathing' ? '呼吸' : session.meditationType}
                    {session.duration ? ` ${session.duration}秒` : ''}
                  </Text>
                </View>
              </View>
            ))}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#4A5568',
    flex: 1,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#718096',
    position: 'absolute',
    right: 24,
  },
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
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4A5568',
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 14,
    color: '#718096',
    textAlign: 'center',
    lineHeight: 22,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  weeklySummaryBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 182, 193, 0.4)',
    shadowColor: '#FFB6C1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
  weeklySummaryIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  weeklySummaryText: {
    fontSize: 13,
    color: '#5A6B7C',
    fontWeight: '500',
    lineHeight: 20,
  },
  sessionCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  sessionDate: {
    fontSize: 13,
    color: '#718096',
    marginBottom: 12,
  },
  emotionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  emotionBlock: {
    flex: 1,
  },
  emotionLabel: {
    fontSize: 11,
    color: '#A0AEC0',
    marginBottom: 4,
  },
  emotionValues: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emotionValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4A5568',
  },
  emotionDivider: {
    fontSize: 14,
    color: '#CBD5E0',
    marginHorizontal: 4,
  },
  emotionValueMissing: {
    fontSize: 14,
    color: '#A0AEC0',
  },
  arrow: {
    fontSize: 16,
    color: '#CBD5E0',
    marginHorizontal: 12,
  },
  sessionMeta: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#EDF2F7',
  },
  sessionMetaText: {
    fontSize: 12,
    color: '#A0AEC0',
  },
});
