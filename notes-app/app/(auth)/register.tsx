import { useState } from 'react';
import { View, Text, KeyboardAvoidingView, Platform, ScrollView, Pressable } from 'react-native';
import { Link } from 'expo-router';
import { useAuthStore } from '@/stores/auth-store';
import { useThemeColors } from '@/hooks/useThemeColors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function RegisterScreen() {
  const colors = useThemeColors();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const { register, isLoading } = useAuthStore();

  const handleRegister = async () => {
    setError('');

    if (!email.trim()) {
      setError('Please enter your email');
      return;
    }

    if (!email.includes('@')) {
      setError('Please enter a valid email');
      return;
    }

    try {
      await register(email.trim().toLowerCase());
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    }
  };

  if (success) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 24,
        }}
      >
        <View style={{ width: '100%', maxWidth: 384 }}>
          <Text
            style={{
              color: colors.text,
              fontSize: 30,
              fontWeight: 'bold',
              textAlign: 'center',
              marginBottom: 16,
            }}
          >
            Check your email
          </Text>
          <Text style={{ color: colors.textMuted, textAlign: 'center', marginBottom: 32 }}>
            We sent a verification link to{'\n'}
            <Text style={{ color: colors.text, fontWeight: '500' }}>{email}</Text>
          </Text>
          <Text style={{ color: colors.textTertiary, textAlign: 'center', fontSize: 14 }}>
            Click the link in the email to verify your account and set your password.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: colors.bg }}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}
        >
          <View style={{ width: '100%', maxWidth: 384 }}>
            <Text
              style={{
                color: colors.text,
                fontSize: 30,
                fontWeight: 'bold',
                textAlign: 'center',
                marginBottom: 8,
              }}
            >
              Create Account
            </Text>
            <Text style={{ color: colors.textMuted, textAlign: 'center', marginBottom: 32 }}>
              Enter your email to get started
            </Text>

            <View style={{ marginBottom: 24 }}>
              <Input
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoComplete="email"
                autoCapitalize="none"
                error={error}
                onSubmitEditing={handleRegister}
                returnKeyType="go"
              />
            </View>

            <View style={{ marginBottom: 16 }}>
              <Button onPress={handleRegister} loading={isLoading}>
                Create Account
              </Button>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
              <Text style={{ color: colors.textMuted }}>Already have an account? </Text>
              <Link href="/(auth)/login" asChild>
                <Pressable>
                  <Text style={{ color: colors.primary, fontWeight: '500' }}>Sign In</Text>
                </Pressable>
              </Link>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
