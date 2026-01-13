import React, { useEffect, useState, useRef, useCallback } from 'react';
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
import { useTrainingMode, TrainingMode } from '@/hooks/useTrainingMode';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// 瞑想の長さ（秒）
const MEDITATION_DURATION = 30;

// メニューIDの型定義
type MenuId = 'release_breath' | 'sense_energy' | 'ground_body' | 'calm_stay';

// 音声ガイドの種類
type VoiceType = 'rina' | 'rinawan';

// メニューIDに対応する音声ファイル（りなさんの声）
const AUDIO_FILES_RINA = {
  release_breath: require('@/assets/sounds/release_breath_30s.m4a'),
  sense_energy: require('@/assets/sounds/sense_energy_30s.m4a'),
  ground_body: require('@/assets/sounds/ground_body_30s.m4a'),
  calm_stay: require('@/assets/sounds/calm_stay_30s.m4a'),
} as const;

// メニューIDに対応する音声ファイル（りなわんの声）
const AUDIO_FILES_RINAWAN = {
  release_breath: require('@/assets/sounds/rinawan_release_breath_30s.mp3'),
  sense_energy: require('@/assets/sounds/rinawan_sense_energy_30s.mp3'),
  ground_body: require('@/assets/sounds/rinawan_ground_body_30s.mp3'),
  calm_stay: require('@/assets/sounds/rinawan_calm_stay_30s.mp3'),
} as const;

// メニューIDに対応するりなわんGIF
const MASCOT_GIFS = {
  release_breath: require('@/assets/images/rinawan_exhaling.gif'),
  sense_energy: require('@/assets/images/rinawan_feeling_energy.gif'),
  ground_body: require('@/assets/images/rinawan_putting_body_weight.gif'),
  calm_stay: require('@/assets/images/rinawan_breathing_eye-closed.gif'),
} as const;

// モード別のUI表示テキスト
type MenuUIItem = { title: string; guideText: string };

const MENU_UI: Record<TrainingMode, Record<MenuId, MenuUIItem>> = {
  // 直感モード（既存の文言）
  intuitive: {
    release_breath: {
      title: '呼吸の出口を感じる30秒',
      guideText: '今の状態を変えようとせず、吐く息が自然に出ていく感覚だけを感じてみます。',
    },
    sense_energy: {
      title: '今のエネルギーを感じる30秒',
      guideText: 'この元気さや高まりが、体のどこにあるかをそのまま感じてみます。',
    },
    ground_body: {
      title: '体の重さをあずける30秒',
      guideText: '呼吸にこだわらず、体の重さがどこにあずけられているかを感じてみます。',
    },
    calm_stay: {
      title: '呼吸を感じる30秒',
      guideText: '今の呼吸の出入りを、そのまま感じてみよう。',
    },
  },
  // 言語化モード
  verbal: {
    release_breath: {
      title: '焦りを整える30秒',
      guideText: '焦りや苛立ちを、無理に変えずに見つめてみます。',
    },
    sense_energy: {
      title: '高揚感を味わう30秒',
      guideText: '今の高揚感や喜びを、そのまま味わってみます。',
    },
    ground_body: {
      title: '悲しみを整える30秒',
      guideText: '悲しみや落ち込みを、無理に変えずに見つめてみます。',
    },
    calm_stay: {
      title: '穏やかさを感じる30秒',
      guideText: '今の穏やかな気持ちを、そのまま感じてみます。',
    },
  },
};

