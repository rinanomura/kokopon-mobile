import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
        prompt: 'consent', // 同意画面を表示してrefresh_tokenを取得
        access_type: 'offline', // リフレッシュトークンを取得
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

    // リフレッシュトークンを保存
    if (tokenResponse.refreshToken) {
      await AsyncStorage.setItem('googleRefreshToken', tokenResponse.refreshToken);
    }

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
 * リフレッシュトークンでアクセストークンを更新
 */
export async function refreshAccessToken(): Promise<string | null> {
  try {
    const refreshToken = await AsyncStorage.getItem('googleRefreshToken');
    if (!refreshToken) return null;

    const clientId = getClientId();
    const body: Record<string, string> = {
      client_id: clientId,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    };

    // Web/Androidの場合のみclientSecretを追加
    if (Platform.OS !== 'ios') {
      body.client_secret = GOOGLE_WEB_CLIENT_SECRET;
    }

    const response = await fetch(discovery.tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(body).toString(),
    });

    if (!response.ok) {
      console.error('Token refresh failed:', response.status);
      return null;
    }

    const data = await response.json();
    const newToken = data.access_token;

    // 新しいトークンを保存
    if (newToken) {
      await AsyncStorage.setItem('googleAccessToken', newToken);
    }

    return newToken;
  } catch (error) {
    console.error('Token refresh error:', error);
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
  const tryFetch = async (token: string) => {
    const response = await fetch(
      'https://www.googleapis.com/calendar/v3/users/me/calendarList',
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!response.ok) {
      throw new Error(`AUTH_EXPIRED:${response.status}`);
    }
    return response.json();
  };

  try {
    let data;
    try {
      data = await tryFetch(accessToken);
    } catch (err: any) {
      if (err.message?.includes('AUTH_EXPIRED')) {
        const newToken = await refreshAccessToken();
        if (newToken) {
          data = await tryFetch(newToken);
        } else {
          throw err;
        }
      } else {
        throw err;
      }
    }
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
  const fetchWithToken = async (token: string) => {
    const params = new URLSearchParams({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '100',
    });

    const idsToFetch = calendarIds && calendarIds.length > 0
      ? calendarIds
      : ['primary'];

    const allEventsPromises = idsToFetch.map(async (calendarId) => {
      const encodedCalendarId = encodeURIComponent(calendarId);
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodedCalendarId}/events?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error(`AUTH_EXPIRED:${response.status}`);
        }
        return [];
      }

      const data = await response.json();
      return (data.items || []).map((event: CalendarEvent) => ({
        ...event,
        summary: event.summary || '(予定あり)',
        calendarId,
      }));
    });

    const allEventsArrays = await Promise.all(allEventsPromises);
    const allEvents = allEventsArrays.flat();

    allEvents.sort((a, b) => {
      const aTime = a.start.dateTime || a.start.date || '';
      const bTime = b.start.dateTime || b.start.date || '';
      return aTime.localeCompare(bTime);
    });

    return allEvents;
  };

  try {
    return await fetchWithToken(accessToken);
  } catch (error: any) {
    if (error.message?.includes('AUTH_EXPIRED')) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        try {
          return await fetchWithToken(newToken);
        } catch {
          console.error('Calendar fetch failed after token refresh');
        }
      }
    }
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
