import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@dak/ui';

export function About() {
  const handleOpenLink = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="flex flex-col min-h-screen bg-surface">
      {/* Header */}
      <div className="flex items-center px-4 py-3 border-b border-border">
        <Link to="/settings" className="p-2 -ml-2">
          <ArrowLeft size={20} className="text-text-muted" />
        </Link>
        <span className="text-lg font-semibold ml-2 text-text">About</span>
      </div>

      <div className="flex-1 p-4">
        {/* App Info */}
        <div className="text-center mb-8 mt-4">
          <h1 className="text-3xl font-bold mb-2 text-text">SimpleNotes</h1>
          <p className="text-base text-text-muted">
            A simple, fast notes app with real-time sync and sharing.
          </p>
        </div>

        {/* Contact */}
        <div className="mb-6">
          <h2 className="text-base font-semibold mb-3 text-text">Contact</h2>
          <Button
            variant="ghost"
            onClick={() => handleOpenLink('mailto:bkemper@gmail.com')}
            className="w-full text-left justify-start h-auto rounded-lg p-4 bg-surface-sunken"
          >
            <div>
              <span className="block text-xs mb-1 text-text-muted">Email</span>
              <span className="block text-base text-accent">bkemper@gmail.com</span>
            </div>
          </Button>
        </div>

        {/* Source Code */}
        <div className="mb-6">
          <h2 className="text-base font-semibold mb-3 text-text">Source Code</h2>
          <Button
            variant="ghost"
            onClick={() => handleOpenLink('https://github.com/Gobd/notes-app')}
            className="w-full text-left justify-start h-auto rounded-lg p-4 bg-surface-sunken"
          >
            <div>
              <span className="block text-xs mb-1 text-text-muted">GitHub</span>
              <span className="block text-base text-accent">github.com/Gobd/notes-app</span>
            </div>
          </Button>
        </div>
      </div>
    </div>
  );
}
