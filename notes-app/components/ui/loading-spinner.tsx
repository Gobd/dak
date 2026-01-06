import { ActivityIndicator, View } from 'react-native';
import { useThemeColors } from '@/hooks/useThemeColors';

interface LoadingSpinnerProps {
  size?: 'small' | 'large';
  color?: string;
  fullScreen?: boolean;
}

export function LoadingSpinner({ size = 'large', color, fullScreen = false }: LoadingSpinnerProps) {
  const colors = useThemeColors();
  const spinnerColor = color || colors.primary;

  if (fullScreen) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.bg,
        }}
      >
        <ActivityIndicator size={size} color={spinnerColor} />
      </View>
    );
  }

  return <ActivityIndicator size={size} color={spinnerColor} />;
}
