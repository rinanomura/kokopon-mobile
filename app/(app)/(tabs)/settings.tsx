import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Switch,
  ActivityIndicator,
  Modal,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { signOut } from 'aws-amplify/auth';
import { router } from 'expo-router';
import { usePreferences, TrainingMode, VoiceType, GuideMode, AmbientSound, NotificationTime, DesignTheme } from '@/hooks/usePreferences';
import { useThemeColors } from '@/hooks/useThemeColors';
import { resetClient } from '@/lib/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  useGoogleAuth,
  exchangeCodeForToken,
  fetchCalendarList,
  CalendarInfo,
} from '@/lib/googleCalendar';
import {
  requestNotificationPermission,
  checkNotificationPermission,
  setupNotificationChannel,
  scheduleAllNotifications,
  cancelNotification,
  setupNotificationHandler,
} from '@/lib/notifications';

/**
 * SettingsScreen - 設定画面
 *
 * ユーザー設定・ログアウト・カレンダー連携管理
 */
export default function SettingsScreen() {
  // トレーニングモード・音声設定・ガイドモード・通知設定
  const {
    trainingMode,
    setTrainingMode,
    voice,
    setVoice,
    guideMode,
    setGuideMode,
    ambientSound,
    setAmbientSound,
    notificationTimes,
    addNotificationTime,
    updateNotificationTime,
    removeNotificationTime,
    designTheme,
    setDesignTheme,
  } = usePreferences();
  const colors = useThemeColors();

  // Googleカレンダー連携
  const { request, response, promptAsync, redirectUri } = useGoogleAuth();

  const [calendars, setCalendars] = useState<CalendarInfo[]>([]);
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  // 通知関連
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [editingNotificationId, setEditingNotificationId] = useState<string | null>(null);
  const [tempHour, setTempHour] = useState(20);
  const [tempMinute, setTempMinute] = useState(0);

  const handleModeChange = (newMode: TrainingMode) => {
    setTrainingMode(newMode);
  };

  const handleVoiceChange = (newVoice: VoiceType) => {
    setVoice(newVoice);
  };

  const handleGuideModeChange = (newMode: GuideMode) => {
    setGuideMode(newMode);
  };

  const handleAmbientSoundChange = (newSound: AmbientSound) => {
    setAmbientSound(newSound);
  };

  // 通知ハンドラーの初期設定
  useEffect(() => {
    setupNotificationHandler();
    setupNotificationChannel();
  }, []);

  // 通知設定が変更されたらスケジュールを更新
  useEffect(() => {
    if (notificationTimes.length > 0) {
      scheduleAllNotifications(notificationTimes);
    }
  }, [notificationTimes]);

  /**
   * 新しい通知を追加
   */
  const handleAddNotification = async () => {
    // パーミッションを確認
    const hasPermission = await checkNotificationPermission();
    if (!hasPermission) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        Alert.alert(
          '通知の許可が必要です',
          '設定アプリから通知を許可してください。',
          [{ text: 'OK' }]
        );
        return;
      }
    }
    // 新規追加モードでモーダルを開く
    setEditingNotificationId(null);
    setTempHour(20);
    setTempMinute(0);
    setShowTimePicker(true);
  };

  /**
   * 通知の時刻を編集
   */
  const handleEditNotification = (notification: NotificationTime) => {
    setEditingNotificationId(notification.id);
    setTempHour(notification.hour);
    setTempMinute(notification.minute);
    setShowTimePicker(true);
  };

  /**
   * 通知の有効/無効を切り替え
   */
  const handleToggleNotification = async (id: string, enabled: boolean) => {
    if (enabled) {
      const hasPermission = await checkNotificationPermission();
      if (!hasPermission) {
        const granted = await requestNotificationPermission();
        if (!granted) {
          Alert.alert(
            '通知の許可が必要です',
            '設定アプリから通知を許可してください。',
            [{ text: 'OK' }]
          );
          return;
        }
      }
    }
    await updateNotificationTime(id, { enabled });
  };

  /**
   * 通知を削除
   */
  const handleDeleteNotification = (id: string) => {
    Alert.alert(
      'リマインダーを削除',
      'このリマインダーを削除しますか？',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除',
          style: 'destructive',
          onPress: async () => {
            await cancelNotification(id);
            await removeNotificationTime(id);
          },
        },
      ]
    );
  };

  /**
   * 時刻選択を確定
   */
  const handleConfirmTime = async () => {
    setShowTimePicker(false);
    if (editingNotificationId) {
      // 編集モード
      await updateNotificationTime(editingNotificationId, {
        hour: tempHour,
        minute: tempMinute,
      });
    } else {
      // 新規追加モード
      await addNotificationTime(tempHour, tempMinute);
    }
  };

  /**
   * 時刻をフォーマット
   */
  const formatTime = (hour: number, minute: number): string => {
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  };

  /**
   * 保存済みのカレンダー情報を読み込む
   */
  useEffect(() => {
    const loadCalendarSettings = async () => {
      try {
        const savedToken = await AsyncStorage.getItem('googleAccessToken');
        const savedCalendars = await AsyncStorage.getItem('googleCalendars');
        const savedCalendarIds = await AsyncStorage.getItem('selectedCalendarIds');

        if (savedToken && savedCalendars) {
          setCalendars(JSON.parse(savedCalendars));
          setIsConnected(true);
        }

        if (savedCalendarIds) {
          setSelectedCalendarIds(JSON.parse(savedCalendarIds));
        }
      } catch (error) {
        console.error('Load calendar settings error:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCalendarSettings();
  }, []);

  /**
   * OAuth レスポンス処理
   */
  useEffect(() => {
    if (response?.type === 'success' && response.params.code && request?.codeVerifier) {
      handleAuthSuccess(response.params.code, request.codeVerifier);
    }
  }, [response]);

  /**
   * 認証成功時の処理
   */
  const handleAuthSuccess = async (code: string, codeVerifier: string) => {
    setConnecting(true);
    try {
      const token = await exchangeCodeForToken(code, codeVerifier, redirectUri);
      if (token) {
        // アクセストークンを保存
        await AsyncStorage.setItem('googleAccessToken', token);

        // カレンダー一覧を取得
        const calendarList = await fetchCalendarList(token);
        setCalendars(calendarList);
        setIsConnected(true);

        // カレンダー一覧を保存
        await AsyncStorage.setItem('googleCalendars', JSON.stringify(calendarList));

        // 初回はすべてのカレンダーを選択
        const allIds = calendarList.map(c => c.id);
        setSelectedCalendarIds(allIds);
        await AsyncStorage.setItem('selectedCalendarIds', JSON.stringify(allIds));

        Alert.alert('完了', 'Googleカレンダーと連携しました');
      } else {
        Alert.alert('エラー', '認証に失敗しました');
      }
    } catch (error) {
      console.error('Auth error:', error);
      Alert.alert('エラー', '認証処理中にエラーが発生しました');
    } finally {
      setConnecting(false);
    }
  };

  /**
   * Google連携ボタン
   */
  const handleConnect = useCallback(() => {
    promptAsync();
  }, [promptAsync]);

  /**
   * カレンダーのオン/オフを切り替え
   */
  const toggleCalendar = async (calendarId: string) => {
    let newSelectedIds: string[];

    if (selectedCalendarIds.includes(calendarId)) {
      // 少なくとも1つは選択されている必要がある
      if (selectedCalendarIds.length === 1) {
        Alert.alert('エラー', '少なくとも1つのカレンダーを選択してください');
        return;
      }
      newSelectedIds = selectedCalendarIds.filter(id => id !== calendarId);
    } else {
      newSelectedIds = [...selectedCalendarIds, calendarId];
    }

    setSelectedCalendarIds(newSelectedIds);
    await AsyncStorage.setItem('selectedCalendarIds', JSON.stringify(newSelectedIds));
  };

  /**
   * 連携を解除
   */
  const handleDisconnect = () => {
    Alert.alert(
      'カレンダー連携を解除',
      'Googleカレンダーとの連携を解除しますか？',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '解除',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem('googleAccessToken');
              await AsyncStorage.removeItem('googleCalendars');
              await AsyncStorage.removeItem('selectedCalendarIds');
              setCalendars([]);
              setSelectedCalendarIds([]);
              setIsConnected(false);
              Alert.alert('完了', '連携を解除しました');
            } catch (error) {
              console.error('Disconnect error:', error);
            }
          },
        },
      ]
    );
  };

  /**
   * 再接続（トークンを更新）
   */
  const handleReconnect = () => {
    console.log('handleReconnect called, request:', !!request);
    promptAsync();
  };

  const handleSignOut = async () => {
    Alert.alert(
      'ログアウト',
      'ログアウトしますか？',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: 'ログアウト',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
              // GraphQLクライアントをリセットして古いユーザー情報をクリア
              resetClient();
              router.replace('/signin');
            } catch (error) {
              console.error('ログアウトエラー:', error);
            }
          },
        },
      ]
    );
  };

  const handleDesignThemeChange = (theme: DesignTheme) => {
    setDesignTheme(theme);
  };

  return (
    <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={styles.gradient}>
      <StatusBar barStyle={colors.statusBarStyle} />
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>設定</Text>

          {/* デザインテーマ設定 */}
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>デザインテーマ</Text>
            <View style={styles.modeSelector}>
              <TouchableOpacity
                style={[
                  styles.modeButton,
                  { backgroundColor: colors.selectorBg, borderColor: 'transparent' },
                  designTheme === 'cute' && { backgroundColor: colors.selectorSelectedBg, borderColor: colors.selectorSelectedBorder },
                ]}
                onPress={() => handleDesignThemeChange('cute')}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.modeButtonText,
                  { color: colors.textSecondary },
                  designTheme === 'cute' && { color: colors.selectorSelectedText, fontWeight: '600' },
                ]}>
                  キュート
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modeButton,
                  { backgroundColor: colors.selectorBg, borderColor: 'transparent' },
                  designTheme === 'simple' && { backgroundColor: colors.selectorSelectedBg, borderColor: colors.selectorSelectedBorder },
                ]}
                onPress={() => handleDesignThemeChange('simple')}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.modeButtonText,
                  { color: colors.textSecondary },
                  designTheme === 'simple' && { color: colors.selectorSelectedText, fontWeight: '600' },
                ]}>
                  シンプル
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.sectionHint, { color: colors.textMuted }]}>アプリ全体のデザインが変わります</Text>
          </View>

          {/* トレーニングモード設定 */}
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>トレーニング表示モード</Text>
            <View style={styles.modeSelector}>
              <TouchableOpacity
                style={[
                  styles.modeButton,
                  { backgroundColor: colors.selectorBg, borderColor: 'transparent' },
                  trainingMode === 'intuitive' && { backgroundColor: colors.selectorSelectedBg, borderColor: colors.selectorSelectedBorder },
                ]}
                onPress={() => handleModeChange('intuitive')}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.modeButtonText,
                  { color: colors.textSecondary },
                  trainingMode === 'intuitive' && { color: colors.selectorSelectedText, fontWeight: '600' },
                ]}>
                  直感モード
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modeButton,
                  { backgroundColor: colors.selectorBg, borderColor: 'transparent' },
                  trainingMode === 'verbal' && { backgroundColor: colors.selectorSelectedBg, borderColor: colors.selectorSelectedBorder },
                ]}
                onPress={() => handleModeChange('verbal')}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.modeButtonText,
                  { color: colors.textSecondary },
                  trainingMode === 'verbal' && { color: colors.selectorSelectedText, fontWeight: '600' },
                ]}>
                  言語化モード
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.sectionHint, { color: colors.textMuted }]}>途中でいつでも変更できます</Text>
          </View>

          {/* 音声ガイド設定 */}
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>音声ガイドの話者</Text>
            <View style={styles.modeSelector}>
              <TouchableOpacity
                style={[
                  styles.modeButton,
                  { backgroundColor: colors.selectorBg, borderColor: 'transparent' },
                  voice === 'rina' && { backgroundColor: colors.selectorSelectedBg, borderColor: colors.selectorSelectedBorder },
                ]}
                onPress={() => handleVoiceChange('rina')}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.modeButtonText,
                  { color: colors.textSecondary },
                  voice === 'rina' && { color: colors.selectorSelectedText, fontWeight: '600' },
                ]}>
                  野村里奈
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modeButton,
                  { backgroundColor: colors.selectorBg, borderColor: 'transparent' },
                  voice === 'rinawan' && { backgroundColor: colors.selectorSelectedBg, borderColor: colors.selectorSelectedBorder },
                ]}
                onPress={() => handleVoiceChange('rinawan')}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.modeButtonText,
                  { color: colors.textSecondary },
                  voice === 'rinawan' && { color: colors.selectorSelectedText, fontWeight: '600' },
                ]}>
                  りなわん
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.sectionHint, { color: colors.textMuted }]}>瞑想画面で使用する音声ガイドの声を選択</Text>
          </View>

          {/* ガイドモード設定 */}
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>瞑想ガイド</Text>
            <View style={styles.guideSelector}>
              <TouchableOpacity
                style={[
                  styles.guideOption,
                  { backgroundColor: colors.selectorBg, borderColor: 'transparent' },
                  guideMode === 'timer' && { backgroundColor: `${colors.accent}20`, borderColor: colors.accent },
                ]}
                onPress={() => handleGuideModeChange('timer')}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="timer-outline"
                  size={24}
                  color={guideMode === 'timer' ? colors.accent : colors.textSecondary}
                />
                <Text style={[
                  styles.guideOptionTitle,
                  { color: colors.textSecondary },
                  guideMode === 'timer' && { color: colors.accent },
                ]}>
                  タイマーのみ
                </Text>
                <Text style={[styles.guideOptionDesc, { color: colors.textMuted }]}>
                  シンプルなタイマーで{'\n'}自分のペースで
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.guideOption,
                  { backgroundColor: colors.selectorBg, borderColor: 'transparent' },
                  guideMode === 'ambient' && { backgroundColor: `${colors.accent}20`, borderColor: colors.accent },
                ]}
                onPress={() => handleGuideModeChange('ambient')}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="leaf-outline"
                  size={24}
                  color={guideMode === 'ambient' ? colors.accent : colors.textSecondary}
                />
                <Text style={[
                  styles.guideOptionTitle,
                  { color: colors.textSecondary },
                  guideMode === 'ambient' && { color: colors.accent },
                ]}>
                  環境音
                </Text>
                <Text style={[styles.guideOptionDesc, { color: colors.textMuted }]}>
                  心地よい環境音{'\n'}とともに
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.guideOption,
                  { backgroundColor: colors.selectorBg, borderColor: 'transparent' },
                  guideMode === 'guided' && { backgroundColor: `${colors.accent}20`, borderColor: colors.accent },
                ]}
                onPress={() => handleGuideModeChange('guided')}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="headset-outline"
                  size={24}
                  color={guideMode === 'guided' ? colors.accent : colors.textSecondary}
                />
                <Text style={[
                  styles.guideOptionTitle,
                  { color: colors.textSecondary },
                  guideMode === 'guided' && { color: colors.accent },
                ]}>
                  瞑想ガイド
                </Text>
                <Text style={[styles.guideOptionDesc, { color: colors.textMuted }]}>
                  音声ガイドに{'\n'}沿って
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 環境音選択（環境音モード時のみ表示） */}
          {guideMode === 'ambient' && (
            <View style={[styles.section, { backgroundColor: colors.card }]}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>環境音の種類</Text>
              <View style={styles.ambientGrid}>
                {[
                  [
                    { id: 'birds' as AmbientSound, icon: '🐦', label: '小鳥' },
                    { id: 'river' as AmbientSound, icon: '🏞️', label: '川' },
                    { id: 'rain' as AmbientSound, icon: '🌧️', label: '雨' },
                  ],
                  [
                    { id: 'wave' as AmbientSound, icon: '🌊', label: '波' },
                    { id: 'bonfire' as AmbientSound, icon: '🔥', label: '焚き火' },
                    { id: 'singing_bowls' as AmbientSound, icon: '🌌', label: 'シンギングボール' },
                  ],
                ].map((row, rowIndex) => (
                  <View key={rowIndex} style={styles.ambientRow}>
                    {row.map((item) => (
                      <TouchableOpacity
                        key={item.id}
                        style={[
                          styles.ambientButton,
                          { backgroundColor: colors.selectorBg, borderColor: 'transparent' },
                          ambientSound === item.id && { backgroundColor: colors.selectorSelectedBg, borderColor: colors.selectorSelectedBorder },
                        ]}
                        onPress={() => handleAmbientSoundChange(item.id)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.ambientIcon}>{item.icon}</Text>
                        <Text style={[
                          styles.modeButtonText,
                          { color: colors.textSecondary },
                          ambientSound === item.id && { color: colors.selectorSelectedText, fontWeight: '600' },
                        ]}>
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* 瞑想リマインダーセクション */}
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>瞑想リマインダー</Text>
              <TouchableOpacity
                style={styles.addButton}
                onPress={handleAddNotification}
                activeOpacity={0.7}
              >
                <Ionicons name="add-circle" size={28} color="#805AD5" />
              </TouchableOpacity>
            </View>

            {notificationTimes.length === 0 ? (
              <View style={styles.emptyNotification}>
                <Ionicons name="notifications-off-outline" size={32} color="#A0AEC0" />
                <Text style={styles.emptyNotificationText}>
                  リマインダーが設定されていません
                </Text>
                <TouchableOpacity
                  style={styles.addFirstButton}
                  onPress={handleAddNotification}
                  activeOpacity={0.7}
                >
                  <Text style={styles.addFirstButtonText}>追加する</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {notificationTimes.map((notification) => (
                  <View key={notification.id} style={styles.notificationItem}>
                    <TouchableOpacity
                      style={styles.notificationTimeContainer}
                      onPress={() => handleEditNotification(notification)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name="time-outline"
                        size={20}
                        color={notification.enabled ? '#805AD5' : '#A0AEC0'}
                      />
                      <Text style={[
                        styles.notificationTimeText,
                        !notification.enabled && styles.notificationTimeTextDisabled,
                      ]}>
                        {formatTime(notification.hour, notification.minute)}
                      </Text>
                    </TouchableOpacity>

                    <View style={styles.notificationActions}>
                      <Switch
                        value={notification.enabled}
                        onValueChange={(enabled) => handleToggleNotification(notification.id, enabled)}
                        trackColor={{ false: '#E2E8F0', true: '#9F7AEA' }}
                        thumbColor={notification.enabled ? '#805AD5' : '#FFF'}
                      />
                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => handleDeleteNotification(notification.id)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="trash-outline" size={20} color="#E53E3E" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </>
            )}

            <Text style={[styles.sectionHint, { color: colors.textMuted }]}>
              {colors.showMascot ? 'りなわんが毎日お知らせします' : '毎日お知らせします'}
            </Text>
          </View>

          {/* 時刻選択モーダル */}
          <Modal
            visible={showTimePicker}
            transparent
            animationType="fade"
            onRequestClose={() => setShowTimePicker(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>
                  {editingNotificationId ? '通知時刻を変更' : '通知時刻を追加'}
                </Text>

                <View style={styles.pickerContainer}>
                  <View style={styles.pickerColumn}>
                    <Text style={styles.pickerLabel}>時</Text>
                    <ScrollView
                      style={styles.pickerScroll}
                      showsVerticalScrollIndicator={false}
                    >
                      {Array.from({ length: 24 }, (_, i) => (
                        <TouchableOpacity
                          key={i}
                          style={[
                            styles.pickerItem,
                            tempHour === i && styles.pickerItemSelected,
                          ]}
                          onPress={() => setTempHour(i)}
                        >
                          <Text style={[
                            styles.pickerItemText,
                            tempHour === i && styles.pickerItemTextSelected,
                          ]}>
                            {i.toString().padStart(2, '0')}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>

                  <Text style={styles.pickerColon}>:</Text>

                  <View style={styles.pickerColumn}>
                    <Text style={styles.pickerLabel}>分</Text>
                    <ScrollView
                      style={styles.pickerScroll}
                      showsVerticalScrollIndicator={false}
                    >
                      {Array.from({ length: 12 }, (_, i) => i * 5).map((minute) => (
                        <TouchableOpacity
                          key={minute}
                          style={[
                            styles.pickerItem,
                            tempMinute === minute && styles.pickerItemSelected,
                          ]}
                          onPress={() => setTempMinute(minute)}
                        >
                          <Text style={[
                            styles.pickerItemText,
                            tempMinute === minute && styles.pickerItemTextSelected,
                          ]}>
                            {minute.toString().padStart(2, '0')}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                </View>

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={styles.modalCancelButton}
                    onPress={() => setShowTimePicker(false)}
                  >
                    <Text style={styles.modalCancelText}>キャンセル</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.modalConfirmButton}
                    onPress={handleConfirmTime}
                  >
                    <Text style={styles.modalConfirmText}>決定</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          {/* カレンダー連携セクション */}
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>カレンダー連携</Text>

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#805AD5" />
              </View>
            ) : !isConnected ? (
              <View style={styles.card}>
                <View style={styles.cardContent}>
                  <Ionicons name="calendar-outline" size={32} color="#A0AEC0" />
                  <Text style={styles.cardText}>
                    Googleカレンダーと連携すると{'\n'}予定を分析できます
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.connectButton}
                  onPress={handleConnect}
                  disabled={!request || connecting}
                  activeOpacity={0.8}
                >
                  {connecting ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <Ionicons name="logo-google" size={18} color="#FFF" />
                      <Text style={styles.connectButtonText}>Googleで連携</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {/* カレンダー一覧 */}
                <View style={styles.card}>
                  {calendars.map((calendar) => {
                    const isSelected = selectedCalendarIds.includes(calendar.id);
                    return (
                      <View key={calendar.id} style={styles.calendarItem}>
                        <View style={styles.calendarInfo}>
                          <View
                            style={[
                              styles.calendarDot,
                              { backgroundColor: calendar.backgroundColor || '#4285F4' },
                            ]}
                          />
                          <View style={styles.calendarTextContainer}>
                            <Text style={styles.calendarName} numberOfLines={1}>
                              {calendar.summary}
                            </Text>
                            {calendar.primary && (
                              <Text style={styles.primaryLabel}>メイン</Text>
                            )}
                          </View>
                        </View>
                        <Switch
                          value={isSelected}
                          onValueChange={() => toggleCalendar(calendar.id)}
                          trackColor={{ false: '#E2E8F0', true: '#9F7AEA' }}
                          thumbColor={isSelected ? '#805AD5' : '#FFF'}
                        />
                      </View>
                    );
                  })}
                </View>

                {/* 再接続・解除ボタン */}
                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    style={styles.reconnectButton}
                    onPress={handleReconnect}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="refresh" size={16} color="#805AD5" />
                    <Text style={styles.reconnectButtonText}>再接続</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.disconnectButton}
                    onPress={handleDisconnect}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="unlink" size={16} color="#E53E3E" />
                    <Text style={styles.disconnectButtonText}>解除</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>

          {/* アカウントセクション */}
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>アカウント</Text>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleSignOut}
              activeOpacity={0.7}
            >
              <Ionicons name="log-out-outline" size={20} color="#E53E3E" />
              <Text style={styles.menuItemText}>ログアウト</Text>
            </TouchableOpacity>
          </View>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#4A5568',
    marginBottom: 24,
  },
  section: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4A5568',
    marginBottom: 12,
  },
  addButton: {
    padding: 4,
    marginBottom: 12,
  },
  sectionHint: {
    fontSize: 12,
    color: '#718096',
    textAlign: 'center',
    marginTop: 8,
  },
  modeSelector: {
    flexDirection: 'row',
    gap: 12,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: 'rgba(122, 215, 240, 0.2)',
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  modeButtonSelected: {
    backgroundColor: 'rgba(122, 215, 240, 0.3)',
    borderColor: '#5ABFB0',
  },
  modeButtonText: {
    fontSize: 14,
    color: '#718096',
    fontWeight: '500',
  },
  modeButtonTextSelected: {
    color: '#2D7A6E',
    fontWeight: '600',
  },
  guideSelector: {
    flexDirection: 'row',
    gap: 10,
  },
  guideOption: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  guideOptionSelected: {
    backgroundColor: 'rgba(255, 133, 162, 0.15)',
    borderColor: '#FF85A2',
  },
  guideOptionTitle: {
    fontSize: 13,
    color: '#718096',
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 4,
  },
  guideOptionTitleSelected: {
    color: '#FF85A2',
  },
  guideOptionDesc: {
    fontSize: 10,
    color: '#A0AEC0',
    textAlign: 'center',
    lineHeight: 14,
  },
  ambientGrid: {
    gap: 10,
  },
  ambientRow: {
    flexDirection: 'row',
    gap: 10,
  },
  ambientButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(122, 215, 240, 0.2)',
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  ambientIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  // 通知関連スタイル
  emptyNotification: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyNotificationText: {
    fontSize: 14,
    color: '#A0AEC0',
    marginTop: 8,
    marginBottom: 16,
  },
  addFirstButton: {
    backgroundColor: '#805AD5',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  addFirstButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF2F7',
  },
  notificationTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  notificationTimeText: {
    fontSize: 18,
    color: '#4A5568',
    fontWeight: '600',
  },
  notificationTimeTextDisabled: {
    color: '#A0AEC0',
  },
  notificationActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deleteButton: {
    padding: 4,
  },
  // モーダル関連スタイル
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 24,
    width: '80%',
    maxWidth: 320,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4A5568',
    textAlign: 'center',
    marginBottom: 20,
  },
  pickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  pickerColumn: {
    alignItems: 'center',
  },
  pickerLabel: {
    fontSize: 12,
    color: '#718096',
    marginBottom: 8,
  },
  pickerScroll: {
    height: 180,
    width: 70,
  },
  pickerItem: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  pickerItemSelected: {
    backgroundColor: 'rgba(128, 90, 213, 0.1)',
  },
  pickerItemText: {
    fontSize: 20,
    color: '#4A5568',
  },
  pickerItemTextSelected: {
    color: '#805AD5',
    fontWeight: '600',
  },
  pickerColon: {
    fontSize: 24,
    color: '#4A5568',
    fontWeight: '600',
    marginTop: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#EDF2F7',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 15,
    color: '#718096',
    fontWeight: '500',
  },
  modalConfirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#805AD5',
    alignItems: 'center',
  },
  modalConfirmText: {
    fontSize: 15,
    color: '#FFF',
    fontWeight: '600',
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    padding: 16,
  },
  cardContent: {
    alignItems: 'center',
    marginBottom: 16,
  },
  cardText: {
    fontSize: 14,
    color: '#718096',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 20,
  },
  connectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4285F4',
    borderRadius: 10,
    paddingVertical: 12,
    gap: 8,
  },
  connectButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
  calendarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF2F7',
  },
  calendarInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  calendarDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 12,
  },
  calendarTextContainer: {
    flex: 1,
  },
  calendarName: {
    fontSize: 15,
    color: '#4A5568',
    fontWeight: '500',
  },
  primaryLabel: {
    fontSize: 11,
    color: '#805AD5',
    marginTop: 2,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  reconnectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 10,
    paddingVertical: 12,
    gap: 6,
  },
  reconnectButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#805AD5',
  },
  disconnectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 10,
    paddingVertical: 12,
    gap: 6,
  },
  disconnectButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#E53E3E',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  menuItemText: {
    fontSize: 15,
    color: '#E53E3E',
    fontWeight: '500',
  },
  loadingContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
});
