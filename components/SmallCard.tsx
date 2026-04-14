import { ReactNode } from 'react';
import { StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';

type SmallCardProps = {
  title: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
};

export default function SmallCard({
  title,
  children,
  style,
  titleStyle,
}: SmallCardProps) {
  return (
    <View style={[styles.smallCard, style]}>
      <Text style={[styles.smallCardTitle, titleStyle]}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  smallCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    padding: 20,
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  smallCardTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 10,
  },
});