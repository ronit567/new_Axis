import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { COLORS, SIZES } from '../constants/theme';

export default function StepHeader({ currentStep, totalSteps = 3, onBack }) {
  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn}>
        <Text style={styles.backArrow}>‹</Text>
      </TouchableOpacity>
      <View style={styles.stepsRow}>
        {Array.from({ length: totalSteps }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.step,
              i < currentStep ? styles.stepActive : styles.stepInactive,
              i < totalSteps - 1 ? styles.stepMargin : null,
            ]}
          />
        ))}
      </View>
      <View style={styles.placeholder} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: 24,
    color: COLORS.text,
    lineHeight: 28,
    marginTop: -2,
  },
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  step: {
    height: 4,
    width: 32,
    borderRadius: 2,
  },
  stepActive: {
    backgroundColor: COLORS.stepActive,
  },
  stepInactive: {
    backgroundColor: COLORS.stepInactive,
  },
  stepMargin: {
    marginRight: 6,
  },
  placeholder: {
    width: 36,
  },
});
