import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

/** Max form width on tablet landscape — fields stay readable, not edge-to-edge. */
export const FORM_MAX_WIDTH = 600;

interface FormKeyboardScreenProps {
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
}

/**
 * Input screens in landscape: scroll + keyboard avoidance, form column centered
 * and width-limited (≈600pt) on wide tablets.
 */
export function FormKeyboardScreen({ children, contentContainerStyle }: FormKeyboardScreenProps) {
  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollOuter}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={[styles.formColumn, contentContainerStyle]}>{children}</View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollOuter: {
    flexGrow: 1,
    alignItems: 'center',
    paddingBottom: 32,
    width: '100%',
  },
  formColumn: {
    width: '100%',
    maxWidth: FORM_MAX_WIDTH,
    alignSelf: 'center',
  },
});
