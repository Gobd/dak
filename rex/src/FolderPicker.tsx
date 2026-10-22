import { useEffect, useState } from 'react';
import { Button, Input } from '@dak/ui';

interface Listing {
  root: string;
  current: string;
  parent: string | null;
  directories: { name: string; path: string }[];
  truncated: boolean;
}

export default function FolderPicker({
  request,
  onChoose,
  onClose,
}: {
  request: <T>(route: string, body?: unknown) => Promise<T>;
  onChoose: (directory: string) => void;
  onClose: () => void;
}) {
  const [path, setPath] = useState('');
  const [query, setQuery] = useState('');
  const [listing, setListing] = useState<Listing | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(
      () => {
        const params = new URLSearchParams({ path, search: query });
        void request<Listing>('directories?' + params.toString())
          .then((result) => {
            if (!cancelled) {
              setListing(result);
              setError('');
            }
          })
          .catch((cause: Error) => {
            if (!cancelled) setError(cause.message);
          })
          .finally(() => {
            if (!cancelled) setLoading(false);
          });
      },
      query ? 200 : 0,
    );
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [path, query, request]);
  return (
    <section
      className="space-y-3 rounded-lg border border-border bg-surface p-3"
      aria-label="Choose a project folder"
    >
      <label className="block">
        <span className="mb-2 block text-sm font-medium">Find a folder</span>
        <Input
          autoFocus
          placeholder="Search folders…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <p className="break-all text-xs text-text-secondary">{listing?.current}</p>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={!listing?.parent || loading}
          onClick={() => {
            setPath(listing?.parent || '');
            setQuery('');
          }}
        >
          Parent
        </Button>
        <Button
          size="sm"
          disabled={!listing || loading}
          onClick={() => {
            if (listing) onChoose(listing.current);
          }}
        >
          Use this folder
        </Button>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div className="max-h-64 overflow-auto" aria-busy={loading}>
        {listing?.directories.map((directory) => (
          <button
            key={directory.path}
            type="button"
            disabled={loading}
            className="block w-full rounded-lg p-3 text-left hover:bg-surface-sunken"
            onClick={() => {
              setPath(directory.path);
              setQuery('');
            }}
          >
            <span className="block text-sm text-accent">{directory.name}</span>
            {query && (
              <span className="block break-all text-xs text-text-muted">{directory.path}</span>
            )}
          </button>
        ))}
        {!loading && !listing?.directories.length && (
          <p className="text-sm text-text-muted">No matching folders.</p>
        )}
      </div>
      {listing?.truncated && (
        <p className="text-xs text-text-muted">
          Narrow your search or open a parent folder for more matches.
        </p>
      )}
    </section>
  );
}
