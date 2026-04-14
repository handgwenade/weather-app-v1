import { StyleSheet, Text, View } from 'react-native';

type WeatherCardProps = {
  location: string;
  temperature: string;
  status: string;
  wind: string;
};

export default function WeatherCard({
  location,
  temperature,
  status,
  wind,
}: WeatherCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.location}>{location}</Text>
      <Text style={styles.temp}>{temperature}</Text>
      <Text style={styles.status}>{status}</Text>
      <Text style={styles.wind}>{wind}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    padding: 24,
    borderRadius: 16,
    marginBottom: 16,
  },
  location: {
    fontSize: 20,
    marginBottom: 12,
  },
  temp: {
    fontSize: 64,
    fontWeight: '700',
    marginBottom: 12,
  },
  status: {
    fontSize: 18,
    marginBottom: 8,
  },
  wind: {
    fontSize: 16,
  },
});