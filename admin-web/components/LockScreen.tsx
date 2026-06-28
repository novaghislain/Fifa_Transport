"use client";

import { useState, useEffect, useCallback } from 'react';

const apiBase = process.env.NEXT_PUBLIC_ADMIN_API_BASE_URL ?? '/api';

type LockScreenProps = {
  children: React.ReactNode;
};

export function LockScreen({ children }: LockScreenProps) {
  const [isLocked, setIsLocked] = useState(true);
  const [passwordInput, setPasswordInput] = useState('');
  const [error, setError] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  // Check initial state
  useEffect(() => {
    setIsMounted(true);
    const sessionUnlocked = sessionStorage.getItem('fifa_admin_session_unlocked') === 'true';
    setIsLocked(!sessionUnlocked);
  }, []);

  // Inactivity tracking (3 minutes = 180000ms)
  useEffect(() => {
    if (isLocked || !isMounted) return;

    let timeoutId: NodeJS.Timeout;

    const resetInactivityTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setIsLocked(true);
        sessionStorage.setItem('fifa_admin_session_unlocked', 'false');
      }, 180000); // 3 minute of inactivity
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];
    const handleActivity = () => resetInactivityTimer();

    events.forEach((event) => {
      window.addEventListener(event, handleActivity);
    });

    // Start timer on mount
    resetInactivityTimer();

    return () => {
      clearTimeout(timeoutId);
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [isLocked, isMounted]);

  const handleUnlock = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (isChecking) return;
    setIsChecking(true);
    setError(false);

    try {
      const response = await fetch(`${apiBase}/config/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordInput })
      });

      const data = await response.json();
      if (response.ok && data.valid) {
        setIsLocked(false);
        setError(false);
        setPasswordInput('');
        sessionStorage.setItem('fifa_admin_session_unlocked', 'true');
      } else {
        setError(true);
        // Reset error state animation after delay
        setTimeout(() => setError(false), 500);
      }
    } catch (err) {
      console.error(err);
      setError(true);
      setTimeout(() => setError(false), 500);
    } finally {
      setIsChecking(false);
    }
  }, [passwordInput, isChecking]);

  if (!isMounted) return null;

  if (isLocked) {
    return (
      <div 
        className="lockscreen-overlay"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99999,
          background: 'radial-gradient(circle at center, #1E1A0A 0%, #050505 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
          backdropFilter: 'blur(20px)',
          fontFamily: "'Inter', sans-serif",
        }}
      >
        <div 
          className={`lockscreen-card ${error ? 'lockscreen-shake' : ''}`}
          style={{
            background: 'rgba(20, 20, 20, 0.75)',
            border: '1px solid rgba(245, 197, 24, 0.2)',
            borderRadius: '24px',
            padding: '40px 32px',
            width: '100%',
            maxWidth: 400,
            textAlign: 'center',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5), 0 0 40px rgba(245, 197, 24, 0.05)',
            backdropFilter: 'blur(10px)',
            transition: 'all 0.3s ease',
          }}
        >
          {/* Logo container */}
          <div style={{ marginBottom: 24, display: 'inline-block' }}>
            <div 
              style={{
                width: 80,
                height: 80,
                background: '#FFFFFF',
                borderRadius: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                boxShadow: '0 8px 24px rgba(255, 255, 255, 0.1)',
                padding: 6
              }}
            >
              <img 
                src="/Fifa_Transport_Logo.png" 
                alt="Logo FIFA Transport" 
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </div>
            <h2 style={{ color: '#FFFFFF', margin: 0, fontSize: '1.5rem', fontWeight: 800, fontFamily: "'Outfit', sans-serif" }}>
              FIFA <span style={{ color: '#F5C518' }}>Transport</span>
            </h2>
            <p style={{ color: '#8E8E93', fontSize: '0.82rem', margin: '6px 0 0', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>
              Sécurité Administration
            </p>
          </div>

          <form onSubmit={handleUnlock} style={{ marginTop: 8 }}>
            <div style={{ marginBottom: 20 }}>
              <label 
                htmlFor="lockscreen-password" 
                style={{ 
                  display: 'block', 
                  color: '#AEAEB2', 
                  fontSize: '0.8rem', 
                  marginBottom: 8, 
                  textAlign: 'left',
                  fontWeight: 500
                }}
              >
                Mot de passe requis pour déverrouiller :
              </label>
              <input
                id="lockscreen-password"
                type="password"
                placeholder="Entrer le mot de passe"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                disabled={isChecking}
                autoFocus
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: error ? '1px solid #FF453A' : '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  color: '#FFFFFF',
                  fontSize: '0.95rem',
                  textAlign: 'center',
                  outline: 'none',
                  transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#F5C518';
                  e.target.style.boxShadow = '0 0 0 3px rgba(245, 197, 24, 0.15)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = error ? '#FF453A' : 'rgba(255, 255, 255, 0.1)';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>

            <button
              type="submit"
              disabled={isChecking}
              style={{
                width: '100%',
                padding: '14px',
                background: isChecking ? '#D1A30F' : '#F5C518',
                color: '#0A0A0A',
                border: 'none',
                borderRadius: '12px',
                fontSize: '0.95rem',
                fontWeight: 700,
                cursor: isChecking ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s ease, transform 0.1s ease',
              }}
              onMouseOver={(e) => {
                if (!isChecking) e.currentTarget.style.background = '#E5B510';
              }}
              onMouseOut={(e) => {
                if (!isChecking) e.currentTarget.style.background = '#F5C518';
              }}
              onMouseDown={(e) => {
                if (!isChecking) e.currentTarget.style.transform = 'scale(0.98)';
              }}
              onMouseUp={(e) => {
                if (!isChecking) e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              {isChecking ? 'Vérification...' : 'Déverrouiller la session'}
            </button>
          </form>

          <p style={{ color: '#636366', fontSize: '0.75rem', marginTop: 24, marginBottom: 0 }}>
            Déconnexion et verrouillage automatique après 3 minutes d'inactivité.
          </p>
        </div>

        {/* Shake animation styles */}
        <style>{`
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            20%, 60% { transform: translateX(-10px); }
            40%, 80% { transform: translateX(10px); }
          }
          .lockscreen-shake {
            animation: shake 0.4s ease-in-out;
            border-color: #FF453A !important;
            box-shadow: 0 0 30px rgba(255, 69, 58, 0.15) !important;
          }
        `}</style>
      </div>
    );
  }

  return <>{children}</>;
}
