import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { createSessionLog, getUserId } from '@/lib/api';
import { useHeadphoneDetection } from '@/hooks/useHeadphoneDetection';
import { usePreferences } from '@/hooks/usePreferences';
import {
  MenuId,
  getTrainingContent,
  isValidMenuId,
} from '@/constants/trainingContents';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// 瞑想の長さ（秒）
const MEDITATION_DURATION = 30;

/**
 * MeditationScreen - 瞑想実行画面（⑤）
 *
 * この画面はマインドフルネス体験の中核です。
 *
 * 思想的制約：
 * - 評価しない（良い・悪い・成功・失敗を示さない）
 * - 指示しすぎない（呼吸を数えさせない、リズムを強制しない）
 * - 変えようとしない（今の状態のままでOK）
 * - 操作を最小限にする
 *
 * ユーザーに「正しくやらせる」ことは目的ではありません。
 * ただ30秒、今の状態と一緒にいられる体験を提供します。
 */
export default function MeditationScreen() {
  // beforePoint と menuId を受け取る
  const params = useLocalSearchParams<{
    beforeX: string;
    beforeY: string;
    beforeR: string;
    beforeTheta: string;
    menuId: string;
  }>();

  // menuId を取得（デフォルトは calm_stay）
  const menuId: MenuId = isValidMenuId(params.menuId || '')
    ? (params.menuId as MenuId)
    : 'calm_stay';

  // 設定を取得
  const { trainingMode, voice } = usePreferences();

  // コンテンツマスターから該当コンテンツを取得
  const content = useMemo(() => getTrainingContent(menuId), [menuId]);

  // 経過時間（秒）
  const [elapsed, setElapsed] = useState(0);

  // 音声ガイドの状態
  const [audioGuideActive, setAudioGuideActive] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);

  // ヘッドフォン接続検出
  const isHeadphoneConnected = useHeadphoneDetection();

  // SessionLog ID（瞑想開始時に作成）
  const sessionIdRef = useRef<string | null>(null);
  const sessionCreatedRef = useRef(false);

  // フェードアウト用のアニメーション値
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // タイマーの参照（クリーンアップ用）
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 音声オブジェクトの参照
  const soundRef = useRef<Audio.Sound | null>(null);

  /**
   * 瞑想開始時に SessionLog を作成（before のみ）
   */
  useEffect(() => {
    if (sessionCreatedRef.current) return;

    const createSession = async () => {
      sessionCreatedRef.current = true;

      try {
        const userId = await getUserId();
        const now = new Date().toISOString();
        const bx = parseFloat(params.beforeX || '0');
        const by = parseFloat(params.beforeY || '0');

        const result = await createSessionLog({
          userId,
          timestamp: now,
          beforeValence: bx,
          beforeArousal: by,
          meditationType: menuId,
          duration: 30,
        });

        sessionIdRef.current = result.id;
        console.log('=== SessionLog 作成（before）===');
        console.log(result);
      } catch (error) {
        console.error('SessionLog 作成エラー:', error);
      }
    };

    createSession();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * 30秒タイマーの開始と終了処理
   */
  useEffect(() => {
    // 1秒ごとに経過時間を更新
    timerRef.current = setInterval(() => {
      setElapsed(prev => {
        const next = prev + 1;

        // 30秒経過したら終了処理
        if (next >= MEDITATION_DURATION) {
          // タイマーをクリア
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }

          // フェードアウトして次画面へ
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 800,
            useNativeDriver: true,
          }).start(() => {
            // ⑥ After画面へ遷移（sessionIdのみ渡す）
            router.replace({
              pathname: '/after',
              params: {
                sessionId: sessionIdRef.current || '',
              },
            });
          });
        }

        return next;
      });
    }, 1000);

    // クリーンアップ（戻る操作やunmount時）
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      // 音声の停止とアンロード
      if (soundRef.current) {
        soundRef.current.stopAsync();
        soundRef.current.unloadAsync();
        soundRef.current = null;
      }
    };
  }, [fadeAnim]);

  /**
   * 戻るボタンのハンドラ
   */
  const handleBack = () => {
    router.back();
  };

  /**
   * 音声ガイドを再生する（共通ロジック）
   * コンテンツマスターから voice に応じた音声ファイルを取得
   */
  const playAudioGuide = useCallback(async () => {
    if (audioGuideActive || audioLoading) return;

    try {
      setAudioLoading(true);

      // オーディオモードの設定
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });

      // コンテンツマスターから音声ファイルを取得
      const audioFile = content.audio[voice];
      console.log('音声ガイド開始:', menuId, '声:', voice);

      const { sound } = await Audio.Sound.createAsync(
        audioFile,
        { shouldPlay: true, volume: 1.0 }
      );

      soundRef.current = sound;
      setAudioGuideActive(true);
      setAudioLoading(false);

      // 再生終了時の処理
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setAudioGuideActive(false);
          sound.unloadAsync();
          soundRef.current = null;
        }
      });
    } catch (error) {
      console.log('音声ガイドの再生エラー:', error);
      setAudioLoading(false);
      setAudioGuideActive(false);
    }
  }, [audioGuideActive, audioLoading, voice, menuId, content.audio]);

  /**
   * 音声ガイドを停止する
   */
  const stopAudioGuide = useCallback(async () => {
    if (soundRef.current) {
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
      soundRef.current = null;
      setAudioGuideActive(false);
    }
  }, []);

  /**
   * 音声ガイドボタンのハンドラ
   */
  const handleAudioGuide = async () => {
    // すでに再生中なら停止
    if (audioGuideActive && soundRef.current) {
      await stopAudioGuide();
      return;
    }

    await playAudioGuide();
  };

  // 前回のイヤホン接続状態を保持
  const prevHeadphoneConnectedRef = useRef<boolean | null>(null);

  /**
   * イヤホン接続状態に応じた音声制御
   * - 接続時：音声を再生
   * - 切断時：音声を停止
   */
  useEffect(() => {
    const prevConnected = prevHeadphoneConnectedRef.current;

    // 初回レンダリング時（画面表示後に判定）
    if (prevConnected === null) {
      prevHeadphoneConnectedRef.current = isHeadphoneConnected;
      if (isHeadphoneConnected && !audioGuideActive) {
        // イヤホン接続中で画面を開いた場合、少し遅延して再生
        const timer = setTimeout(() => {
          console.log('初回: イヤホン接続中 → 音声ガイド再生');
          playAudioGuide();
        }, 1000);
        return () => clearTimeout(timer);
      }
      return;
    }

    // イヤホンを付けた時（未接続 → 接続）
    if (!prevConnected && isHeadphoneConnected) {
      console.log('イヤホン接続: 音声ガイド再生');
      playAudioGuide();
    }

    // イヤホンを外した時（接続 → 未接続）
    if (prevConnected && !isHeadphoneConnected) {
      console.log('イヤホン切断: 音声ガイド停止');
      stopAudioGuide();
    }

    prevHeadphoneConnectedRef.current = isHeadphoneConnected;
  }, [isHeadphoneConnected, audioGuideActive, playAudioGuide, stopAudioGuide]);

  // プログレスの割合（0〜1）
  const progress = elapsed / MEDITATION_DURATION;

  return (
    <LinearGradient
      colors={content.colors.backgroundGradient}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
          {/* ヘッダー：戻るボタン */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={handleBack}
              style={styles.backButton}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={24} color="#5A6B7C" />
            </TouchableOpacity>
          </View>

          {/* メインコンテンツ */}
          <View style={styles.mainContent}>
            {/* タイトル（trainingModeで切り替え） */}
            <Text style={styles.title}>
              {content.title[trainingMode]}
            </Text>

            {/* りなわんGIF（コンテンツマスターから取得） */}
            <View style={styles.mascotContainer}>
              <Image
                source={content.mascotGif}
                style={styles.mascotImage}
                resizeMode="contain"
              />
            </View>

            {/* ガイド文（trainingModeで切り替え） */}
            <Text style={styles.guideText}>
              {content.description[trainingMode]}
            </Text>

            {/* プログレス表示（円形リング） */}
            <View style={styles.progressContainer}>
              <View style={styles.progressRing}>
                {/* 背景リング */}
                <View style={styles.progressBackground} />
                {/* プログレスリング（SVGを使わずシンプルに表現） */}
                <View
                  style={[
                    styles.progressFill,
                    {
                      // 擬似的なプログレス表現（横バー）
                      width: `${progress * 100}%`,
                    },
                  ]}
                />
              </View>
            </View>

            {/* 音声ガイドボタン（プログレスバーの下） */}
            <View style={styles.audioGuideContainer}>
              {audioLoading ? (
                <View style={styles.audioGuideButtonLoading}>
                  <Text style={styles.audioGuideButtonLoadingText}>
                    読み込み中...
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={handleAudioGuide}
                  activeOpacity={0.8}
                  style={[
                    styles.audioGuideButtonWrapper,
                    audioGuideActive && styles.audioGuideButtonActive,
                  ]}
                >
                  <Ionicons
                    name={audioGuideActive ? 'pause-circle' : 'play-circle'}
                    size={24}
                    color={audioGuideActive ? '#FFFFFF' : '#FF85A2'}
                  />
                  <Text
                    style={[
                      styles.audioGuideButtonText,
                      audioGuideActive && styles.audioGuideButtonTextActive,
                    ]}
                  >
                    {audioGuideActive ? '音声ガイドを止める' : '音声ガイドを聴く'}
                  </Text>
                </TouchableOpacity>
              )}
              {/* 話者表示（再生中以外） */}
              {!audioGuideActive && !audioLoading && (
                <Text style={styles.voiceLabel}>
                  {voice === 'rina' ? '野村里奈' : 'りなわん'}の声
                </Text>
              )}
            </View>
          </View>

          {/* フッター：開発用表示 */}
          <View style={styles.footer}>
            <Text style={styles.devSettings}>
              mode={trainingMode} / voice={voice}
            </Text>
          </View>
        </Animated.View>
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
  content: {
    flex: 1,
  },

  // ヘッダー
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // メインコンテンツ
  mainContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  // タイトル
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: '#4A5568',
    textAlign: 'center',
    marginBottom: 32,
  },

  // りなわん
  mascotContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  mascotImage: {
    width: SCREEN_WIDTH * 0.45,
    height: SCREEN_WIDTH * 0.45,
    maxWidth: 200,
    maxHeight: 200,
  },

  // ガイド文
  guideText: {
    fontSize: 16,
    color: '#4A5568',
    textAlign: 'center',
    lineHeight: 26,
    fontWeight: '500',
    marginBottom: 40,
  },

  // プログレス表示
  progressContainer: {
    width: '80%',
    alignItems: 'center',
  },
  progressRing: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBackground: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  progressFill: {
    height: '100%',
    backgroundColor: 'rgba(255, 133, 162, 0.8)', // ピンク系
    borderRadius: 3,
  },

  // 音声ガイドボタン
  audioGuideContainer: {
    marginTop: 32,
    alignItems: 'center',
  },
  audioGuideButtonWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 28,
    gap: 10,
    shadowColor: '#FF85A2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 2,
    borderColor: 'rgba(255, 133, 162, 0.3)',
  },
  audioGuideButtonActive: {
    backgroundColor: '#FF85A2',
    borderColor: '#FF85A2',
    shadowOpacity: 0.4,
  },
  audioGuideButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FF85A2',
  },
  audioGuideButtonTextActive: {
    color: '#FFFFFF',
  },
  audioGuideButtonLoading: {
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  audioGuideButtonLoadingText: {
    fontSize: 14,
    color: '#A0AEC0',
    fontWeight: '500',
  },
  voiceLabel: {
    marginTop: 12,
    fontSize: 12,
    color: '#718096',
    fontWeight: '500',
  },

  // フッター
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    alignItems: 'center',
  },
  // 開発用設定表示（本番では削除）
  devSettings: {
    fontSize: 10,
    color: '#A0AEC0',
    textAlign: 'center',
  },
});
