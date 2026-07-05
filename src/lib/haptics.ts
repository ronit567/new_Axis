import * as Haptics from 'expo-haptics';

/**
 * Thin wrappers around expo-haptics. Each call is fire-and-forget and swallows
 * errors so unsupported platforms (e.g. web) never throw at a call site.
 */
export const haptics = {
  /** Light selection feedback — nav taps, toggles, chip selects. */
  tap() {
    Haptics.selectionAsync().catch(() => {});
  },
  /** Medium impact — primary actions like posting or confirming. */
  impact() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  },
};
