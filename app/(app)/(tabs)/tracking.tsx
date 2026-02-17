import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Image,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { listSessionLogs, SessionLog } from '@/lib/api';
import { emotionToChipColor, getMissingChipColor } from '@/lib/emotionColor';
import { getTrainingContent, isValidMenuId } from '@/constants/trainingContents';
import { usePreferences } from '@/hooks/usePreferences';
import { useThemeColors } from '@/hooks/useThemeColors';

/**
 * からだスライダー値をラベルに変換（After用）
 */
function getBodyLabel(value: number): string {
  if (value > 0.5) return 'ゆるんでいる';
  if (value > 0) return 'ややゆるんでいる';
  if (value > -0.5) return 'ややこわばっている';
  return 'こわばっている';
}

/**
 * こころスライダー値をラベルに変換（After用）
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
 */
function getMenuName(meditationType: string, trainingMode: 'intuitive' | 'verbal'): string {
  if (meditationType === 'timer') return 'タイマー';
  if (meditationType === 'ambient') return '環境音';
  if (isValidMenuId(meditationType)) {
    const content = getTrainingContent(meditationType);
    return content.title[trainingMode];
  }
  return meditationType || '';
}

/**
 * TrackingScreen - トラッキング画面
 */
export default function TrackingScreen() {
  const { trainingMode, designTheme } = usePreferences();
  const colors = useThemeColors();
  const [sessions, setSessions] = useState<SessionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  /**
   * 継続を促すメッセージを生成
   */
  const encouragementMessage = useMemo(() => {
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

    if (designTheme === 'simple') {
      if (total === 1) return '最初の一歩ですね。\nまたお待ちしています。';
      if (total <= 3) return `${total}回目のセッションですね。\nすばらしいです。`;
      if (weeklyCount >= 3) return `今週${weeklyCount}回のセッションですね。\n継続されていますね。`;
      if (weeklyCount >= 1) return 'またお越しいただけましたね。\nいつでもお待ちしています。';
      return 'お久しぶりです。\nまたお気軽にどうぞ。';
    }

    // かわいいモード（りなわん口調）
    if (total === 1) return '最初の一歩だね！\nまた会えるの楽しみにしてるよ';
    if (total <= 3) return `${total}回も来てくれたんだね！\nうれしいな`;
    if (weeklyCount >= 3) return `今週${weeklyCount}回も会えたね！\nいつもありがとう`;
    if (weeklyCount >= 1) return 'また会えてうれしいな！\nいつでも待ってるからね';
    return 'ひさしぶり！\nまた気が向いたら遊びに来てね';
  }, [sessions, designTheme]);

  const fetchSessions = useCallback(async () => {
    try {
      const items = await listSessionLogs();
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

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchSessions();
  }, [fetchSessions]);

  return (
    <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={styles.gradient}>
      <StatusBar barStyle={colors.statusBarStyle} />
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* ヘッダー */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>セッション履歴</Text>
        </View>

        {/* ローディング */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : sessions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: colors.textPrimary }]}>まだ記録がありません</Text>
            <Text style={[styles.emptyHint, { color: colors.textSecondary }]}>
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
                tintColor={colors.accent}
              />
            }
          >
            {/* マスコットと継続メッセージ */}
            {encouragementMessage && (
              colors.showMascot ? (
                <View style={styles.mascotSection}>
                  <Image
                    source={require('@/assets/images/rinawan_talking.gif')}
                    style={styles.mascotImage}
                    resizeMode="contain"
                  />
                  <View style={styles.speechBubbleContainer}>
                    <View style={[styles.speechBubbleTail, { borderRightColor: colors.bubbleBg[0] }]} />
                    <LinearGradient
                      colors={colors.bubbleBg as unknown as [string, string, ...string[]]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={[styles.speechBubble, { borderColor: colors.bubbleBorder }]}
                    >
                      <Text style={[styles.sparkle, styles.sparkleTopRight, { color: colors.sparkleColor }]}>✧</Text>
                      <Text style={[styles.sparkle, styles.sparkleTopLeft, { color: colors.sparkleColor }]}>✦</Text>
                      <Text style={[styles.sparkle, styles.sparkleBottomRight, { color: colors.sparkleColor }]}>⋆</Text>
                      <Text style={[styles.speechBubbleText, { color: colors.textSecondary }]}>
                        {encouragementMessage}
                      </Text>
                    </LinearGradient>
                  </View>
                </View>
              ) : (
                <View style={[styles.simpleMessageCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                  <Text style={[styles.simpleMessageText, { color: colors.textSecondary }]}>
                    {encouragementMessage}
                  </Text>
                </View>
              )
            )}

            {sessions.map((session) => (
              <View key={session.id} style={[styles.sessionCard, { backgroundColor: colors.card }]}>
                <Text style={[styles.sessionDate, { color: colors.textMuted }]}>
                  実施日時: {formatDateTime(session.timestamp)}
                </Text>

                <View style={styles.emotionRow}>
                  <View style={styles.emotionBlock}>
                    <Text style={[styles.emotionLabel, { color: colors.textSecondary }]}>Before</Text>
                    <View style={styles.chipRow}>
                      <View style={[
                        styles.chip,
                        { backgroundColor: emotionToChipColor(session.beforeValence, session.beforeArousal) }
                      ]}>
                        <Text style={styles.chipText}>
                          からだ: {getBodyLabel(session.beforeValence)}
                        </Text>
                      </View>
                      <View style={[
                        styles.chip,
                        { backgroundColor: emotionToChipColor(session.beforeValence, session.beforeArousal) }
                      ]}>
                        <Text style={styles.chipText}>
                          こころ: {getMindLabel(session.beforeArousal)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <Text style={[styles.arrow, { color: colors.textMuted }]}>→</Text>

                  <View style={[styles.emotionBlock, styles.emotionBlockRight]}>
                    <Text style={[styles.emotionLabel, { color: colors.textSecondary }]}>After</Text>
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

                {session.memo ? (
                  <Text style={[styles.sessionMemo, { color: colors.textSecondary }]}>メモ: {session.memo}</Text>
                ) : null}

                <Text style={[styles.sessionMeta, { color: colors.textMuted }]}>
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
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 14,
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
    marginRight: -1,
  },
  speechBubble: {
    flex: 1,
    position: 'relative',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  sparkle: {
    position: 'absolute',
    fontSize: 14,
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
  },
  sparkleBottomRight: {
    bottom: -6,
    right: -2,
    fontSize: 12,
  },
  speechBubbleText: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  simpleMessageCard: {
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderWidth: 1,
    marginTop: 8,
    marginBottom: 16,
    marginHorizontal: 8,
  },
  simpleMessageText: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 20,
    textAlign: 'center',
  },
  sessionCard: {
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
    marginHorizontal: 8,
    marginTop: 24,
  },
  sessionMemo: {
    marginTop: 10,
    fontSize: 12,
    fontStyle: 'italic',
  },
  sessionMeta: {
    marginTop: 12,
    fontSize: 11,
  },
});
