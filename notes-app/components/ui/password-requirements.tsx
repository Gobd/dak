import { View, Text } from 'react-native';
import Check from 'lucide-react-native/dist/esm/icons/check';
import X from 'lucide-react-native/dist/esm/icons/x';
import { useThemeColors } from '@/hooks/useThemeColors';

export interface PasswordValidation {
  minLength: boolean;
  hasLower: boolean;
  hasUpper: boolean;
  hasDigit: boolean;
  hasSymbol: boolean;
}

export function validatePassword(password: string): PasswordValidation {
  return {
    minLength: password.length >= 8,
    hasLower: /[a-z]/.test(password),
    hasUpper: /[A-Z]/.test(password),
    hasDigit: /[0-9]/.test(password),
    hasSymbol: /[^a-zA-Z0-9]/.test(password),
  };
}

export function isPasswordValid(password: string): boolean {
  const v = validatePassword(password);
  return v.minLength && v.hasLower && v.hasUpper && v.hasDigit && v.hasSymbol;
}

interface PasswordRequirementsProps {
  password: string;
}

export function PasswordRequirements({ password }: PasswordRequirementsProps) {
  const colors = useThemeColors();
  const validation = validatePassword(password);

  const requirements = [
    { met: validation.minLength, label: 'At least 8 characters' },
    { met: validation.hasLower, label: 'One lowercase letter' },
    { met: validation.hasUpper, label: 'One uppercase letter' },
    { met: validation.hasDigit, label: 'One number' },
    { met: validation.hasSymbol, label: 'One symbol' },
  ];

  return (
    <View style={{ marginTop: 8, gap: 4 }}>
      {requirements.map((req, index) => (
        <View key={index} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {req.met ? (
            <Check size={14} color={colors.success} />
          ) : (
            <X size={14} color={colors.textMuted} />
          )}
          <Text
            style={{
              fontSize: 13,
              color: req.met ? colors.success : colors.textMuted,
            }}
          >
            {req.label}
          </Text>
        </View>
      ))}
    </View>
  );
}
