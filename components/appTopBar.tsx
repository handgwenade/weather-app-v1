import { StyleSheet, Text, View, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';

type AppTopBarProps = {
  title: string;
};

export default function AppTopBar({ title }: AppTopBarProps) {
  const router = useRouter();

  return (
    <View style={styles.topRow}>
      <Pressable style={styles.circleButton} onPress={() => router.push('/settings')}>
        <Ionicons name="settings-outline" size={24} color="#ffffff" />
      </Pressable>

      <Text style={styles.appTitle}>{title}</Text>

      <Pressable style={styles.circleButton} onPress={() => router.push('/manage-locations')}>
        <Ionicons name="location-outline" size={24} color="#ffffff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  circleButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.28)',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '500',
  },
});