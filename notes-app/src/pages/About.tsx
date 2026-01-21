import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useThemeColors } from '../hooks/useThemeColors';

export function About() {
  const colors = useThemeColors();

  const handleOpenLink = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: colors.bg }}>
      {/* Header */}
      <div className="flex items-center px-4 py-3 border-b" style={{ borderColor: colors.border }}>
        <Link to="/settings" className="p-2 -ml-2">
          <ArrowLeft size={20} color={colors.icon} />
        </Link>
        <span className="text-lg font-semibold ml-2" style={{ color: colors.text }}>
          About
        </span>
      </div>

      <div className="flex-1 p-4">
        {/* App Info */}
        <div className="text-center mb-8 mt-4">
          <h1 className="text-3xl font-bold mb-2" style={{ color: colors.text }}>
            SimpleNotes
          </h1>
          <p className="text-base" style={{ color: colors.textMuted }}>
            A simple, fast notes app with real-time sync and sharing.
          </p>
        </div>

        {/* Contact */}
        <div className="mb-6">
          <h2 className="text-base font-semibold mb-3" style={{ color: colors.text }}>
            Contact
          </h2>
          <button
            onClick={() => handleOpenLink('mailto:bkemper@gmail.com')}
            className="w-full text-left rounded-lg p-4"
            style={{ backgroundColor: colors.bgSecondary }}
          >
            <span className="block text-xs mb-1" style={{ color: colors.textMuted }}>
              Email
            </span>
            <span className="block text-base" style={{ color: colors.primary }}>
              bkemper@gmail.com
            </span>
          </button>
        </div>

        {/* Source Code */}
        <div className="mb-6">
          <h2 className="text-base font-semibold mb-3" style={{ color: colors.text }}>
            Source Code
          </h2>
          <button
            onClick={() => handleOpenLink('https://github.com/Gobd/notes-app')}
            className="w-full text-left rounded-lg p-4"
            style={{ backgroundColor: colors.bgSecondary }}
          >
            <span className="block text-xs mb-1" style={{ color: colors.textMuted }}>
              GitHub
            </span>
            <span className="block text-base" style={{ color: colors.primary }}>
              github.com/Gobd/notes-app
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
