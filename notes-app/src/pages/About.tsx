import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export function About() {
  const handleOpenLink = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-zinc-950">
      {/* Header */}
      <div className="flex items-center px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <Link to="/settings" className="p-2 -ml-2">
          <ArrowLeft size={20} className="text-zinc-500" />
        </Link>
        <span className="text-lg font-semibold ml-2 text-zinc-950 dark:text-white">About</span>
      </div>

      <div className="flex-1 p-4">
        {/* App Info */}
        <div className="text-center mb-8 mt-4">
          <h1 className="text-3xl font-bold mb-2 text-zinc-950 dark:text-white">SimpleNotes</h1>
          <p className="text-base text-zinc-500">
            A simple, fast notes app with real-time sync and sharing.
          </p>
        </div>

        {/* Contact */}
        <div className="mb-6">
          <h2 className="text-base font-semibold mb-3 text-zinc-950 dark:text-white">Contact</h2>
          <button
            onClick={() => handleOpenLink('mailto:bkemper@gmail.com')}
            className="w-full text-left rounded-lg p-4 bg-zinc-100 dark:bg-zinc-800"
          >
            <span className="block text-xs mb-1 text-zinc-500">Email</span>
            <span className="block text-base text-amber-500 dark:text-amber-400">
              bkemper@gmail.com
            </span>
          </button>
        </div>

        {/* Source Code */}
        <div className="mb-6">
          <h2 className="text-base font-semibold mb-3 text-zinc-950 dark:text-white">
            Source Code
          </h2>
          <button
            onClick={() => handleOpenLink('https://github.com/Gobd/notes-app')}
            className="w-full text-left rounded-lg p-4 bg-zinc-100 dark:bg-zinc-800"
          >
            <span className="block text-xs mb-1 text-zinc-500">GitHub</span>
            <span className="block text-base text-amber-500 dark:text-amber-400">
              github.com/Gobd/notes-app
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
