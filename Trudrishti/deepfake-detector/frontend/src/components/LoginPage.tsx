import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, KeyRound, Mail, AlertTriangle } from 'lucide-react';
import axios from 'axios';
import logoImg from '../assets/logo.jpg';

interface User {
  name: string;
  email: string;
  avatar: string;
}

interface LoginPageProps {
  onLogin: (user: User, token: string) => void;
}

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000';

export function LoginPage({ onLogin }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleDirectLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const response = await axios.post(`${API_URL}/auth/login`, { email, password });
      const data = response.data;
      if (data.status === 'success') {
        onLogin(data.user, data.token);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.response?.data?.detail || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden">
      {/* Background decorations */}
      <div className="bg-mesh" />
      <div className="bg-grid" />

      {/* Main glass card wrapper */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md p-8 glass-card border flex flex-col items-center relative z-10 text-center"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        {/* Header Logo */}
        <div className="relative w-20 h-20 flex items-center justify-center rounded-3xl mb-5 overflow-hidden"
          style={{ background: 'var(--cyan)' }}>
          <img src={logoImg} alt="TruDrishti" className="w-full h-full object-cover" />
          <span className="absolute inset-0 rounded-3xl animate-pulse-ring"
            style={{ boxShadow: '0 0 0 6px rgba(0,180,230,0.15)' }} />
        </div>

        <h1 className="text-3xl font-extrabold tracking-tight gradient-text mb-1">TruDrishti</h1>
        <p className="text-xs font-semibold tracking-wider mb-6" style={{ color: 'var(--text-muted)' }}>
          AI Adaptive Intelligent Identification System
        </p>

        {/* Global Error Banner */}
        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full flex gap-2 p-3 rounded-lg border text-xs text-left mb-4"
            style={{
              borderColor: 'var(--border-danger)',
              background: 'var(--status-error-bg)',
              color: 'var(--status-error)'
            }}
          >
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{errorMsg}</span>
          </motion.div>
        )}

        <div className="w-full flex flex-col">
          <form onSubmit={handleDirectLoginSubmit} className="space-y-4 text-left">
            {/* Email Input */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[var(--text-secondary)] flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" /> Email ID
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email address"
                className="w-full p-3 rounded-xl border text-sm transition-all bg-[var(--bg-card)] border-[var(--border-strong)] focus:border-[var(--cyan)] focus:ring-1 focus:ring-[var(--cyan-glow)] text-[var(--text-primary)] placeholder-[var(--text-disabled)] outline-none"
              />
            </div>

            {/* Password Input */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[var(--text-secondary)] flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5" /> Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full p-3 rounded-xl border text-sm transition-all bg-[var(--bg-card)] border-[var(--border-strong)] focus:border-[var(--cyan)] focus:ring-1 focus:ring-[var(--cyan-glow)] text-[var(--text-primary)] placeholder-[var(--text-disabled)] outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary py-3 flex justify-center items-center gap-2 mt-2 font-semibold text-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Signing In...</span>
                </>
              ) : (
                <span>Sign In</span>
              )}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
