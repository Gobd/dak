import { useState, useRef } from 'react';
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  Pressable,
} from 'react-native';
import { Link, router } from 'expo-router';
import { useAuthStore } from '@/stores/auth-store';
import { useThemeColors } from '@/hooks/useThemeColors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function LoginScreen() {
  const colors = useThemeColors();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { signIn, isLoading } = useAuthStore();
  const passwordRef = useRef<TextInput>(null);

  const handleSignIn = async () => {
    setError('');

    if (!email.trim()) {
      setError('Please enter your email');
      return;
    }

    if (!password) {
      setError('Please enter your password');
      return;
    }

    try {
      await signIn(email.trim().toLowerCase(), password);
      router.replace('/(main)');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    }
  };

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
              Welcome Back
            </Text>
            <Text style={{ color: colors.textMuted, textAlign: 'center', marginBottom: 32 }}>
              Sign in to your account
            </Text>

            <View style={{ marginBottom: 16 }}>
              <Input
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoComplete="email"
                autoCapitalize="none"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                blurOnSubmit={false}
              />
            </View>

            <View style={{ marginBottom: 8 }}>
              <Input
                ref={passwordRef}
                label="Password"
                value={password}
                onChangeText={setPassword}
                placeholder="Your password"
                secureTextEntry
                autoComplete="password"
                error={error}
                returnKeyType="go"
                onSubmitEditing={handleSignIn}
              />
            </View>

            <Link href="/(auth)/forgot-password" asChild>
              <Pressable style={{ marginBottom: 24 }}>
                <Text style={{ color: colors.primary, fontSize: 14, textAlign: 'right' }}>
                  Forgot password?
                </Text>
              </Pressable>
            </Link>

            <View style={{ marginBottom: 16 }}>
              <Button onPress={handleSignIn} loading={isLoading}>
                Sign In
              </Button>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
              <Text style={{ color: colors.textMuted }}>{"Don't have an account? "}</Text>
              <Link href="/(auth)/register" asChild>
                <Pressable>
                  <Text style={{ color: colors.primary, fontWeight: '500' }}>Create Account</Text>
                </Pressable>
              </Link>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
