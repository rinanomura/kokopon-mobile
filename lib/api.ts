import { generateClient } from "aws-amplify/api";
import { getCurrentUser } from "aws-amplify/auth";

// GraphQL クライアント（遅延初期化）
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _client: any = null;

function getClient() {
  if (!_client) {
    _client = generateClient();
  }
  return _client;
}

/**
 * GraphQL クライアントをリセット
 * ログアウト時に呼び出す
 */
export function resetClient(): void {
  _client = null;
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
// EventClassification 関連のクエリ・ミューテーション
// ========================================

// EventClassification 作成
export const createEventClassificationMutation = /* GraphQL */ `
  mutation CreateEventClassification($input: CreateEventClassificationInput!) {
    createEventClassification(input: $input) {
      id
      userId
      eventId
      eventSummary
      eventStart
      eventEnd
      participants
      relationships
      format
      eventType
      stressScore
      attendeeIds
      isManuallyEdited
      source
      createdAt
      updatedAt
      owner
    }
  }
`;

// EventClassification 更新
export const updateEventClassificationMutation = /* GraphQL */ `
  mutation UpdateEventClassification($input: UpdateEventClassificationInput!) {
    updateEventClassification(input: $input) {
      id
      userId
      eventId
      eventSummary
      eventStart
      eventEnd
      participants
      relationships
      format
      eventType
      stressScore
      attendeeIds
      isManuallyEdited
      source
      createdAt
      updatedAt
      owner
    }
  }
`;

// EventClassification 削除
export const deleteEventClassificationMutation = /* GraphQL */ `
  mutation DeleteEventClassification($input: DeleteEventClassificationInput!) {
    deleteEventClassification(input: $input) {
      id
    }
  }
`;

// EventClassification 一覧取得
export const listEventClassificationsQuery = /* GraphQL */ `
  query ListEventClassifications($filter: ModelEventClassificationFilterInput, $limit: Int, $nextToken: String) {
    listEventClassifications(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items {
        id
        userId
        eventId
        eventSummary
        eventStart
        eventEnd
        participants
        relationships
        format
        eventType
        stressScore
        attendeeIds
        isManuallyEdited
        source
        createdAt
        updatedAt
        owner
      }
      nextToken
    }
  }
`;

// ========================================
// Person 関連のクエリ・ミューテーション
// ========================================

// Person 作成
export const createPersonMutation = /* GraphQL */ `
  mutation CreatePerson($input: CreatePersonInput!) {
    createPerson(input: $input) {
      id
      personId
      name
      createdAt
      updatedAt
      owner
    }
  }
`;

// Person 更新
export const updatePersonMutation = /* GraphQL */ `
  mutation UpdatePerson($input: UpdatePersonInput!) {
    updatePerson(input: $input) {
      id
      personId
      name
      createdAt
      updatedAt
      owner
    }
  }
`;

// Person 削除
export const deletePersonMutation = /* GraphQL */ `
  mutation DeletePerson($input: DeletePersonInput!) {
    deletePerson(input: $input) {
      id
    }
  }
`;

// Person 一覧取得
export const listPeopleQuery = /* GraphQL */ `
  query ListPeople($filter: ModelPersonFilterInput, $limit: Int, $nextToken: String) {
    listPeople(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items {
        id
        personId
        name
        createdAt
        updatedAt
        owner
      }
      nextToken
    }
  }
`;

// ========================================
// 型定義
// ========================================

// EventClassification 型
export type EventClassificationParticipants = 'solo' | 'small' | 'large';
export type EventClassificationRelationship = 'family' | 'work' | 'friend' | 'stranger';
export type EventClassificationFormat = 'online' | 'onsite';
export type EventClassificationSource = 'ai' | 'manual';

export interface EventClassificationInput {
  userId: string;
  eventId: string;
  eventSummary: string;
  eventStart: string;
  eventEnd: string;
  participants?: EventClassificationParticipants;
  relationships?: EventClassificationRelationship[] | null;
  format?: EventClassificationFormat;
  eventType?: string;
  stressScore?: number;
  attendeeIds?: string[] | null;
  isManuallyEdited?: boolean;
  source?: EventClassificationSource;
}

export interface EventClassification extends EventClassificationInput {
  id: string;
  createdAt: string;
  updatedAt: string;
  owner?: string;
}

// Person 型
export interface PersonInput {
  personId: string;
  name: string;
}

export interface Person extends PersonInput {
  id: string;
  createdAt: string;
  updatedAt: string;
  owner?: string;
}

export interface SessionLogInput {
  userId: string;
  timestamp: string;
  beforeValence: number;
  beforeArousal: number;
  afterValence?: number;
  afterArousal?: number;
  meditationType?: string;
  duration?: number;
  memo?: string;
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
 * memo はバックエンド対応完了後に送信を有効化する
 */
export async function updateSessionLog(
  id: string,
  afterValence: number,
  afterArousal: number,
  memo?: string
): Promise<SessionLog> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const input: any = {
    id,
    afterValence,
    afterArousal,
  };
  // TODO: バックエンド対応完了後にコメントアウトを解除
  // if (memo) {
  //   input.memo = memo;
  // }
  const result = await getClient().graphql({
    query: updateSessionLogMutation,
    variables: { input },
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

// ========================================
// EventClassification API
// ========================================

/**
 * EventClassification を作成
 */
export async function createEventClassification(input: EventClassificationInput): Promise<EventClassification> {
  const result = await getClient().graphql({
    query: createEventClassificationMutation,
    variables: { input },
  });
  return (result as any).data.createEventClassification;
}

/**
 * EventClassification を更新
 */
export async function updateEventClassification(
  id: string,
  updates: Partial<Omit<EventClassificationInput, 'userId' | 'eventId'>>
): Promise<EventClassification> {
  const result = await getClient().graphql({
    query: updateEventClassificationMutation,
    variables: {
      input: {
        id,
        ...updates,
      },
    },
  });
  return (result as any).data.updateEventClassification;
}

/**
 * EventClassification を削除
 */
export async function deleteEventClassification(id: string): Promise<void> {
  await getClient().graphql({
    query: deleteEventClassificationMutation,
    variables: {
      input: { id },
    },
  });
}

/**
 * EventClassification 一覧を取得
 */
export async function listEventClassifications(): Promise<EventClassification[]> {
  const result = await getClient().graphql({
    query: listEventClassificationsQuery,
    variables: {},
  });
  return (result as any).data.listEventClassifications.items;
}

/**
 * 複数のEventClassificationを一括作成
 */
export async function batchCreateEventClassifications(
  inputs: EventClassificationInput[]
): Promise<EventClassification[]> {
  const results = await Promise.all(
    inputs.map((input) => createEventClassification(input))
  );
  return results;
}

// ========================================
// Person 関連の関数
// ========================================

/**
 * Person を作成
 */
export async function createPerson(input: PersonInput): Promise<Person> {
  const result = await getClient().graphql({
    query: createPersonMutation,
    variables: { input },
  });
  return (result as any).data.createPerson;
}

/**
 * Person を更新
 */
export async function updatePerson(
  id: string,
  updates: Partial<PersonInput>
): Promise<Person> {
  const result = await getClient().graphql({
    query: updatePersonMutation,
    variables: {
      input: {
        id,
        ...updates,
      },
    },
  });
  return (result as any).data.updatePerson;
}

/**
 * Person を削除
 */
export async function deletePerson(id: string): Promise<void> {
  await getClient().graphql({
    query: deletePersonMutation,
    variables: {
      input: { id },
    },
  });
}

/**
 * Person 一覧を取得
 */
export async function listPeople(): Promise<Person[]> {
  const result = await getClient().graphql({
    query: listPeopleQuery,
    variables: {},
  });
  return (result as any).data.listPeople.items;
}
