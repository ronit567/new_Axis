import React from 'react';
import { View, TextInput, Pressable, StyleSheet } from 'react-native';
import { COLORS, SIZES } from '../../constants/theme';
import LockedHint from './LockedHint';

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
      {locked && <LockedHint label="Title requires review to change" />}
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
});
