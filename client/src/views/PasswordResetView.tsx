import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { KeyRound, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';

export const PasswordResetView: React.FC = () => {
  const { token: urlToken } = useParams<{ token?: string }>();

  // State
  const [email, setEmail] = useState('');
  const [token, setToken] = useState(urlToken || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [step, setStep] = useState<'request' | 'reset'>(urlToken ? 'reset' : 'request');
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Handle Step 1: Request reset
  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!email.trim()) {
      setError('Please provide your account email address.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate password reset request.');
      }

      setGeneratedToken(data.resetToken);
      setToken(data.resetToken);
      setSuccessMessage(data.message || 'Reset token generated successfully.');
      setStep('reset');
    } catch (err: any) {
      setError(err.message || 'An error occurred while requesting password reset.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Step 2: Set new password
  const handlePerformReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!token.trim()) {
      setError('Please provide a valid password reset token.');
      return;
    }

    if (!newPassword || !confirmPassword) {
      setError('Please fill in both password fields.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('The passwords you entered do not match. Please ensure both fields are identical.');
      return;
    }

    if (newPassword.length < 6) {
      setError('The new password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: token.trim(),
          newPassword,
          confirmPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to reset password.');
      }

      setSuccessMessage(data.message);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.message || 'An error occurred while resetting your password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-neutral-900/90 border border-neutral-800 rounded-2xl p-8 shadow-2xl backdrop-blur-md">
        <div className="text-center mb-8">
          <div className="inline-flex p-3 rounded-2xl bg-amber-600/10 text-amber-500 mb-3 border border-amber-500/20">
            <KeyRound className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Reset Password</h1>
          <p className="text-sm text-neutral-400 mt-1">
            {step === 'request'
              ? 'Enter your account email to receive a password reset token'
              : 'Enter your reset token and your new password'}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-950/40 border border-red-800/60 text-red-300 text-sm flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">{error}</div>
          </div>
        )}

        {successMessage && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-sm flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">{successMessage}</div>
          </div>
        )}

        {step === 'request' ? (
          <form onSubmit={handleRequestReset} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                Registered Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                className="w-full px-4 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-white placeholder-neutral-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-xl font-semibold text-sm bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-lg shadow-amber-600/20 disabled:opacity-50 transition-all active:scale-[0.99]"
            >
              {loading ? 'Requesting Reset Token...' : 'Get Reset Token'}
            </button>

            <div className="text-center mt-3">
              <button
                type="button"
                onClick={() => setStep('reset')}
                className="text-xs text-neutral-400 hover:text-white"
              >
                Already have a reset token? Click here
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handlePerformReset} className="space-y-4">
            {generatedToken && (
              <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-xl">
                <span className="text-[10px] uppercase font-bold text-neutral-500 block">
                  Generated Reset Token (Auto-filled)
                </span>
                <span className="text-xs font-mono text-amber-400 break-all select-all">
                  {generatedToken}
                </span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                Reset Token
              </label>
              <input
                type="text"
                required
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Paste your reset token"
                className="w-full px-4 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-white placeholder-neutral-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all text-sm font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                New Password
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full px-4 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-white placeholder-neutral-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                Confirm New Password
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                className="w-full px-4 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-white placeholder-neutral-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-xl font-semibold text-sm bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-lg shadow-amber-600/20 disabled:opacity-50 transition-all active:scale-[0.99]"
            >
              {loading ? 'Resetting Password...' : 'Update Password'}
            </button>

            <div className="text-center mt-3">
              <button
                type="button"
                onClick={() => setStep('request')}
                className="text-xs text-neutral-400 hover:text-white"
              >
                Need to request a new token? Go back
              </button>
            </div>
          </form>
        )}

        <div className="mt-6 text-center text-xs text-neutral-400">
          <Link to="/login" className="inline-flex items-center gap-1 text-neutral-300 hover:text-white">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
};
