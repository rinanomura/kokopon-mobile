import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform, Alert } from 'react-native';

// OAuth完了時にブラウザを閉じる
WebBrowser.maybeCompleteAuthSession();

// ========================================
// 設定値（環境変数から読み込み）
// ========================================
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_OAUTH_WEB_CLIENT_ID!;
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_OAUTH_IOS_CLIENT_ID!;
const GOOGLE_WEB_CLIENT_SECRET = process.env.EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_SECRET!;

// Platformに応じてクライアントIDを選択
const getClientId = () => {
  if (Platform.OS === 'ios') {
    return GOOGLE_IOS_CLIENT_ID;
  }
  return GOOGLE_WEB_CLIENT_ID;
};

// デバッグ: 環境変数の確認
console.log('=== ENV Check ===');
console.log('WEB_CLIENT_ID:', GOOGLE_WEB_CLIENT_ID ? 'SET' : 'MISSING');
console.log('IOS_CLIENT_ID:', GOOGLE_IOS_CLIENT_ID ? 'SET' : 'MISSING');
console.log('CLIENT_SECRET:', GOOGLE_WEB_CLIENT_SECRET ? 'SET' : 'MISSING');
console.log('=================');

const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];

// Google OAuth Discovery Document
const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

/**
 * Google OAuth 用の設定を取得
 */
// iOSではGoogleのリバースクライアントIDをschemeとして使用
const GOOGLE_IOS_SCHEME = 'com.googleusercontent.apps.854736505548-mibriea31qqtaabf4d2hb4frvtf3d3v9';

export function useGoogleAuth() {
  // リダイレクトURIを自動生成
  // iOSスタンドアロンビルドではGoogleのリバースクライアントIDを使用
  const redirectUri = AuthSession.makeRedirectUri({
    scheme: Platform.OS === 'ios' ? GOOGLE_IOS_SCHEME : 'kokoponmobile',
    preferLocalhost: Platform.OS === 'web',
  });

  // デバッグ用：リダイレクトURIをコンソールに出力
  console.log('=== Redirect URI ===');
  console.log(redirectUri);
  console.log('Platform:', Platform.OS);
  console.log('====================');

  const clientId = getClientId();

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId,
      scopes: SCOPES,
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
      usePKCE: true,
      extraParams: {
        prompt: 'select_account', // 毎回アカウント選択画面を表示
      },
    },
    discovery
  );

  // Web用のpromptAsyncラッパー（リダイレクト方式を使用）
  const wrappedPromptAsync = Platform.OS === 'web'
    ? () => promptAsync({ windowFeatures: { popup: false } })
    : promptAsync;

  return { request, response, promptAsync: wrappedPromptAsync, redirectUri };
}

/**
 * Authorization Code を Access Token に交換
 */
export async function exchangeCodeForToken(
  code: string,
  codeVerifier: string,
  redirectUri: string
): Promise<string | null> {
  const clientId = getClientId();
  try {

    // iOSネイティブアプリではclientSecretは不要（PKCEを使用）
    const tokenRequest: AuthSession.AccessTokenRequestConfig = {
      clientId,
      code,
      redirectUri,
      extraParams: {
        code_verifier: codeVerifier,
      },
    };

    // Web/Androidの場合のみclientSecretを追加
    if (Platform.OS !== 'ios') {
      tokenRequest.clientSecret = GOOGLE_WEB_CLIENT_SECRET;
    }

    const tokenResponse = await AuthSession.exchangeCodeAsync(
      tokenRequest,
      discovery
    );
    return tokenResponse.accessToken;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('Token exchange error:', error);
    // デバッグ用アラート（本番リリース前に削除）
    Alert.alert(
      'OAuth Debug',
      `ClientID: ${clientId?.substring(0, 20)}...\nRedirectURI: ${redirectUri}\nError: ${errorMsg}`
    );
    return null;
  }
}

/**
 * カレンダー情報型
 */
export interface CalendarInfo {
  id: string;
  summary: string;
  primary?: boolean;
  backgroundColor?: string;
  selected?: boolean;
}

/**
 * カレンダーイベント型
 */
export interface CalendarEvent {
  id: string;
  summary: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
  calendarId?: string;
}

/**
 * Google Calendar API からカレンダー一覧を取得
 */
export async function fetchCalendarList(
  accessToken: string
): Promise<CalendarInfo[]> {
  try {
    const response = await fetch(
      'https://www.googleapis.com/calendar/v3/users/me/calendarList',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Calendar List API error: ${response.status}`);
    }

    const data = await response.json();
    return (data.items || []).map((item: any) => ({
      id: item.id,
      summary: item.summary || item.id,
      primary: item.primary || false,
      backgroundColor: item.backgroundColor,
      selected: item.selected,
    }));
  } catch (error) {
    console.error('Calendar list fetch error:', error);
    return [];
  }
}

/**
 * Google Calendar API からイベントを取得
 * calendarIds が指定されていない場合は primary のみ取得
 */
export async function fetchCalendarEvents(
  accessToken: string,
  timeMin: Date,
  timeMax: Date,
  calendarIds?: string[]
): Promise<CalendarEvent[]> {
  try {
    const params = new URLSearchParams({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '100',
    });

    // カレンダーIDが指定されていなければ primary のみ
    const idsToFetch = calendarIds && calendarIds.length > 0
      ? calendarIds
      : ['primary'];

    // 各カレンダーからイベントを並列取得
    const allEventsPromises = idsToFetch.map(async (calendarId) => {
      const encodedCalendarId = encodeURIComponent(calendarId);
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodedCalendarId}/events?${params}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        console.warn(`Calendar API error for ${calendarId}: ${response.status}`);
        return [];
      }

      const data = await response.json();
      // 各イベントにcalendarIdを付与し、summaryがない場合はフォールバック
      return (data.items || []).map((event: CalendarEvent) => ({
        ...event,
        summary: event.summary || '(予定あり)',
        calendarId,
      }));
    });

    const allEventsArrays = await Promise.all(allEventsPromises);
    const allEvents = allEventsArrays.flat();

    // 開始時刻でソート
    allEvents.sort((a, b) => {
      const aTime = a.start.dateTime || a.start.date || '';
      const bTime = b.start.dateTime || b.start.date || '';
      return aTime.localeCompare(bTime);
    });

    return allEvents;
  } catch (error) {
    console.error('Calendar fetch error:', error);
    return [];
  }
}

/**
 * 日別のイベント数を集計
 */
export function countEventsByDate(events: CalendarEvent[]): Record<string, number> {
  const counts: Record<string, number> = {};

  events.forEach((event) => {
    const dateStr = event.start.dateTime || event.start.date;
    if (dateStr) {
      const date = dateStr.split('T')[0]; // YYYY-MM-DD
      counts[date] = (counts[date] || 0) + 1;
    }
  });

  return counts;
}
