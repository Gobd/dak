import { useState, useRef, useEffect } from 'react';
import { Modal, Input, Button } from '@dak/ui';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useAuthStore } from '../stores/auth-store';

const BOOKMARKLET_HREF =
  `javascript:(function(){` +
  `var orig=window.fetch;` +
  `window.fetch=async function(url,opts){` +
  `opts=opts||{};` +
  `var auth=null;` +
  `if(opts.headers instanceof Headers){auth=opts.headers.get('authorization');}` +
  `else if(opts.headers){auth=opts.headers['Authorization']||opts.headers['authorization'];}` +
  `if(auth&&auth.toLowerCase().startsWith('bearer ')){` +
  `window.fetch=orig;` +
  `var token=auth.replace(/^bearer /i,'');` +
  `prompt('Copy your Reddit token (Cmd+A, Cmd+C):',token);` +
  `}` +
  `return orig.call(this,url,opts);` +
  `};` +
  `})();`;

interface AuthModalProps {
  onClose: () => void;
}

export function AuthModal({ onClose }: AuthModalProps) {
  const { apiKey, oauthToken, setCredentials, clearCredentials } = useAuthStore();
  const [localApiKey, setLocalApiKey] = useState(apiKey);
  const [localToken, setLocalToken] = useState(oauthToken);
  const [showInstructions, setShowInstructions] = useState(false);
  const bookmarkletRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (bookmarkletRef.current) {
      bookmarkletRef.current.setAttribute('href', BOOKMARKLET_HREF);
    }
  }, [showInstructions]);

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
              <ol className="text-text-secondary text-sm space-y-1 list-decimal list-inside">
                <li>
                  Drag this link to your bookmarks bar:{' '}
                  <a
                    ref={bookmarkletRef}
                    className="text-accent underline font-medium"
                  >
                    Get Reddit Token
                  </a>
                </li>
                <li>
                  Go to <strong>reddit.com</strong> (not old.reddit.com)
                </li>
                <li>Click the bookmark — an alert will confirm it&apos;s ready</li>
                <li>Click anything on Reddit — a prompt will pop up with your token</li>
              </ol>

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
