import { TagsSidebarSection } from '@/components/TagChips';
import { Tag as TagType } from '@/types/tag';
import { useRouter } from 'expo-router';
import LogOut from 'lucide-react-native/dist/esm/icons/log-out';
import PanelLeftClose from 'lucide-react-native/dist/esm/icons/panel-left-close';
import RefreshCw from 'lucide-react-native/dist/esm/icons/refresh-cw';
import Settings from 'lucide-react-native/dist/esm/icons/settings';
import Trash2 from 'lucide-react-native/dist/esm/icons/trash-2';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';

interface DesktopSidebarProps {
  colors: {
    border: string;
    text: string;
    textTertiary: string;
    iconMuted: string;
  };
  // Visibility
  onClose: () => void;
  // Tags
  tags: TagType[];
  selectedTagId: string | null;
  onSelectTag: (id: string | null) => void;
  tagCounts: Record<string, number>;
  // User
  userEmail?: string;
  onLogout: () => void;
}

export function DesktopSidebar({
  colors,
  onClose,
  tags,
  selectedTagId,
  onSelectTag,
  tagCounts,
  userEmail,
  onLogout,
}: DesktopSidebarProps) {
  const router = useRouter();

  return (
    <View
      style={{
        width: 224,
        borderRightWidth: 1,
        borderRightColor: colors.border,
        flexDirection: 'column',
      }}
    >
      {/* Nav Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: '600' }}>SimpleNotes</Text>
        <Pressable onPress={onClose} style={{ padding: 4 }}>
          <PanelLeftClose size={18} color={colors.iconMuted} />
        </Pressable>
      </View>

      {/* Tags */}
      <ScrollView style={{ flex: 1 }}>
        <View style={{ paddingVertical: 8 }}>
          <TagsSidebarSection
            tags={tags}
            selectedTagId={selectedTagId}
            onSelectTag={onSelectTag}
            tagCounts={tagCounts}
          />
        </View>
      </ScrollView>

      {/* Sidebar Footer */}
      <View style={{ borderTopWidth: 1, borderTopColor: colors.border, padding: 12 }}>
        {Platform.OS === 'web' && (
          <Pressable
            onPress={() => window.location.reload()}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              padding: 8,
              borderRadius: 8,
            }}
          >
            <RefreshCw size={16} color={colors.iconMuted} />
            <Text style={{ color: colors.textTertiary, fontSize: 14 }}>Refresh</Text>
          </Pressable>
        )}
        <Pressable
          onPress={() => router.push('/settings')}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            padding: 8,
            borderRadius: 8,
          }}
        >
          <Settings size={16} color={colors.iconMuted} />
          <Text style={{ color: colors.textTertiary, fontSize: 14 }}>Settings</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/trash')}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            padding: 8,
            borderRadius: 8,
          }}
        >
          <Trash2 size={16} color={colors.iconMuted} />
          <Text style={{ color: colors.textTertiary, fontSize: 14 }}>Trash</Text>
        </Pressable>
        <Pressable
          onPress={onLogout}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            padding: 8,
            borderRadius: 8,
          }}
        >
          <LogOut size={16} color={colors.iconMuted} />
          <Text style={{ color: colors.textTertiary, fontSize: 14 }} numberOfLines={1}>
            {userEmail}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
