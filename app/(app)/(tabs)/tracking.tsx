import React, { useEffect, useState, useCallback } from 'react';
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
          <Text style={styles.subtitle}>
            {sessions.length > 0 ? `${sessions.length}件の記録` : ''}
          </Text>
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
