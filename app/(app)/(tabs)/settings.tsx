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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { signOut } from 'aws-amplify/auth';
import { router } from 'expo-router';
import { resetClient } from '@/lib/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  useGoogleAuth,
  exchangeCodeForToken,
  fetchCalendarList,
  CalendarInfo,
} from '@/lib/googleCalendar';

/**
 * SettingsScreen - 設定画面
 *
 * ユーザー設定・ログアウト・カレンダー連携管理
 */
export default function SettingsScreen() {
  // Googleカレンダー連携
  const { request, response, promptAsync, redirectUri } = useGoogleAuth();

  const [calendars, setCalendars] = useState<CalendarInfo[]>([]);
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

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

  return (
    <LinearGradient colors={['#7AD7F0', '#CDECF6']} style={styles.gradient}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <Text style={styles.title}>設定</Text>

          {/* カレンダー連携セクション */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>カレンダー連携</Text>

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
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>アカウント</Text>
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4A5568',
    marginBottom: 12,
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
