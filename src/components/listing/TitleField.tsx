import React from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES } from '../../constants/theme';

type Props = {
  value: string;
  onChange: (title: string) => void;
  // EditListingScreen: title is a scam-vector field — locked once the
  // listing is engaged. A transparent overlay (rather than just
  // editable={false}) is needed because a disabled TextInput still normally
  // swallows the tap instead of surfacing the "requires review" affordance.
  locked?: boolean;
  onLockedPress?: () => void;
};

export default function TitleField({ value, onChange, locked, onLockedPress }: Props) {
  return (
    <View>
      <View>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChange}
          placeholder="What are you selling?"
          placeholderTextColor={COLORS.textMuted}
          returnKeyType="next"
          editable={!locked}
        />
        {locked && <Pressable style={StyleSheet.absoluteFill} onPress={onLockedPress} />}
      </View>
      {locked && (
        <View style={styles.lockedHint}>
          <Ionicons name="lock-closed-outline" size={13} color={COLORS.textMuted} />
          <Text style={styles.lockedHintText}>Title requires review to change</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1.5,
    borderColor: COLORS.inputBorder,
    borderRadius: SIZES.borderRadius,
    height: SIZES.inputHeight,
    paddingHorizontal: 16,
    fontSize: SIZES.base,
    color: COLORS.text,
    backgroundColor: COLORS.white,
  },
  lockedHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  lockedHintText: {
    fontSize: SIZES.xs,
    color: COLORS.textMuted,
  },
});
