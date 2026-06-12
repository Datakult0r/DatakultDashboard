'use client';

import { useState } from 'react';

/** Minimal password gate — styled to match the Control Tower brand. */
export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      window.location.href = '/';
    } else {
      setError('Wrong password');
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm bg-surface border border-border rounded-lg p-8 shadow-lg">
        <p className="text-[10px] tracking-[0.25em] uppercase text-secondary font-mono">Clinic of AI</p>
        <h1 className="text-2xl font-semibold text-primary mt-1 mb-6">Control Tower</h1>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoFocus
          className="w-full px-3 py-2 rounded-md bg-base border border-border text-primary text-sm focus:border-accent outline-none mb-3"
        />
        {error && <p className="text-danger text-xs mb-3">{error}</p>}
        <button
          type="submit"
          disabled={busy || !password}
          className="w-full py-2 rounded-md bg-accent text-white text-sm font-medium hover:opacity-90 disabled:opacity-40"
        >
          {busy ? 'Checking…' : 'Enter'}
        </button>
      </form>
    </div>
  );
}
