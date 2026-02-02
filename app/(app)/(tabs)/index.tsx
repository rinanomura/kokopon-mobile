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
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useFootprints } from '@/hooks/useFootprints';
import MindfulSlider from '@/components/MindfulSlider';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * HomeScreen - トレーニング開始画面
 *
 * ユーザーは「こころ」の状態をスライダーで入力し、
 * トレーニングへ進みます。
 */
export default function HomeScreen() {
  const { addFootprint } = useFootprints();

  // スライダー値
  const [mindValue, setMindValue] = useState(0);   // こころ: -1(ざわざわ) ~ +1(しずか)

  // メモ
  const [memo, setMemo] = useState('');

  // 吹き出しアニメーション
  const bubbleAnim = useRef(new Animated.Value(0)).current;
  const sparkle1Anim = useRef(new Animated.Value(0)).current;
  const sparkle2Anim = useRef(new Animated.Value(0)).current;
  const sparkle3Anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 吹き出しふわふわアニメーション
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

    // キラキラアニメーション（それぞれ異なるタイミング）
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

  /**
   * 「トレーニングへ進む」ボタンのハンドラ
   */
  const handleProceed = useCallback(async () => {
    await addFootprint();

    // 時間選択画面へ遷移
    router.push({
      pathname: '/time-select',
      params: {
        beforeMind: mindValue.toString(),
        memo: memo,
      },
    });
  }, [mindValue, memo, addFootprint]);

  return (
    <LinearGradient
      colors={['#7AD7F0', '#CDECF6']}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.keyboardAvoid}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
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
            {/* スライダーセクション */}
            <View style={styles.slidersContainer}>
              <MindfulSlider
                label="こころ"
                leftLabel="ざわざわ"
                rightLabel="しずか"
                value={mindValue}
                onValueChange={setMindValue}
              />
            </View>

            {/* メモ入力 */}
            <View style={styles.memoContainer}>
              <TextInput
                style={styles.memoInput}
                placeholder="今の気持ちや状況など自由に…（任意）"
                placeholderTextColor="#A0AEC0"
                value={memo}
                onChangeText={setMemo}
                multiline
                maxLength={200}
              />
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
                  <Text style={styles.speechBubbleText}>
                    準備ができたら{'\n'}始めよう！
                  </Text>
                </LinearGradient>
              </Animated.View>
            </View>
          </ScrollView>

          {/* フッター：トレーニングへ進むボタン */}
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
                  トレーニングへ進む
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
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
  keyboardAvoid: {
    flex: 1,
  },
  titleWrapper: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 8,
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
    paddingTop: 8,
    paddingBottom: 16,
  },

  // スライダー
  slidersContainer: {
    marginBottom: 16,
  },

  // メモ
  memoContainer: {
    marginBottom: 16,
  },
  memoInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 16,
    padding: 16,
    fontSize: 14,
    color: '#4A5568',
    minHeight: 60,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: 'rgba(255, 182, 193, 0.3)',
  },

  // りなわん + 吹き出し
  mascotSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
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
