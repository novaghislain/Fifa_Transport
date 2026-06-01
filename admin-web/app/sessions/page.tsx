"use client";

import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, type Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';

const apiBase = process.env.NEXT_PUBLIC_ADMIN_API_BASE_URL ?? '/api';

type Session = {
  id: number;
  agent_id: number;
  device_id: string;
  active: boolean;
  last_seen_at: string;
  revoked_at: string | null;
  created_at: string;
  agent_code: string | null;
  agent_name: string | null;
  device_label: string | null;
};

function formatDate(dateStr: string): string {
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${apiBase}/auth/sessions`, { cache: 'no-store' });
      if (!response.ok) throw new Error('Impossible de charger les sessions');
      setSessions(await response.json());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const revoke = async (id: number) => {
    const response = await fetch(`${apiBase}/auth/sessions/${id}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Impossible de révoquer la session');
    await fetchSessions();
  };

  const columns: Column<Session>[] = [
    { key: 'agent_name', label: 'Agent', render: (row) => row.agent_name ?? row.agent_code ?? `#${row.agent_id}` },
    { key: 'device_label', label: 'Terminal', render: (row) => row.device_label ?? row.device_id },
    { key: 'active', label: 'Statut', render: (row) => <StatusBadge status={row.active ? 'active' : 'revoked'} /> },
    { key: 'last_seen_at', label: 'Dernière activité', render: (row) => formatDate(row.last_seen_at) },
    { key: 'created_at', label: 'Créée le', render: (row) => formatDate(row.created_at) },
    {
      key: '_actions',
      label: 'Actions',
      render: (row) => (
        <button
          className="btn btn-ghost"
          type="button"
          disabled={!row.active}
          onClick={() => revoke(row.id).catch((err) => setError(err instanceof Error ? err.message : 'Erreur inconnue'))}
        >
          Révoquer
        </button>
      ),
    },
  ];

  if (loading) {
    return (
      <>
        <PageHeader icon="🔐" title="Sessions" subtitle="Connexions TPE actives" breadcrumb={[{ label: 'Dashboard', href: '/' }, { label: 'Sessions' }]} />
        <div className="card"><div className="empty-state"><div className="loading-dots"><span /><span /><span /></div></div></div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader icon="🔐" title="Sessions" subtitle="Connexions TPE actives" breadcrumb={[{ label: 'Dashboard', href: '/' }, { label: 'Sessions' }]} />
        <div className="card"><div className="empty-state"><div className="empty-state-icon"></div><div className="empty-state-title">Erreur de chargement</div><div className="empty-state-desc">{error}</div></div></div>
      </>
    );
  }

  return (
    <>
      <PageHeader icon="🔐" title="Sessions" subtitle={`${sessions.filter((s) => s.active).length} active(s)`} breadcrumb={[{ label: 'Dashboard', href: '/' }, { label: 'Sessions' }]} />
      <DataTable<Session>
        columns={columns}
        data={sessions}
        searchKeys={['agent_name', 'agent_code', 'device_id', 'device_label']}
        searchPlaceholder="Rechercher par agent ou terminal..."
        idKey="id"
        emptyIcon="—"
        emptyTitle="Aucune session"
        emptyDesc="Les connexions TPE apparaîtront ici."
      />
    </>
  );
}
