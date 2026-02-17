import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export interface TextButtonOption {
  value: number;
  label: string;
}

interface TextButtonSelectorProps {
  label: string;
  options: TextButtonOption[];
  value: number;
  onValueChange: (value: number) => void;
}

export default function TextButtonSelector({
  label,
  options,
  value,
  onValueChange,
}: TextButtonSelectorProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.buttonsRow}>
        {options.map((option) => {
          const isSelected = value === option.value;
          return (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.button,
                isSelected && styles.buttonSelected,
              ]}
              onPress={() => onValueChange(option.value)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.buttonText,
                  isSelected && styles.buttonTextSelected,
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 0,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4A5568',
    marginBottom: 8,
    textAlign: 'center',
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderWidth: 2,
    borderColor: 'rgba(255, 182, 193, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSelected: {
    backgroundColor: '#FF85A2',
    borderColor: '#FF85A2',
    shadowColor: '#FF85A2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#718096',
    textAlign: 'center',
  },
  buttonTextSelected: {
    color: '#FFFFFF',
  },
});
