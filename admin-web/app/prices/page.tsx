"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { Modal } from '@/components/Modal';
import { ActionForm } from '@/components/ActionForm';

const apiBase = process.env.NEXT_PUBLIC_ADMIN_API_BASE_URL ?? '/api';

type Price = {
  id: string;
  label: string;
  amount: number;
  updated_at: string;
};

type Ticket = {
  id: number;
  reference: string;
  device_id: string;
  agent_id: number;
  agent_name: string | null;
  agent_code: string | null;
  device_label: string | null;
  service_type: string;
  route: string;
  amount: number;
  payment_mode: string;
  created_at: string;
};

function formatAmount(amount: number): string {
  return new Intl.NumberFormat('fr-FR').format(amount);
}

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

export default function PricesPage() {
  const [prices, setPrices] = useState<Price[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modals state
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedPrice, setSelectedPrice] = useState<Price | null>(null);

  // Report filters state
  const [reportPeriod, setReportPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily');
  
  // Date states initialized dynamically
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedWeek, setSelectedWeek] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedYear, setSelectedYear] = useState(2026);
  const [reportExpenses, setReportExpenses] = useState<number>(0);

  // Company Settings & Security State
  const [compName, setCompName] = useState('');
  const [compIfu, setCompIfu] = useState('');
  const [compRccm, setCompRccm] = useState('');
  const [compAddress, setCompAddress] = useState('');
  const [compPhone, setCompPhone] = useState('');
  const [compCity, setCompCity] = useState('');
  const [compCountry, setCompCountry] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Initialize date defaults
  useEffect(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    setSelectedDate(`${yyyy}-${mm}-${dd}`);
    setSelectedMonth(`${yyyy}-${mm}`);
    setSelectedYear(yyyy);

    // Calculate current ISO week
    const tempDate = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
    const dayNum = tempDate.getUTCDay() || 7;
    tempDate.setUTCDate(tempDate.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(tempDate.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((tempDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    setSelectedWeek(`${tempDate.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [pricesRes, ticketsRes, configRes] = await Promise.all([
        fetch(`${apiBase}/prices`, { cache: 'no-store' }),
        fetch(`${apiBase}/tickets`, { cache: 'no-store' }),
        fetch(`${apiBase}/config`, { cache: 'no-store' })
      ]);

      if (!pricesRes.ok) throw new Error('Impossible de charger les tarifs');
      if (!ticketsRes.ok) throw new Error('Impossible de charger les tickets');
      if (!configRes.ok) throw new Error('Impossible de charger la configuration');

      const pricesData = await pricesRes.json();
      const ticketsData = await ticketsRes.json();
      const configData = await configRes.json();

      setPrices(pricesData);
      setTickets(ticketsData);
      
      setCompName(configData.company_name || 'FIFA Transport');
      setCompIfu(configData.company_ifu || '3202612345678');
      setCompRccm(configData.company_rccm || 'RB-COT-26-B-1234');
      setCompAddress(configData.company_address || 'Avenue Steinmetz, Cotonou');
      setCompPhone(configData.company_phone || '+229 21 30 00 00');
      setCompCity(configData.company_city || 'Cotonou');
      setCompCountry(configData.company_country || 'Bénin');
      setAdminPassword('');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleEditSuccess = useCallback(() => {
    setShowEditModal(false);
    setSelectedPrice(null);
    fetchData();
  }, [fetchData]);

  const handleSaveConfig = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: Record<string, string> = {
        company_name: compName,
        company_ifu: compIfu,
        company_rccm: compRccm,
        company_address: compAddress,
        company_phone: compPhone,
        company_city: compCity,
        company_country: compCountry,
      };
      if (adminPassword && adminPassword.trim() !== '') {
        payload.admin_password = adminPassword;
      }
      const response = await fetch(`${apiBase}/config`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error('Impossible d\'enregistrer la configuration');
      }
      setAdminPassword('');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Une erreur est survenue');
    }
  }, [compName, compIfu, compRccm, compAddress, compPhone, compCity, compCountry, adminPassword]);

  // Compute report data based on active period type & select options
  const reportData = useMemo(() => {
    if (!tickets || tickets.length === 0) {
      return {
        tickets: [],
        totalRevenue: 0,
        totalTickets: 0,
        averageAmount: 0,
        services: [],
        periodLabel: 'Aucune donnée disponible',
        exercice: '2026'
      };
    }

    let filtered = [...tickets];
    let periodLabel = '';
    let exercice = '2026';

    if (reportPeriod === 'daily') {
      if (selectedDate) {
        filtered = tickets.filter(t => t.created_at.startsWith(selectedDate));
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

        // Get simple week date start
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

        filtered = tickets.filter(t => {
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
        filtered = tickets.filter(t => t.created_at.startsWith(selectedMonth));
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
      filtered = tickets.filter(t => t.created_at.startsWith(target));
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

    return {
      tickets: filtered,
      totalRevenue,
      totalTickets,
      averageAmount,
      services,
      periodLabel,
      exercice
    };
  }, [tickets, reportPeriod, selectedDate, selectedWeek, selectedMonth, selectedYear]);

  // Handle printing SYSCOHADA SMT report PDF
  const handleDownloadPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Veuillez autoriser les fenêtres surgissantes (popups) pour imprimer le bilan.");
      return;
    }

    const valueAdded = reportData.totalRevenue - reportExpenses;
    const netProfit = valueAdded;

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="fr">
        <head>
          <meta charset="utf-8">
          <title>Bilan Financier SYSCOHADA SMT - ${compName}</title>
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
            /* Styling Cover Page */
            .cover-container {
              border: 4px double #1A202C;
              padding: 40px;
              height: 90%;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              min-height: 25cm;
              box-sizing: border-box;
            }
            .syscohada-header {
              text-align: center;
              border-bottom: 2px solid #1A202C;
              padding-bottom: 15px;
              margin-bottom: 30px;
            }
            .syscohada-header h2 {
              margin: 0;
              font-size: 16px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 1px;
            }
            .syscohada-header p {
              margin: 5px 0 0;
              font-size: 11px;
              font-weight: bold;
              color: #4A5568;
            }
            .company-info-box {
              margin-top: 20px;
              font-size: 13px;
            }
            .company-info-box table {
              width: 100%;
              border-collapse: collapse;
            }
            .company-info-box td {
              border: none;
              padding: 6px 0;
            }
            .report-title-box {
              text-align: center;
              margin: 60px 0;
            }
            .report-title-box h1 {
              font-size: 26px;
              font-weight: 800;
              margin: 10px 0;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .report-title-box .exercice-badge {
              display: inline-block;
              border: 2px solid #000000;
              padding: 8px 24px;
              font-size: 18px;
              font-weight: 800;
              margin-top: 15px;
            }
            .signature-box {
              margin-top: 80px;
              display: flex;
              justify-content: space-between;
            }
            .signature-col {
              width: 45%;
              text-align: center;
              border-top: 1px dashed #000000;
              padding-top: 10px;
              font-weight: bold;
              font-size: 11px;
            }

            /* Report sheets structures */
            .sheet-title {
              font-size: 16px;
              font-weight: 800;
              text-transform: uppercase;
              margin: 0 0 20px;
              border-bottom: 2px solid #000000;
              padding-bottom: 6px;
              display: flex;
              justify-content: space-between;
            }
            .sheet-subtitle {
              font-size: 11px;
              color: #4A5568;
              font-weight: normal;
              text-transform: none;
            }
            .mini-meta-table {
              width: 100%;
              margin-bottom: 20px;
            }
            .mini-meta-table td {
              border: none;
              padding: 3px 0;
              font-size: 11px;
            }
            table.sys-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 30px;
              font-size: 12px;
            }
            table.sys-table th, table.sys-table td {
              border: 1px solid #1A202C;
              padding: 8px 10px;
            }
            table.sys-table th {
              background-color: #F7FAFC;
              font-weight: bold;
              text-transform: uppercase;
              font-size: 11px;
            }
            table.sys-table tr.total-row {
              font-weight: bold;
              background-color: #EDF2F7;
            }
            table.sys-table tr.header-section {
              background-color: #EDF2F7;
              font-weight: bold;
              text-transform: uppercase;
            }
            .text-right {
              text-align: right;
            }
            .text-center {
              text-align: center;
            }
            .footer-pages {
              text-align: center;
              font-size: 10px;
              color: #718096;
              border-top: 1px solid #E2E8F0;
              padding-top: 10px;
              margin-top: 30px;
            }
          </style>
        </head>
        <body>
          
          <!-- PAGE 1: PAGE DE GARDE / IDENTIFICATION -->
          <div class="cover-container">
            <div>
              <div class="syscohada-header">
                <h2>RÉPUBLIQUE DU BÉNIN</h2>
                <p>Système Minimal de Trésorerie (SMT) — Acte Uniforme SYSCOHADA Révisé</p>
              </div>

              <div class="company-info-box">
                <table>
                  <tr>
                    <td style="width: 30%;"><strong>Désignation de l'Entreprise :</strong></td>
                    <td>${compName}</td>
                  </tr>
                  <tr>
                    <td><strong>Adresse Complète :</strong></td>
                    <td>${compAddress}</td>
                  </tr>
                  <tr>
                    <td><strong>Téléphone :</strong></td>
                    <td>${compPhone}</td>
                  </tr>
                  <tr>
                    <td><strong>Ville / Pays :</strong></td>
                    <td>${compCity} / ${compCountry}</td>
                  </tr>
                  <tr>
                    <td><strong>N° d'Identification Fiscale (IFU) :</strong></td>
                    <td><strong>${compIfu}</strong></td>
                  </tr>
                  <tr>
                    <td><strong>Registre du Commerce (RCCM) :</strong></td>
                    <td><strong>${compRccm}</strong></td>
                  </tr>
                </table>
              </div>
            </div>

            <div class="report-title-box">
              <p style={{ fontSize: 14, fontWeight: 'bold', margin: 0, textTransform: 'uppercase', color: '#4A5568' }}>Etats Financiers Annuels</p>
              <h1>Liasse Financière & Bilan SMT</h1>
              <p style={{ margin: 5, color: '#4A5568' }}>Période de bilan : <strong>${reportData.periodLabel}</strong></p>
              <div class="exercice-badge">EXERCICE CLOTURÉ : ${reportData.exercice}</div>
            </div>

            <div>
              <div class="signature-box">
                <div class="signature-col">
                  Signature du Comptable / Expert-Comptable
                </div>
                <div class="signature-col">
                  Signature du Représentant Légal
                  <br/><br/>
                  <em>${compName}</em>
                </div>
              </div>
              <div class="footer-pages" style="border: none; margin-top: 40px;">
                Page 1 — Fiche d'Identification Générale
              </div>
            </div>
          </div>

          <!-- PAGE 2: BILAN ACTIF / PASSIF SMT -->
          <div class="page-break"></div>
          
          <div class="sheet-title">
            Bilan Financier SYSCOHADA SMT
            <span class="sheet-subtitle">Exercice : ${reportData.exercice} | Devise : FCFA</span>
          </div>

          <table class="mini-meta-table">
            <tr>
              <td style="width: 50%;"><strong>Entreprise :</strong> ${compName}</td>
              <td style="text-align: right;"><strong>N° IFU :</strong> ${compIfu}</td>
            </tr>
            <tr>
              <td><strong>Période :</strong> ${reportData.periodLabel}</td>
              <td style="text-align: right;"><strong>RCCM :</strong> ${compRccm}</td>
            </tr>
          </table>

          <div style="font-weight: bold; font-size: 13px; margin: 15px 0 8px; text-transform: uppercase;">1. Bilan - ACTIF (Emplois)</div>
          <table class="sys-table">
            <thead>
              <tr>
                <th style="width: 15%;">Code SMT</th>
                <th style="width: 55%;">Rubriques Actif</th>
                <th style="width: 15%; text-align: right;">Montant Brut</th>
                <th style="width: 15%; text-align: right;">Montant Net</th>
              </tr>
            </thead>
            <tbody>
              <tr class="header-section">
                <td>TA</td>
                <td colspan="3">Actif Immobilisé</td>
              </tr>
              <tr>
                <td class="text-center">TA.1</td>
                <td>Immobilisations incorporelles et corporelles</td>
                <td class="text-right">0</td>
                <td class="text-right">0</td>
              </tr>
              <tr class="header-section">
                <td>TB</td>
                <td colspan="3">Actif Circulant</td>
              </tr>
              <tr>
                <td class="text-center">TB.1</td>
                <td>Stocks et en-cours</td>
                <td class="text-right">0</td>
                <td class="text-right">0</td>
              </tr>
              <tr>
                <td class="text-center">TB.2</td>
                <td>Créances de l'exercice</td>
                <td class="text-right">0</td>
                <td class="text-right">0</td>
              </tr>
              <tr class="header-section">
                <td>TC</td>
                <td colspan="3">Trésorerie Actif</td>
              </tr>
              <tr>
                <td class="text-center">TC.1</td>
                <td>Banques, chèques postaux et caisse (Chiffre d'Affaires encaissé)</td>
                <td class="text-right">${formatAmount(reportData.totalRevenue)}</td>
                <td class="text-right"><strong>${formatAmount(reportData.totalRevenue)}</strong></td>
              </tr>
              <tr class="total-row">
                <td class="text-center">BZ</td>
                <td>TOTAL ACTIF (TA.1 + TB.1 + TB.2 + TC.1)</td>
                <td class="text-right">${formatAmount(reportData.totalRevenue)}</td>
                <td class="text-right">${formatAmount(reportData.totalRevenue)}</td>
              </tr>
            </tbody>
          </table>

          <div style="font-weight: bold; font-size: 13px; margin: 25px 0 8px; text-transform: uppercase;">2. Bilan - PASSIF (Ressources)</div>
          <table class="sys-table">
            <thead>
              <tr>
                <th style="width: 15%;">Code SMT</th>
                <th style="width: 70%;">Rubriques Passif</th>
                <th style="width: 15%; text-align: right;">Montant Net</th>
              </tr>
            </thead>
            <tbody>
              <tr class="header-section">
                <td>TD</td>
                <td colspan="2">Ressources Stables</td>
              </tr>
              <tr>
                <td class="text-center">TD.1</td>
                <td>Capitaux propres (Capital social et réserves)</td>
                <td class="text-right">0</td>
              </tr>
              <tr>
                <td class="text-center">TD.2</td>
                <td>Résultat Net de l'exercice (Bénéfice ou Perte)</td>
                <td class="text-right"><strong>${formatAmount(netProfit)}</strong></td>
              </tr>
              <tr class="header-section">
                <td>TE</td>
                <td colspan="2">Passif Circulant</td>
              </tr>
              <tr>
                <td class="text-center">TE.1</td>
                <td>Dettes d'exploitation (Fournisseurs et charges à payer)</td>
                <td class="text-right">0</td>
              </tr>
              <tr class="header-section">
                <td>TF</td>
                <td colspan="2">Trésorerie Passif</td>
              </tr>
              <tr>
                <td class="text-center">TF.1</td>
                <td>Concours bancaires et soldes créditeurs</td>
                <td class="text-right">${formatAmount(reportExpenses)}</td>
              </tr>
              <tr class="total-row">
                <td class="text-center">CZ</td>
                <td>TOTAL PASSIF (TD.1 + TD.2 + TE.1 + TF.1)</td>
                <td class="text-right">${formatAmount(reportData.totalRevenue)}</td>
              </tr>
            </tbody>
          </table>

          <div class="footer-pages">
            Page 2 — Bilan Actif / Passif Simplifié (Norme SMT SYSCOHADA)
          </div>

          <!-- PAGE 3: COMPTE DE RESULTAT SMT -->
          <div class="page-break"></div>

          <div class="sheet-title">
            Compte de Résultat SYSCOHADA SMT
            <span class="sheet-subtitle">Exercice : ${reportData.exercice} | Devise : FCFA</span>
          </div>

          <table class="mini-meta-table">
            <tr>
              <td style="width: 50%;"><strong>Entreprise :</strong> ${compName}</td>
              <td style="text-align: right;"><strong>N° IFU :</strong> ${compIfu}</td>
            </tr>
            <tr>
              <td><strong>Période :</strong> ${reportData.periodLabel}</td>
              <td style="text-align: right;"><strong>RCCM :</strong> ${compRccm}</td>
            </tr>
          </table>

          <table class="sys-table">
            <thead>
              <tr>
                <th style="width: 10%;">Code</th>
                <th style="width: 60%;">Libellés Rubriques</th>
                <th style="width: 15%; text-align: right;">Exercice Brut</th>
                <th style="width: 15%; text-align: right;">Part relative (%)</th>
              </tr>
            </thead>
            <tbody>
              <tr class="header-section">
                <td>XA</td>
                <td colspan="3">PRODUITS (Revenus d'exploitation)</td>
              </tr>
              <tr>
                <td class="text-center">XA.1</td>
                <td>Chiffre d'Affaires (CA) des ventes de tickets</td>
                <td class="text-right"><strong>${formatAmount(reportData.totalRevenue)}</strong></td>
                <td class="text-right">100%</td>
              </tr>
              <tr style="font-size: 11px; color: #4A5568;">
                <td></td>
                <td style="padding-left: 20px;">— CA Ticket Option PASSAGER</td>
                <td class="text-right">${formatAmount(reportData.services[0].revenue)}</td>
                <td class="text-right">${reportData.services[0].percentage}%</td>
              </tr>
              <tr style="font-size: 11px; color: #4A5568;">
                <td></td>
                <td style="padding-left: 20px;">— CA Ticket Option COLIS</td>
                <td class="text-right">${formatAmount(reportData.services[1].revenue)}</td>
                <td class="text-right">${reportData.services[1].percentage}%</td>
              </tr>

              <tr class="header-section">
                <td>XB</td>
                <td colspan="3">CHARGES (Coûts d'exploitation déclarés)</td>
              </tr>
              <tr>
                <td class="text-center">XB.1</td>
                <td>Charges de fonctionnement & d'exploitation déclarées</td>
                <td class="text-right" style="color: #E53E3E;">${formatAmount(reportExpenses)}</td>
                <td class="text-right">—</td>
              </tr>
              
              <tr class="header-section">
                <td>XC</td>
                <td colspan="3">INDICATEURS DE PERFORMANCE</td>
              </tr>
              <tr class="total-row" style="background-color: #EDF2F7;">
                <td class="text-center">XC.1</td>
                <td>Valeur Ajoutée (Chiffre d'Affaires Net - Charges)</td>
                <td class="text-right">${formatAmount(valueAdded)}</td>
                <td class="text-right">${reportData.totalRevenue > 0 ? Math.round((valueAdded / reportData.totalRevenue) * 100) : 0}%</td>
              </tr>
              <tr class="total-row" style="background-color: #EDF2F7; font-size: 13px;">
                <td class="text-center">XC.2</td>
                <td>RÉSULTAT NET DE L'EXERCICE (BÉNÉFICE)</td>
                <td class="text-right" style="color: #2F855A;">${formatAmount(netProfit)}</td>
                <td class="text-right">${reportData.totalRevenue > 0 ? Math.round((netProfit / reportData.totalRevenue) * 100) : 0}%</td>
              </tr>
            </tbody>
          </table>

          <div style="font-size: 11px; color: #4A5568; line-height: 1.5; margin-top: 40px; border: 1px solid #CBD5E0; padding: 15px; border-radius: 6px; background-color: #F7FAFC;">
            <strong>Note comptable :</strong> Les revenus présentés ci-dessus correspondent à la consolidation des tickets enregistrés par les terminaux de paiement électronique (TPE) de la flotte <em>FIFA Transport</em> pour l'exercice comptable spécifié. L'imputabilité des charges est gérée sous la supervision de l'administrateur de la plateforme conformément au référentiel comptable SYSCOHADA en République du Bénin.
          </div>

          <div class="footer-pages">
            Page 3 — Compte de Résultat Simplifié (Norme SMT SYSCOHADA)
          </div>

          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 800);
            }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  if (loading) {
    return (
      <>
        <PageHeader
          icon="💵"
          title="Tarifs & Bilans"
          subtitle="Gestion des prix de services et bilans financiers"
          breadcrumb={[
            { label: 'Dashboard', href: '/' },
            { label: 'Tarifs & Bilans' },
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
          icon="💵"
          title="Tarifs & Bilans"
          subtitle="Gestion des prix de services et bilans financiers"
          breadcrumb={[
            { label: 'Dashboard', href: '/' },
            { label: 'Tarifs & Bilans' },
          ]}
        />
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon"></div>
            <div className="empty-state-title">Erreur de chargement</div>
            <div className="empty-state-desc">{error}</div>
            <button className="btn btn-primary mt-md" onClick={fetchData} type="button">
              Réessayer
            </button>
          </div>
        </div>
      </>
    );
  }

  const yearsOptions = [];
  const currentYear = new Date().getFullYear();
  for (let y = currentYear; y >= currentYear - 3; y--) {
    yearsOptions.push(y);
  }

  return (
    <>
      <PageHeader
        icon="💵"
        title="Tarifs & Bilans"
        subtitle="Mise à jour des grilles de tarifs et téléchargement des bilans financiers normalisés SYSCOHADA Bénin"
        breadcrumb={[
          { label: 'Dashboard', href: '/' },
          { label: 'Tarifs & Bilans' },
        ]}
      />

      <div className="section-grid">
        {/* Card 1: Prices Grid */}
        <div className="card">
          <div className="card-header">
            <div className="card-header-left">
              <span className="card-header-icon" aria-hidden="true"></span>
              <div>
                <h2 className="card-title">Grille des Tarifs Actuels</h2>
                <p className="card-subtitle">Modifier les montants des offres passager et colis</p>
              </div>
            </div>
          </div>
          <div className="card-body-flush">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Offre de Service</th>
                    <th>Identifiant</th>
                    <th>Montant</th>
                    <th>Dernière modification</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {prices.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                        Aucun tarif défini dans la base de données.
                      </td>
                    </tr>
                  ) : (
                    prices.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <strong>{p.label}</strong>
                        </td>
                        <td>
                          <span className="cell-mono">{p.id}</span>
                        </td>
                        <td>
                          <span className="cell-amount">{formatAmount(p.amount)} FCFA</span>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                            {formatDate(p.updated_at)}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="btn btn-ghost"
                            onClick={() => {
                              setSelectedPrice(p);
                              setShowEditModal(true);
                            }}
                            type="button"
                            style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                          >
                            Modifier
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Card 2: Company Settings & Lock Security */}
        <div className="card">
          <div className="card-header">
            <div className="card-header-left">
              <span className="card-header-icon" aria-hidden="true"></span>
              <div>
                <h2 className="card-title">Configuration Entreprise & Sécurité</h2>
                <p className="card-subtitle">Modifier les identifiants fiscaux (IFU, RCCM) et le mot de passe d'accès</p>
              </div>
            </div>
          </div>
          
          <div className="card-body">
            <form onSubmit={handleSaveConfig} className="form-grid" style={{ gap: '14px' }}>
              <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>Raison Sociale</label>
                  <input
                    type="text"
                    className="form-input"
                    value={compName}
                    onChange={(e) => setCompName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>N° IFU (Fiscale)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={compIfu}
                    onChange={(e) => setCompIfu(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>Registre RCCM</label>
                  <input
                    type="text"
                    className="form-input"
                    value={compRccm}
                    onChange={(e) => setCompRccm(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>N° Téléphone</label>
                  <input
                    type="text"
                    className="form-input"
                    value={compPhone}
                    onChange={(e) => setCompPhone(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Adresse Siège Social</label>
                <input
                  type="text"
                  className="form-input"
                  value={compAddress}
                  onChange={(e) => setCompAddress(e.target.value)}
                  required
                />
              </div>

              <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>Ville</label>
                  <input
                    type="text"
                    className="form-input"
                    value={compCity}
                    onChange={(e) => setCompCity(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>Pays</label>
                  <input
                    type="text"
                    className="form-input"
                    value={compCountry}
                    onChange={(e) => setCompCountry(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 'bold' }}>
                  Mot de Passe de Déverrouillage Admin (Sécurité)
                </label>
                <input
                  type="password"
                  className="form-input"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Laisser vide pour ne pas le modifier"
                  style={{ border: '1px solid rgba(245, 197, 24, 0.4)' }}
                />
              </div>

              <div style={{ marginTop: '6px' }}>
                <button type="submit" className="btn btn-primary w-full" style={{ padding: '12px' }}>
                  Enregistrer la Configuration
                </button>
                {saveSuccess && (
                  <div style={{ color: 'var(--success)', fontSize: '0.85rem', textAlign: 'center', marginTop: '8px', fontWeight: 600 }}>
                    ✓ Configuration et mot de passe enregistrés !
                  </div>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Card 3: SYSCOHADA PDF Revenue Report Generator */}
      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-header">
          <div className="card-header-left">
            <span className="card-header-icon" aria-hidden="true">📋</span>
            <div>
              <h2 className="card-title">Générateur de Bilans Financiers (SYSCOHADA Bénin)</h2>
              <p className="card-subtitle">Générer, prévisualiser et exporter la liasse financière officielle au format PDF</p>
            </div>
          </div>
        </div>
        
        <div className="card-body">
          <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}>
            
            {/* Filters panel */}
            <div>
              {/* Period Selector Tabs */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 16, background: 'rgba(255,255,255,0.03)', padding: 4, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                {(['daily', 'weekly', 'monthly', 'yearly'] as const).map((period) => (
                  <button
                    key={period}
                    className={`btn ${reportPeriod === period ? 'btn-primary' : 'btn-ghost'}`}
                    style={{
                      flex: 1,
                      fontSize: '0.82rem',
                      padding: '8px 10px',
                      minWidth: 0,
                      textTransform: 'capitalize',
                      background: reportPeriod === period ? '' : 'transparent',
                      border: 'none'
                    }}
                    onClick={() => setReportPeriod(period)}
                    type="button"
                  >
                    {period === 'daily' && 'Journalier'}
                    {period === 'weekly' && 'Hebdomadaire'}
                    {period === 'monthly' && 'Mensuel'}
                    {period === 'yearly' && 'Annuel'}
                  </button>
                ))}
              </div>

              {/* Inputs based on selection */}
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label" style={{ marginBottom: 8, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Choisir la période de facturation :
                </label>

                {reportPeriod === 'daily' && (
                  <input
                    type="date"
                    className="form-input"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    style={{ width: '100%' }}
                  />
                )}

                {reportPeriod === 'weekly' && (
                  <input
                    type="week"
                    className="form-input"
                    value={selectedWeek}
                    onChange={(e) => setSelectedWeek(e.target.value)}
                    style={{ width: '100%' }}
                  />
                )}

                {reportPeriod === 'monthly' && (
                  <input
                    type="month"
                    className="form-input"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    style={{ width: '100%' }}
                  />
                )}

                {reportPeriod === 'yearly' && (
                  <select
                    className="form-input"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                    style={{ width: '100%' }}
                  >
                    {yearsOptions.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Extra input for operating costs to determine SMT net result */}
              <div className="form-group" style={{ marginBottom: 20 }}>
                <label className="form-label" style={{ marginBottom: 8, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Charges / Coûts d'exploitation de la période (FCFA) :
                </label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="Entrer les charges d'exploitation"
                  value={reportExpenses || ''}
                  onChange={(e) => setReportExpenses(Math.max(0, Number(e.target.value)))}
                  style={{ width: '100%' }}
                />
              </div>

              {/* Download Button */}
              <button
                className="btn btn-primary w-full"
                onClick={handleDownloadPDF}
                type="button"
                style={{ padding: '14px 24px', fontWeight: 700, fontSize: '0.95rem' }}
              >
                Imprimer le Bilan SYSCOHADA (PDF)
              </button>
            </div>

            {/* Live SYSCOHADA Preview Card */}
            <div style={{ background: 'rgba(255, 255, 255, 0.015)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: '20px 24px', position: 'relative' }}>
              <div 
                style={{
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '16px 20px',
                  background: 'rgba(0,0,0,0.2)'
                }}
              >
                <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 10, marginBottom: 14 }}>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Aperçu e-Bilan Bénin (Modèle SMT)
                  </div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>
                    {compName}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--primary)', marginTop: 2, fontWeight: 600 }}>
                    {reportData.periodLabel}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed rgba(255,255,255,0.05)', paddingBottom: 6 }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Chiffre d'Affaires brut (XA.1)</span>
                    <strong style={{ fontSize: '0.85rem' }}>{formatAmount(reportData.totalRevenue)} F</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed rgba(255,255,255,0.05)', paddingBottom: 6 }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Charges déclarées (XB.1)</span>
                    <strong style={{ fontSize: '0.85rem', color: '#FF453A' }}>-{formatAmount(reportExpenses)} F</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed rgba(255,255,255,0.05)', paddingBottom: 6 }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Valeur Ajoutée (XC.1)</span>
                    <strong style={{ fontSize: '0.85rem' }}>{formatAmount(reportData.totalRevenue - reportExpenses)} F</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 4 }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 'bold' }}>Résultat Net Estimé (XC.2)</span>
                    <strong style={{ fontSize: '0.95rem', color: 'var(--success)' }}>
                      {formatAmount(reportData.totalRevenue - reportExpenses)} FCFA
                    </strong>
                  </div>
                </div>

                <div style={{ marginTop: 20, fontSize: '0.72rem', color: 'var(--text-muted)', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 10 }}>
                  <div>IFU : {compIfu}</div>
                  <div style={{ marginTop: 2 }}>RCCM : {compRccm}</div>
                  <div style={{ marginTop: 2 }}>Siège : {compAddress}, {compCity}</div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedPrice(null);
        }}
        title={selectedPrice ? `Modifier le tarif: ${selectedPrice.label}` : 'Modifier le tarif'}
      >
        {selectedPrice && (
          <ActionForm
            endpoint={`${apiBase}/prices/${selectedPrice.id}`}
            method="PATCH"
            buttonLabel="Enregistrer le tarif"
            onSuccess={handleEditSuccess}
            fields={[
              {
                name: 'amount',
                label: 'Montant (FCFA)',
                type: 'number',
                required: true,
                initialValue: selectedPrice.amount,
                placeholder: 'Saisir le nouveau prix en FCFA'
              }
            ]}
          />
        )}
      </Modal>
    </>
  );
}