// メニューごとの背景色定義
const MENU_COLORS: Record<MenuId, {
  backgroundGradient: [string, string];
}> = {
  release_breath: {
    backgroundGradient: ['#D4A5E8', '#E8D0F0'],  // ピンク寄りの淡い紫
  },
  sense_energy: {
    backgroundGradient: ['#FFB6C1', '#FFDCE4'],  // 現行ピンク（淡め）
  },
  ground_body: {
    backgroundGradient: ['#A5B8E8', '#D0DEF0'],  // ブルー寄りの淡い紫
  },
  calm_stay: {
    backgroundGradient: ['#7AD7C8', '#CDEEF0'],  // グリーン寄りの淡いブルー
  },
};

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
    menuId: MenuId;
  }>();

  // menuId を取得（デフォルトは calm_stay）
  const menuId: MenuId = (params.menuId as MenuId) || 'calm_stay';

  // トレーニングモードを取得
  const { mode } = useTrainingMode();

  // 経過時間（秒）
  const [elapsed, setElapsed] = useState(0);

  // 音声ガイドの状態
  const [audioGuideActive, setAudioGuideActive] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<VoiceType>('rinawan');

  // ヘッドフォン接続検出
  const isHeadphoneConnected = useHeadphoneDetection();
  const autoPlayTriggeredRef = useRef(false);

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

      // 選択された声に対応する音声ファイルを読み込み・再生
      const audioFiles = selectedVoice === 'rina' ? AUDIO_FILES_RINA : AUDIO_FILES_RINAWAN;
      const audioFile = audioFiles[menuId];
      console.log('音声ガイド開始:', menuId, '声:', selectedVoice);
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
  }, [audioGuideActive, audioLoading, selectedVoice, menuId]);

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

  /**
   * ヘッドフォン接続時の自動再生
   */
  useEffect(() => {
    // 一度だけ自動再生（ヘッドフォン接続中で、まだ再生していない場合）
    if (isHeadphoneConnected && !autoPlayTriggeredRef.current && !audioGuideActive) {
      autoPlayTriggeredRef.current = true;
      // 少し遅延させて画面表示後に再生
      const timer = setTimeout(() => {
        console.log('ヘッドフォン検出: 音声ガイド自動再生');
        playAudioGuide();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isHeadphoneConnected, audioGuideActive, playAudioGuide]);

  // プログレスの割合（0〜1）
  const progress = elapsed / MEDITATION_DURATION;

  return (
    <LinearGradient
      colors={MENU_COLORS[menuId].backgroundGradient}
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
            {/* タイトル */}
            <Text style={styles.title}>
              {MENU_UI[mode][menuId].title}
            </Text>

            {/* りなわんGIF */}
            <View style={styles.mascotContainer}>
              <Image
                source={MASCOT_GIFS[menuId]}
                style={styles.mascotImage}
                resizeMode="contain"
              />
            </View>

            {/* ガイド文 */}
            <Text style={styles.guideText}>
              {MENU_UI[mode][menuId].guideText}
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
          </View>

          {/* フッター：音声ガイド */}
          <View style={styles.footer}>
            {/* 声の選択 */}
            {!audioGuideActive && !audioLoading && (
              <View style={styles.voiceSelector}>
                <Text style={styles.voiceSelectorLabel}>音声ガイドの声：</Text>
                <View style={styles.voiceButtons}>
                  <TouchableOpacity
                    onPress={() => setSelectedVoice('rinawan')}
                    style={[
                      styles.voiceButton,
                      selectedVoice === 'rinawan' && styles.voiceButtonSelected,
                    ]}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.voiceButtonText,
                      selectedVoice === 'rinawan' && styles.voiceButtonTextSelected,
                    ]}>
                      りなわん
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setSelectedVoice('rina')}
                    style={[
                      styles.voiceButton,
                      selectedVoice === 'rina' && styles.voiceButtonSelected,
                    ]}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.voiceButtonText,
                      selectedVoice === 'rina' && styles.voiceButtonTextSelected,
                    ]}>
                      りなさん
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* 再生ボタン */}
            {audioLoading ? (
              <Text style={styles.audioGuideHint}>
                読み込み中...
              </Text>
            ) : (
              <TouchableOpacity
                onPress={handleAudioGuide}
                activeOpacity={0.7}
              >
                <Text style={styles.audioGuideButton}>
                  {audioGuideActive ? '🔇 音声ガイドを止める' : '🔊 音声ガイドを使う'}
                </Text>
              </TouchableOpacity>
            )}
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

  // フッター
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    alignItems: 'center',
  },
  voiceSelector: {
    alignItems: 'center',
    marginBottom: 16,
  },
  voiceSelectorLabel: {
    fontSize: 12,
    color: '#718096',
    marginBottom: 8,
  },
  voiceButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  voiceButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  voiceButtonSelected: {
    backgroundColor: 'rgba(255, 133, 162, 0.2)',
    borderColor: '#FF85A2',
  },
  voiceButtonText: {
    fontSize: 13,
    color: '#718096',
    fontWeight: '500',
  },
  voiceButtonTextSelected: {
    color: '#FF85A2',
    fontWeight: '600',
  },
  audioGuideButton: {
    fontSize: 14,
    color: '#5A6B7C',
    fontWeight: '500',
  },
  audioGuideHint: {
    fontSize: 14,
    color: '#A0AEC0',
    fontWeight: '500',
  },
});
