import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  createSessionLog,
  listSessionLogs,
  getUserId,
  SessionLog,
} from '@/lib/api';

/**
 * API動作確認画面
 *
 * GraphQL API（AppSync）への接続テスト用
 */
export default function ExploreScreen() {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<SessionLog[]>([]);
  const [message, setMessage] = useState<string>('');

  /**
   * テスト用 SessionLog を作成
   */
  const handleCreateLog = async () => {
    setLoading(true);
    setMessage('');
    try {
      const userId = await getUserId();
      const now = new Date().toISOString();

      // ランダムな感情座標を生成
      const beforeValence = Math.random() * 2 - 1;  // -1 〜 1
      const beforeArousal = Math.random() * 2 - 1;  // -1 〜 1
      const afterValence = Math.random() * 2 - 1;
      const afterArousal = Math.random() * 2 - 1;

      const result = await createSessionLog({
        userId,
        timestamp: now,
        beforeValence,
        beforeArousal,
        afterValence,
        afterArousal,
        meditationType: 'breathing',
        duration: 30,
      });

      setMessage(`作成成功: ID=${result.id}`);
      console.log('=== SessionLog 作成成功 ===');
      console.log(result);
    } catch (error) {
      console.error('SessionLog 作成エラー:', error);
      setMessage(`エラー: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  /**
   * SessionLog 一覧を取得
   */
  const handleListLogs = async () => {
    setLoading(true);
    setMessage('');
    try {
      const items = await listSessionLogs();
      setLogs(items);
      setMessage(`${items.length} 件取得しました`);
      console.log('=== SessionLog 一覧取得成功 ===');
      console.log(items);
    } catch (error) {
      console.error('SessionLog 取得エラー:', error);
      setMessage(`エラー: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={['#7AD7F0', '#CDECF6']}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* タイトル */}
          <Text style={styles.title}>API 動作確認</Text>
          <Text style={styles.subtitle}>
            AppSync GraphQL への接続テスト
          </Text>

          {/* ボタン群 */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.button}
              onPress={handleCreateLog}
              disabled={loading}
            >
              <LinearGradient
                colors={['#FF85A2', '#FFB6C1']}
                style={styles.buttonGradient}
              >
                <Text style={styles.buttonText}>
                  SessionLog 作成（テスト）
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.button}
              onPress={handleListLogs}
              disabled={loading}
            >
              <LinearGradient
                colors={['#85C1E9', '#AED6F1']}
                style={styles.buttonGradient}
              >
                <Text style={styles.buttonText}>
                  SessionLog 一覧取得
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* ローディング */}
          {loading && (
            <ActivityIndicator size="large" color="#FF85A2" style={styles.loading} />
          )}

          {/* メッセージ */}
          {message !== '' && (
            <View style={styles.messageContainer}>
              <Text style={styles.message}>{message}</Text>
            </View>
          )}

          {/* ログ一覧 */}
          {logs.length > 0 && (
            <View style={styles.logsContainer}>
              <Text style={styles.logsTitle}>SessionLog 一覧</Text>
              {logs.map((log) => (
                <View key={log.id} style={styles.logItem}>
                  <Text style={styles.logId}>ID: {log.id.slice(0, 8)}...</Text>
                  <Text style={styles.logDetail}>
                    Before: ({log.beforeValence.toFixed(2)}, {log.beforeArousal.toFixed(2)})
                  </Text>
                  <Text style={styles.logDetail}>
                    After: ({log.afterValence?.toFixed(2) ?? '-'}, {log.afterArousal?.toFixed(2) ?? '-'})
                  </Text>
                  <Text style={styles.logTimestamp}>
                    {log.meditationType} / {log.duration}秒
                  </Text>
                  <Text style={styles.logTimestamp}>
                    {new Date(log.timestamp).toLocaleString('ja-JP')}
                  </Text>
                </View>
              ))}
            </View>
          )}
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
  scrollContent: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#4A5568',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#718096',
    textAlign: 'center',
    marginBottom: 24,
  },
  buttonContainer: {
    gap: 16,
    marginBottom: 24,
  },
  button: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonGradient: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  loading: {
    marginVertical: 20,
  },
  messageContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  message: {
    fontSize: 14,
    color: '#4A5568',
    textAlign: 'center',
  },
  logsContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 16,
  },
  logsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4A5568',
    marginBottom: 16,
  },
  logItem: {
    backgroundColor: 'rgba(122, 215, 240, 0.2)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  logId: {
    fontSize: 12,
    color: '#718096',
    marginBottom: 4,
  },
  logDetail: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4A5568',
    marginBottom: 4,
  },
  logTimestamp: {
    fontSize: 12,
    color: '#A0AEC0',
  },
});
