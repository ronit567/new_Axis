import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { COLORS } from '../../constants/theme';
import { CONTENT_MAX_WIDTH } from '../../lib/layout';

// The page tint behind scrolling content, vs. an opaque sheet that content
// sits directly on. Two names, because the app only ever needs two — the old
// COLORS.background (#F8F8F8) and COLORS.surfaceAlt (#F5F5FA) were a
// distinction nobody could see and everybody had to guess between.
type Background = 'page' | 'surface' | 'none';

type Props = {
  children: React.ReactNode;
  background?: Background;
  // Light content (white glyphs) is for screens whose top is a dark or
  // gradient header; every other screen wants dark.
  statusBar?: 'dark' | 'light';
  edges?: readonly Edge[];
  style?: StyleProp<ViewStyle>;
  /**
   * Opt out of the centred reading column and use the window's full width.
   * For screens whose content is a grid that should gain columns rather than
   * margins on a wide window. See src/lib/layout.ts.
   */
  fullWidth?: boolean;
};

const BACKGROUNDS: Record<Background, string | undefined> = {
  page: COLORS.surfaceAlt,
  surface: COLORS.white,
  none: undefined,
};

// The root of every screen. It exists mainly so a screen cannot *forget* the
// things that used to be forgotten: five screens shipped with no <StatusBar>
// at all, and because MainScreen unmounts tabs on switch, Home's `light` style
// leaked into Saved/Messages/Profile and left the clock invisible on a white
// background. Declaring the status bar here makes that failure unrepresentable
// — there is no "didn't say" state, only a default.
//
// `edges` defaults to the top inset only: the bottom is either owned by the
// floating tab bar's clearance or by a screen's own footer, and letting
// SafeAreaView pad it too would double the gap.
export default function Screen({
  children,
  background = 'page',
  statusBar = 'dark',
  edges = ['top'],
  style,
  fullWidth = false,
}: Props) {
  const backgroundColor = BACKGROUNDS[background];

  // `none` is for screens that paint their own top (Home and Search run a
  // gradient up under the status bar), where a SafeAreaView top inset would
  // cut the gradient off short.
  const Container = edges.length === 0 ? View : SafeAreaView;

  return (
    <Container
      style={[styles.root, backgroundColor ? { backgroundColor } : null, style]}
      {...(edges.length === 0 ? {} : { edges })}
    >
      <StatusBar style={statusBar} />
      {/* On a wide iPad window the content is held to a reading column and
          centred, while the background above still fills the whole window.
          Constrained by default, so a screen added later cannot forget this
          the way screens once forgot their status bar; a grid opts out. On a
          phone the column is simply the full width and changes nothing. */}
      {fullWidth ? children : <View style={styles.column}>{children}</View>}
    </Container>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  column: {
    flex: 1,
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
  },
});
