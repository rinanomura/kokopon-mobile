import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import EmotionWheel, { EmotionPoint, LabelMode } from '@/components/EmotionWheel';
import { listSessionLogs } from '@/lib/api';
import FootprintsBlock from '@/components/FootprintsBlock';
import { useFootprints } from '@/hooks/useFootprints';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// 円環のサイズ（画面幅の85%、上限340px）
const WHEEL_SIZE = Math.min(SCREEN_WIDTH * 0.85, 340);

/**
 * HomeScreen - 感情センシング画面（③）
 *
 * マインドフルネスのためのメイン画面です。
 * ユーザーは円環をタップして「今の感情」を選択し、
 * 次の画面（④おすすめ画面）へ進みます。
 *
 * 重要: この画面では感情を「評価」しません。
 * 良い／悪い、正しい／間違い、といった判断は一切行いません。
 * ユーザーは自分の状態にただ「気づく」だけです。
 */
export default function HomeScreen() {
  const { totalCount, startedAtISO, addFootprint } = useFootprints();

  // ラベル表示モード（0: ベースのみ, 1: +基本ラベル, 2: +詳細ラベル）
  // 初期値は0（ベースのみ）
  const [labelMode, setLabelMode] = useState<LabelMode>(0);

  // 選択された感情の座標（before = アクティビティ前の状態）
  const [beforePoint, setBeforePoint] = useState<EmotionPoint | null>(null);

  // 今月のセッション回数
  const [monthlySessionCount, setMonthlySessionCount] = useState<number | null>(null);

  /**
   * 今月のセッション回数を取得
   */
  useEffect(() => {
    const fetchMonthlyCount = async () => {
      try {
        const sessions = await listSessionLogs();

        // 今月の開始日を取得
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        // 今月のセッションをフィルター
        const monthlySessions = sessions.filter(session => {
          const sessionDate = new Date(session.timestamp);
          return sessionDate >= startOfMonth;
        });

        setMonthlySessionCount(monthlySessions.length);
      } catch (error) {
        console.error('セッション回数取得エラー:', error);
        setMonthlySessionCount(0);
      }
    };

    fetchMonthlyCount();
  }, []);

  /**
   * 円環がタップされたときのハンドラ
   * 座標をコンソールに出力し、beforePoint を更新
   */
  const handleEmotionSelect = useCallback((point: EmotionPoint) => {
    // 動作確認用：選択された座標をコンソールに出力
    console.log('=== beforePoint が選択されました ===');
    console.log(`座標: (x: ${point.x}, y: ${point.y})`);
    console.log(`極座標: (r: ${point.r}, theta: ${point.theta})`);
    console.log('=====================================');

    setBeforePoint(point);
  }, []);

  /**
   * ラベル表示モードを切り替え（0 → 1 → 2 → 0）
   */
  const cycleLabelMode = useCallback(() => {
    setLabelMode(prev => ((prev + 1) % 3) as LabelMode);
  }, []);

  /**
   * 「トレーニングへ進む」ボタンのハンドラ
   * beforePoint をログに出力し、次の画面へ遷移
   */
  const handleRecord = useCallback(async () => {
    if (!beforePoint) {
      return;
    }

    await addFootprint();

    // ④ おすすめ画面へ遷移
    router.push({
      pathname: '/recommendation',
      params: {
        beforeX: beforePoint.x.toString(),
        beforeY: beforePoint.y.toString(),
        beforeR: beforePoint.r.toString(),
        beforeTheta: beforePoint.theta.toString(),
      },
    });
  }, [beforePoint, addFootprint]);

  return (
    <LinearGradient
      colors={['#7AD7F0', '#CDECF6']}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* ヘッダー部分：ラベル切り替えボタン */}
        <View style={styles.header}>
          <TouchableOpacity
            style={[
              styles.helpButton,
              labelMode > 0 && styles.helpButtonActive,
            ]}
            onPress={cycleLabelMode}
            activeOpacity={0.7}
          >
            <Text style={styles.helpButtonText}>
              {labelMode === 0 ? '?' : labelMode === 1 ? '?' : '!'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* メインコンテンツ：感情円環 */}
        <View style={styles.wheelContainer}>
          {/* ガイド文 */}
          <View style={styles.guideContainer}>
            {/* りなわん + 回数表示 */}
            <View style={styles.mascotWrapper}>
              {monthlySessionCount !== null && (
                <Text style={styles.sessionCountText}>
                  今月 {monthlySessionCount + 1} 回目です
                </Text>
              )}
              <Image
                source={require('@/assets/images/rinawan_tilting_head.gif')}
                style={styles.mascotImage}
                resizeMode="contain"
              />
            </View>
            <View style={styles.speechBubbleContainer}>
              {/* 吹き出しの尻尾（左向き三角） */}
              <View style={styles.speechBubbleTail} />
              <LinearGradient
                colors={['#FFF5F7', '#FFFFFF', '#FFF0F5']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.speechBubble}
              >
                {/* 装飾キラキラ */}
                <View style={styles.sparkleTopRight}>
                  <Text style={styles.sparkleText}>✧</Text>
                </View>
                <Text style={styles.speechBubbleText}>
                  円の中をタップして、{'\n'}今の気持ちを選んでね
                </Text>
              </LinearGradient>
            </View>
          </View>

          {/* 感情円環 */}
          <EmotionWheel
            size={WHEEL_SIZE}
            labelMode={labelMode}
            onSelect={handleEmotionSelect}
            selectedPoint={beforePoint}
          />

          {/* 足あとブロック */}
          <FootprintsBlock
            totalCount={totalCount}
            startedAtISO={startedAtISO}
          />
        </View>

        {/* フッター部分：トレーニングへ進むボタン */}
        <View style={styles.footer}>
          <TouchableOpacity
            onPress={handleRecord}
            activeOpacity={0.8}
            disabled={!beforePoint}
            style={styles.recordButtonWrapper}
          >
            <LinearGradient
              colors={beforePoint ? ['#FF85A2', '#FFB6C1'] : ['#A0AEC0', '#B8C5D0']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.recordButton}
            >
              <Text style={styles.recordButtonText}>
                トレーニングへ進む
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
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  helpButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  helpButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderWidth: 2,
    borderColor: '#7AD7F0',
  },
  helpButtonText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#5A6B7C',
  },
  wheelContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 20,
  },
  guideContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  mascotWrapper: {
    alignItems: 'center',
  },
  sessionCountText: {
    fontSize: 13,
    color: '#5A6B7C',
    fontWeight: '600',
    marginBottom: 4,
  },
  mascotImage: {
    width: 110,
    height: 110,
  },
  speechBubbleContainer: {
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
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderWidth: 2,
    borderColor: 'rgba(255, 182, 193, 0.5)',
    // ピンク系のやさしい影
    shadowColor: '#FFB6C1',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
    position: 'relative',
  },
  sparkleTopRight: {
    position: 'absolute',
    top: -6,
    right: -4,
  },
  sparkleText: {
    fontSize: 14,
    color: '#FFB6C1',
  },
  speechBubbleText: {
    fontSize: 14,
    color: '#5A6B7C',
    fontWeight: '600',
    lineHeight: 21,
    letterSpacing: 0.2,
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    alignItems: 'center',
  },
  recordButtonWrapper: {
    borderRadius: 25,
    // やさしい影
    shadowColor: '#FF85A2',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  recordButton: {
    borderRadius: 25,
    paddingVertical: 12,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
