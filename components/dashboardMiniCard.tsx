import { ReactNode } from 'react';
import { StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';

type DashboardMiniCardProps = {
  title: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
  minHeight?: number;
};

export default function DashboardMiniCard({
  title,
  children,
  style,
  titleStyle,
  minHeight = 136,
}: DashboardMiniCardProps) {
  return (
    <View style={[styles.card, { minHeight }, style]}>
      <Text style={[styles.title, titleStyle]}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
  },
});