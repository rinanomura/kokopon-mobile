import { generateClient } from "aws-amplify/api";
import { getCurrentUser } from "aws-amplify/auth";

// GraphQL クライアント（遅延初期化）
let _client: ReturnType<typeof generateClient> | null = null;

function getClient() {
  if (!_client) {
    _client = generateClient();
  }
  return _client;
}

// ========================================
// EmotionLog 関連のクエリ・ミューテーション
// ========================================

// EmotionLog 作成
export const createEmotionLogMutation = /* GraphQL */ `
  mutation CreateEmotionLog($input: CreateEmotionLogInput!) {
    createEmotionLog(input: $input) {
      id
      userId
      timestamp
      valence
      arousal
      deleted
      createdAt
      updatedAt
      owner
    }
  }
`;

// EmotionLog 一覧取得
export const listEmotionLogsQuery = /* GraphQL */ `
  query ListEmotionLogs($filter: ModelEmotionLogFilterInput, $limit: Int, $nextToken: String) {
    listEmotionLogs(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items {
        id
        userId
        timestamp
        valence
        arousal
        deleted
        createdAt
        updatedAt
        owner
      }
      nextToken
    }
  }
`;

// ========================================
// MeditationLog 関連のクエリ・ミューテーション
// ========================================

// MeditationLog 作成
export const createMeditationLogMutation = /* GraphQL */ `
  mutation CreateMeditationLog($input: CreateMeditationLogInput!) {
    createMeditationLog(input: $input) {
      id
      userId
      timestamp
      duration
      meditationType
      deleted
      createdAt
      updatedAt
      owner
    }
  }
`;

// MeditationLog 一覧取得
export const listMeditationLogsQuery = /* GraphQL */ `
  query ListMeditationLogs($filter: ModelMeditationLogFilterInput, $limit: Int, $nextToken: String) {
    listMeditationLogs(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items {
        id
        userId
        timestamp
        duration
        meditationType
        deleted
        createdAt
        updatedAt
        owner
      }
      nextToken
    }
  }
`;

// ========================================
// SessionLog 関連のクエリ・ミューテーション
// ========================================

// SessionLog 作成
export const createSessionLogMutation = /* GraphQL */ `
  mutation CreateSessionLog($input: CreateSessionLogInput!) {
    createSessionLog(input: $input) {
      id
      userId
      timestamp
      beforeValence
      beforeArousal
      afterValence
      afterArousal
      meditationType
      duration
      deleted
      createdAt
      updatedAt
      owner
    }
  }
`;

// SessionLog 更新（afterを追加するため）
export const updateSessionLogMutation = /* GraphQL */ `
  mutation UpdateSessionLog($input: UpdateSessionLogInput!) {
    updateSessionLog(input: $input) {
      id
      userId
      timestamp
      beforeValence
      beforeArousal
      afterValence
      afterArousal
      meditationType
      duration
      deleted
      createdAt
      updatedAt
      owner
    }
  }
`;

// SessionLog 一覧取得
export const listSessionLogsQuery = /* GraphQL */ `
  query ListSessionLogs($filter: ModelSessionLogFilterInput, $limit: Int, $nextToken: String) {
    listSessionLogs(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items {
        id
        userId
        timestamp
        beforeValence
        beforeArousal
        afterValence
        afterArousal
        meditationType
        duration
        deleted
        createdAt
        updatedAt
        owner
      }
      nextToken
    }
  }
`;

// SessionLog 単一取得
export const getSessionLogQuery = /* GraphQL */ `
  query GetSessionLog($id: ID!) {
    getSessionLog(id: $id) {
      id
      userId
      timestamp
      beforeValence
      beforeArousal
      afterValence
      afterArousal
      meditationType
      duration
      deleted
      createdAt
      updatedAt
      owner
    }
  }
`;

// ========================================
// 型定義
// ========================================

export interface SessionLogInput {
  userId: string;
  timestamp: string;
  beforeValence: number;
  beforeArousal: number;
  afterValence?: number;
  afterArousal?: number;
  meditationType?: string;
  duration?: number;
  deleted?: boolean;
}

