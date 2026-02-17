import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Image,
  Animated,
  Easing,
  ScrollView,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useFootprints } from '@/hooks/useFootprints';
import TextButtonSelector from '@/components/TextButtonSelector';
import { generateMindfulComment } from '@/lib/openRouter';
import { useThemeColors, useThemeTexts } from '@/hooks/useThemeColors';
import { usePreferences } from '@/hooks/usePreferences';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const BODY_OPTIONS = [
  { value: 1, label: '軽い' },
  { value: 2, label: 'ふつう' },
  { value: 3, label: '重い' },
];

const MIND_OPTIONS = [
  { value: 1, label: '軽い' },
  { value: 2, label: 'ふつう' },
  { value: 3, label: '重い' },
];

const REACTIVITY_OPTIONS = [
  { value: 1, label: '揺れて\n戻らない' },
  { value: 2, label: '揺れて\n戻る' },
  { value: 3, label: '安定\nしている' },
];

export default function HomeScreen() {
  const { addFootprint } = useFootprints();
  const { designTheme } = usePreferences();
  const colors = useThemeColors();
  const texts = useThemeTexts();

  // 3つの選択値 (1-3)、初期値は未選択(0)
  const [bodyValue, setBodyValue] = useState(0);
  const [mindValue, setMindValue] = useState(0);
  const [reactivityValue, setReactivityValue] = useState(0);

  // AIコメント
  const [aiComment, setAiComment] = useState('');
  const [isLoadingComment, setIsLoadingComment] = useState(false);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 吹き出しアニメーション
  const bubbleAnim = useRef(new Animated.Value(0)).current;
  const sparkle1Anim = useRef(new Animated.Value(0)).current;
  const sparkle2Anim = useRef(new Animated.Value(0)).current;
  const sparkle3Anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(bubbleAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(bubbleAnim, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    const startSparkleAnim = (anim: Animated.Value, delay: number) => {
      setTimeout(() => {
        Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: 1,
              duration: 1500,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0.2,
              duration: 1500,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ])
        ).start();
      }, delay);
    };

    startSparkleAnim(sparkle1Anim, 0);
    startSparkleAnim(sparkle2Anim, 500);
    startSparkleAnim(sparkle3Anim, 800);
  }, []);

  const requestAiComment = useCallback((body: number, mind: number, reactivity: number) => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    // 少なくとも1つ選択されていないとリクエストしない
    if (body === 0 && mind === 0 && reactivity === 0) return;
    debounceTimer.current = setTimeout(async () => {
      setIsLoadingComment(true);
      try {
        const comment = await generateMindfulComment({
          body,
          mind,
          reactivity,
          designTheme,
        });
        setAiComment(comment);
      } catch (error) {
        console.error('AI comment error:', error);
      } finally {
        setIsLoadingComment(false);
      }
    }, 2000);
  }, [designTheme]);

  const handleBodyChange = useCallback((v: number) => {
    setBodyValue(v);
    requestAiComment(v, mindValue, reactivityValue);
  }, [mindValue, reactivityValue, requestAiComment]);

  const handleMindChange = useCallback((v: number) => {
    setMindValue(v);
    requestAiComment(bodyValue, v, reactivityValue);
  }, [bodyValue, reactivityValue, requestAiComment]);

  const handleReactivityChange = useCallback((v: number) => {
    setReactivityValue(v);
    requestAiComment(bodyValue, mindValue, v);
  }, [bodyValue, mindValue, requestAiComment]);

  const handleProceed = useCallback(async () => {
    await addFootprint();

    router.push({
      pathname: '/time-select',
      params: {
        bodyValue: bodyValue.toString(),
        mindValue: mindValue.toString(),
        reactivityValue: reactivityValue.toString(),
      },
    });
  }, [bodyValue, mindValue, reactivityValue, addFootprint]);

  return (
    <LinearGradient
      colors={[colors.gradientStart, colors.gradientEnd]}
      style={styles.gradient}
    >
      <StatusBar barStyle={colors.statusBarStyle} />
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* タイトル */}
        <View style={styles.titleWrapper}>
          <LinearGradient
            colors={colors.titleBg as unknown as [string, string, ...string[]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.titleContainer, { borderColor: colors.titleBorder }]}
          >
            {colors.showMascot && (
              <Text style={[styles.titleDecorLeft, { color: colors.titleDecor }]}>✧ ⋆</Text>
            )}
            <Text style={[styles.title, { color: colors.textPrimary }]}>{texts.homeTitle}</Text>
            {colors.showMascot && (
              <Text style={[styles.titleDecorRight, { color: colors.titleDecor }]}>⋆ ✧</Text>
            )}
          </LinearGradient>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* セレクターセクション */}
          <View style={styles.selectorsContainer}>
            <View style={[styles.selectorCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <TextButtonSelector
                label="からだ"
                options={BODY_OPTIONS}
                value={bodyValue}
                onValueChange={handleBodyChange}
              />
            </View>
            <View style={[styles.selectorCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <TextButtonSelector
                label="こころ"
                options={MIND_OPTIONS}
                value={mindValue}
                onValueChange={handleMindChange}
              />
            </View>
            <View style={[styles.selectorCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <TextButtonSelector
                label="心の反応しやすさ"
                options={REACTIVITY_OPTIONS}
                value={reactivityValue}
                onValueChange={handleReactivityChange}
              />
            </View>
          </View>

          {/* マスコット / AIコメント */}
          {colors.showMascot ? (
            /* りなわんと吹き出し */
            <View style={styles.mascotSection}>
              <View style={styles.mascotWrapper}>
                <Image
                  source={require('@/assets/images/rinawan_tilting_head.gif')}
                  style={styles.mascotImage}
                  resizeMode="contain"
                />
              </View>
              <Animated.View
                style={[
                  styles.speechBubbleContainer,
                  {
                    transform: [{
                      translateY: bubbleAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, -4],
                      }),
                    }],
                  },
                ]}
              >
                <View style={[styles.speechBubbleTail, { borderRightColor: colors.bubbleBg[0] }]} />
                <LinearGradient
                  colors={colors.bubbleBg as unknown as [string, string, ...string[]]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.speechBubble, { borderColor: colors.bubbleBorder }]}
                >
                  <Animated.Text style={[styles.sparkle, styles.sparkleTopRight, { opacity: sparkle1Anim, color: colors.sparkleColor }]}>
                    ✧
                  </Animated.Text>
                  <Animated.Text style={[styles.sparkle, styles.sparkleTopLeft, { opacity: sparkle2Anim, color: colors.sparkleColor }]}>
                    ✦
                  </Animated.Text>
                  <Animated.Text style={[styles.sparkle, styles.sparkleBottomRight, { opacity: sparkle3Anim, color: colors.sparkleColor }]}>
                    ⋆
                  </Animated.Text>
                  {isLoadingComment ? (
                    <ActivityIndicator size="small" color={colors.accent} />
                  ) : (
                    <Text style={[styles.speechBubbleText, { color: colors.textSecondary }]}>
                      {aiComment || texts.homeBubbleDefault}
                    </Text>
                  )}
                </LinearGradient>
              </Animated.View>
            </View>
          ) : (
            /* シンプルモード: AIコメントカード */
            <View style={styles.simpleCommentSection}>
              <View style={[styles.simpleCommentCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                {isLoadingComment ? (
                  <ActivityIndicator size="small" color={colors.accent} />
                ) : (
                  <Text style={[styles.simpleCommentText, { color: colors.textSecondary }]}>
                    {aiComment || texts.homeBubbleDefault}
                  </Text>
                )}
              </View>
            </View>
          )}
        </ScrollView>

        {/* フッター */}
        <View style={styles.footer}>
          <TouchableOpacity
            onPress={handleProceed}
            activeOpacity={0.8}
            style={[styles.proceedButtonWrapper, { shadowColor: colors.buttonShadow }]}
          >
            <LinearGradient
              colors={[colors.buttonGradientStart, colors.buttonGradientEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.proceedButton}
            >
              <Text style={styles.proceedButtonText}>
                トレーニング（瞑想）に進む
              </Text>
            </LinearGradient>
          </TouchableOpacity>
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
  titleWrapper: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginHorizontal: 4,
  },
  titleDecorLeft: {
    fontSize: 14,
    marginRight: 4,
  },
  titleDecorRight: {
    fontSize: 14,
    marginLeft: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
  },

  // セレクター
  selectorsContainer: {
    gap: 12,
    marginBottom: 4,
  },
  selectorCard: {
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1.5,
  },

  // りなわん + 吹き出し
  mascotSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingTop: 24,
  },
  mascotWrapper: {
    alignItems: 'center',
  },
  mascotImage: {
    width: 90,
    height: 90,
  },
  speechBubbleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: -8,
    flexShrink: 1,
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
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    position: 'relative',
    maxWidth: SCREEN_WIDTH * 0.5,
  },
  sparkle: {
    position: 'absolute',
    fontSize: 12,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
  sparkleTopRight: {
    top: -6,
    right: -4,
  },
  sparkleTopLeft: {
    top: 2,
    left: -8,
  },
  sparkleBottomRight: {
    bottom: -4,
    right: 0,
  },
  speechBubbleText: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 20,
    textAlign: 'center',
  },

  // シンプルモードのAIコメント
  simpleCommentSection: {
    paddingTop: 24,
    paddingHorizontal: 8,
  },
  simpleCommentCard: {
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderWidth: 1,
    alignItems: 'center',
  },
  simpleCommentText: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 22,
    textAlign: 'center',
  },

  // フッター
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 8,
    alignItems: 'center',
  },
  proceedButtonWrapper: {
    borderRadius: 25,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  proceedButton: {
    borderRadius: 25,
    paddingVertical: 14,
    paddingHorizontal: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proceedButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
