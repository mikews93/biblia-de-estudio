import { type PropsWithChildren, useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Platform, type StyleProp, type ViewStyle } from 'react-native';

type Props = PropsWithChildren<{ from?: number; delay?: number; style?: StyleProp<ViewStyle> }>;

/** Entrada sutil: aparece y sube unos píxeles. Respeta «reducir movimiento». */
export default function Appear({ from = 8, delay = 0, style, children }: Props) {
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (cancelled) return;
        if (reduce) t.setValue(1);
        else Animated.timing(t, { toValue: 1, duration: 220, delay, useNativeDriver: Platform.OS !== 'web' }).start();
      });
    return () => {
      cancelled = true;
    };
  }, [t, delay]);

  const translateY = t.interpolate({ inputRange: [0, 1], outputRange: [from, 0] });
  return <Animated.View style={[style, { opacity: t, transform: [{ translateY }] }]}>{children}</Animated.View>;
}
