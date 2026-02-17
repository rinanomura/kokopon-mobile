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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useFootprints } from '@/hooks/useFootprints';
import TextButtonSelector from '@/components/TextButtonSelector';
import { generateMindfulComment } from '@/lib/openRouter';

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
  { value: 1, label: '敏感だが\nすぐに安定' },
  { value: 2, label: '敏感な\n状態が続く' },
  { value: 3, label: '常に安定' },
];

export default function HomeScreen() {
  const { addFootprint } = useFootprints();

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
        });
        setAiComment(comment);
      } catch (error) {
        console.error('AI comment error:', error);
      } finally {
        setIsLoadingComment(false);
      }
    }, 2000);
  }, []);

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
      colors={['#7AD7F0', '#CDECF6']}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* タイトル */}
        <View style={styles.titleWrapper}>
          <LinearGradient
            colors={['rgba(255,240,245,0.95)', 'rgba(255,255,255,0.95)', 'rgba(255,240,245,0.95)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.titleContainer}
          >
            <Text style={styles.titleDecorLeft}>✧ ⋆</Text>
            <Text style={styles.title}>今の状態を教えてね！</Text>
            <Text style={styles.titleDecorRight}>⋆ ✧</Text>
          </LinearGradient>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* セレクターセクション */}
          <View style={styles.selectorsContainer}>
            <View style={styles.selectorCard}>
              <TextButtonSelector
                label="からだ"
                options={BODY_OPTIONS}
                value={bodyValue}
                onValueChange={handleBodyChange}
              />
            </View>
            <View style={styles.selectorCard}>
              <TextButtonSelector
                label="こころ"
                options={MIND_OPTIONS}
                value={mindValue}
                onValueChange={handleMindChange}
              />
            </View>
            <View style={styles.selectorCard}>
              <TextButtonSelector
                label="心の反応しやすさ"
                options={REACTIVITY_OPTIONS}
                value={reactivityValue}
                onValueChange={handleReactivityChange}
              />
            </View>
          </View>

          {/* りなわんと吹き出し */}
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
              <View style={styles.speechBubbleTail} />
              <LinearGradient
                colors={['#FFF5F7', '#FFFFFF', '#FFF0F5']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.speechBubble}
              >
                <Animated.Text style={[styles.sparkle, styles.sparkleTopRight, { opacity: sparkle1Anim }]}>
                  ✧
                </Animated.Text>
                <Animated.Text style={[styles.sparkle, styles.sparkleTopLeft, { opacity: sparkle2Anim }]}>
                  ✦
                </Animated.Text>
                <Animated.Text style={[styles.sparkle, styles.sparkleBottomRight, { opacity: sparkle3Anim }]}>
                  ⋆
                </Animated.Text>
                {isLoadingComment ? (
                  <ActivityIndicator size="small" color="#FF85A2" />
                ) : (
                  <Text style={styles.speechBubbleText}>
                    {aiComment || '準備ができたら\n始めよう！'}
                  </Text>
                )}
              </LinearGradient>
            </Animated.View>
          </View>
        </ScrollView>

        {/* フッター */}
        <View style={styles.footer}>
          <TouchableOpacity
            onPress={handleProceed}
            activeOpacity={0.8}
            style={styles.proceedButtonWrapper}
          >
            <LinearGradient
              colors={['#FF85A2', '#FFB6C1']}
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
    borderColor: 'rgba(255, 182, 193, 0.5)',
    shadowColor: '#FFB6C1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4A5568',
    textAlign: 'center',
    marginHorizontal: 4,
  },
  titleDecorLeft: {
    fontSize: 14,
    color: '#FF85A2',
    marginRight: 4,
  },
  titleDecorRight: {
    fontSize: 14,
    color: '#FF85A2',
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
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 182, 193, 0.3)',
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
    borderRightColor: '#FFF5F7',
    marginRight: -1,
  },
  speechBubble: {
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 182, 193, 0.5)',
    shadowColor: '#FFB6C1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
    position: 'relative',
    maxWidth: SCREEN_WIDTH * 0.5,
  },
  sparkle: {
    position: 'absolute',
    fontSize: 12,
    color: '#FF69B4',
    textShadowColor: '#FF69B4',
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
    color: '#5A6B7C',
    fontWeight: '600',
    lineHeight: 20,
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
    shadowColor: '#FF85A2',
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
