import { Alert } from 'react-native';

export function presentImportSummary(summary: string, onDone: () => void) {
  Alert.alert('Import terminé', summary, [{ text: 'OK', onPress: onDone }]);
}
