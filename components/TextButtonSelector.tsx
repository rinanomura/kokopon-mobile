import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useThemeColors } from '@/hooks/useThemeColors';

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
  const colors = useThemeColors();

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.textPrimary }]}>{label}</Text>
      <View style={styles.buttonsRow}>
        {options.map((option) => {
          const isSelected = value === option.value;
          return (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.button,
                {
                  backgroundColor: colors.selectorBg,
                  borderColor: colors.selectorBorder,
                },
                isSelected && {
                  backgroundColor: colors.selectorSelectedBg,
                  borderColor: colors.selectorSelectedBorder,
                  shadowColor: colors.accent,
                },
              ]}
              onPress={() => onValueChange(option.value)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.buttonText,
                  { color: colors.textSecondary },
                  isSelected && { color: colors.selectorSelectedText },
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
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});
