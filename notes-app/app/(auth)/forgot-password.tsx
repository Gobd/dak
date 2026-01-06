import { useState } from 'react';
import { View, Text, KeyboardAvoidingView, Platform, ScrollView, Pressable } from 'react-native';
import { Link } from 'expo-router';
import { useAuthStore } from '@/stores/auth-store';
import { useThemeColors } from '@/hooks/useThemeColors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function ForgotPasswordScreen() {
  const colors = useThemeColors();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const { sendPasswordReset, isLoading } = useAuthStore();

  const handleSendReset = async () => {
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
      await sendPasswordReset(email.trim().toLowerCase());
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset link');
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
            We sent a password reset link to{'\n'}
            <Text style={{ color: colors.text, fontWeight: '500' }}>{email}</Text>
          </Text>
          <Link href="/(auth)/login" asChild>
            <Button variant="secondary">Back to Sign In</Button>
          </Link>
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
              Forgot Password
            </Text>
            <Text style={{ color: colors.textMuted, textAlign: 'center', marginBottom: 32 }}>
              Enter your email to receive a reset link
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
                returnKeyType="go"
                onSubmitEditing={handleSendReset}
              />
            </View>

            <View style={{ marginBottom: 16 }}>
              <Button onPress={handleSendReset} loading={isLoading}>
                Send Reset Link
              </Button>
            </View>

            <Link href="/(auth)/login" asChild>
              <Pressable>
                <Text style={{ color: colors.primary, textAlign: 'center' }}>Back to Sign In</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
