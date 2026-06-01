"use client";

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';

const navItems = [
  { href: '/', label: 'Dashboard', icon: '📊', section: 'main' },
  { href: '/agents', label: 'Agents', icon: '👤', section: 'main' },
  { href: '/devices', label: 'Terminaux TPE', icon: '📱', section: 'main' },
  { href: '/sessions', label: 'Sessions', icon: '🔐', section: 'main' },
  { href: '/tickets', label: 'Tickets', icon: '🎫', section: 'main' },
  { href: '/prices', label: 'Tarifs & Bilans', icon: '💵', section: 'main' },
];

type SidebarProps = {
  counts?: {
    agents?: number;
    devices?: number;
    tickets?: number;
  };
};

export function Sidebar({ counts }: SidebarProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const closeSidebar = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSidebar();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeSidebar]);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    closeSidebar();
  }, [pathname, closeSidebar]);

  const getBadge = (href: string) => {
    if (!counts) return null;
    switch (href) {
      case '/agents': return counts.agents;
      case '/devices': return counts.devices;
      case '/tickets': return counts.tickets;
      default: return null;
    }
  };

  return (
    <>
      {/* Mobile menu button */}
      <button
        className="mobile-menu-btn"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Ouvrir le menu"
        type="button"
        id="mobile-menu-toggle"
      >
        {isOpen ? '✕' : '☰'}
      </button>

      {/* Overlay for mobile */}
      <div
        className={`sidebar-overlay ${isOpen ? 'open' : ''}`}
        onClick={closeSidebar}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <aside className={`sidebar ${isOpen ? 'open' : ''}`} id="main-sidebar">
        <div className="sidebar-header">
          <Link href="/" className="sidebar-logo">
            <img
              src="/Fifa_Transport_Logo.png"
              alt="FIFA Transport Logo"
              width={48}
              height={48}
            />
            <div className="sidebar-logo-text">
              <span className="brand-name">FIFA Transport</span>
              <span className="brand-sub">Administration</span>
            </div>
          </Link>
        </div>

        <nav className="sidebar-nav" aria-label="Navigation principale">
          <div className="sidebar-section-label">Navigation</div>
          {navItems.map((item) => {
            const isActive = item.href === '/' 
              ? pathname === '/' 
              : pathname.startsWith(item.href);
            const badge = getBadge(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-link ${isActive ? 'active' : ''}`}
                id={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <span>{item.label}</span>
                {badge != null && badge > 0 && (
                  <span className="badge-count">{badge}</span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-footer-info">
            <div className="sidebar-footer-avatar" aria-hidden="true">A</div>
            <div className="sidebar-footer-details">
              <span className="sidebar-footer-name">Administrateur</span>
              <span className="sidebar-footer-role">Super Admin</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
