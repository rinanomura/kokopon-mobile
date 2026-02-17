import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  ScrollView,
  Animated,
  Easing,
  Vibration,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { Audio } from 'expo-av';
import { generateAfterComment } from '@/lib/openRouter';
import { listSessionLogs, SessionLog } from '@/lib/api';
import { useThemeColors, useThemeTexts } from '@/hooks/useThemeColors';
import { usePreferences } from '@/hooks/usePreferences';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const FALLBACK_MESSAGES = [
  'おつかれさま！\n今日も自分と過ごす時間をつくれたね。',
  'えらいね！\nまた気が向いたら会いに来てね。',
  'おつかれさま！\nどんな感覚でも、気づけたことがすばらしいよ。',
  'ありがとう！\n今の自分に気づけたね。',
  'がんばったね！\nゆっくり休んでね。',
];

const FALLBACK_MESSAGES_SIMPLE = [
  'おつかれさまでした。\n今日もご自身と向き合う時間を取れましたね。',
  'すばらしいですね。\nまた気が向いたらいつでもどうぞ。',
  'おつかれさまでした。\nどんな感覚でも、気づけたことが大切です。',
  'ありがとうございます。\n今の自分に気づけましたね。',
  'よくがんばりましたね。\nゆっくりお休みください。',
];

// ジャーニーマップの統計データ
interface JourneyStats {
  streak: number;
  recentDays: { date: string; label: string; hasSession: boolean; isToday: boolean }[];
  totalMinutes: number;
  totalSessions: number;
}

