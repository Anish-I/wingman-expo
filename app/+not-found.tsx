import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { wingmanFonts } from '@/features/wingman/theme';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View style={styles.container}>
        <Text style={styles.title}>That screen flew away.</Text>

        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Go back to Wingman</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#FBF5E9',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    fontFamily: wingmanFonts.display,
    color: '#1B2240',
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
  linkText: {
    fontSize: 14,
    color: '#2563EB',
    fontFamily: wingmanFonts.text,
    fontWeight: '800',
  },
});
