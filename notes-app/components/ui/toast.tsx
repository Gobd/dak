import { View, Text, Pressable } from 'react-native';
import X from 'lucide-react-native/dist/esm/icons/x';
import Check from 'lucide-react-native/dist/esm/icons/check';
import TriangleAlert from 'lucide-react-native/dist/esm/icons/triangle-alert';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useToastStore, ToastType } from '@/stores/toast-store';

const icons: Record<ToastType, typeof Check> = {
  success: Check,
  error: TriangleAlert,
  info: Check,
};

export function ToastContainer() {
  const colors = useThemeColors();
  const { toasts, hideToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <View
      style={{
        position: 'absolute',
        top: 60,
        right: 16,
        alignItems: 'flex-end',
        pointerEvents: 'box-none',
        zIndex: 9999,
      }}
    >
      {toasts.map((toast) => {
        const Icon = icons[toast.type];
        const iconColor =
          toast.type === 'success'
            ? colors.success || '#22c55e'
            : toast.type === 'error'
              ? colors.error
              : colors.info || '#3b82f6';

        return (
          <View
            key={toast.id}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.bgSecondary,
              borderRadius: 8,
              paddingVertical: 12,
              paddingHorizontal: 16,
              marginBottom: 8,
              maxWidth: 360,
              minWidth: 200,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.15,
              shadowRadius: 8,
              elevation: 4,
              borderLeftWidth: 3,
              borderLeftColor: iconColor,
            }}
          >
            <Icon size={18} color={iconColor} style={{ marginRight: 10 }} />
            <Text style={{ flex: 1, color: colors.text, fontSize: 14 }}>{toast.message}</Text>
            <Pressable onPress={() => hideToast(toast.id)} hitSlop={8} style={{ padding: 4 }}>
              <X size={16} color={colors.iconMuted} />
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}
