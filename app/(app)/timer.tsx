import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Vibration,
  AppState,
  AppStateStatus,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { createSessionLog, updateSessionLog, getUserId } from '@/lib/api';
import { getMeditationGroup, getGuideFile, MEDITATION_GUIDE_GROUPS, type MeditationGroupId } from '@/lib/meditationGuides';

// 環境音の型
type AmbientSoundItem = {
  id: string;
  file: number;
  label: string;
};

// 環境音ファイル（6種類）
const AMBIENT_SOUNDS: AmbientSoundItem[] = [
  { id: 'birds', file: require('@/assets/sounds/birds.mp3'), label: '小鳥' },
  { id: 'river', file: require('@/assets/sounds/river.mp3'), label: '川' },
  { id: 'rain', file: require('@/assets/sounds/rain.mp3'), label: '雨' },
  { id: 'wave', file: require('@/assets/sounds/ocean_waves.mp3'), label: '波' },
  { id: 'bonfire', file: require('@/assets/sounds/fire_crackling.mp3'), label: '焚き火' },
  { id: 'singing_bowls', file: require('@/assets/sounds/singing_bowls.mp3'), label: 'シンギングボール' },
];

// フェードアウト開始時間（秒）- 終了の何秒前からフェードアウトするか
const FADE_DURATION = 5;

/**
 * TimerScreen - タイマー画面
 *
 * 選択された時間のカウントダウンを表示し、
 * 終了時にafter画面へ遷移します。
 */
