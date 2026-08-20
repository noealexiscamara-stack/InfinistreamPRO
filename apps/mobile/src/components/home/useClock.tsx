import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, typography } from '@/theme/tokens';

/** Live clock for the home header — updates every 30s (minute resolution is enough). */
export function useClock(): { time: string; date: string } {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  return {
    time: formatTime(now),
    date: formatDate(now),
  };
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatDate(d: Date): string {
  const raw = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function ClockLabel() {
  const { time, date } = useClock();
  return (
    <View style={styles.wrap}>
      <Text style={styles.time}>{time}</Text>
      <Text style={styles.date}>{date}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'flex-end', minWidth: 52 },
  time: { ...typography.bodyStrong, color: colors.textPrimary, fontVariant: ['tabular-nums'] },
  date: { ...typography.caption, color: colors.textSecondary, fontSize: 11 },
});
