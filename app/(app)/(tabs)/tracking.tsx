import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { listSessionLogs, SessionLog } from '@/lib/api';
import { emotionToChipColor, getMissingChipColor } from '@/lib/emotionColor';
import { getTrainingContent, isValidMenuId } from '@/constants/trainingContents';
import { usePreferences } from '@/hooks/usePreferences';

/**
 * 活性度を日本語ラベルに変換（Before用）
 * arousal: -1（不活性）〜 1（活性）
 */
function getArousalLabel(arousal: number): string {
  if (arousal > 0.5) return '高め';
  if (arousal > 0) return 'やや高め';
  if (arousal > -0.5) return 'やや低め';
  return '低め';
}

/**
 * 快・不快を日本語ラベルに変換（Before用）
 * valence: -1（不快）〜 1（快）
 */
function getValenceLabel(valence: number): string {
  if (valence > 0.5) return '快';
  if (valence > 0) return 'やや快';
  if (valence > -0.5) return 'やや不快';
  return '不快';
}

/**
 * からだスライダー値をラベルに変換（After用）
 * afterValence: -1（こわばっている）〜 +1（ゆるんでいる）
 */
function getBodyLabel(value: number): string {
  if (value > 0.5) return 'ゆるんでいる';
  if (value > 0) return 'ややゆるんでいる';
  if (value > -0.5) return 'ややこわばっている';
  return 'こわばっている';
}

/**
 * こころスライダー値をラベルに変換（After用）
 * afterArousal: -1（ざわざわ）〜 +1（しずか）
 */
