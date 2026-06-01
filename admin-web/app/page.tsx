"use client";

import { useState, useEffect, useMemo } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { StatsCard } from '@/components/StatsCard';
import { StatusBadge } from '@/components/StatusBadge';

const apiBase = process.env.NEXT_PUBLIC_ADMIN_API_BASE_URL ?? '/api';

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return dateStr;
  }
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat('fr-FR').format(amount);
}

function getRelativeTime(dateStr: string): string {
  try {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diffMs = now - then;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "À l'instant";
    if (diffMin < 60) return `Il y a ${diffMin}min`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `Il y a ${diffH}h`;
    const diffD = Math.floor(diffH / 24);
    return `Il y a ${diffD}j`;
  } catch {
    return '';
  }
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<any>(null);
  const [tickets, setTickets] = useState<any[]>([]);

  // Period state
  const [period, setPeriod] = useState<'all' | 'daily' | 'weekly' | 'monthly' | 'yearly'>('all');

  // Filter values initialization
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthStr = `${currentYear}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const currentDateStr = now.toISOString().split('T')[0];

  const getISOWeekStr = (date: Date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
  };
  const currentWeekStr = getISOWeekStr(now);

  const [selectedDate, setSelectedDate] = useState(currentDateStr);
  const [selectedWeek, setSelectedWeek] = useState(currentWeekStr);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
  const [selectedYear, setSelectedYear] = useState(currentYear);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [dashRes, tickRes] = await Promise.all([
          fetch(`${apiBase}/dashboard`, { cache: 'no-store' }),
          fetch(`${apiBase}/tickets`, { cache: 'no-store' }),
        ]);

        if (!dashRes.ok || !tickRes.ok) {
          throw new Error('Impossible de charger les données du dashboard');
        }

        const dashData = await dashRes.json();
        const tickData = await tickRes.json();

        setDashboard(dashData);
        setTickets(tickData);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur inconnue');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Filtered tickets computation
  const { filteredTickets, periodLabel } = useMemo(() => {
    let result = [...tickets];
    let label = 'Toutes périodes confondues';

    if (period === 'daily') {
      if (selectedDate) {
        result = tickets.filter((t) => t.created_at.startsWith(selectedDate));
        const dateObj = new Date(selectedDate);
        label = `Journée du ${dateObj.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`;
      }
    } else if (period === 'weekly') {
      if (selectedWeek) {
        const [yearStr, weekStr] = selectedWeek.split('-W');
        const year = parseInt(yearStr);
        const week = parseInt(weekStr);

        const getWeekStartDate = (w: number, y: number) => {
          const simple = new Date(y, 0, 1 + (w - 1) * 7);
          const dow = simple.getDay();
          const ISOweekStart = simple;
          if (dow <= 4) {
            ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
          } else {
            ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
          }
          return ISOweekStart;
        };

        const startDate = getWeekStartDate(week, year);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 7);

        result = tickets.filter((t) => {
          const d = new Date(t.created_at);
          return d >= startDate && d < endDate;
        });

        const endLabelDate = new Date(startDate);
        endLabelDate.setDate(startDate.getDate() + 6);
        label = `Semaine du ${startDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} au ${endLabelDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`;
      }
    } else if (period === 'monthly') {
      if (selectedMonth) {
        result = tickets.filter((t) => t.created_at.startsWith(selectedMonth));
        const [year, month] = selectedMonth.split('-');
        const monthIndex = parseInt(month) - 1;
        const dateObj = new Date(parseInt(year), monthIndex, 1);
        label = `Mois de ${dateObj.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`;
      }
    } else if (period === 'yearly') {
      const target = String(selectedYear);
      result = tickets.filter((t) => t.created_at.startsWith(target));
      label = `Année ${selectedYear}`;
    }

    return { filteredTickets: result, periodLabel: label };
  }, [tickets, period, selectedDate, selectedWeek, selectedMonth, selectedYear]);

  // Derived stats
  const totalRevenue = filteredTickets.reduce((sum, t) => sum + (t.amount ?? 0), 0);
  const totalTicketsCount = filteredTickets.length;

  const passagerTickets = filteredTickets.filter((t) => t.service_type === 'PASSAGER');
  const colisTickets = filteredTickets.filter((t) => t.service_type === 'COLIS');
  const passagerRev = passagerTickets.reduce((sum, t) => sum + (t.amount ?? 0), 0);
  const colisRev = colisTickets.reduce((sum, t) => sum + (t.amount ?? 0), 0);
  const totalServiceRev = passagerRev + colisRev;
  const passagerPct = totalServiceRev > 0 ? Math.round((passagerRev / totalServiceRev) * 100) : 0;
  const colisPct = totalServiceRev > 0 ? Math.round((colisRev / totalServiceRev) * 100) : 0;

  const cashTickets = filteredTickets.filter((t) => t.payment_mode === 'cash');
  const otherTickets = filteredTickets.filter((t) => t.payment_mode !== 'cash');
  const cashRev = cashTickets.reduce((sum, t) => sum + (t.amount ?? 0), 0);
  const otherRev = otherTickets.reduce((sum, t) => sum + (t.amount ?? 0), 0);
  const totalPaymentRev = cashRev + otherRev;
  const cashPct = totalPaymentRev > 0 ? Math.round((cashRev / totalPaymentRev) * 100) : 0;
  const otherPct = totalPaymentRev > 0 ? Math.round((otherRev / totalPaymentRev) * 100) : 0;

  if (loading) {
    return (
      <>
        <PageHeader
          icon="📊"
          title="Dashboard"
          subtitle="Vue d'ensemble de l'activité FIFA Transport"
          breadcrumb={[{ label: 'Accueil' }]}
        />
        <div className="card">
          <div className="empty-state">
            <div className="loading-dots" aria-label="Chargement">
              <span /><span /><span />
            </div>
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader
          icon="📊"
          title="Dashboard"
          subtitle="Vue d'ensemble de l'activité FIFA Transport"
          breadcrumb={[{ label: 'Accueil' }]}
        />
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-title">Erreur de chargement</div>
            <div className="empty-state-desc">{error}</div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        icon="📊"
        title="Dashboard"
        subtitle="Vue d'ensemble de l'activité FIFA Transport"
        breadcrumb={[{ label: 'Accueil' }]}
      />

      {/* Temporal Filter Control Center */}
      <div className="card" style={{ marginBottom: 24, padding: '16px 20px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(245, 197, 24, 0.15)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '1.25rem' }}>📅</span>
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#F5C518' }}>Filtre Temporel des Revenus</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Filtrer les stats globales du dashboard</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            {/* Period selector */}
            <div className="btn-group" style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
              {(['all', 'daily', 'weekly', 'monthly', 'yearly'] as const).map((p) => {
                const isActive = period === p;
                const label = p === 'all' ? 'Tout' : p === 'daily' ? 'Quotidien' : p === 'weekly' ? 'Hebdomadaire' : p === 'monthly' ? 'Mensuel' : 'Annuel';
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPeriod(p)}
                    className="btn"
                    style={{
                      borderRadius: 0,
                      border: 'none',
                      background: isActive ? 'var(--primary)' : 'transparent',
                      color: isActive ? '#000000' : 'var(--text-secondary)',
                      padding: '6px 14px',
                      fontSize: '0.8rem',
                      fontWeight: isActive ? 'bold' : 'normal',
                      boxShadow: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Dynamic Datepickers */}
            {period !== 'all' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.03)', padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                {period === 'daily' && (
                  <input
                    type="date"
                    className="form-input"
                    style={{ width: 'auto', padding: '4px 8px', fontSize: '0.8rem', margin: 0, border: 'none', background: 'transparent' }}
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                  />
                )}

                {period === 'weekly' && (
                  <input
                    type="week"
                    className="form-input"
                    style={{ width: 'auto', padding: '4px 8px', fontSize: '0.8rem', margin: 0, border: 'none', background: 'transparent' }}
                    value={selectedWeek}
                    onChange={(e) => setSelectedWeek(e.target.value)}
                  />
                )}

                {period === 'monthly' && (
                  <input
                    type="month"
                    className="form-input"
                    style={{ width: 'auto', padding: '4px 8px', fontSize: '0.8rem', margin: 0, border: 'none', background: 'transparent' }}
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                  />
                )}

                {period === 'yearly' && (
                  <select
                    className="form-input"
                    style={{ width: 'auto', padding: '4px 8px', fontSize: '0.8rem', margin: 0, border: 'none', background: 'transparent', color: 'var(--text-primary)' }}
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                  >
                    {[2024, 2025, 2026, 2027, 2028].map((y) => (
                      <option key={y} value={y} style={{ background: 'var(--bg-card)' }}>{y}</option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Selected period details label */}
        <div style={{ marginTop: 10, fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#F5C518', display: 'inline-block' }} />
          Période active : <strong style={{ color: 'var(--text-primary)' }}>{periodLabel}</strong>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <StatsCard
          label="Agents actifs"
          value={dashboard?.agents ?? 0}
          color="yellow"
        />
        <StatsCard
          label="Terminaux TPE"
          value={dashboard?.devices ?? 0}
          color="blue"
        />
        <StatsCard
          label={period === 'all' ? "Tickets émis (Total)" : "Tickets (Période)"}
          value={totalTicketsCount}
          color="green"
        />
        <StatsCard
          label={period === 'all' ? "Revenus totaux" : "Revenus (Période)"}
          value={totalRevenue}
          color="yellow"
        />
      </div>

      {/* Dynamic Breakdown Progress Bars */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, marginBottom: 24 }}>
        {/* Service Breakdown */}
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 8, marginBottom: 12 }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Services ({periodLabel})</div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#F5C518' }}>{formatAmount(totalRevenue)} F</div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: 4 }}>
                <span>PASSAGER</span>
                <strong>{formatAmount(passagerRev)} F ({passagerPct}%)</strong>
              </div>
              <div style={{ height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', background: 'var(--primary)', width: `${passagerPct}%`, borderRadius: 4, transition: 'width 0.5s ease' }} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: 4 }}>
                <span>COLIS</span>
                <strong>{formatAmount(colisRev)} F ({colisPct}%)</strong>
              </div>
              <div style={{ height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', background: '#3182CE', width: `${colisPct}%`, borderRadius: 4, transition: 'width 0.5s ease' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Payment Breakdown */}
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 8, marginBottom: 12 }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Règlements ({periodLabel})</div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#F5C518' }}>{filteredTickets.length} tickets</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: 4 }}>
                <span>ESPÈCES (CASH)</span>
                <strong>{formatAmount(cashRev)} F ({cashPct}%)</strong>
              </div>
              <div style={{ height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', background: '#48BB78', width: `${cashPct}%`, borderRadius: 4, transition: 'width 0.5s ease' }} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: 4 }}>
                <span>AUTRES (CARD/MOBILE)</span>
                <strong>{formatAmount(otherRev)} F ({otherPct}%)</strong>
              </div>
              <div style={{ height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', background: '#ED8936', width: `${otherPct}%`, borderRadius: 4, transition: 'width 0.5s ease' }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Two columns: Recent Tickets + Quick Activity */}
      <div className="section-grid">
        {/* Recent Tickets Table */}
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <div className="card-header">
            <div className="card-header-left">
              <span className="card-header-icon" aria-hidden="true">—</span>
              <div>
                <div className="card-title">
                  {period === 'all' ? "Derniers tickets" : `Tickets de la période`}
                </div>
                <div className="card-subtitle">
                  {period === 'all' 
                    ? "Les 15 tickets les plus récents enregistrés" 
                    : `${filteredTickets.length} ticket${filteredTickets.length !== 1 ? 's' : ''} trouvé${filteredTickets.length !== 1 ? 's' : ''} sur cette période`
                  }
                </div>
              </div>
            </div>
            <a href="/tickets" className="btn btn-secondary" id="view-all-tickets-btn">
              Voir tout l{"'"}historique →
            </a>
          </div>
          <div className="card-body-flush">
            {filteredTickets.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon" aria-hidden="true">🎫</div>
                <div className="empty-state-title">Aucun ticket</div>
                <div className="empty-state-desc">
                  Aucun ticket n{"'"}a été émis par les TPE sur la période sélectionnée ({periodLabel}).
                </div>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Référence</th>
                      <th>Agent</th>
                      <th>Terminal</th>
                      <th>Service</th>
                      <th>Montant</th>
                      <th>Paiement</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(period === 'all' ? filteredTickets.slice(0, 15) : filteredTickets).map((ticket: {
                      id: number;
                      reference: string;
                      agent_name?: string;
                      agent_code?: string;
                      device_label?: string;
                      service_type: string;
                      amount: number;
                      payment_mode: string;
                      created_at: string;
                    }) => (
                      <tr key={ticket.id}>
                        <td>
                          <span className="cell-mono">{ticket.reference}</span>
                        </td>
                        <td>
                          <span className="cell-primary">
                            {ticket.agent_name ?? '—'}
                          </span>
                          {ticket.agent_code && (
                            <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                              {ticket.agent_code}
                            </div>
                          )}
                        </td>
                        <td>{ticket.device_label ?? '—'}</td>
                        <td>
                          <span className="badge badge-neutral">{ticket.service_type}</span>
                        </td>
                        <td>
                          <span className="cell-amount">
                            {formatAmount(ticket.amount)} FCFA
                          </span>
                        </td>
                        <td>
                          <StatusBadge status={ticket.payment_mode} />
                        </td>
                        <td>
                          <div style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{formatDate(ticket.created_at)}</div>
                          <div className="text-muted" style={{ fontSize: '0.7rem' }}>
                            {getRelativeTime(ticket.created_at)}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions" style={{ marginTop: 24 }}>
        <a href="/agents" className="quick-action-card" id="quick-action-agents">
          <div className="quick-action-icon" aria-hidden="true">👥</div>
          <div className="quick-action-info">
            <h4>Gérer les agents</h4>
            <p>Ajouter, modifier ou désactiver</p>
          </div>
        </a>
        <a href="/devices" className="quick-action-card" id="quick-action-devices">
          <div className="quick-action-icon" aria-hidden="true">📟</div>
          <div className="quick-action-info">
            <h4>Gérer les TPE</h4>
            <p>Enregistrer et assigner des terminaux</p>
          </div>
        </a>
        <a href="/tickets" className="quick-action-card" id="quick-action-tickets">
          <div className="quick-action-icon" aria-hidden="true">🎫</div>
          <div className="quick-action-info">
            <h4>Historique tickets</h4>
            <p>Rechercher et filtrer les tickets</p>
          </div>
        </a>
      </div>
    </>
  );
}
