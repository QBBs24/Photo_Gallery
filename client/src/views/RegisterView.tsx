import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserPlus, AlertCircle } from 'lucide-react';

export const RegisterView: React.FC = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !email.trim() || !password || !passwordConfirm) {
      setError('Please fill out all registration fields.');
      return;
    }

    if (password !== passwordConfirm) {
      setError('The passwords you entered do not match. Please ensure both fields are identical.');
      return;
    }

    if (password.length < 6) {
      setError('Password must contain at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          email: email.trim().toLowerCase(),
          password,
          passwordConfirm,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Registration failed. Please check your details.');
      }

      login(data.token, data.user);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred during registration.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-neutral-900/90 border border-neutral-800 rounded-2xl p-8 shadow-2xl backdrop-blur-md">
        <div className="text-center mb-8">
          <div className="inline-flex p-3 rounded-2xl bg-blue-600/10 text-blue-500 mb-3 border border-blue-500/20">
            <UserPlus className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Create an Account</h1>
          <p className="text-sm text-neutral-400 mt-1">
            Join Photo Gallery to upload and share your images
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-950/40 border border-red-800/60 text-red-300 text-sm flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
              Username
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. photography_lover"
              className="w-full px-4 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-white placeholder-neutral-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your.email@example.com"
              className="w-full px-4 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-white placeholder-neutral-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              className="w-full px-4 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-white placeholder-neutral-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
              Confirm Password
            </label>
            <input
              type="password"
              required
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              placeholder="Repeat your password"
              className="w-full px-4 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-white placeholder-neutral-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 px-4 rounded-xl font-semibold text-sm bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-600/20 disabled:opacity-50 transition-all active:scale-[0.99]"
          >
            {loading ? 'Creating Account...' : 'Complete Registration'}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-neutral-400">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-400 hover:text-blue-300 font-semibold underline underline-offset-4">
            Sign in here
          </Link>
        </div>
      </div>
    </div>
  );
};
