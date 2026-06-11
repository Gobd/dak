import { useState } from 'react';
import { Modal, Input, Button } from '@dak/ui';
import { ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import { useAuthStore } from '../stores/auth-store';

const DEVTOOLS_SNIPPET = `(function() {
  const orig = window.fetch;
  window.fetch = async function(...args) {
    const opts = args[1] || {};
    let auth = null;
    if (opts.headers instanceof Headers) {
      auth = opts.headers.get('authorization');
    } else if (opts.headers) {
      auth = opts.headers['Authorization'] || opts.headers['authorization'];
    }
    if (auth && auth.toLowerCase().startsWith('bearer ')) {
      console.clear();
      console.log('%c🔑 Reddit token (paste this):', 'color:#ff4500;font-weight:bold');
      console.log(auth.replace(/^bearer /i, ''));
      window.fetch = orig;
    }
    return orig.apply(this, args);
  };
  console.log('%c✓ Interceptor ready — click anything on Reddit', 'color:#00cc44');
})();`;

interface AuthModalProps {
  onClose: () => void;
}

export function AuthModal({ onClose }: AuthModalProps) {
  const { apiKey, oauthToken, setCredentials, clearCredentials } = useAuthStore();
  const [localApiKey, setLocalApiKey] = useState(apiKey);
  const [localToken, setLocalToken] = useState(oauthToken);
  const [showInstructions, setShowInstructions] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleSave = () => {
    setCredentials(localApiKey.trim(), localToken.trim());
    onClose();
  };

  const handleClear = () => {
    clearCredentials();
    setLocalApiKey('');
    setLocalToken('');
    onClose();
  };

  const handleCopySnippet = () => {
    void navigator.clipboard.writeText(DEVTOOLS_SNIPPET).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Modal open={true} onClose={onClose} title="Authentication">
      <div className="flex flex-col gap-4">
        <div>
          <label className="block text-text-secondary text-sm mb-1">API Key</label>
          <Input
            type="password"
            placeholder="Your REDDIT_API_KEY value"
            value={localApiKey}
            onChange={(e) => setLocalApiKey(e.target.value)}
          />
          <p className="text-text-muted text-xs mt-1">
            Set as <code>REDDIT_API_KEY</code> env var on the Cloudflare function.
          </p>
        </div>

        <div>
          <label className="block text-text-secondary text-sm mb-1">Reddit OAuth Token</label>
          <Input
            type="password"
            placeholder="Paste token here (without Bearer prefix)"
            value={localToken}
            onChange={(e) => setLocalToken(e.target.value)}
          />
        </div>

        <div>
          <button
            type="button"
            className="flex items-center gap-1 text-text-muted text-sm hover:text-text"
            onClick={() => setShowInstructions((v) => !v)}
          >
            {showInstructions ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            How to get your Reddit token
          </button>

          {showInstructions && (
            <div className="mt-3 space-y-3">
              <p className="text-text-secondary text-sm">
                Go to <strong>reddit.com</strong> (not old.reddit.com — the snippet only works on
                new Reddit). Open DevTools <kbd>F12</kbd>, click the <strong>Console</strong> tab,
                paste the snippet below, and press Enter. Then click anything on Reddit — the token
                will print in the console.
              </p>

              <div className="relative">
                <pre className="bg-surface-sunken text-text-secondary text-xs rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
                  {DEVTOOLS_SNIPPET}
                </pre>
                <button
                  type="button"
                  onClick={handleCopySnippet}
                  className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded bg-surface-raised text-text-muted text-xs hover:text-text"
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>

              <p className="text-text-muted text-xs">
                Token lasts ~1 hour. When it expires you&apos;ll see a banner to refresh.
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <Button onClick={handleSave} className="flex-1">
            Save
          </Button>
          {(apiKey || oauthToken) && (
            <Button variant="danger" onClick={handleClear}>
              Clear
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
