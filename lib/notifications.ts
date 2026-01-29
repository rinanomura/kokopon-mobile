import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// 通知時刻の型
export type NotificationTime = {
  id: string;
  hour: number;
  minute: number;
  enabled: boolean;
};

// りなわんからのメッセージ
const RINAWAN_MESSAGES = [
  '今日の瞑想、まだやってないワン！一緒にやろうワン！',
  '深呼吸の時間だワン！心を落ち着けようワン！',
  '瞑想でリフレッシュするワン！待ってるワン！',
  'そろそろ瞑想タイムだワン！準備はいいワン？',
  '今日も一緒に瞑想しようワン！きっと気持ちいいワン！',
  'ちょっと休憩して瞑想するワン！お待ちしてるワン！',
  '瞑想の時間だワン！今日の自分と向き合おうワン！',
  '頑張りすぎてないワン？瞑想でリラックスするワン！',
];

// 通知チャンネルID (Android用)
const CHANNEL_ID = 'meditation-reminder';

/**
 * 通知のパーミッションをリクエスト
 */
export async function requestNotificationPermission(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();

  if (existingStatus === 'granted') {
    return true;
  }

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/**
 * 通知パーミッションの状態を確認
 */
export async function checkNotificationPermission(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
}

/**
 * Android用の通知チャンネルを設定
 */
export async function setupNotificationChannel(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: '瞑想リマインダー',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#7AD7F0',
    });
  }
}

/**
 * りなわんメッセージをランダムに取得
 */
function getRandomMessage(): string {
  const index = Math.floor(Math.random() * RINAWAN_MESSAGES.length);
  return RINAWAN_MESSAGES[index];
}

/**
 * 単一の通知をスケジュール
 */
export async function scheduleNotification(
  id: string,
  hour: number,
  minute: number
): Promise<string | null> {
  try {
    const identifier = await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: {
        title: '🐕 りなわんからのお知らせ',
        body: getRandomMessage(),
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
        channelId: Platform.OS === 'android' ? CHANNEL_ID : undefined,
      },
    });

    console.log('通知スケジュール完了:', identifier, `${hour}:${minute}`);
    return identifier;
  } catch (error) {
    console.error('通知スケジュールエラー:', error);
    return null;
  }
}

/**
 * 複数の通知をまとめてスケジュール
 */
export async function scheduleAllNotifications(
  times: NotificationTime[]
): Promise<void> {
  try {
    // 既存の通知をすべてキャンセル
    await cancelAllNotifications();

    // 有効な通知のみスケジュール
    for (const time of times) {
      if (time.enabled) {
        await scheduleNotification(time.id, time.hour, time.minute);
      }
    }
    console.log(`${times.filter(t => t.enabled).length}件の通知をスケジュールしました`);
  } catch (error) {
    console.error('通知スケジュールエラー:', error);
  }
}

/**
 * 特定の通知をキャンセル
 */
export async function cancelNotification(id: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
    console.log('通知をキャンセルしました:', id);
  } catch (error) {
    console.error('通知キャンセルエラー:', error);
  }
}

/**
 * すべての通知をキャンセル
 */
export async function cancelAllNotifications(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('すべての通知をキャンセルしました');
  } catch (error) {
    console.error('通知キャンセルエラー:', error);
  }
}

/**
 * 通知ハンドラーを設定（フォアグラウンド通知の表示設定）
 */
export function setupNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}