function getMindLabel(value: number): string {
  if (value > 0.5) return 'しずか';
  if (value > 0) return 'ややしずか';
  if (value > -0.5) return 'ややざわざわ';
  return 'ざわざわ';
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
 * meditationType からトレーニング名を取得
 * trainingMode に応じた表示名を返す
 */
function getMenuName(meditationType: string, trainingMode: 'intuitive' | 'verbal'): string {
  if (isValidMenuId(meditationType)) {
    const content = getTrainingContent(meditationType);
    return content.title[trainingMode];
  }
  return meditationType || '';
}

/**
 * TrackingScreen - トラッキング画面
 *
 * 過去のセッション履歴を表示
 */
export default function TrackingScreen() {
  const { trainingMode } = usePreferences();
  const [sessions, setSessions] = useState<SessionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  /**
   * 継続を促すメッセージを生成（りなわん口調）
   * フレンドリーかつ礼儀正しいタメ口
   */
  const encouragementMessage = useMemo(() => {
    const total = sessions.length;
    if (total === 0) return null;

    // 最近1週間のセッション数
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const weeklyCount = sessions.filter(session => {
      const sessionDate = new Date(session.timestamp);
      return sessionDate >= sevenDaysAgo;
    }).length;

    // りなわん口調のメッセージ
    if (total === 1) {
      return '最初の一歩だね！\nまた会えるの楽しみにしてるよ';
    }
    if (total <= 3) {
      return `${total}回も来てくれたんだね！\nうれしいな`;
    }
    if (weeklyCount >= 3) {
      return `今週${weeklyCount}回も会えたね！\nいつもありがとう`;
    }
    if (weeklyCount >= 1) {
      return 'また会えてうれしいな！\nいつでも待ってるからね';
    }
    // 今週0回だが過去にはある
    return 'ひさしぶり！\nまた気が向いたら遊びに来てね';
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
            {/* りなわんと継続メッセージ */}
            {encouragementMessage && (
              <View style={styles.mascotSection}>
                <Image
                  source={require('@/assets/images/rinawan_talking.gif')}
                  style={styles.mascotImage}
                  resizeMode="contain"
                />
                <View style={styles.speechBubbleContainer}>
                  <View style={styles.speechBubbleTail} />
                  <LinearGradient
                    colors={['#FFF5F7', '#FFFFFF', '#FFF0F5']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.speechBubble}
                  >
                    {/* キラキラ装飾 */}
                    <Text style={[styles.sparkle, styles.sparkleTopRight]}>✧</Text>
                    <Text style={[styles.sparkle, styles.sparkleTopLeft]}>✦</Text>
                    <Text style={[styles.sparkle, styles.sparkleBottomRight]}>⋆</Text>
                    <Text style={styles.speechBubbleText}>
                      {encouragementMessage}
                    </Text>
                  </LinearGradient>
                </View>
              </View>
            )}

            {sessions.map((session) => (
              <View key={session.id} style={styles.sessionCard}>
                {/* 補助情報：日時（右上） */}
                <Text style={styles.sessionDate}>
                  実施日時: {formatDateTime(session.timestamp)}
                </Text>

                {/* 主情報：Before → After */}
                <View style={styles.emotionRow}>
                  {/* Before */}
                  <View style={styles.emotionBlock}>
                    <Text style={styles.emotionLabel}>Before</Text>
                    <View style={styles.chipRow}>
                      <View style={[
                        styles.chip,
                        { backgroundColor: emotionToChipColor(session.beforeValence, session.beforeArousal) }
                      ]}>
                        <Text style={styles.chipText}>
                          {getValenceLabel(session.beforeValence)}
                        </Text>
                      </View>
                      <View style={[
                        styles.chip,
                        { backgroundColor: emotionToChipColor(session.beforeValence, session.beforeArousal) }
                      ]}>
                        <Text style={styles.chipText}>
                          活性{getArousalLabel(session.beforeArousal)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* 矢印 */}
                  <Text style={styles.arrow}>→</Text>

                  {/* After */}
                  <View style={[styles.emotionBlock, styles.emotionBlockRight]}>
                    <Text style={styles.emotionLabel}>After</Text>
                    {session.afterValence !== null && session.afterValence !== undefined ? (
                      <View style={styles.chipRow}>
                        <View style={[
                          styles.chip,
                          { backgroundColor: emotionToChipColor(session.afterValence, session.afterArousal ?? 0) }
                        ]}>
                          <Text style={styles.chipText}>
                            からだ: {getBodyLabel(session.afterValence)}
                          </Text>
                        </View>
                        <View style={[
                          styles.chip,
                          { backgroundColor: emotionToChipColor(session.afterValence, session.afterArousal ?? 0) }
                        ]}>
                          <Text style={styles.chipText}>
                            こころ: {getMindLabel(session.afterArousal ?? 0)}
                          </Text>
                        </View>
                      </View>
                    ) : (
                      <View style={styles.chipRow}>
                        <View style={[styles.chip, { backgroundColor: getMissingChipColor() }]}>
                          <Text style={styles.chipMissingText}>未記録</Text>
                        </View>
                      </View>
                    )}
                  </View>
                </View>

                {/* メモ表示 */}
                {session.memo ? (
                  <Text style={styles.sessionMemo}>メモ: {session.memo}</Text>
                ) : null}

                {/* 副情報：トレーニング名・時間 */}
                <Text style={styles.sessionMeta}>
                  {getMenuName(session.meditationType ?? '', trainingMode)}
                </Text>
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
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#4A5568',
    textAlign: 'center',
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
  sparkleTopRight: {
    top: -8,
    right: -6,
    fontSize: 16,
  },
  sparkleTopLeft: {
    top: 0,
    left: -10,
    fontSize: 14,
    color: '#FF85A2',
  },
  sparkleBottomRight: {
    bottom: -6,
    right: -2,
    fontSize: 12,
    color: '#FFB6C1',
  },
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
    position: 'absolute',
    top: 12,
    right: 16,
    fontSize: 11,
    color: '#A0AEC0',
  },
  emotionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  emotionBlock: {
    flex: 1,
  },
  emotionBlockRight: {
    alignItems: 'flex-end',
  },
  emotionLabel: {
    fontSize: 11,
    color: '#718096',
    marginBottom: 6,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  chip: {
    borderRadius: 10,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  chipText: {
    fontSize: 12,
    color: '#5A6B7C',
    fontWeight: '500',
  },
  chipMissingText: {
    fontSize: 12,
    color: '#A0AEC0',
    fontWeight: '500',
  },
  arrow: {
    fontSize: 14,
    color: '#CBD5E0',
    marginHorizontal: 8,
    marginTop: 24,
  },
  sessionMemo: {
    marginTop: 10,
    fontSize: 12,
    color: '#5A6B7C',
    fontStyle: 'italic',
  },
  sessionMeta: {
    marginTop: 12,
    fontSize: 11,
    color: '#A0AEC0',
  },
});
