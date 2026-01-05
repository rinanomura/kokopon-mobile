import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

// OAuth完了時にブラウザを閉じる
WebBrowser.maybeCompleteAuthSession();

// ========================================
// 設定値（環境変数から読み込み）
// ========================================
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID!;
const GOOGLE_WEB_CLIENT_SECRET = process.env.EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_SECRET!;

// デバッグ: 環境変数の確認
console.log('=== ENV Check ===');
console.log('CLIENT_ID:', GOOGLE_WEB_CLIENT_ID ? 'SET' : 'MISSING');
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
export function useGoogleAuth() {
  // リダイレクトURIを自動生成（Dev Client / Expo Go 両対応）
  const redirectUri = AuthSession.makeRedirectUri({
    scheme: 'kokoponmobile',
    preferLocalhost: Platform.OS === 'web',
  });

  // デバッグ用：リダイレクトURIをコンソールに出力
  console.log('=== Redirect URI ===');
  console.log(redirectUri);
  console.log('Platform:', Platform.OS);
  console.log('====================');

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: GOOGLE_WEB_CLIENT_ID,
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
  try {
    const tokenResponse = await AuthSession.exchangeCodeAsync(
      {
        clientId: GOOGLE_WEB_CLIENT_ID,
        clientSecret: GOOGLE_WEB_CLIENT_SECRET, // Web用に必要
        code,
        redirectUri,
        extraParams: {
          code_verifier: codeVerifier,
        },
      },
      discovery
    );
    return tokenResponse.accessToken;
  } catch (error) {
    console.error('Token exchange error:', error);
    return null;
  }
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
}

/**
 * Google Calendar API からイベントを取得
 */
export async function fetchCalendarEvents(
  accessToken: string,
  timeMin: Date,
  timeMax: Date
): Promise<CalendarEvent[]> {
  try {
    const params = new URLSearchParams({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '100',
    });

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Calendar API error: ${response.status}`);
    }

    const data = await response.json();
    return data.items || [];
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