function calcJourneyStats(sessions: SessionLog[]): JourneyStats {
  const now = new Date();
  const todayStr = toDateStr(now);

  const sessionDates = new Set<string>();
  let totalSeconds = 0;

  for (const s of sessions) {
    const d = toDateStr(new Date(s.timestamp));
    sessionDates.add(d);
    totalSeconds += s.actualDuration ?? s.settingDuration ?? 0;
  }

  let streak = 0;
  const check = new Date(now);
  while (true) {
    const ds = toDateStr(check);
    if (sessionDates.has(ds)) {
      streak++;
      check.setDate(check.getDate() - 1);
    } else {
      break;
    }
  }

  const recentDays: JourneyStats['recentDays'] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const ds = toDateStr(d);
    recentDays.push({
      date: ds,
      label: `${d.getMonth() + 1}/${d.getDate()}`,
      hasSession: sessionDates.has(ds),
      isToday: ds === todayStr,
    });
  }

  return {
    streak,
    recentDays,
    totalMinutes: Math.round(totalSeconds / 60),
    totalSessions: sessions.length,
  };
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatTotalTime(minutes: number): string {
  if (minutes < 60) return `${minutes}分`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}時間${m}分` : `${h}時間`;
}

function getStreakMessage(streak: number): string {
  if (streak >= 30) return `連続${streak}日達成！すごい！`;
  if (streak >= 14) return `連続${streak}日達成！`;
  if (streak >= 7) return `連続${streak}日達成！`;
  if (streak >= 3) return `連続${streak}日目！いい調子！`;
  if (streak >= 2) return `連続${streak}日目！`;
  return '今日もおつかれさま！';
}

// ジャーニーマップ表示までの待機時間（コメント表示後）
const JOURNEY_REVEAL_DELAY = 800;

export default function AfterScreen() {
  const params = useLocalSearchParams<{
    sessionId: string;
    bodyValue: string;
    mindValue: string;
    reactivityValue: string;
    meditationGuideId: string;
  }>();

  const colors = useThemeColors();
  const texts = useThemeTexts();
  const { designTheme } = usePreferences();

  const [mascotMessage, setMascotMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [journeyStats, setJourneyStats] = useState<JourneyStats | null>(null);
  const [showJourney, setShowJourney] = useState(false);

  // アニメーション
  const journeyOpacity = useRef(new Animated.Value(0)).current;
  const journeyTranslateY = useRef(new Animated.Value(30)).current;
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    const fetchComment = async () => {
      try {
        const comment = await generateAfterComment({
          body: parseFloat(params.bodyValue ?? '3'),
          mind: parseFloat(params.mindValue ?? '3'),
          reactivity: parseFloat(params.reactivityValue ?? '3'),
          meditationGuideId: params.meditationGuideId ?? '',
          designTheme,
        });
        setMascotMessage(comment);
      } catch {
        const fallbacks = designTheme === 'simple' ? FALLBACK_MESSAGES_SIMPLE : FALLBACK_MESSAGES;
        setMascotMessage(
          fallbacks[Math.floor(Math.random() * fallbacks.length)]
        );
      } finally {
        setLoading(false);
      }
    };

    const fetchJourney = async () => {
      try {
        const sessions = await listSessionLogs();
        setJourneyStats(calcJourneyStats(sessions));
      } catch (error) {
        console.error('Failed to load journey stats:', error);
      }
    };

    fetchComment();
    fetchJourney();
  }, [params.bodyValue, params.mindValue, params.reactivityValue, params.meditationGuideId, designTheme]);

  // コメント表示完了後、ジャーニーマップをアニメーション表示
  useEffect(() => {
    if (loading || !journeyStats) return;

    const timer = setTimeout(() => {
      setShowJourney(true);

      // やさしい振動
      Vibration.vibrate(80);

      // 効果音を再生
      playRevealSound();

      // フェードイン + スライドアップ
      Animated.parallel([
        Animated.timing(journeyOpacity, {
          toValue: 1,
          duration: 600,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(journeyTranslateY, {
          toValue: 0,
          duration: 600,
          easing: Easing.out(Easing.back(1.2)),
          useNativeDriver: true,
        }),
      ]).start(() => {
        // アニメーション完了後に下へスクロール
        scrollViewRef.current?.scrollToEnd({ animated: true });
      });
    }, JOURNEY_REVEAL_DELAY);

    return () => clearTimeout(timer);
  }, [loading, journeyStats]);

  const playRevealSound = async () => {
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync(
        require('@/assets/sounds/singing_bowls.mp3'),
        { shouldPlay: true, volume: 0.8 }
      );
      // 3秒後に停止・解放
      setTimeout(async () => {
        try {
          await sound.stopAsync();
          await sound.unloadAsync();
        } catch { /* ignore */ }
      }, 3000);
    } catch (error) {
      console.error('Failed to play reveal sound:', error);
    }
  };

  const handleGoHome = () => {
    router.replace('/');
  };

  return (
    <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={styles.gradient}>
      <StatusBar barStyle={colors.statusBarStyle} />
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* コメント + マスコット */}
          <View style={styles.mascotArea}>
            {/* 吹き出し / コメントカード */}
            <View style={styles.speechBubbleContainer}>
              {colors.showMascot ? (
                <LinearGradient
                  colors={colors.bubbleBg as unknown as [string, string, ...string[]]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.speechBubble, { borderColor: colors.bubbleBorder }]}
                >
                  <View style={styles.sparkleTopLeft}>
                    <Text style={[styles.sparkleText, { color: colors.sparkleColor }]}>✧</Text>
                  </View>
                  <View style={styles.sparkleBottomRight}>
                    <Text style={[styles.sparkleText, { color: colors.sparkleColor }]}>✧</Text>
                  </View>
                  {loading ? (
                    <ActivityIndicator size="small" color={colors.accent} />
                  ) : (
                    <Text style={[styles.speechBubbleText, { color: colors.textSecondary }]}>
                      {mascotMessage}
                    </Text>
                  )}
                </LinearGradient>
              ) : (
                <View style={[styles.simpleCommentCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                  {loading ? (
                    <ActivityIndicator size="small" color={colors.accent} />
                  ) : (
                    <Text style={[styles.speechBubbleText, { color: colors.textSecondary }]}>
                      {mascotMessage}
                    </Text>
                  )}
                </View>
              )}
              {colors.showMascot && (
                <View style={styles.speechBubbleTailOuter}>
                  <View style={[styles.speechBubbleTail, { borderTopColor: colors.bubbleBg[2] }]} />
                </View>
              )}
            </View>

            {/* りなわん GIF（かわいいモードのみ） */}
            {colors.showMascot && (
              <Image
                source={require('@/assets/images/rinawan_laying_down.gif')}
                style={styles.mascotImage}
                resizeMode="contain"
              />
            )}
          </View>

          {/* ジャーニーマップ（遅延アニメーション表示） */}
          {showJourney && journeyStats && (
            <Animated.View
              style={[
                styles.journeyCard,
                {
                  opacity: journeyOpacity,
                  transform: [{ translateY: journeyTranslateY }],
                  shadowColor: colors.bubbleShadow,
                },
              ]}
            >
              <LinearGradient
                colors={colors.journeyGradient as unknown as [string, string, ...string[]]}
                style={[styles.journeyGradient, { borderColor: colors.journeyBorder }]}
              >
                {/* ストリークヘッダー */}
                <View style={styles.journeyHeader}>
                  <Text style={styles.journeyStreakEmoji}>
                    {journeyStats.streak >= 7 ? '🏆' : journeyStats.streak >= 3 ? '🔥' : '✨'}
                  </Text>
                  <Text style={[styles.journeyStreakText, { color: colors.textPrimary }]}>
                    {getStreakMessage(journeyStats.streak)}
                  </Text>
                </View>

                {/* ドットタイムライン */}
                <View style={styles.timelineContainer}>
                  <View style={[styles.timelineLine, { backgroundColor: colors.journeyLine }]} />
                  <View style={styles.timelineDots}>
                    {journeyStats.recentDays.map((day) => (
                      <View key={day.date} style={styles.timelineDayColumn}>
                        <View
                          style={[
                            styles.timelineDot,
                            { backgroundColor: colors.journeyDotInactive, borderColor: colors.journeyDotInactive },
                            day.hasSession && { backgroundColor: colors.journeyDotActive, borderColor: colors.journeyDotActive },
                            day.isToday && { backgroundColor: colors.journeyDotToday, borderColor: colors.journeyDotToday, shadowColor: colors.journeyDotToday },
                          ]}
                        />
                        <Text
                          style={[
                            styles.timelineDateLabel,
                            { color: colors.textMuted },
                            day.isToday && { color: colors.accent, fontWeight: '700' },
                          ]}
                        >
                          {day.isToday ? '今日' : day.label}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>

                {/* 累計統計 */}
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: colors.statValueColor }]}>
                      {formatTotalTime(journeyStats.totalMinutes)}
                    </Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>累計瞑想時間</Text>
                  </View>
                  <View style={[styles.statDivider, { backgroundColor: colors.journeyLine }]} />
                  <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: colors.statValueColor }]}>
                      {journeyStats.totalSessions}回
                    </Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>トレーニング回数</Text>
                  </View>
                </View>
              </LinearGradient>
            </Animated.View>
          )}
        </ScrollView>

        {/* ホームへ戻るボタン */}
        <View style={styles.footer}>
          <TouchableOpacity
            onPress={handleGoHome}
            activeOpacity={0.8}
            style={[styles.buttonWrapper, { shadowColor: colors.buttonShadow }]}
          >
            <LinearGradient
              colors={[colors.buttonGradientStart, colors.buttonGradientEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.button}
            >
              <Text style={styles.buttonText}>ホームへもどる</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const DOT_SIZE = 14;

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
  },

  // マスコット + 吹き出し
  mascotArea: {
    alignItems: 'center',
    marginBottom: 24,
  },
  speechBubbleContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  speechBubble: {
    borderRadius: 24,
    paddingVertical: 20,
    paddingHorizontal: 28,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
    position: 'relative',
  },
  simpleCommentCard: {
    borderRadius: 24,
    paddingVertical: 20,
    paddingHorizontal: 28,
    borderWidth: 1,
  },
  sparkleTopLeft: {
    position: 'absolute',
    top: -8,
    left: -4,
  },
  sparkleBottomRight: {
    position: 'absolute',
    bottom: -6,
    right: -2,
  },
  sparkleText: {
    fontSize: 16,
  },
  speechBubbleText: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 26,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  speechBubbleTailOuter: {
    alignItems: 'center',
    marginTop: -2,
  },
  speechBubbleTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 12,
    borderRightWidth: 12,
    borderTopWidth: 14,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  mascotImage: {
    width: SCREEN_WIDTH * 0.35,
    height: SCREEN_WIDTH * 0.35,
    maxWidth: 140,
    maxHeight: 140,
  },

  // ジャーニーマップ
  journeyCard: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  journeyGradient: {
    borderRadius: 20,
    borderWidth: 1.5,
    paddingVertical: 20,
    paddingHorizontal: 20,
  },

  // ストリークヘッダー
  journeyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 8,
  },
  journeyStreakEmoji: {
    fontSize: 20,
  },
  journeyStreakText: {
    fontSize: 16,
    fontWeight: '700',
  },

  // タイムライン
  timelineContainer: {
    position: 'relative',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  timelineLine: {
    position: 'absolute',
    left: DOT_SIZE / 2 + 4,
    right: DOT_SIZE / 2 + 4,
    top: DOT_SIZE / 2,
    height: 3,
    borderRadius: 1.5,
  },
  timelineDots: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timelineDayColumn: {
    alignItems: 'center',
    width: 36,
  },
  timelineDot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    borderWidth: 2,
    marginBottom: 6,
  },
  timelineDateLabel: {
    fontSize: 10,
  },

  // 累計統計
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
  },
  statDivider: {
    width: 1,
    height: 32,
  },

  // フッター
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 8,
    alignItems: 'center',
  },
  buttonWrapper: {
    borderRadius: 25,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  button: {
    borderRadius: 25,
    paddingVertical: 14,
    paddingHorizontal: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
