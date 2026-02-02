import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { getSessionLog, updateSessionLog, SessionLog } from '@/lib/api';
import MindfulSlider from '@/components/MindfulSlider';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * マスコットメッセージ（Phase 2用）
 */
const MASCOT_MESSAGES = [
  'おつかれさま！\n今日も自分と過ごす時間をつくれたね。',
  'えらいね！\nまた気が向いたら会いに来てね。',
  'おつかれさま！\nどんな感覚でも、気づけたことがすばらしいよ。',
  'ありがとう！\n今の自分に気づけたね。',
  'がんばったね！\nゆっくり休んでね。',
];

/**
 * AfterScreen - トレーニング後記録画面
 *
 * Phase 1: スライダー2本 + メモ入力 + 記録ボタン
 * Phase 2: りなわん吹き出し + ホームへ戻る
 */
export default function AfterScreen() {
  const params = useLocalSearchParams<{
    sessionId: string;
    beforeMind: string;
  }>();

  const [session, setSession] = useState<SessionLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recorded, setRecorded] = useState(false);

  // スライダー値（ホーム画面で選んだ値を初期値に）
  const [mindValue, setMindValue] = useState(() => {
    const beforeMind = parseFloat(params.beforeMind ?? '0');
    return isNaN(beforeMind) ? 0 : beforeMind;
  });   // こころ: -1(ざわざわ) ~ +1(しずか)

  // メモ
  const [memo, setMemo] = useState('');

  // マスコットメッセージ（ランダム選択、一度決めたら変えない）
  const [mascotMessage] = useState(() =>
    MASCOT_MESSAGES[Math.floor(Math.random() * MASCOT_MESSAGES.length)]
  );

  /**
   * 画面表示時に SessionLog を取得
   */
  useEffect(() => {
    const fetchSession = async () => {
      if (!params.sessionId) {
        console.error('sessionId がありません');
        setLoading(false);
        return;
      }

      try {
        const result = await getSessionLog(params.sessionId);
        setSession(result);
      } catch (error) {
        console.error('SessionLog 取得エラー:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSession();
  }, [params.sessionId]);

  /**
   * 記録ボタン押下
   */
  const handleRecord = useCallback(async () => {
    if (!session?.id) return;

    setSaving(true);
    try {
      await updateSessionLog(
        session.id,
        0,            // afterValence: からだは削除されたので0
        mindValue,    // afterArousal: こころ
        memo || undefined,
      );
      setRecorded(true);
    } catch (error) {
      console.error('SessionLog 更新エラー:', error);
    } finally {
      setSaving(false);
    }
  }, [session?.id, mindValue, memo]);

  /**
   * ホームへ戻る
   */
  const handleGoHome = () => {
    router.replace('/');
  };

  // ローディング中
  if (loading) {
    return (
      <LinearGradient colors={['#7AD7F0', '#CDECF6']} style={styles.gradient}>
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FF85A2" />
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // セッションが見つからない場合（リフレッシュ時など）
  if (!session) {
    return (
      <LinearGradient colors={['#7AD7F0', '#CDECF6']} style={styles.gradient}>
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>
              セッション情報が見つかりません
            </Text>
            <Text style={styles.errorHint}>
              ページをリフレッシュした場合、{'\n'}記録が失われることがあります
            </Text>
            <TouchableOpacity
              onPress={handleGoHome}
              activeOpacity={0.8}
              style={styles.homeButtonWrapper}
            >
              <LinearGradient
                colors={['#FF85A2', '#FFB6C1']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.homeButton}
              >
                <Text style={styles.homeButtonText}>ホームへ戻る</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // Phase 2: 記録完了後
  if (recorded) {
    return (
      <LinearGradient colors={['#7AD7F0', '#CDECF6']} style={styles.gradient}>
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
          <View style={styles.phase2Content}>
            {/* 吹き出し */}
            <View style={styles.speechBubbleContainer}>
              <LinearGradient
                colors={['#FFF5F7', '#FFFFFF', '#FFF0F5']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.speechBubble}
              >
                <View style={styles.sparkleTopLeft}>
                  <Text style={styles.sparkleText}>✧</Text>
                </View>
                <View style={styles.sparkleBottomRight}>
                  <Text style={styles.sparkleText}>✧</Text>
                </View>
                <Text style={styles.speechBubbleText}>
                  {mascotMessage}
                </Text>
              </LinearGradient>
              <View style={styles.speechBubbleTailOuter}>
                <View style={styles.speechBubbleTail} />
              </View>
            </View>

            {/* りなわん GIF */}
            <Image
              source={require('@/assets/images/rinawan_laying_down.gif')}
              style={styles.mascotImage}
              resizeMode="contain"
            />
          </View>

          {/* ホームへ戻るボタン */}
          <View style={styles.footer}>
            <TouchableOpacity
              onPress={handleGoHome}
              activeOpacity={0.8}
              style={styles.buttonWrapper}
            >
              <LinearGradient
                colors={['#FF85A2', '#FFB6C1']}
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

  // Phase 1: 記録画面
  return (
    <LinearGradient colors={['#7AD7F0', '#CDECF6']} style={styles.gradient}>
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
              <Text style={styles.title}>トレーニング後の状態を教えてね！</Text>
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
                placeholder="トレーニング中の気づきや、今の感覚など自由に…（任意）"
                placeholderTextColor="#A0AEC0"
                value={memo}
                onChangeText={setMemo}
                multiline
                maxLength={200}
              />
            </View>
          </ScrollView>

          {/* 記録ボタン */}
          <View style={styles.footer}>
            <TouchableOpacity
              onPress={handleRecord}
              activeOpacity={0.8}
              disabled={saving}
              style={styles.buttonWrapper}
            >
              <LinearGradient
                colors={['#FF85A2', '#FFB6C1']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.button}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.buttonText}>この内容で記録する</Text>
                )}
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4A5568',
    marginBottom: 8,
  },
  errorHint: {
    fontSize: 14,
    color: '#718096',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  homeButtonWrapper: {
    borderRadius: 25,
    shadowColor: '#FF85A2',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  homeButton: {
    borderRadius: 25,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 0,
    paddingBottom: 80,
  },

  // タイトル
  titleWrapper: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 8,
    paddingHorizontal: 16,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
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
    fontSize: 16,
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

  // スライダー
  slidersContainer: {
    marginBottom: 24,
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
    minHeight: 80,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: 'rgba(255, 182, 193, 0.3)',
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
    shadowColor: '#FF85A2',
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

  // Phase 2: 確認画面
  phase2Content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  // 吹き出し
  speechBubbleContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  speechBubble: {
    borderRadius: 24,
    paddingVertical: 20,
    paddingHorizontal: 28,
    borderWidth: 2,
    borderColor: 'rgba(255, 182, 193, 0.5)',
    shadowColor: '#FFB6C1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
    position: 'relative',
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
    color: '#FFB6C1',
  },
  speechBubbleText: {
    fontSize: 15,
    color: '#5A6B7C',
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
    borderTopColor: '#FFF0F5',
  },

  // りなわん
  mascotImage: {
    width: SCREEN_WIDTH * 0.4,
    height: SCREEN_WIDTH * 0.4,
    maxWidth: 160,
    maxHeight: 160,
  },
});
