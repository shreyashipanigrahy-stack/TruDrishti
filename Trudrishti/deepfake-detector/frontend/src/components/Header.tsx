import React, { useState } from 'react';
import { Moon, Sun, Zap, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import logoImg from '../assets/logo.jpg';

interface HeaderProps {
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  user: {
    name: string;
    email: string;
    avatar: string;
  };
  onLogout: () => void;
  scaleType: '3-grade' | '5-grade';
  onChangeScaleType: (scale: '3-grade' | '5-grade') => void;
}

export function Header({ theme, onToggleTheme, user, onLogout, scaleType, onChangeScaleType }: HeaderProps) {
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);

  return (
    <header className="relative z-10 w-full py-4">
      <div className="w-full px-4 sm:px-6 flex items-center justify-between">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-3"
        >
          <div className="relative w-12 h-12 flex items-center justify-center rounded-xl overflow-hidden"
            style={{ background: 'var(--cyan)' }}>
            <img src={logoImg} alt="TruDrishti" className="w-full h-full object-cover" />
            <span className="absolute inset-0 rounded-xl animate-pulse-ring"
              style={{ boxShadow: '0 0 0 4px rgba(0,180,230,0.2)' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight gradient-text">TruDrishti</h1>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              AI Adaptive Intelligent Identification System
            </p>
          </div>
        </motion.div>

        {/* Controls */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-3"
        >
          {/* Live indicator */}
          <div className="hidden sm:flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                style={{ background: 'var(--cyan)' }} />
              <span className="relative inline-flex rounded-full h-2 w-2"
                style={{ background: 'var(--cyan)' }} />
            </span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Live</span>
          </div>

          {/* Theme toggle */}
          <button
            id="theme-toggle"
            onClick={onToggleTheme}
            className="w-9 h-9 flex items-center justify-center rounded-lg glass-card
                       transition-all hover:scale-105 active:scale-95"
            aria-label="Toggle theme"
          >
            {theme === 'dark'
              ? <Sun className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
              : <Moon className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
            }
          </button>

          {/* User profile picture */}
          <img
            src={user.avatar}
            alt={user.name}
            className="w-8 h-8 rounded-full object-cover border border-[var(--border-subtle)] shrink-0"
          />

          {/* Settings button & Dropdown wrapper */}
          <div className="relative">
            <button
              id="header-settings-btn"
              onClick={() => setShowSettingsDropdown(prev => !prev)}
              className="w-9 h-9 flex items-center justify-center rounded-lg glass-card
                         transition-all hover:scale-105 active:scale-95 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              aria-label="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Dropdown Menu */}
            <AnimatePresence>
              {showSettingsDropdown && (
                <>
                  {/* Backdrop listener for clicking outside to close */}
                  <div
                    className="fixed inset-0 z-40 cursor-default"
                    onClick={() => setShowSettingsDropdown(false)}
                  />

                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-72 rounded-xl p-4 border z-50 text-left shadow-2xl glass-card flex flex-col"
                    style={{
                      borderColor: 'var(--border-subtle)',
                      top: '100%',
                    }}
                  >
                    {/* User profile summary */}
                    <div className="flex items-center gap-3 pb-3 border-b border-[var(--border-subtle)] mb-3">
                      <img
                        src={user.avatar}
                        alt={user.name}
                        className="w-10 h-10 rounded-full object-cover border border-[var(--border-subtle)]"
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-bold text-[var(--text-primary)] truncate">{user.name}</span>
                        <span className="text-xs text-[var(--text-secondary)] truncate">{user.email}</span>
                      </div>
                    </div>

                    {/* Preferences list */}
                    <div className="flex flex-col gap-2 mb-4 border-b border-[var(--border-subtle)] pb-3">
                      <span className="text-[9px] font-bold tracking-wider text-[var(--text-muted)]">Preferences</span>
                      <div className="flex items-center justify-between text-xs p-1">
                        <span style={{ color: 'var(--text-secondary)' }}>Analysis Precision</span>
                        <span className="font-mono font-bold text-[var(--cyan)]">High</span>
                      </div>
                      <div className="flex items-center justify-between text-xs p-1">
                        <span style={{ color: 'var(--text-secondary)' }}>Auto-GradCAM</span>
                        <span className="font-semibold text-[var(--status-success)]">Enabled</span>
                      </div>
                      
                      {/* Scale selection */}
                      <div className="flex flex-col gap-1.5 mt-1.5">
                        <span style={{ color: 'var(--text-secondary)' }} className="text-xs">Detection Scale</span>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => onChangeScaleType('3-grade')}
                            className={`py-1.5 px-2 rounded-lg border text-[11px] font-semibold transition-all duration-150 text-center ${
                              scaleType === '3-grade'
                                ? 'border-[var(--cyan)] bg-[var(--cyan)]/10 text-[var(--cyan)]'
                                : 'border-[var(--border-subtle)] bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                            }`}
                          >
                            3-Grade
                          </button>
                          <button
                            type="button"
                            onClick={() => onChangeScaleType('5-grade')}
                            className={`py-1.5 px-2 rounded-lg border text-[11px] font-semibold transition-all duration-150 text-center ${
                              scaleType === '5-grade'
                                ? 'border-[var(--cyan)] bg-[var(--cyan)]/10 text-[var(--cyan)]'
                                : 'border-[var(--border-subtle)] bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                            }`}
                          >
                            5-Grade
                          </button>
                        </div>

                        {/* Scale Legend Details */}
                        <div className="mt-2.5 p-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] flex flex-col gap-2">
                          <span className="text-[9px] font-bold text-[var(--text-muted)] tracking-wider block">
                            Scale Grades Definition:
                          </span>
                          {scaleType === '3-grade' ? (
                            <div className="flex flex-col gap-1.5 text-[10px]">
                              <div className="flex items-center justify-between">
                                <span className="font-extrabold text-[var(--status-success)]">Authentic</span>
                                <span className="font-semibold font-mono text-[var(--text-secondary)]">≥ 70%</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="font-extrabold text-[var(--status-warning)]">Slightly Suspicious</span>
                                <span className="font-semibold font-mono text-[var(--text-secondary)]">40% - 69%</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="font-extrabold text-[var(--status-error)]">Suspicious</span>
                                <span className="font-semibold font-mono text-[var(--text-secondary)]">&lt; 40%</span>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-1.5 text-[10px]">
                              <div className="flex items-center justify-between">
                                <span className="font-extrabold text-[var(--status-success)]">Highly Authentic</span>
                                <span className="font-semibold font-mono text-[var(--text-secondary)]">≥ 85%</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="font-extrabold text-[var(--status-info)]">Probably Real</span>
                                <span className="font-semibold font-mono text-[var(--text-secondary)]">65% - 84%</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="font-extrabold text-[var(--status-warning)]">Low Suspicion</span>
                                <span className="font-semibold font-mono text-[var(--text-secondary)]">40% - 64%</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="font-extrabold text-[var(--status-warning)]">Moderately Suspicious</span>
                                <span className="font-semibold font-mono text-[var(--text-secondary)]">20% - 39%</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="font-extrabold text-[var(--status-error)]">Highly Suspicious</span>
                                <span className="font-semibold font-mono text-[var(--text-secondary)]">&lt; 20%</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Logout Button */}
                    <button
                      onClick={() => {
                        setShowSettingsDropdown(false);
                        onLogout();
                      }}
                      className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-bold transition-all duration-150 border-[var(--border-danger)] bg-[var(--status-error-bg)] text-[var(--status-error)] hover:opacity-90 active:scale-98"
                    >
                      <span>Sign Out</span>
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </header>
  );
}
