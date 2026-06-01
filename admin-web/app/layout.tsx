import './globals.css';
import type { ReactNode } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { LockScreen } from '@/components/LockScreen';

export const metadata = {
  title: {
    default: 'FIFA Transport — Administration',
    template: '%s | FIFA Transport',
  },
  description: 'Interface d\'administration centralisée pour la gestion des tickets, agents et terminaux de paiement (TPE) FIFA Transport.',
  icons: {
    icon: '/Fifa_Transport_Logo.png',
  },
};

const apiBase = process.env.ADMIN_API_BASE_URL ?? 'https://fifa-tpe.onrender.com/api';

async function getDashboardCounts() {
  try {
    const response = await fetch(`${apiBase}/dashboard`, {
      cache: 'no-store',
    });
    if (!response.ok) return { agents: 0, devices: 0, tickets: 0 };
    const data = await response.json();
    return {
      agents: data.agents ?? 0,
      devices: data.devices ?? 0,
      tickets: data.tickets ?? 0,
    };
  } catch {
    return { agents: 0, devices: 0, tickets: 0 };
  }
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const counts = await getDashboardCounts();

  return (
    <html lang="fr">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#0A0A0A" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body>
        <LockScreen>
          <div className="app-layout">
            <Sidebar counts={counts} />
            <main className="main-content">
              <div className="page-content">
                {children}
              </div>
            </main>
          </div>
        </LockScreen>
      </body>
    </html>
  );
}
