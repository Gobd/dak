import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SearchInput } from '@dak/ui';

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
    <form onSubmit={handleSubmit} className="w-72">
      <SearchInput
        value={value}
        onChange={setValue}
        placeholder="r/sub or u/user"
        onClear={() => setValue('')}
      />
    </form>
  );
}
