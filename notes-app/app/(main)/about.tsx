import { View, Text, Pressable, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import ArrowLeft from 'lucide-react-native/dist/esm/icons/arrow-left';
import { useThemeColors } from '@/hooks/useThemeColors';

export default function AboutScreen() {
  const router = useRouter();
  const colors = useThemeColors();

  const handleOpenLink = (url: string) => {
    Linking.openURL(url);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Pressable
          onPress={() => router.replace('/settings')}
          style={{ padding: 8, marginLeft: -8 }}
        >
          <ArrowLeft size={20} color={colors.icon} />
        </Pressable>
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: '600', marginLeft: 8 }}>
          About
        </Text>
      </View>

      <View style={{ flex: 1, padding: 16 }}>
        {/* App Info */}
        <View style={{ alignItems: 'center', marginBottom: 32, marginTop: 16 }}>
          <Text style={{ color: colors.text, fontSize: 28, fontWeight: '700', marginBottom: 8 }}>
            SimpleNotes
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 16, textAlign: 'center' }}>
            A simple, fast notes app with real-time sync and sharing.
          </Text>
        </View>

        {/* Contact */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600', marginBottom: 12 }}>
            Contact
          </Text>
          <Pressable
            onPress={() => handleOpenLink('mailto:bkemper@gmail.com')}
            style={{
              backgroundColor: colors.bgSecondary,
              borderRadius: 8,
              padding: 16,
            }}
          >
            <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 4 }}>Email</Text>
            <Text style={{ color: colors.primary, fontSize: 16 }}>bkemper@gmail.com</Text>
          </Pressable>
        </View>

        {/* Source Code */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600', marginBottom: 12 }}>
            Source Code
          </Text>
          <Pressable
            onPress={() => handleOpenLink('https://github.com/Gobd/notes-app')}
            style={{
              backgroundColor: colors.bgSecondary,
              borderRadius: 8,
              padding: 16,
            }}
          >
            <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 4 }}>GitHub</Text>
            <Text style={{ color: colors.primary, fontSize: 16 }}>github.com/Gobd/notes-app</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