export default function TimerScreen() {
  const params = useLocalSearchParams<{
    bodyValue: string;
    mindValue: string;
    reactivityValue: string;
    duration: string;
    mode: string;
  }>();

  const mode = (params.mode ?? 'timer') as 'timer' | 'ambient' | 'guided';
  const durationMinutes = parseFloat(params.duration ?? '5');
  const totalSeconds = Math.round(durationMinutes * 60);

  const [remainingSeconds, setRemainingSeconds] = useState(totalSeconds);
  const [isPaused, setIsPaused] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appState = useRef(AppState.currentState);
  const backgroundTimeRef = useRef<number | null>(null);
  const sessionCreatedRef = useRef(false);
  const sessionIdRef = useRef<string | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const fadeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ランダムに選択した環境音/瞑想ガイドを保持
  const selectedAmbientSound = useMemo((): AmbientSoundItem | null => {
    if (mode === 'ambient') {
      const randomIndex = Math.floor(Math.random() * AMBIENT_SOUNDS.length);
      return AMBIENT_SOUNDS[randomIndex];
    }
    return null;
  }, [mode]);

  const selectedGuideGroupId = useMemo((): MeditationGroupId | null => {
    if (mode === 'guided') {
      const bodyVal = parseFloat(params.bodyValue ?? '0');
      const mindVal = parseFloat(params.mindValue ?? '0');
      return getMeditationGroup(bodyVal, mindVal);
    }
    return null;
  }, [mode, params.bodyValue, params.mindValue]);

  const selectedGuideLabel = selectedGuideGroupId
    ? MEDITATION_GUIDE_GROUPS[selectedGuideGroupId].label
    : null;

  // 完了時の吹き出しアニメーション
  const bubbleAnim = useRef(new Animated.Value(0)).current;
  const sparkle1Anim = useRef(new Animated.Value(0)).current;
  const sparkle2Anim = useRef(new Animated.Value(0)).current;
  const sparkle3Anim = useRef(new Animated.Value(0)).current;

  // 環境音/瞑想ガイドの読み込みと再生
  useEffect(() => {
    if (mode === 'timer') return;
    if (mode === 'ambient' && !selectedAmbientSound) return;
    if (mode === 'guided' && !selectedGuideGroupId) return;

    const loadAndPlaySound = async () => {
      try {
        // オーディオモードの設定
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
        });

        let soundFile;
        if (mode === 'ambient' && selectedAmbientSound) {
          soundFile = selectedAmbientSound.file;
        } else if (mode === 'guided' && selectedGuideGroupId) {
          soundFile = getGuideFile(selectedGuideGroupId, durationMinutes as 1 | 5 | 10);
        }

        if (!soundFile) return;

        const { sound } = await Audio.Sound.createAsync(
          soundFile,
          {
            shouldPlay: true,
            isLooping: mode === 'ambient',
          }
        );
        soundRef.current = sound;
      } catch (error) {
        console.error('Failed to load sound:', error);
      }
    };

    loadAndPlaySound();

    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      if (fadeIntervalRef.current) {
        clearInterval(fadeIntervalRef.current);
      }
    };
  }, [mode, selectedAmbientSound, selectedGuideGroupId, durationMinutes]);

  // タイマー開始時にセッションログを作成
  useEffect(() => {
    if (sessionCreatedRef.current) return;

    const createSession = async () => {
      sessionCreatedRef.current = true;
      try {
        const userId = await getUserId();
        const now = new Date().toISOString();
        const beforeMind = parseFloat(params.mindValue ?? '0');

        const session = await createSessionLog({
          userId,
          timestamp: now,
          beforeMentalCondition: beforeMind,
          meditationType: selectedGuideGroupId ?? mode,
          settingDuration: durationMinutes * 60,
          meditationMode: mode,
        });

        if (session?.id) {
          sessionIdRef.current = session.id;
          console.log('Session created:', session.id);
        }
      } catch (error) {
        console.error('Failed to create session:', error);
      }
    };

    createSession();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // バックグラウンド対応
  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [remainingSeconds, isPaused]);

  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (
      appState.current.match(/inactive|background/) &&
      nextAppState === 'active'
    ) {
      // フォアグラウンドに戻った
      if (backgroundTimeRef.current && !isPaused && !isComplete) {
        const elapsed = Math.floor((Date.now() - backgroundTimeRef.current) / 1000);
        setRemainingSeconds(prev => Math.max(0, prev - elapsed));
      }
      backgroundTimeRef.current = null;
    } else if (nextAppState.match(/inactive|background/)) {
      // バックグラウンドに移行
      backgroundTimeRef.current = Date.now();
    }
    appState.current = nextAppState;
  };

  // タイマー処理
  useEffect(() => {
    if (isPaused || isComplete) {
      return;
    }

    timerRef.current = setInterval(() => {
      setRemainingSeconds(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          handleTimerComplete();
          return 0;
        }

        // 環境音のフェードアウト処理
        if (mode === 'ambient' && soundRef.current && prev <= FADE_DURATION) {
          const volume = (prev - 1) / FADE_DURATION;
          soundRef.current.setVolumeAsync(Math.max(0, volume));
        }

        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isPaused, isComplete, mode]);

  // 完了時にアニメーション開始
  useEffect(() => {
    if (!isComplete) return;

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

    // キラキラアニメーション
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
  }, [isComplete]);

  const handleTimerComplete = useCallback(async () => {
    setIsComplete(true);

    // 音声を停止
    if (soundRef.current) {
      await soundRef.current.stopAsync();
    }

    // 実績時間を記録
    if (sessionIdRef.current) {
      try {
        await updateSessionLog(sessionIdRef.current, undefined, totalSeconds);
      } catch (error) {
        console.error('Failed to update actualDuration:', error);
      }
    }

    // 振動
    Vibration.vibrate([0, 500, 200, 500]);

    // after画面へ遷移（少し待ってから）
    setTimeout(() => {
      router.replace({
        pathname: '/after',
        params: {
          sessionId: sessionIdRef.current ?? '',
          bodyValue: params.bodyValue,
          mindValue: params.mindValue,
          reactivityValue: params.reactivityValue,
          meditationGuideId: selectedGuideGroupId ?? mode,
        },
      });
    }, 1500);
  }, [params.bodyValue, params.mindValue, params.reactivityValue, selectedGuideGroupId, mode]);

  const handlePause = useCallback(async () => {
    // 音声の一時停止/再開
    if (soundRef.current) {
      if (isPaused) {
        await soundRef.current.playAsync();
      } else {
        await soundRef.current.pauseAsync();
      }
    }
    setIsPaused(prev => !prev);
  }, [isPaused]);

  const handleCancel = useCallback(async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    // 音声を停止
    if (soundRef.current) {
      await soundRef.current.stopAsync();
    }

    // 実績時間を記録
    const actualSeconds = totalSeconds - remainingSeconds;
    if (sessionIdRef.current && actualSeconds > 0) {
      try {
        await updateSessionLog(sessionIdRef.current, undefined, actualSeconds);
      } catch (error) {
        console.error('Failed to update actualDuration:', error);
      }
    }

    // after画面へ遷移
    router.replace({
      pathname: '/after',
      params: {
        sessionId: sessionIdRef.current ?? '',
        bodyValue: params.bodyValue,
        mindValue: params.mindValue,
        reactivityValue: params.reactivityValue,
        meditationGuideId: selectedGuideGroupId ?? mode,
      },
    });
  }, [totalSeconds, remainingSeconds, params.bodyValue, params.mindValue, params.reactivityValue, selectedGuideGroupId, mode]);

  // 時間表示フォーマット
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // 進捗率
  const progress = 1 - remainingSeconds / totalSeconds;

  // モード表示
  const getModeLabel = () => {
    switch (mode) {
      case 'ambient':
        return selectedAmbientSound ? selectedAmbientSound.label : '環境音';
      case 'guided':
        return selectedGuideLabel ?? '瞑想ガイド';
      default:
        return '';
    }
  };

  return (
    <LinearGradient
      colors={['#7AD7F0', '#CDECF6']}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>

        {/* モード表示（環境音/瞑想ガイドの場合） */}
        {mode !== 'timer' && (
          <View style={styles.modeIndicator}>
            <Ionicons
              name={mode === 'ambient' ? 'leaf-outline' : 'headset-outline'}
              size={16}
              color="#718096"
            />
            <Text style={styles.modeIndicatorText}>{getModeLabel()}</Text>
          </View>
        )}

        {/* タイマー表示 */}
        <View style={styles.timerSection}>
          <View style={styles.timerCircle}>
            {/* プログレスリング */}
            <View style={styles.progressRing}>
              <View
                style={[
                  styles.progressFill,
                  { transform: [{ rotate: `${progress * 360}deg` }] },
                ]}
              />
            </View>
            <Text style={styles.timerText}>{formatTime(remainingSeconds)}</Text>
          </View>
        </View>

        {/* りなわん */}
        <View style={styles.mascotSection}>
          {!isComplete ? (
            <>
              <Image
                source={require('@/assets/images/rinawan_breathing.gif')}
                style={styles.mascotImage}
                resizeMode="contain"
              />
              <Text style={styles.breathingHint}>
                りなわんと一緒に{'\n'}ゆっくり呼吸してみよう
              </Text>
            </>
          ) : (
            <View style={styles.completeMascotRow}>
              <Image
                source={require('@/assets/images/rinawan_breathing.gif')}
                style={styles.mascotImageSmall}
                resizeMode="contain"
              />
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
                    おつかれさま！
                  </Text>
                </LinearGradient>
              </Animated.View>
            </View>
          )}
        </View>

        {/* コントロールボタン */}
        {!isComplete && (
          <View style={styles.controlsSection}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancel}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={24} color="#718096" />
              <Text style={styles.cancelButtonText}>やめる</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.pauseButton}
              onPress={handlePause}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={isPaused ? ['#5ABFB0', '#7AD7F0'] : ['#FF85A2', '#FFB6C1']}
                style={styles.pauseButtonGradient}
              >
                <Ionicons
                  name={isPaused ? 'play' : 'pause'}
                  size={32}
                  color="#FFFFFF"
                />
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.spacer} />
          </View>
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

  // モード表示
  modeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    gap: 6,
  },
  modeIndicatorText: {
    fontSize: 14,
    color: '#718096',
    fontWeight: '500',
  },

  // タイマー
  timerSection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  timerCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF85A2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  progressRing: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 4,
    borderColor: 'rgba(255, 182, 193, 0.3)',
  },
  progressFill: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 4,
    borderColor: '#FF85A2',
    borderLeftColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  timerText: {
    fontSize: 48,
    fontWeight: '300',
    color: '#4A5568',
    fontVariant: ['tabular-nums'],
  },

  // りなわん
  mascotSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mascotImage: {
    width: 160,
    height: 160,
  },
  breathingHint: {
    marginTop: 16,
    fontSize: 14,
    color: '#718096',
    textAlign: 'center',
    lineHeight: 22,
  },
  completeMascotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mascotImageSmall: {
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
    fontSize: 14,
    color: '#5A6B7C',
    fontWeight: '600',
    lineHeight: 20,
    textAlign: 'center',
  },

  // コントロール
  controlsSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 40,
    paddingBottom: 40,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    gap: 4,
  },
  cancelButtonText: {
    fontSize: 14,
    color: '#718096',
    fontWeight: '500',
  },
  pauseButton: {
    borderRadius: 35,
    shadowColor: '#FF85A2',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  pauseButtonGradient: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spacer: {
    width: 80,
  },
});
