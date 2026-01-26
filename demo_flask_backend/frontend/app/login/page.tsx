'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, User, ArrowRight, Loader2, ShieldCheck } from 'lucide-react';

export default function LoginPage() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Dynamic URL: Login vs Register
    const endpoint = isRegistering ? '/api/auth/register' : '/api/auth/login';

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (res.ok) {
        if (isRegistering) {
          setIsRegistering(false);
          alert("Account created! Please log in.");
        } else {
          // Success: Redirect to the Main Chat App
          router.push('/');
          router.refresh(); // Ensure auth state updates immediately
        }
      } else {
        setError(data.error || 'Authentication failed');
      }
    } catch (err) {
      setError('Connection error. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-xl overflow-hidden border border-gray-100 dark:border-gray-800">

        {/* Header */}
        <div className="bg-blue-600 p-8 text-center">
          <div className="mx-auto bg-blue-500 w-12 h-12 rounded-full flex items-center justify-center mb-4 text-white">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">
            {isRegistering ? 'Create Account' : 'Welcome Back'}
          </h1>
          <p className="text-blue-100 text-sm">
            {isRegistering
              ? 'Join to access your private knowledge base'
              : 'Secure access to your RAG Workspace'}
          </p>
        </div>

        {/* Form */}
        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3 text-xs font-medium text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg text-center">
                {error}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase">Username</label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50 dark:bg-gray-800 dark:text-white transition-all"
                  placeholder="Enter your username"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50 dark:bg-gray-800 dark:text-white transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isRegistering ? 'Sign Up' : 'Sign In')}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          <div className="mt-6 text-center text-sm">
            <span className="text-gray-500 dark:text-gray-400">
              {isRegistering ? 'Already have an account?' : "New here?"}
            </span>
            <button
              onClick={() => { setIsRegistering(!isRegistering); setError(''); }}
              className="ml-2 font-medium text-blue-600 hover:text-blue-500 hover:underline"
            >
              {isRegistering ? 'Log in' : 'Create account'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}