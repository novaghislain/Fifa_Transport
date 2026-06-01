"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, type Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { Modal } from '@/components/Modal';
import { ActionForm } from '@/components/ActionForm';

const apiBase = process.env.NEXT_PUBLIC_ADMIN_API_BASE_URL ?? '/api';

type Agent = {
  id: number;
  code: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  active: boolean;
  created_at: string;
};

type Ticket = {
  id: number;
  reference: string;
  device_id: string;
  agent_id: number;
  agent_code: string | null;
  agent_name: string | null;
  device_label: string | null;
  service_type: string;
  route: string;
  amount: number;
  payment_mode: string;
  passenger_name: string | null;
  passenger_phone: string | null;
  package_details: string | null;
  sender_name: string | null;
  sender_phone: string | null;
  receiver_name: string | null;
  receiver_phone: string | null;
  created_at: string;
};

function formatDate(dateStr: string): string {
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

const columns: Column<Agent>[] = [
  {
    key: 'code',
    label: 'Code',
    sortable: true,
    render: (row) => <span className="cell-mono">{row.code}</span>,
  },
  {
    key: 'full_name',
    label: 'Nom complet',
    sortable: true,
    render: (row) => <span className="cell-primary">{row.full_name}</span>,
  },
  {
    key: 'email',
    label: 'Email',
    render: (row) => row.email ?? '—',
  },
  {
    key: 'phone',
    label: 'Téléphone',
    render: (row) => row.phone ?? '—',
  },
  {
    key: 'active',
    label: 'Statut',
    sortable: true,
    render: (row) => <StatusBadge status={String(row.active)} />,
  },
  {
    key: 'created_at',
    label: 'Créé le',
    sortable: true,
    render: (row) => formatDate(row.created_at),
  },
];

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  // Agent Report States
  const [selectedReportAgent, setSelectedReportAgent] = useState<Agent | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportTickets, setReportTickets] = useState<Ticket[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const [reportPeriod, setReportPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedWeek, setSelectedWeek] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedYear, setSelectedYear] = useState(2026);
  const [config, setConfig] = useState<{
    company_name: string;
    company_ifu: string;
    company_rccm: string;
    company_address: string;
    company_phone: string;
    company_city: string;
    company_country: string;
  } | null>(null);

  const fetchAgents = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${apiBase}/agents`, { cache: 'no-store' });
      if (!response.ok) throw new Error('Impossible de charger les agents');
      const data = await response.json();
      setAgents(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const handleSuccess = useCallback(() => {
    setShowModal(false);
    fetchAgents();
  }, [fetchAgents]);

  const handleEditSuccess = useCallback(() => {
    setShowEditModal(false);
    setSelectedAgent(null);
    fetchAgents();
  }, [fetchAgents]);

  // Fetch Agent Tickets
  const fetchAgentTickets = useCallback(async (agentId: number) => {
    try {
      setReportLoading(true);
      setReportError(null);
      const response = await fetch(`${apiBase}/tickets?agentId=${agentId}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('Impossible de charger les ventes de l\'agent');
      const data = await response.json();
      setReportTickets(data);
    } catch (err) {
      setReportError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setReportLoading(false);
    }
  }, []);

  // Sync tickets when selectedReportAgent changes
  useEffect(() => {
    if (selectedReportAgent) {
      fetchAgentTickets(selectedReportAgent.id);
    } else {
      setReportTickets([]);
    }
  }, [selectedReportAgent, fetchAgentTickets]);

  // Initialize report date filters
  useEffect(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    setSelectedDate(`${yyyy}-${mm}-${dd}`);
    setSelectedMonth(`${yyyy}-${mm}`);
    setSelectedYear(yyyy);

    const tempDate = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
    const dayNum = tempDate.getUTCDay() || 7;
    tempDate.setUTCDate(tempDate.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(tempDate.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((tempDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    setSelectedWeek(`${tempDate.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`);
  }, []);

  // Load company config for report printing
  useEffect(() => {
    async function fetchConfig() {
      try {
        const res = await fetch(`${apiBase}/config`, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          setConfig({
            company_name: data.company_name || 'FIFA Transport',
            company_ifu: data.company_ifu || '3202612345678',
            company_rccm: data.company_rccm || 'RB-COT-26-B-1234',
            company_address: data.company_address || 'Avenue Steinmetz, Cotonou',
            company_phone: data.company_phone || '+229 21 30 00 00',
            company_city: data.company_city || 'Cotonou',
            company_country: data.company_country || 'Bénin',
          });
        }
      } catch (e) {
        console.error('Error fetching config for report:', e);
      }
    }
    fetchConfig();
  }, []);

  // Compute report statistics based on active filters
  const reportData = useMemo(() => {
    if (!reportTickets || reportTickets.length === 0) {
      return {
        tickets: [],
        totalRevenue: 0,
        totalTickets: 0,
        averageAmount: 0,
        services: [
          { name: 'PASSAGER', count: 0, revenue: 0, percentage: 0 },
          { name: 'COLIS', count: 0, revenue: 0, percentage: 0 }
        ],
        payments: [
          { name: 'ESPÈCES (CASH)', count: 0, revenue: 0, percentage: 0 },
          { name: 'AUTRES MODES', count: 0, revenue: 0, percentage: 0 }
        ],
        periodLabel: 'Aucune donnée disponible',
        exercice: '2026'
      };
    }

    let filtered = [...reportTickets];
    let periodLabel = '';
    let exercice = '2026';

    if (reportPeriod === 'daily') {
      if (selectedDate) {
        filtered = reportTickets.filter(t => t.created_at.startsWith(selectedDate));
        const dateObj = new Date(selectedDate);
        exercice = String(dateObj.getFullYear());
        periodLabel = `Journée du ${dateObj.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`;
      } else {
        periodLabel = 'Journée non spécifiée';
      }
    } else if (reportPeriod === 'weekly') {
      if (selectedWeek) {
        const [yearStr, weekStr] = selectedWeek.split('-W');
        const year = parseInt(yearStr);
        const week = parseInt(weekStr);
        exercice = yearStr;

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

        filtered = reportTickets.filter(t => {
          const d = new Date(t.created_at);
          return d >= startDate && d < endDate;
        });

        const endLabelDate = new Date(startDate);
        endLabelDate.setDate(startDate.getDate() + 6);
        periodLabel = `Semaine du ${startDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} au ${endLabelDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`;
      } else {
        periodLabel = 'Semaine non spécifiée';
      }
    } else if (reportPeriod === 'monthly') {
      if (selectedMonth) {
        filtered = reportTickets.filter(t => t.created_at.startsWith(selectedMonth));
        const [year, month] = selectedMonth.split('-');
        exercice = year;
        const monthIndex = parseInt(month) - 1;
        const dateObj = new Date(parseInt(year), monthIndex, 1);
        periodLabel = `Mois de ${dateObj.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`;
      } else {
        periodLabel = 'Mois non spécifié';
      }
    } else if (reportPeriod === 'yearly') {
      const target = String(selectedYear);
      exercice = target;
      filtered = reportTickets.filter(t => t.created_at.startsWith(target));
      periodLabel = `Année ${selectedYear}`;
    }

    const totalTickets = filtered.length;
    const totalRevenue = filtered.reduce((sum, t) => sum + t.amount, 0);
    const averageAmount = totalTickets > 0 ? Math.round(totalRevenue / totalTickets) : 0;

    // Breakdown by services
    const passagerTickets = filtered.filter(t => t.service_type === 'PASSAGER');
    const colisTickets = filtered.filter(t => t.service_type === 'COLIS');

    const passagerRevenue = passagerTickets.reduce((sum, t) => sum + t.amount, 0);
    const colisRevenue = colisTickets.reduce((sum, t) => sum + t.amount, 0);

    const services = [
      {
        name: 'PASSAGER',
        count: passagerTickets.length,
        revenue: passagerRevenue,
        percentage: totalRevenue > 0 ? Math.round((passagerRevenue / totalRevenue) * 100) : 0
      },
      {
        name: 'COLIS',
        count: colisTickets.length,
        revenue: colisRevenue,
        percentage: totalRevenue > 0 ? Math.round((colisRevenue / totalRevenue) * 100) : 0
      }
    ];

    // Breakdown by payment mode
    const cashTickets = filtered.filter(t => t.payment_mode.toLowerCase() === 'cash');
    const otherTickets = filtered.filter(t => t.payment_mode.toLowerCase() !== 'cash');

    const cashRevenue = cashTickets.reduce((sum, t) => sum + t.amount, 0);
    const otherRevenue = otherTickets.reduce((sum, t) => sum + t.amount, 0);

    const payments = [
      {
        name: 'ESPÈCES (CASH)',
        count: cashTickets.length,
        revenue: cashRevenue,
        percentage: totalRevenue > 0 ? Math.round((cashRevenue / totalRevenue) * 100) : 0
      },
      {
        name: 'AUTRES MODES',
        count: otherTickets.length,
        revenue: otherRevenue,
        percentage: totalRevenue > 0 ? Math.round((otherRevenue / totalRevenue) * 100) : 0
      }
    ];

    return {
      tickets: filtered,
      totalRevenue,
      totalTickets,
      averageAmount,
      services,
      payments,
      periodLabel,
      exercice
    };
  }, [reportTickets, reportPeriod, selectedDate, selectedWeek, selectedMonth, selectedYear]);

  // Print agent-specific SYSCOHADA financial report
  const handlePrintAgentReport = useCallback(() => {
    if (!selectedReportAgent) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Veuillez autoriser les fenêtres surgissantes (popups) pour imprimer le bilan.");
      return;
    }

    const compName = config?.company_name || 'FIFA Transport';
    const compIfu = config?.company_ifu || '3202612345678';
    const compRccm = config?.company_rccm || 'RB-COT-26-B-1234';
    const compAddress = config?.company_address || 'Avenue Steinmetz, Cotonou';
    const compPhone = config?.company_phone || '+229 21 30 00 00';
    const compCity = config?.company_city || 'Cotonou';
    const compCountry = config?.company_country || 'Bénin';

    const formatAmt = (amount: number) => new Intl.NumberFormat('fr-FR').format(amount);
    
    const rowsHtml = reportData.tickets.map(t => `
      <tr>
        <td class="cell-mono">${t.reference}</td>
        <td>${t.service_type}</td>
        <td>${t.route}</td>
        <td>${t.payment_mode.toUpperCase()}</td>
        <td class="text-right">${formatAmt(t.amount)} F</td>
        <td>${new Date(t.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
      </tr>
    `).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="fr">
        <head>
          <meta charset="utf-8">
          <title>Bilan des Ventes - ${selectedReportAgent.full_name}</title>
          <style>
            @media print {
              body { 
                padding: 0; 
                margin: 0;
                background: #FFFFFF;
                color: #000000;
              }
              .page-break { 
                page-break-before: always; 
              }
              @page {
                size: A4 portrait;
                margin: 1.5cm;
              }
            }
            body {
              font-family: Arial, sans-serif;
              color: #2D3748;
              margin: 0;
              padding: 30px;
              background: #FFFFFF;
              font-size: 13px;
              line-height: 1.4;
            }
            .header-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
            }
            .header-table td {
              vertical-align: top;
              border: none;
              padding: 0;
            }
            .company-info {
              font-size: 11px;
              color: #4A5568;
            }
            .company-name {
              font-size: 16px;
              font-weight: bold;
              color: #1A202C;
              text-transform: uppercase;
              margin-bottom: 5px;
            }
            .report-title-box {
              text-align: center;
              border: 1px solid #CBD5E0;
              padding: 15px;
              margin: 20px 0;
              background: #F7FAFC;
              border-radius: 4px;
            }
            .report-title-box h1 {
              margin: 5px 0;
              font-size: 18px;
              color: #2D3748;
              text-transform: uppercase;
            }
            .section-title {
              font-weight: bold;
              font-size: 13px;
              margin: 25px 0 10px;
              text-transform: uppercase;
              border-bottom: 2px solid #2D3748;
              padding-bottom: 3px;
            }
            .sys-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
            }
            .sys-table th, .sys-table td {
              border: 1px solid #A0AEC0;
              padding: 8px 10px;
              text-align: left;
            }
            .sys-table th {
              background-color: #EDF2F7;
              font-weight: bold;
            }
            .sys-table tr.total-row {
              font-weight: bold;
              background-color: #F7FAFC;
            }
            .text-right {
              text-align: right;
            }
            .cell-mono {
              font-family: monospace;
              font-size: 12px;
            }
            .signature-box {
              margin-top: 40px;
              display: flex;
              justify-content: space-between;
            }
            .signature-col {
              width: 45%;
              border: 1px dashed #CBD5E0;
              padding: 15px;
              height: 120px;
              font-size: 12px;
            }
            .badge {
              font-weight: bold;
              padding: 2px 6px;
              border-radius: 3px;
              font-size: 11px;
            }
            .metadata-table {
              width: 100%;
              margin-bottom: 20px;
            }
            .metadata-table td {
              padding: 4px 0;
              border: none;
            }
          </style>
        </head>
        <body>
          <div class="sheet">
            <table class="header-table">
              <tr>
                <td style="width: 60%;">
                  <div class="company-name">${compName}</div>
                  <div class="company-info">
                    ${compAddress}<br>
                    Téléphone : ${compPhone} | Ville : ${compCity}<br>
                    N° IFU : ${compIfu} | RCCM : ${compRccm}
                  </div>
                </td>
                <td style="width: 40%; text-align: right;">
                  <div style="font-size: 11px; color: #718096;">
                    Date d'édition : ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}<br>
                    SYSCOHADA Normalisé - Bénin
                  </div>
                </td>
              </tr>
            </table>

            <div class="report-title-box">
              <p style="font-size: 12px; margin: 0; text-transform: uppercase; color: #4A5568;">Rapport de Performance Individuel</p>
              <h1>Bilan des Ventes Agent</h1>
              <p style="margin: 5px 0 0; color: #2D3748;">Période : <strong>${reportData.periodLabel}</strong></p>
            </div>

            <div class="section-title">1. Informations de l'Agent</div>
            <table class="metadata-table">
              <tr>
                <td style="width: 20%;"><strong>Nom complet :</strong></td>
                <td style="width: 30%;">${selectedReportAgent.full_name}</td>
                <td style="width: 20%;"><strong>Code Agent :</strong></td>
                <td style="width: 30%;"><code style="font-size:12px;">${selectedReportAgent.code}</code></td>
              </tr>
              <tr>
                <td><strong>Téléphone :</strong></td>
                <td>${selectedReportAgent.phone || '—'}</td>
                <td><strong>Email :</strong></td>
                <td>${selectedReportAgent.email || '—'}</td>
              </tr>
              <tr>
                <td><strong>Statut :</strong></td>
                <td>${selectedReportAgent.active ? 'ACTIF' : 'INACTIF'}</td>
                <td><strong>Exercice comptable :</strong></td>
                <td>${reportData.exercice}</td>
              </tr>
            </table>

            <div class="section-title">2. Synthèse Financière des Ventes</div>
            <table class="sys-table">
              <thead>
                <tr>
                  <th>Indicateur</th>
                  <th style="text-align: right;">Volume (Tickets)</th>
                  <th style="text-align: right;">Montant Total</th>
                  <th style="text-align: right;">Pourcentage (%)</th>
                </tr>
              </thead>
              <tbody>
                <tr class="total-row">
                  <td>Chiffre d'Affaires Global (CA)</td>
                  <td class="text-right">${reportData.totalTickets}</td>
                  <td class="text-right">${formatAmt(reportData.totalRevenue)} FCFA</td>
                  <td class="text-right">100%</td>
                </tr>
                <tr>
                  <td style="padding-left: 20px;">• Ventes Service PASSAGER</td>
                  <td class="text-right">${reportData.services[0].count}</td>
                  <td class="text-right">${formatAmt(reportData.services[0].revenue)} FCFA</td>
                  <td class="text-right">${reportData.services[0].percentage}%</td>
                </tr>
                <tr>
                  <td style="padding-left: 20px;">• Ventes Service COLIS</td>
                  <td class="text-right">${reportData.services[1].count}</td>
                  <td class="text-right">${formatAmt(reportData.services[1].revenue)} FCFA</td>
                  <td class="text-right">${reportData.services[1].percentage}%</td>
                </tr>
                <tr class="total-row">
                  <td colspan="4" style="background-color: #EDF2F7; font-size: 11px;">Répartition par mode de règlement</td>
                </tr>
                <tr>
                  <td style="padding-left: 20px;">• Règlement en ESPÈCES</td>
                  <td class="text-right">${reportData.payments[0].count}</td>
                  <td class="text-right">${formatAmt(reportData.payments[0].revenue)} FCFA</td>
                  <td class="text-right">${reportData.payments[0].percentage}%</td>
                </tr>
                <tr>
                  <td style="padding-left: 20px;">• Autres Règlements</td>
                  <td class="text-right">${reportData.payments[1].count}</td>
                  <td class="text-right">${formatAmt(reportData.payments[1].revenue)} FCFA</td>
                  <td class="text-right">${reportData.payments[1].percentage}%</td>
                </tr>
              </tbody>
            </table>

            <div class="signature-box">
              <div class="signature-col">
                <strong>Signature de l'Agent</strong><br><br>
                ${selectedReportAgent.full_name}
              </div>
              <div class="signature-col">
                <strong>Signature du Superviseur</strong><br><br>
                Pour validation administrative et financière
              </div>
            </div>
          </div>

          ${reportData.tickets.length > 0 ? `
            <div class="page-break"></div>
            <div class="sheet">
              <div class="section-title" style="margin-top: 0;">3. Journal des Ventes (Détails des Tickets)</div>
              <p style="font-size: 11px; margin-bottom: 10px;">Liste des transactions enregistrées par l'agent <strong>${selectedReportAgent.full_name}</strong> pour la période concernée.</p>
              
              <table class="sys-table" style="font-size: 11px;">
                <thead>
                  <tr>
                    <th>Référence</th>
                    <th>Service</th>
                    <th>Trajet</th>
                    <th>Paiement</th>
                    <th style="text-align: right;">Montant</th>
                    <th>Date & Heure</th>
                  </tr>
                </thead>
                <tbody>
                  ${rowsHtml}
                  <tr class="total-row">
                    <td colspan="4">Total cumulé</td>
                    <td class="text-right">${formatAmt(reportData.totalRevenue)} F</td>
                    <td>${reportData.totalTickets} ticket(s)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ` : ''}

          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  }, [selectedReportAgent, reportData, config]);

  const columnsWithAction = useMemo<Column<Agent>[]>(() => [
    ...columns,
    {
      key: '_actions',
      label: 'Actions',
      render: (row) => (
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            className="btn btn-ghost"
            onClick={() => {
              setSelectedAgent(row);
              setShowEditModal(true);
            }}
            type="button"
            style={{ fontSize: '0.8rem' }}
          >
            Modifier
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => {
              setSelectedReportAgent(row);
              setShowReportModal(true);
            }}
            type="button"
            style={{ fontSize: '0.8rem', color: 'var(--primary)' }}
          >
            Bilan
          </button>
        </div>
      ),
    },
  ], []);

  if (loading) {
    return (
      <>
        <PageHeader
          icon="👤"
          title="Agents"
          subtitle="Gestion des agents FIFA Transport"
          breadcrumb={[
            { label: 'Dashboard', href: '/' },
            { label: 'Agents' },
          ]}
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
          icon="👤"
          title="Agents"
          subtitle="Gestion des agents FIFA Transport"
          breadcrumb={[
            { label: 'Dashboard', href: '/' },
            { label: 'Agents' },
          ]}
        />
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon"></div>
            <div className="empty-state-title">Erreur de chargement</div>
            <div className="empty-state-desc">{error}</div>
            <button
              className="btn btn-primary mt-md"
              onClick={fetchAgents}
              type="button"
            >
              Réessayer
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        icon="👤"
        title="Agents"
        subtitle={`${agents.length} agent${agents.length !== 1 ? 's' : ''} enregistré${agents.length !== 1 ? 's' : ''}`}
        breadcrumb={[
          { label: 'Dashboard', href: '/' },
          { label: 'Agents' },
        ]}
        actions={
          <button
            className="btn btn-primary"
            onClick={() => setShowModal(true)}
            type="button"
            id="add-agent-btn"
          >
            <span className="btn-icon-left" aria-hidden="true">+</span>
            Nouvel agent
          </button>
        }
      />

      {/* Stats summary */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon green">
              <span aria-hidden="true">✓</span>
            </div>
          </div>
          <div className="stat-card-value">{agents.filter((a) => a.active).length}</div>
          <div className="stat-card-label">Agents actifs</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon red">
              <span aria-hidden="true">✕</span>
            </div>
          </div>
          <div className="stat-card-value">{agents.filter((a) => !a.active).length}</div>
          <div className="stat-card-label">Agents inactifs</div>
        </div>
      </div>

      <DataTable<Agent>
        columns={columnsWithAction}
        data={agents}
        searchKeys={['code', 'full_name', 'phone']}
        searchPlaceholder="Rechercher un agent par nom, code ou téléphone..."
        idKey="id"
        emptyIcon="—"
        emptyTitle="Aucun agent"
        emptyDesc="Créez votre premier agent pour commencer."
      />

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Nouvel agent"
      >
        <ActionForm
          endpoint={`${apiBase}/agents`}
          buttonLabel="Créer l'agent"
          onSuccess={handleSuccess}
          fields={[
            {
              name: 'code',
              label: 'Code agent',
              placeholder: 'Ex: AGT-001',
              required: true,
            },
            {
              name: 'fullName',
              label: 'Nom complet',
              placeholder: 'Ex: Moussa Diallo',
              required: true,
            },
            {
              name: 'email',
              label: 'Email',
              placeholder: 'Ex: moussa@fifa-transport.tg',
              required: true,
              type: 'email',
            },
            {
              name: 'password',
              label: 'Mot de passe',
              placeholder: 'Créer un mot de passe',
              required: true,
              type: 'password',
            },
            {
              name: 'phone',
              label: 'Téléphone',
              placeholder: 'Ex: +221 77 123 4567',
            },
          ]}
        />
      </Modal>

      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedAgent(null);
        }}
        title={`Modifier l'agent : ${selectedAgent?.full_name ?? ''}`}
      >
        {selectedAgent && (
          <ActionForm
            endpoint={`${apiBase}/agents/${selectedAgent.id}`}
            method="PATCH"
            buttonLabel="Enregistrer les modifications"
            onSuccess={handleEditSuccess}
            fields={[
              {
                name: 'code',
                label: 'Code agent',
                placeholder: 'Ex: AGT-001',
                required: true,
                initialValue: selectedAgent.code,
              },
              {
                name: 'fullName',
                label: 'Nom complet',
                placeholder: 'Ex: Moussa Diallo',
                required: true,
                initialValue: selectedAgent.full_name,
              },
              {
                name: 'email',
                label: 'Email',
                placeholder: 'Ex: moussa@fifa-transport.tg',
                required: true,
                type: 'email',
                initialValue: selectedAgent.email ?? '',
              },
              {
                name: 'phone',
                label: 'Téléphone',
                placeholder: 'Ex: +221 77 123 4567',
                initialValue: selectedAgent.phone ?? '',
              },
              {
                name: 'active',
                label: 'Statut de l\'agent',
                type: 'select',
                required: true,
                initialValue: String(selectedAgent.active),
                options: [
                  { value: 'true', label: 'Actif' },
                  { value: 'false', label: 'Inactif' },
                ],
              },
              {
                name: 'password',
                label: 'Nouveau mot de passe (optionnel)',
                placeholder: 'Laisser vide pour ne pas modifier',
                type: 'password',
                required: false,
              },
            ]}
          />
        )}
      </Modal>

      <Modal
        isOpen={showReportModal}
        onClose={() => {
          setShowReportModal(false);
          setSelectedReportAgent(null);
        }}
        title={`Bilan des ventes : ${selectedReportAgent?.full_name ?? ''}`}
        size="lg"
      >
        <div className="report-modal-content" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Period selector */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div className="btn-group" style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
              {(['daily', 'weekly', 'monthly', 'yearly'] as const).map((period) => {
                const isActive = reportPeriod === period;
                const label = period === 'daily' ? 'Quotidien' : period === 'weekly' ? 'Hebdomadaire' : period === 'monthly' ? 'Mensuel' : 'Annuel';
                return (
                  <button
                    key={period}
                    type="button"
                    onClick={() => setReportPeriod(period)}
                    className="btn"
                    style={{
                      borderRadius: 0,
                      border: 'none',
                      background: isActive ? 'var(--primary)' : 'transparent',
                      color: isActive ? '#000000' : 'var(--text-secondary)',
                      padding: '5px 12px',
                      fontSize: '0.8rem',
                      fontWeight: isActive ? 'bold' : 'normal',
                      boxShadow: 'none',
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <button
              onClick={handlePrintAgentReport}
              disabled={reportLoading || reportData.tickets.length === 0}
              className="btn btn-primary"
              style={{ padding: '5px 12px', fontSize: '0.8rem' }}
            >
              Imprimer le bilan
            </button>
          </div>

          {/* Date Picker Section */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-input)', padding: 10, borderRadius: 'var(--radius-sm)' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Choisir la période :</span>
            
            {reportPeriod === 'daily' && (
              <input
                type="date"
                className="form-input"
                style={{ width: 'auto', padding: '4px 8px', fontSize: '0.8rem', margin: 0 }}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            )}

            {reportPeriod === 'weekly' && (
              <input
                type="week"
                className="form-input"
                style={{ width: 'auto', padding: '4px 8px', fontSize: '0.8rem', margin: 0 }}
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(e.target.value)}
              />
            )}

            {reportPeriod === 'monthly' && (
              <input
                type="month"
                className="form-input"
                style={{ width: 'auto', padding: '4px 8px', fontSize: '0.8rem', margin: 0 }}
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              />
            )}

            {reportPeriod === 'yearly' && (
              <select
                className="form-input"
                style={{ width: 'auto', padding: '4px 8px', fontSize: '0.8rem', margin: 0 }}
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
              >
                {[2024, 2025, 2026, 2027, 2028].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            )}
          </div>

          {reportLoading ? (
            <div style={{ padding: '40px 0', textAlign: 'center' }}>
              <div className="loading-dots" aria-label="Chargement du bilan">
                <span /><span /><span />
              </div>
            </div>
          ) : reportError ? (
            <div style={{ color: '#E53E3E', fontSize: '0.85rem', padding: 20, textAlign: 'center' }}>
              {reportError}
            </div>
          ) : (
            <>
              {/* Active period label */}
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                {reportData.periodLabel}
              </div>

              {/* Mini Stats Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                <div className="stat-card" style={{ padding: 12 }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>CA Total</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--primary)', marginTop: 4 }}>
                    {new Intl.NumberFormat('fr-FR').format(reportData.totalRevenue)} F
                  </div>
                </div>
                <div className="stat-card" style={{ padding: 12 }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Tickets vendus</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--text-primary)', marginTop: 4 }}>
                    {reportData.totalTickets}
                  </div>
                </div>
                <div className="stat-card" style={{ padding: 12 }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Panier moyen</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--text-primary)', marginTop: 4 }}>
                    {new Intl.NumberFormat('fr-FR').format(reportData.averageAmount)} F
                  </div>
                </div>
              </div>

              {/* Service & Payment breakdown tables */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
                {/* Services */}
                <div className="card" style={{ padding: 12, margin: 0 }}>
                  <h4 style={{ fontSize: '0.8rem', margin: '0 0 10px 0', textTransform: 'uppercase', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
                    Répartition par Service
                  </h4>
                  <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ color: 'var(--text-secondary)', textAlign: 'left' }}>
                        <th style={{ padding: '4px 0' }}>Service</th>
                        <th style={{ textAlign: 'right' }}>Tickets</th>
                        <th style={{ textAlign: 'right' }}>Montant</th>
                        <th style={{ textAlign: 'right' }}>%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.services.map((s) => (
                        <tr key={s.name} style={{ borderTop: '1px solid var(--border)' }}>
                          <td style={{ padding: '6px 0', fontWeight: 'bold' }}>{s.name}</td>
                          <td style={{ textAlign: 'right' }}>{s.count}</td>
                          <td style={{ textAlign: 'right' }}>{new Intl.NumberFormat('fr-FR').format(s.revenue)} F</td>
                          <td style={{ textAlign: 'right', color: 'var(--primary)' }}>{s.percentage}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Payments */}
                <div className="card" style={{ padding: 12, margin: 0 }}>
                  <h4 style={{ fontSize: '0.8rem', margin: '0 0 10px 0', textTransform: 'uppercase', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
                    Répartition par Règlement
                  </h4>
                  <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ color: 'var(--text-secondary)', textAlign: 'left' }}>
                        <th style={{ padding: '4px 0' }}>Mode</th>
                        <th style={{ textAlign: 'right' }}>Tickets</th>
                        <th style={{ textAlign: 'right' }}>Montant</th>
                        <th style={{ textAlign: 'right' }}>%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.payments.map((p) => (
                        <tr key={p.name} style={{ borderTop: '1px solid var(--border)' }}>
                          <td style={{ padding: '6px 0', fontWeight: 'bold' }}>{p.name}</td>
                          <td style={{ textAlign: 'right' }}>{p.count}</td>
                          <td style={{ textAlign: 'right' }}>{new Intl.NumberFormat('fr-FR').format(p.revenue)} F</td>
                          <td style={{ textAlign: 'right', color: 'var(--primary)' }}>{p.percentage}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Transactions list */}
              <div>
                <h4 style={{ fontSize: '0.8rem', margin: '0 0 8px 0', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                  Journal des Ventes ({reportData.tickets.length} tickets)
                </h4>
                <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                  {reportData.tickets.length === 0 ? (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', padding: 20, textAlign: 'center' }}>
                      Aucun ticket vendu sur cette période.
                    </div>
                  ) : (
                    <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 1, boxShadow: '0 1px 0 var(--border)' }}>
                        <tr style={{ color: 'var(--text-secondary)' }}>
                          <th style={{ padding: '6px 8px' }}>Référence</th>
                          <th style={{ padding: '6px 8px' }}>Trajet</th>
                          <th style={{ padding: '6px 8px' }}>Service</th>
                          <th style={{ padding: '6px 8px', textAlign: 'right' }}>Montant</th>
                          <th style={{ padding: '6px 8px', textAlign: 'right' }}>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.tickets.map((t) => (
                          <tr key={t.id} style={{ borderTop: '1px solid var(--border)' }}>
                            <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{t.reference}</td>
                            <td style={{ padding: '6px 8px' }}>{t.route}</td>
                            <td style={{ padding: '6px 8px' }}>
                              <span style={{ fontSize: '0.7rem', padding: '1px 4px', borderRadius: 3, background: 'var(--border)', color: 'var(--text-primary)' }}>
                                {t.service_type}
                              </span>
                            </td>
                            <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 'bold' }}>
                              {new Intl.NumberFormat('fr-FR').format(t.amount)} F
                            </td>
                            <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                              {new Date(t.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </Modal>
    </>
  );
}
