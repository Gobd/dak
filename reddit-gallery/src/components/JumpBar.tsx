import { useState } from 'react';
import { SubredditTypeahead } from './SubredditTypeahead';

export function JumpBar() {
  const [value, setValue] = useState('');

  return (
    <form onSubmit={(e) => e.preventDefault()} className="w-72">
      <SubredditTypeahead value={value} onChange={setValue} placeholder="r/sub or u/user" />
    </form>
  );
}
