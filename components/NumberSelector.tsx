import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface NumberSelectorProps {
  label: string;
  leftLabel: string;
  rightLabel: string;
  value: number;          // 1 ~ 5
  onValueChange: (value: number) => void;
}

const OPTIONS = [1, 2, 3, 4, 5];

export default function NumberSelector({
  label,
  leftLabel,
  rightLabel,
  value,
  onValueChange,
}: NumberSelectorProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.barContainer}>
        <View style={styles.bar} />
        <View style={styles.numbersRow}>
          {OPTIONS.map((num) => {
            const isSelected = value === num;
            return (
              <TouchableOpacity
                key={num}
                style={[
                  styles.numberButton,
                  isSelected && styles.numberButtonSelected,
                ]}
                onPress={() => onValueChange(num)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.numberText,
                    isSelected && styles.numberTextSelected,
                  ]}
                >
                  {num}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
      <View style={styles.edgeLabelRow}>
        <Text style={styles.edgeLabel}>{leftLabel}</Text>
        <Text style={styles.edgeLabel}>{rightLabel}</Text>
      </View>
    </View>
  );
}

const BUTTON_SIZE = 40;

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4A5568',
    marginBottom: 8,
    textAlign: 'center',
  },
  barContainer: {
    height: BUTTON_SIZE,
    justifyContent: 'center',
    marginHorizontal: 8,
  },
  bar: {
    position: 'absolute',
    left: BUTTON_SIZE / 2,
    right: BUTTON_SIZE / 2,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 182, 193, 0.3)',
  },
  numbersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  numberButton: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 182, 193, 0.3)',
  },
  numberButtonSelected: {
    backgroundColor: '#FF85A2',
    borderColor: '#FF85A2',
    shadowColor: '#FF85A2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  numberText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#718096',
  },
  numberTextSelected: {
    color: '#FFFFFF',
  },
  edgeLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginTop: 4,
  },
  edgeLabel: {
    fontSize: 11,
    color: '#718096',
  },
});
