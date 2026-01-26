'use client';

import { useState, useEffect } from 'react';
import { Github, Loader2, CheckCircle, ExternalLink, Copy, AlertCircle } from 'lucide-react';

export default function GithubConnect() {
  const [step, setStep] = useState<'idle' | 'loading' | 'waiting' | 'success'>('idle');
  const [authData, setAuthData] = useState<any>(null);
  const [error, setError] = useState('');
  const [isConnected, setIsConnected] = useState(false);

  // 1. Check status on load
  useEffect(() => {
    fetch('/api/github/status')
      .then(res => res.json())
      .then(data => setIsConnected(data.connected))
      .catch(console.error);
  }, []);

  // 2. Start the flow
  const startAuth = async () => {
    setStep('loading');
    setError('');

    try {
      const res = await fetch('/api/github/connect', { method: 'POST' });
      const data = await res.json();

      if (res.ok) {
        setAuthData(data);
        setStep('waiting');
        // Start polling immediately with the interval GitHub gave us
        pollForToken(data.device_code, data.interval);
      } else {
        setError(data.error || 'Failed to start GitHub auth');
        setStep('idle');
      }
    } catch (err) {
      setError('Network connection failed');
      setStep('idle');
    }
  };

  // 3. The Polling Loop
  const pollForToken = async (deviceCode: string, interval: number) => {
    let currentInterval = interval * 1000; // Convert to ms

    const poll = async () => {
      try {
        const res = await fetch('/api/github/poll', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ device_code: deviceCode })
        });

        const data = await res.json();

        if (data.status === 'success') {
          setStep('success');
          setIsConnected(true);
        } else if (data.status === 'pending') {
          // If GitHub says "slow_down", add 5 seconds to interval
          if (data.slow_down) currentInterval += 5000;
          setTimeout(poll, currentInterval);
        } else if (data.status === 'expired') {
          setError('The code expired. Please try again.');
          setStep('idle');
        } else {
          setError(data.error || 'Unknown error');
          setStep('idle');
        }
      } catch (err) {
        // Stop polling on network error to avoid infinite loops
        setError('Connection lost during polling');
        setStep('idle');
      }
    };

    // Initial wait before first poll
    setTimeout(poll, currentInterval);
  };

  // --- RENDER STATES ---

  if (isConnected) {
    return (
      <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-400">
        <CheckCircle className="w-5 h-5 flex-shrink-0" />
        <div className="flex-1">
          <p className="font-medium text-sm">GitHub Connected</p>
          <p className="text-xs opacity-80">RAG can now access your repositories.</p>
        </div>
        {/* Optional: Add a Disconnect button here later */}
      </div>
    );
  }

  if (step === 'waiting' && authData) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm space-y-4 text-center">
        <h3 className="font-semibold text-gray-900 dark:text-white">Authorize GitHub</h3>

        <div className="space-y-2">
          <p className="text-sm text-gray-500">1. Copy this code:</p>
          <div className="flex items-center justify-center gap-2">
            <code className="text-2xl font-mono font-bold tracking-widest bg-gray-100 dark:bg-gray-900 px-4 py-2 rounded border border-gray-300 dark:border-gray-600 select-all">
              {authData.user_code}
            </code>
            <button
              onClick={() => navigator.clipboard.writeText(authData.user_code)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition"
              title="Copy Code"
            >
              <Copy className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm text-gray-500">2. Paste it here:</p>
          <a
            href={authData.verification_uri}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition-colors"
          >
            Open GitHub Login <ExternalLink className="w-4 h-4" />
          </a>
        </div>

        <div className="pt-2 flex items-center justify-center gap-2 text-xs text-gray-400 animate-pulse">
          <Loader2 className="w-3 h-3 animate-spin" />
          Waiting for authorization...
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {error && (
        <div className="mb-3 flex items-center gap-2 text-xs text-red-600 bg-red-50 dark:bg-red-900/20 p-2 rounded">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      <button
        onClick={startAuth}
        disabled={step === 'loading'}
        className="w-full flex items-center justify-center gap-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-4 py-2.5 rounded-lg hover:opacity-90 transition-all active:scale-95 disabled:opacity-50"
      >
        {step === 'loading' ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Github className="w-5 h-5" />
        )}
        <span>Connect GitHub Repository</span>
      </button>
    </div>
  );
}