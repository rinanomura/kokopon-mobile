import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { Ionicons } from '@expo/vector-icons';

interface SwipeableCardProps {
  onDelete: () => void;
  onSave?: () => void;
  isSaved?: boolean;
  saving?: boolean;
  hideLeftActions?: boolean;
  children: React.ReactNode;
}

export function SwipeableCard({ onDelete, onSave, isSaved, saving, hideLeftActions, children }: SwipeableCardProps) {
  const swipeableRef = useRef<Swipeable>(null);

  const renderRightActions = () => (
    <TouchableOpacity
      style={styles.deleteAction}
      onPress={() => {
        swipeableRef.current?.close();
        onDelete();
      }}
      activeOpacity={0.7}
    >
      <Ionicons name="trash-outline" size={22} color="#fff" />
      <Text style={styles.actionText}>削除</Text>
    </TouchableOpacity>
  );

  const renderLeftActions = () => {
    if (saving) {
      return (
        <View style={styles.savingAction}>
          <ActivityIndicator size="small" color="#fff" />
          <Text style={styles.actionText}>保存中</Text>
        </View>
      );
    }
    if (isSaved) {
      return (
        <View style={styles.alreadySavedAction}>
          <Ionicons name="checkmark-circle" size={22} color="#fff" />
          <Text style={styles.actionText}>保存済</Text>
        </View>
      );
    }
    return (
      <TouchableOpacity
        style={styles.saveAction}
        onPress={() => {
          swipeableRef.current?.close();
          onSave();
        }}
        activeOpacity={0.7}
      >
        <Ionicons name="cloud-upload-outline" size={22} color="#fff" />
        <Text style={styles.actionText}>保存</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Swipeable
        ref={swipeableRef}
        renderRightActions={renderRightActions}
        renderLeftActions={hideLeftActions ? undefined : renderLeftActions}
        rightThreshold={40}
        leftThreshold={hideLeftActions ? 999 : 40}
        overshootRight={false}
        overshootLeft={false}
      >
        {children}
        {isSaved && (
          <View style={styles.savedBadge}>
            <Ionicons name="checkmark-circle" size={16} color="#4ea892" />
          </View>
        )}
      </Swipeable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
  },
  deleteAction: {
    backgroundColor: '#E53E3E',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: 12,
    marginBottom: 0,
  },
  saveAction: {
    backgroundColor: '#4ea892',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: 12,
    marginBottom: 0,
  },
  savingAction: {
    backgroundColor: '#7BB8A8',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: 12,
    marginBottom: 0,
  },
  alreadySavedAction: {
    backgroundColor: '#A0AEC0',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: 12,
    marginBottom: 0,
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  savedBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
});
