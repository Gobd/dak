import { Link, Stack } from 'expo-router';
import { View, Text } from 'react-native';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View className="flex-1 items-center justify-center bg-black p-5">
        <Text className="text-white text-xl font-bold">{"This screen doesn't exist."}</Text>

        <Link href="/" className="mt-4 py-4">
          <Text className="text-primary-400 text-sm">Go to home screen!</Text>
        </Link>
      </View>
    </>
  );
}
