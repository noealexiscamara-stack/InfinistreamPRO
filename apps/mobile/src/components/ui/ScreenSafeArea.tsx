import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';

/**
 * Applies safe-area padding on the chosen edges.
 *
 * Uses explicit inset padding (not only SafeAreaView) so landscape Android
 * 3-button nav bars (right/left) are respected even when the system reports
 * zero through SafeAreaView alone on some OEM builds.
 */
export function ScreenSafeArea({
  children,
  edges = ['top', 'bottom', 'left', 'right'],
  style,
}: {
  children: ReactNode;
  edges?: Edge[];
  style?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  const edgeSet = new Set(edges);

  return (
    <View
      style={[
        styles.root,
        {
          paddingTop: edgeSet.has('top') ? insets.top : 0,
          paddingBottom: edgeSet.has('bottom') ? insets.bottom : 0,
          paddingLeft: edgeSet.has('left') ? Math.max(insets.left, 0) : 0,
          paddingRight: edgeSet.has('right') ? Math.max(insets.right, 0) : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
