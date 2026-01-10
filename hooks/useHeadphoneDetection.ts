import { useState, useEffect } from 'react';
import { Platform } from 'react-native';

// react-native-headphone-detection の型定義
interface HeadphoneDetectionModule {
  isAudioDeviceConnected: () => Promise<{ audioJack: boolean; bluetooth: boolean }>;
  addListener: (callback: (data: { audioJack: boolean; bluetooth: boolean }) => void) => { remove: () => void };
}

/**
 * ヘッドフォン/イヤフォン接続を検出するフック
 *
 * @returns {boolean} isConnected - ヘッドフォンが接続されているかどうか
 */
export function useHeadphoneDetection(): boolean {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    let subscription: { remove: () => void } | null = null;

    const checkHeadphones = async () => {
      try {
        // 動的インポートでネイティブモジュールを読み込み
        const HeadphoneDetection: HeadphoneDetectionModule = require('react-native-headphone-detection').default;

        // 初期状態をチェック
        const status = await HeadphoneDetection.isAudioDeviceConnected();
        setIsConnected(status.audioJack || status.bluetooth);

        // 接続状態の変更を監視
        subscription = HeadphoneDetection.addListener((data) => {
          setIsConnected(data.audioJack || data.bluetooth);
        });
      } catch (error) {
        // ネイティブモジュールが利用できない場合（Expo Goなど）
        console.log('Headphone detection not available:', error);
        setIsConnected(false);
      }
    };

    // iOS/Androidのみで実行（Webは対象外）
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      checkHeadphones();
    }

    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, []);

  return isConnected;
}
