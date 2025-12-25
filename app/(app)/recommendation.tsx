import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * RecommendationScreen - マインドフルネスおすすめ画面（④）
 *
 * この画面の役割：
 * - 感情を分析・診断・評価しない
 * - 「あなたは◯◯タイプ」のような分類はしない
 * - 今の状態をやさしく言葉にして、次の行動につなぐ
 * - マインドフルネス的に安心できるトーンを保つ
 */
export default function RecommendationScreen() {
  // beforePoint を受け取る
  const params = useLocalSearchParams<{
    beforeX: string;
    beforeY: string;
    beforeR: string;
    beforeTheta: string;
  }>();

  /**
   * トレーニングカードをタップしたときのハンドラ
   * ⑤瞑想実行画面へ遷移（beforePoint を引き継ぐ）
   */
  const handleStart = () => {
    console.log('=== トレーニング開始 ===');
    router.push({
      pathname: '/meditation',
      params: {
        beforeX: params.beforeX,
        beforeY: params.beforeY,
        beforeR: params.beforeR,
        beforeTheta: params.beforeTheta,
      },
    });
  };

  return (
    <LinearGradient
      colors={['#7AD7F0', '#CDECF6']}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* 上部タイトル */}
          <Text style={styles.title}>
            今のあなたにおすすめのトレーニング
          </Text>

          {/* 吹き出し（りなわんのセリフ） */}
          <View style={styles.speechBubbleContainer}>
            <View style={styles.speechBubble}>
              <Text style={styles.speechBubbleText}>
                少し外に向かうエネルギーが{'\n'}
                あるみたい。{'\n'}
                まずは呼吸を整えるところから{'\n'}
                始めてみようね。
              </Text>
            </View>
            {/* 吹き出しの尻尾（下向き三角） */}
            <View style={styles.speechBubbleTail} />
          </View>

          {/* りなわん（マスコット） */}
          <View style={styles.mascotContainer}>
            <Image
              source={require('@/assets/images/rinawan_talking.gif')}
              style={styles.mascotImage}
              resizeMode="contain"
            />
          </View>

          {/* トレーニングカード（ボタン化） */}
          <TouchableOpacity
            onPress={handleStart}
            activeOpacity={0.8}
            style={styles.trainingCardWrapper}
          >
            <LinearGradient
              colors={['#FF85A2', '#FFB6C1']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.trainingCard}
            >
              <Text style={styles.trainingTitle}>
                ただ呼吸を感じてみる30秒
              </Text>
              <Text style={styles.trainingDescription}>
                今の状態を変えようとせず、{'\n'}
                ただ呼吸を感じてみる短い時間です。
              </Text>
              <View style={styles.tapHintContainer}>
                <Ionicons
                  name="sparkles"
                  size={14}
                  color="rgba(255, 255, 255, 0.8)"
                />
                <Text style={styles.tapHint}>
                  タップして開始
                </Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
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
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
    alignItems: 'center',
  },

  // 上部タイトル
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#4A5568',
    textAlign: 'center',
    lineHeight: 30,
    marginBottom: 20,
  },

  // 吹き出し
  speechBubbleContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  speechBubble: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 20,
    // やさしい影
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  speechBubbleText: {
    fontSize: 14,
    color: '#4A5568',
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '500',
  },
  speechBubbleTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: 'rgba(255, 255, 255, 0.9)',
    marginTop: -1,
  },

  // りなわん
  mascotContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  mascotImage: {
    width: SCREEN_WIDTH * 0.4,
    height: SCREEN_WIDTH * 0.4,
    maxWidth: 160,
    maxHeight: 160,
  },

  // トレーニングカード（ボタン）
  trainingCardWrapper: {
    width: '100%',
    borderRadius: 20,
    // やさしい影
    shadowColor: '#FF85A2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  trainingCard: {
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  trainingTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 12,
  },
  trainingDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 22,
  },
  tapHintContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    gap: 6,
  },
  tapHint: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
});
