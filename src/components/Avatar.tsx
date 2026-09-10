import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Image } from 'expo-image';
import { COLORS } from '../constants/theme';
import { useAvatarUrl } from '../lib/avatarUrls';

type Props = {
  // The stored avatar value: an object path inside the private `avatars`
  // bucket (profiles.avatar_url, post-0039), a local file:// uri for an
  // unsaved pick, or null. Absent/null renders the initials + color fallback
  // alone (the pre-AX-403 look).
  url?: string | null;
  initials: string;
  color: string;
  size: number;
  style?: ViewStyle;
  textStyle?: TextStyle;
};

// The one avatar renderer (AX-403). Same layering idiom as ListingCard's
// photo-over-imageColor: the colored initials circle always renders, and the
// photo sits on top once it decodes — so a slow or missing image degrades to
// exactly the old initials look instead of an empty circle.
export default function Avatar({ url, initials, color, size, style, textStyle }: Props) {
  // The single place a stored path becomes a fetchable URL. Resolving here
  // rather than at each of the 12 call sites is what keeps the private-bucket
  // change (0039) from rippling through every screen — and it means one shared
  // cache serves the same person's photo everywhere it appears.
  const resolved = useAvatarUrl(url);

  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color },
        style,
      ]}
    >
      <Text style={[styles.initials, { fontSize: size * 0.38 }, textStyle]}>{initials}</Text>
      {resolved ? (
        <Image
          source={{ uri: resolved }}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
          transition={150}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    // Clips the square Image fill to the circle.
    overflow: 'hidden',
  },
  initials: {
    color: COLORS.white,
    fontWeight: '700',
  },
});
