import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

type LiveHeroMetaProps = {
  locationText: string;
};

export default function LiveHeroMeta({ locationText }: LiveHeroMetaProps) {
  return (
    <View style={styles.centerMeta}>
      <View style={styles.centerLocationRow}>
        <Ionicons name="location-outline" size={16} color="#d6e4ff" />
        <Text style={styles.centerLocationText}>{locationText}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centerMeta: {
    alignItems: 'center',
    marginBottom: 6,
  },
  centerLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  centerLocationText: {
    color: '#d6e4ff',
    fontSize: 16,
    textAlign: 'center',
  },
});