export interface SessionLog extends SessionLogInput {
  id: string;
  createdAt: string;
  updatedAt: string;
  owner?: string;
}

export interface EmotionLogInput {
  userId: string;
  timestamp: string;  // ISO8601 形式
  valence: number;    // -1 〜 1（x軸：ネガティブ〜ポジティブ）
  arousal: number;    // -1 〜 1（y軸：低覚醒〜高覚醒）
  deleted?: boolean;
}

export interface EmotionLog extends EmotionLogInput {
  id: string;
  createdAt: string;
  updatedAt: string;
  owner?: string;
}

export interface MeditationLogInput {
  userId: string;
  timestamp: string;
  duration: number;       // 秒単位
  meditationType: string; // "breathing", "body_scan", etc.
  deleted?: boolean;
}

export interface MeditationLog extends MeditationLogInput {
  id: string;
  createdAt: string;
  updatedAt: string;
  owner?: string;
}

// ========================================
// API ヘルパー関数
// ========================================

/**
 * 現在のユーザーID を取得
 */
export async function getUserId(): Promise<string> {
  const user = await getCurrentUser();
  return user.userId;
}

/**
 * EmotionLog を作成
 */
export async function createEmotionLog(input: EmotionLogInput): Promise<EmotionLog> {
  const result = await getClient().graphql({
    query: createEmotionLogMutation,
    variables: { input },
  });
  return (result as any).data.createEmotionLog;
}

/**
 * EmotionLog 一覧を取得（削除されていないもの）
 */
export async function listEmotionLogs(): Promise<EmotionLog[]> {
  const result = await getClient().graphql({
    query: listEmotionLogsQuery,
    variables: {
      filter: {
        deleted: { ne: true },
      },
    },
  });
  return (result as any).data.listEmotionLogs.items;
}

/**
 * MeditationLog を作成
 */
export async function createMeditationLog(input: MeditationLogInput): Promise<MeditationLog> {
  const result = await getClient().graphql({
    query: createMeditationLogMutation,
    variables: { input },
  });
  return (result as any).data.createMeditationLog;
}

/**
 * MeditationLog 一覧を取得（削除されていないもの）
 */
export async function listMeditationLogs(): Promise<MeditationLog[]> {
  const result = await getClient().graphql({
    query: listMeditationLogsQuery,
    variables: {
      filter: {
        deleted: { ne: true },
      },
    },
  });
  return (result as any).data.listMeditationLogs.items;
}

// ========================================
// SessionLog API
// ========================================

/**
 * SessionLog を作成（瞑想開始時に before を保存）
 */
export async function createSessionLog(input: SessionLogInput): Promise<SessionLog> {
  const result = await getClient().graphql({
    query: createSessionLogMutation,
    variables: { input },
  });
  return (result as any).data.createSessionLog;
}

/**
 * SessionLog を取得（IDで1件取得）
 */
export async function getSessionLog(id: string): Promise<SessionLog | null> {
  const result = await getClient().graphql({
    query: getSessionLogQuery,
    variables: { id },
  });
  return (result as any).data.getSessionLog;
}

/**
 * SessionLog を更新（瞑想終了時に after を追加）
 */
export async function updateSessionLog(
  id: string,
  afterValence: number,
  afterArousal: number
): Promise<SessionLog> {
  const result = await getClient().graphql({
    query: updateSessionLogMutation,
    variables: {
      input: {
        id,
        afterValence,
        afterArousal,
      },
    },
  });
  return (result as any).data.updateSessionLog;
}

/**
 * SessionLog 一覧を取得（削除されていないもの）
 */
export async function listSessionLogs(): Promise<SessionLog[]> {
  const result = await getClient().graphql({
    query: listSessionLogsQuery,
    variables: {
      filter: {
        deleted: { ne: true },
      },
    },
  });
  return (result as any).data.listSessionLogs.items;
}
