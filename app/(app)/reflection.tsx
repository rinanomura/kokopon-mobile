import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/hooks/useThemeColors';
import { usePreferences } from '@/hooks/usePreferences';
import { generateAfterComment } from '@/lib/openRouter';
import { listSessionLogs, SessionLog } from '@/lib/api';

type Rating = 'good' | 'neutral' | 'notSure';

interface Question {
  id: 'breathing' | 'body' | 'mind';
  text: string;
  options: { value: Rating; label: string; icon: keyof typeof Ionicons.glyphMap }[];
}

const QUESTIONS: Question[] = [
  {
    id: 'breathing',
    text: '呼吸はどうでしたか？',
    options: [
      { value: 'good', label: '心地よかった', icon: 'sunny-outline' },
      { value: 'neutral', label: 'ふつう', icon: 'remove-outline' },
      { value: 'notSure', label: 'よくわからない', icon: 'help-outline' },
    ],
  },
  {
    id: 'body',
    text: '体は軽くなりましたか？',
    options: [
      { value: 'good', label: '軽くなった', icon: 'sunny-outline' },
      { value: 'neutral', label: '変わらない', icon: 'remove-outline' },
      { value: 'notSure', label: 'よくわからない', icon: 'help-outline' },
    ],
  },
  {
    id: 'mind',
    text: '気持ちは楽になりましたか？',
    options: [
      { value: 'good', label: '楽になった', icon: 'sunny-outline' },
      { value: 'neutral', label: '変わらない', icon: 'remove-outline' },
      { value: 'notSure', label: 'よくわからない', icon: 'help-outline' },
    ],
  },
];

export default function ReflectionScreen() {
  const params = useLocalSearchParams<{
    sessionId: string;
    bodyValue: string;
    mindValue: string;
    breathValue: string;
    meditationGuideId: string;
  }>();

  const colors = useThemeColors();
  const { designTheme } = usePreferences();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Rating>>({});
  const [waitingForAI, setWaitingForAI] = useState(false);

  // バックグラウンドAI生成の結果を保持
  const aiCommentRef = useRef<string | null>(null);
  const aiPromiseRef = useRef<Promise<string> | null>(null);
  const journeyDataRef = useRef<string | null>(null);

  // マウント時にバックグラウンドでAI生成 & ジャーニーデータ取得を開始
  useEffect(() => {
    // AI コメント生成（リフレクション結果なしで先行開始）
    const aiPromise = generateAfterComment({
      body: parseFloat(params.bodyValue ?? '3'),
      mind: parseFloat(params.mindValue ?? '3'),
      breath: parseFloat(params.breathValue ?? '3'),
      meditationGuideId: params.meditationGuideId ?? '',
      designTheme,
    }).then(comment => {
      aiCommentRef.current = comment;
      return comment;
    }).catch(() => {
      // フォールバックはafter側で処理
      return '';
    });
    aiPromiseRef.current = aiPromise;

    // ジャーニーデータ取得
    listSessionLogs().then(sessions => {
      journeyDataRef.current = JSON.stringify(sessions);
    }).catch(() => {
      // エラー時はafter側で再取得
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentQuestion = QUESTIONS[currentIndex];
  const isLastQuestion = currentIndex === QUESTIONS.length - 1;

  // after画面への遷移
  const navigateToAfter = useCallback(async (finalAnswers: Record<string, Rating>) => {
    // AI生成がまだ完了していなければ待つ
    if (!aiCommentRef.current && aiPromiseRef.current) {
      setWaitingForAI(true);
      await aiPromiseRef.current;
      setWaitingForAI(false);
    }

    router.replace({
      pathname: '/after',
      params: {
        sessionId: params.sessionId ?? '',
        bodyValue: params.bodyValue,
        mindValue: params.mindValue,
        breathValue: params.breathValue,
        meditationGuideId: params.meditationGuideId,
        reflectionBreathing: finalAnswers.breathing ?? '',
        reflectionBody: finalAnswers.body ?? '',
        reflectionMind: finalAnswers.mind ?? '',
        preGeneratedComment: aiCommentRef.current ?? '',
        preloadedJourney: journeyDataRef.current ?? '',
      },
    });
  }, [params]);

  const handleSelect = useCallback((value: Rating) => {
    const questionId = QUESTIONS[currentIndex].id;
    const newAnswers = { ...answers, [questionId]: value };
    setAnswers(newAnswers);

    if (isLastQuestion) {
      navigateToAfter(newAnswers);
    } else {
      setCurrentIndex(prev => prev + 1);
    }
  }, [currentIndex, answers, isLastQuestion, navigateToAfter]);

  const handleSkip = useCallback(() => {
    navigateToAfter(answers);
  }, [answers, navigateToAfter]);

  // ドットインジケーター
  const progressDots = QUESTIONS.map((_, i) => {
    if (i < currentIndex) return 'done';
    if (i === currentIndex) return 'current';
    return 'upcoming';
  });

  return (
    <LinearGradient
      colors={[colors.gradientStart, colors.gradientEnd]}
      style={styles.gradient}
    >
      <StatusBar barStyle={colors.statusBarStyle} />
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* AI待ちオーバーレイ */}
        {waitingForAI && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="small" color={colors.accent} />
          </View>
        )}

        {/* ヘッダー */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleSkip} activeOpacity={0.7} disabled={waitingForAI}>
            <Text style={[styles.skipText, { color: colors.textMuted }]}>スキップ</Text>
          </TouchableOpacity>
        </View>

        {/* メインコンテンツ */}
        <View style={styles.mainContent}>
          {/* ドットインジケーター */}
          <View style={styles.dots}>
            {progressDots.map((status, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  { backgroundColor: colors.progressRingBg },
                  status === 'done' && { backgroundColor: colors.accent },
                  status === 'current' && { backgroundColor: colors.accent, width: 24 },
                ]}
              />
            ))}
          </View>

          {/* 質問テキスト */}
          <Text style={[styles.questionText, { color: colors.textPrimary }]}>
            {currentQuestion.text}
          </Text>

          {/* 選択肢 */}
          <View style={styles.optionsContainer}>
            {currentQuestion.options.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[styles.optionButton, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
                onPress={() => handleSelect(option.value)}
                activeOpacity={0.7}
                disabled={waitingForAI}
              >
                <Ionicons name={option.icon} size={24} color={colors.accent} />
                <Text style={[styles.optionLabel, { color: colors.textPrimary }]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
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
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  skipText: {
    fontSize: 14,
    fontWeight: '500',
  },
  mainContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 40,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  questionText: {
    fontSize: 22,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 32,
  },
  optionsContainer: {
    width: '100%',
    gap: 12,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 16,
    borderWidth: 1,
    gap: 14,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
});
