import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Modal,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { signOut, fetchUserAttributes } from 'aws-amplify/auth';
import { router } from 'expo-router';
import { usePreferences, NotificationTime, DesignTheme } from '@/hooks/usePreferences';
import { useThemeColors } from '@/hooks/useThemeColors';
import { resetClient } from '@/lib/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  requestNotificationPermission,
  checkNotificationPermission,
  setupNotificationChannel,
  scheduleAllNotifications,
  cancelNotification,
  setupNotificationHandler,
} from '@/lib/notifications';
let setAlternateAppIcon: ((name: string | null) => Promise<void>) | null = null;
try {
  setAlternateAppIcon = require('expo-alternate-app-icons').setAlternateAppIcon;
} catch {
  // Expo Go ではネイティブモジュールが利用不可
}

/**
 * SettingsScreen - 設定画面
 *
 * ユーザー設定・ログアウト・カレンダー連携管理
 */
export default function SettingsScreen() {
  const {
    notificationTimes,
    addNotificationTime,
    updateNotificationTime,
    removeNotificationTime,
    designTheme,
    setDesignTheme,
    breathTiming,
    setBreathTiming,
  } = usePreferences();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  // ユーザー情報
  const [userEmail, setUserEmail] = useState<string>('');

  useEffect(() => {
    const loadUserInfo = async () => {
      try {
        const attributes = await fetchUserAttributes();
        setUserEmail(attributes.email ?? '');
      } catch (error) {
        console.error('Failed to fetch user attributes:', error);
      }
    };
    loadUserInfo();
  }, []);

  // リマインダーモード: 'auto' | 'manual' | 'off'
  const [reminderMode, setReminderMode] = useState<'auto' | 'manual' | 'off'>('auto');

  // 通知関連
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [editingNotificationId, setEditingNotificationId] = useState<string | null>(null);
  const [tempHour, setTempHour] = useState(20);
  const [tempMinute, setTempMinute] = useState(0);

  // 通知ハンドラーの初期設定
  useEffect(() => {
    setupNotificationHandler();
    setupNotificationChannel();
  }, []);

  // 通知設定またはテーマが変更されたらスケジュールを更新
  useEffect(() => {
    if (notificationTimes.length > 0) {
      scheduleAllNotifications(notificationTimes, designTheme);
    }
  }, [notificationTimes, designTheme]);

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

  // リマインダーモード初期化（既存データから判定）
  useEffect(() => {
    if (notificationTimes.length === 0) {
      // 初回は自動設定をデフォルトでオン
      (async () => {
        const stored = await AsyncStorage.getItem('pref_reminder_mode');
        if (stored === 'manual' || stored === 'off') {
          setReminderMode(stored);
        } else {
          // 初回 or auto: 自動設定（20:00）
          setReminderMode('auto');
          if (notificationTimes.length === 0 && stored !== 'auto') {
            await addNotificationTime(20, 0);
            await AsyncStorage.setItem('pref_reminder_mode', 'auto');
          }
        }
      })();
    } else {
      AsyncStorage.getItem('pref_reminder_mode').then(stored => {
        if (stored === 'manual' || stored === 'off' || stored === 'auto') {
          setReminderMode(stored);
        }
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * リマインダーモード変更
   */
  const handleReminderModeChange = async (mode: 'auto' | 'manual' | 'off') => {
    setReminderMode(mode);
    await AsyncStorage.setItem('pref_reminder_mode', mode);

    if (mode === 'auto') {
      // 既存を全削除して20:00を設定
      for (const t of notificationTimes) {
        await cancelNotification(t.id);
        await removeNotificationTime(t.id);
      }
      await addNotificationTime(20, 0);
    } else if (mode === 'manual') {
      // 既存がなければ20:00をデフォルトで1つ追加
      if (notificationTimes.length === 0) {
        await addNotificationTime(20, 0);
      }
    } else {
      // off: 全削除
      for (const t of notificationTimes) {
        await cancelNotification(t.id);
        await removeNotificationTime(t.id);
      }
    }
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

  const handleDesignThemeChange = async (theme: DesignTheme) => {
    setDesignTheme(theme);
    if (setAlternateAppIcon) {
      try {
        if (theme === 'simple') {
          await setAlternateAppIcon('IconSimpleMode');
        } else {
          await setAlternateAppIcon(null);
        }
      } catch (error) {
        console.error('アイコン切り替えエラー:', error);
      }
    }
  };

  return (
    <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={styles.gradient}>
      <StatusBar barStyle={colors.statusBarStyle} />
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* 閉じるボタン */}
        <View style={styles.closeBar}>
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.7}
            style={styles.closeButton}
          >
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* プロフィールヘッダー */}
        <View style={[styles.profileHeader, { backgroundColor: colors.card }]}>
          <View style={[styles.profileIconContainer, { backgroundColor: colors.accent + '20' }]}>
            <Ionicons name="person" size={32} color={colors.accent} />
          </View>
          <Text style={[styles.profileEmail, { color: colors.textPrimary }]}>
            {userEmail || '読み込み中...'}
          </Text>
          <Text style={[styles.profileLabel, { color: colors.textMuted }]}>マイページ</Text>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>

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

          {/* 呼吸リズム設定（シンプルモードのみ） */}
          {designTheme === 'simple' && (
            <View style={[styles.section, { backgroundColor: colors.card }]}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>呼吸リズム</Text>
              <Text style={[styles.sectionHint, { color: colors.textMuted, marginBottom: 12 }]}>
                ホーム画面の光のアニメーション（秒）
              </Text>
              {([
                { key: 'expandSec' as const, label: 'ふくらむ' },
                { key: 'holdTopSec' as const, label: '大きく止まる' },
                { key: 'shrinkSec' as const, label: 'しぼむ' },
                { key: 'holdBottomSec' as const, label: '小さく止まる' },
              ]).map(({ key, label }) => (
                <View key={key} style={styles.breathRow}>
                  <Text style={[styles.breathLabel, { color: colors.textSecondary }]}>{label}</Text>
                  <View style={styles.breathStepper}>
                    <TouchableOpacity
                      onPress={() => {
                        if (breathTiming[key] > (key.startsWith('hold') ? 0 : 1)) {
                          setBreathTiming({ ...breathTiming, [key]: breathTiming[key] - 1 });
                        }
                      }}
                      style={[styles.breathStepButton, { borderColor: colors.cardBorder }]}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="remove" size={18} color={colors.textSecondary} />
                    </TouchableOpacity>
                    <Text style={[styles.breathValue, { color: colors.textPrimary }]}>
                      {breathTiming[key]}
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        if (breathTiming[key] < 10) {
                          setBreathTiming({ ...breathTiming, [key]: breathTiming[key] + 1 });
                        }
                      }}
                      style={[styles.breathStepButton, { borderColor: colors.cardBorder }]}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="add" size={18} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* 瞑想リマインダーセクション */}
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>瞑想リマインダー</Text>

            {/* 3択セレクター */}
            <View style={styles.reminderSelector}>
              {([
                { id: 'auto' as const, label: '自動設定', desc: '' },
                { id: 'manual' as const, label: '手動設定', desc: '時間を選ぶ' },
                { id: 'off' as const, label: '設定しない', desc: '' },
              ]).map((option) => (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.reminderOption,
                    { backgroundColor: colors.selectorBg, borderColor: 'transparent' },
                    reminderMode === option.id && { backgroundColor: colors.selectorSelectedBg, borderColor: colors.selectorSelectedBorder },
                  ]}
                  onPress={() => handleReminderModeChange(option.id)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.reminderOptionLabel,
                    { color: colors.textSecondary },
                    reminderMode === option.id && { color: colors.selectorSelectedText, fontWeight: '600' },
                  ]}>
                    {option.label}
                  </Text>
                  {option.desc !== '' && (
                    <Text style={[
                      styles.reminderOptionDesc,
                      { color: colors.textMuted },
                      reminderMode === option.id && { color: colors.selectorSelectedText },
                    ]}>
                      {option.desc}
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* 手動設定時の時刻表示・変更 */}
            {reminderMode === 'manual' && notificationTimes.length > 0 && (
              <TouchableOpacity
                style={styles.manualTimeRow}
                onPress={() => {
                  const t = notificationTimes[0];
                  setEditingNotificationId(t.id);
                  setTempHour(t.hour);
                  setTempMinute(t.minute);
                  setShowTimePicker(true);
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="time-outline" size={20} color={colors.accent} />
                <Text style={[styles.manualTimeText, { color: colors.textPrimary }]}>
                  {formatTime(notificationTimes[0].hour, notificationTimes[0].minute)}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            )}

            <Text style={[styles.sectionHint, { color: colors.textMuted }]}>
              {colors.showMascot ? 'りなわんが毎日お知らせします' : '毎日お知らせします'}
            </Text>
          </View>

          {/* ログアウトボタン */}
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleSignOut}
            activeOpacity={0.7}
          >
            <Ionicons name="log-out-outline" size={20} color="#E53E3E" />
            <Text style={styles.logoutButtonText}>ログアウト</Text>
          </TouchableOpacity>
        </ScrollView>

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
      </View>
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
  closeBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 40,
  },
  profileHeader: {
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 24,
    marginTop: 20,
    marginBottom: 16,
    alignItems: 'center',
  },
  profileIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  profileEmail: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  profileLabel: {
    fontSize: 13,
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
  breathRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  breathLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  breathStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  breathStepButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  breathValue: {
    fontSize: 18,
    fontWeight: '700',
    width: 28,
    textAlign: 'center',
  },
  reminderSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  reminderOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
  },
  reminderOptionLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  reminderOptionDesc: {
    fontSize: 10,
    marginTop: 2,
  },
  manualTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 10,
  },
  manualTimeText: {
    fontSize: 24,
    fontWeight: '600',
    flex: 1,
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
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#E53E3E',
    gap: 8,
    marginBottom: 16,
  },
  logoutButtonText: {
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
