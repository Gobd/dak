import { useState, useRef } from 'react';
import { View, Text, KeyboardAvoidingView, Platform, ScrollView, TextInput } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '@/stores/auth-store';
import { useThemeColors } from '@/hooks/useThemeColors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordRequirements, isPasswordValid } from '@/components/ui/password-requirements';

export default function ResetPasswordScreen() {
  const colors = useThemeColors();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const { resetPassword, isLoading } = useAuthStore();
  const confirmPasswordRef = useRef<TextInput>(null);

  const handleResetPassword = async () => {
    setError('');

    if (!password) {
      setError('Please enter a new password');
      return;
    }

    if (!isPasswordValid(password)) {
      setError('Password does not meet requirements');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      await resetPassword(password);
      router.replace('/(auth)/login');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
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
              Reset Password
            </Text>
            <Text style={{ color: colors.textMuted, textAlign: 'center', marginBottom: 32 }}>
              Enter your new password
            </Text>

            <View style={{ marginBottom: 16 }}>
              <Input
                label="New Password"
                value={password}
                onChangeText={setPassword}
                placeholder="Enter new password"
                secureTextEntry
                autoComplete="password"
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => confirmPasswordRef.current?.focus()}
              />
              <PasswordRequirements password={password} />
            </View>

            <View style={{ marginBottom: 24 }}>
              <Input
                ref={confirmPasswordRef}
                label="Confirm Password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm your password"
                secureTextEntry
                autoComplete="password"
                error={error}
                returnKeyType="go"
                onSubmitEditing={handleResetPassword}
              />
            </View>

            <Button onPress={handleResetPassword} loading={isLoading}>
              Reset Password
            </Button>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
