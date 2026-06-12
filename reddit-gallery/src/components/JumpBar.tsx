import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';

export function JumpBar() {
  const [value, setValue] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = value.trim();
    if (!raw) return;
    const userMatch = raw.match(/^\/?(u|user)\/(.+)$/i);
    if (userMatch) {
      navigate(`/u/${userMatch[2].trim()}`);
    } else {
      const sub = raw
        .replace(/^\/?(r)\//i, '')
        .replace(/\s+/g, '')
        .replace(/,+/g, '+')
        .replace(/\++/g, '+');
      navigate(`/r/${sub}`);
    }
    setValue('');
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-1">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="r/sub or u/user"
        className="bg-surface-raised border border-border text-text placeholder:text-text-muted rounded-lg px-3 py-1 text-sm w-40 focus:outline-none focus:border-accent"
      />
      <button
        type="submit"
        disabled={!value.trim()}
        className="p-1.5 text-text-muted hover:text-accent disabled:opacity-40 cursor-pointer disabled:cursor-default"
        aria-label="Go"
      >
        <Search size={15} />
      </button>
    </form>
  );
}
