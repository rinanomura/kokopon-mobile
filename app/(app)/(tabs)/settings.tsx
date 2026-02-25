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

  const handleDesignThemeChange = async (theme: DesignTheme) => {
    setDesignTheme(theme);
    if (setAlternateAppIcon) {
      try {
        if (theme === 'simple') {
          await setAlternateAppIcon('icon-simple-mode');
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
