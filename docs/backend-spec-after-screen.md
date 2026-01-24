# バックエンド仕様書: トレーニング後画面 (After Screen)

## 概要

トレーニング終了後の記録画面で、ユーザーがテキストメモを残せるようにする。
既存の `SessionLog` モデルに `memo` フィールドを追加する。

## 変更内容

### SessionLog モデル変更

| フィールド | 型 | 必須 | 説明 |
|-----------|------|------|------|
| `memo` | `String` | No | トレーニング後のユーザーメモ（任意入力） |

### GraphQL スキーマ変更

```graphql
type SessionLog @model @auth(rules: [{allow: owner}]) {
  id: ID!
  userId: String!
  timestamp: AWSDateTime!
  beforeValence: Float!
  beforeArousal: Float!
  afterValence: Float
  afterArousal: Float
  meditationType: String
  duration: Int
  memo: String          # <-- 新規追加
  deleted: Boolean
}
```

### Input 型の変更

```graphql
input CreateSessionLogInput {
  userId: String!
  timestamp: AWSDateTime!
  beforeValence: Float!
  beforeArousal: Float!
  afterValence: Float
  afterArousal: Float
  meditationType: String
  duration: Int
  memo: String          # <-- 新規追加
  deleted: Boolean
}

input UpdateSessionLogInput {
  id: ID!
  userId: String
  timestamp: AWSDateTime
  beforeValence: Float
  beforeArousal: Float
  afterValence: Float
  afterArousal: Float
  meditationType: String
  duration: Int
  memo: String          # <-- 新規追加
  deleted: Boolean
}
```

## API 動作

### UpdateSessionLog ミューテーション

トレーニング終了後、フロントエンドから以下のようなリクエストが送信される:

```graphql
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
    memo
    deleted
    createdAt
    updatedAt
    owner
  }
}
```

リクエスト例:
```json
{
  "input": {
    "id": "session-123",
    "afterValence": 0.5,
    "afterArousal": -0.3,
    "memo": "呼吸に集中できた"
  }
}
```

## フロントエンド対応

- `memo` フィールドがバックエンドに存在しない間は、フロントエンドは `memo` を送信しない（エラー回避）
- バックエンド対応完了後、フロントエンドの `updateSessionLog` 関数で `memo` の送信を有効化する

## マイグレーション

- `memo` は nullable なオプショナルフィールドのため、既存データへの影響なし
- DynamoDB の場合は特別なマイグレーション不要（スキーマレス）

## テスト観点

1. `memo` なしで SessionLog を更新できること
2. `memo` ありで SessionLog を更新できること
3. `memo` を含む SessionLog を取得できること
4. 既存の SessionLog（memo なし）を取得しても問題ないこと
