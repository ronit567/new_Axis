import { useRef } from 'react';
import { Animated } from 'react-native';

/**
 * The hairline under a fixed header, faded in as content scrolls beneath it:
 * the header sits flush at rest and gains definition once there is something
 * passing under it. Pair with <ScrollHairline opacity={hairlineOpacity} />, and
 * pass `onScroll` to the list.
 *
 * Home, Search, Saved and Messages each carried this block verbatim — the same
 * Animated.Value, the same 0–14pt fade and the same native-driven scroll event.
 *
 * Native-driven, so the fade runs on the UI thread and does not re-render the
 * screen per frame.
 */
export function useScrollHairline() {
  const scrollY = useRef(new Animated.Value(0)).current;

  const hairlineOpacity = scrollY.interpolate({
    inputRange: [0, 14],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const onScroll = Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
    useNativeDriver: true,
  });

  return { onScroll, hairlineOpacity };
}
