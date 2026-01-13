import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { signOut } from 'aws-amplify/auth';
import { router } from 'expo-router';
import { useTrainingMode, TrainingMode } from '@/hooks/useTrainingMode';
import { resetClient } from '@/lib/api';

/**
 * SettingsScreen - 設定画面
 *
 * ユーザー設定・ログアウト
 */
export default function SettingsScreen() {
  const { mode, setMode } = useTrainingMode();

  const handleModeChange = (newMode: TrainingMode) => {
    setMode(newMode);
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
        <View style={styles.content}>
          <Text style={styles.title}>設定</Text>

          {/* トレーニングモード設定 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>トレーニングモード設定</Text>
            <View style={styles.modeSelector}>
              <TouchableOpacity
                style={[
                  styles.modeButton,
                  mode === 'intuitive' && styles.modeButtonSelected,
                ]}
                onPress={() => handleModeChange('intuitive')}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.modeButtonText,
                  mode === 'intuitive' && styles.modeButtonTextSelected,
                ]}>
                  直感モード
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modeButton,
                  mode === 'verbal' && styles.modeButtonSelected,
                ]}
                onPress={() => handleModeChange('verbal')}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.modeButtonText,
                  mode === 'verbal' && styles.modeButtonTextSelected,
                ]}>
                  言語化モード
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.sectionHint}>途中でいつでも変更できます</Text>
          </View>

          {/* ログアウトボタン */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={handleSignOut}
            activeOpacity={0.7}
          >
            <Text style={styles.menuItemText}>ログアウト</Text>
          </TouchableOpacity>
        </View>
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
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#4A5568',
    marginBottom: 32,
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
  sectionHint: {
    fontSize: 12,
    color: '#718096',
    textAlign: 'center',
    marginTop: 8,
  },
  modeSelector: {
    flexDirection: 'row',
    gap: 12,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: 'rgba(122, 215, 240, 0.2)',
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  modeButtonSelected: {
    backgroundColor: 'rgba(122, 215, 240, 0.3)',
    borderColor: '#5ABFB0',
  },
  modeButtonText: {
    fontSize: 14,
    color: '#718096',
    fontWeight: '500',
  },
  modeButtonTextSelected: {
    color: '#2D7A6E',
    fontWeight: '600',
  },
  menuItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  menuItemText: {
    fontSize: 16,
    color: '#E53E3E',
    fontWeight: '500',
  },
});
