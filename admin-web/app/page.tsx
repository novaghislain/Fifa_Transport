"use client";

import { useState, useEffect, useMemo } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { StatsCard } from '@/components/StatsCard';
import { StatusBadge } from '@/components/StatusBadge';
import { Modal } from '@/components/Modal';
import ExcelJS from 'exceljs';

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

function formatToBeninTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const formatter = new Intl.DateTimeFormat('fr-CA', {
      timeZone: 'Africa/Porto-Novo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    const parts = formatter.formatToParts(date);
    const partMap = new Map(parts.map(p => [p.type, p.value]));
    const yyyy = partMap.get('year');
    const mm = partMap.get('month');
    const dd = partMap.get('day');
    const hh = partMap.get('hour');
    const min = partMap.get('minute');
    return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
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
  const [exporting, setExporting] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportPeriod, setExportPeriod] = useState<'today' | 'week' | 'month' | 'year' | 'all'>('all');

  const handleExportExcel = async (selectedPeriod: 'today' | 'week' | 'month' | 'year' | 'all' = 'all') => {
    if (exporting) return;
    try {
      setExporting(true);
      const [agentsRes, devicesRes, ticketsRes, sessionsRes] = await Promise.all([
        fetch(`${apiBase}/agents`, { cache: 'no-store' }),
        fetch(`${apiBase}/devices`, { cache: 'no-store' }),
        fetch(`${apiBase}/tickets`, { cache: 'no-store' }),
        fetch(`${apiBase}/auth/sessions`, { cache: 'no-store' }),
      ]);

      if (!agentsRes.ok || !devicesRes.ok || !ticketsRes.ok || !sessionsRes.ok) {
        throw new Error('Impossible de charger les données pour l\'export');
      }

      const agents = await agentsRes.json();
      const devices = await devicesRes.json();
      const ticketsData = await ticketsRes.json();

      // Filtrer les tickets selon la période sélectionnée
      let filteredExportTickets = [...ticketsData];
      let periodLabelForExcel = 'Toutes périodes confondues';
      let periodSuffix = 'global';

      const now = new Date();
      if (selectedPeriod === 'today') {
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        filteredExportTickets = ticketsData.filter((t: any) => t.created_at.startsWith(todayStr));
        periodLabelForExcel = `Aujourd'hui (${now.toLocaleDateString('fr-FR')})`;
        periodSuffix = `aujourdhui_${todayStr}`;
      } else if (selectedPeriod === 'week') {
        const getStartOfWeek = (d: Date) => {
          const date = new Date(d);
          const day = date.getDay();
          const diff = date.getDate() - day + (day === 0 ? -6 : 1);
          const monday = new Date(date.setDate(diff));
          monday.setHours(0, 0, 0, 0);
          return monday;
        };
        const weekStart = getStartOfWeek(now);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 7);

        filteredExportTickets = ticketsData.filter((t: any) => {
          const d = new Date(t.created_at);
          return d >= weekStart && d < weekEnd;
        });

        const endLabelDate = new Date(weekStart);
        endLabelDate.setDate(weekStart.getDate() + 6);
        periodLabelForExcel = `Cette semaine (du ${weekStart.toLocaleDateString('fr-FR', { day: 'numeric', month: 'numeric' })} au ${endLabelDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'numeric', year: 'numeric' })})`;
        const weekNo = Math.ceil((((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 86400000) + 1) / 7);
        periodSuffix = `semaine_${now.getFullYear()}-W${weekNo}`;
      } else if (selectedPeriod === 'month') {
        const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        filteredExportTickets = ticketsData.filter((t: any) => t.created_at.startsWith(currentMonthStr));
        const dateObj = new Date(now.getFullYear(), now.getMonth(), 1);
        periodLabelForExcel = `Ce mois (${dateObj.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })})`;
        periodSuffix = `mois_${currentMonthStr}`;
      } else if (selectedPeriod === 'year') {
        const currentYearStr = String(now.getFullYear());
        filteredExportTickets = ticketsData.filter((t: any) => t.created_at.startsWith(currentYearStr));
        periodLabelForExcel = `Cette année (${now.getFullYear()})`;
        periodSuffix = `annee_${currentYearStr}`;
      }

      const wb = new ExcelJS.Workbook();

      const activeAgents = agents.filter((a: any) => a.active).length;
      const totalDevices = devices.length;
      const activeDevices = devices.filter((d: any) => d.status === 'assigned').length;

      const dataRowsCount = filteredExportTickets.length;
      const endRow = dataRowsCount > 0 ? dataRowsCount + 1 : 2;

      // 1. FEUILLE : TABLEAU DE BORD
      const wsDb = wb.addWorksheet('Tableau de Bord');
      wsDb.views = [{ showGridLines: true }];

      // Configuration des largeurs des colonnes du résumé
      wsDb.columns = [
        { width: 35 }, // Indicateurs
        { width: 22 }, // Valeurs / Ventes
        { width: 22 }, // Revenus (FCFA)
        { width: 15 }  // Part %
      ];

      // Styles réutilisables
      const fontName = 'Segoe UI';
      const borderThin: any = {
        top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
      };

      // Titre Principal
      wsDb.mergeCells('A1:D1');
      const titleCell = wsDb.getCell('A1');
      titleCell.value = "RAPPORTS D'ACTIVITÉ - FIFA TRANSPORT";
      titleCell.font = { name: fontName, size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111827' } }; // Noir / gris très foncé
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      wsDb.getRow(1).height = 40;

      // Date Génération & Période d'exportation
      wsDb.mergeCells('A2:D2');
      const dateCell = wsDb.getCell('A2');
      dateCell.value = `Généré le : ${now.toLocaleDateString('fr-FR')} à ${now.toLocaleTimeString('fr-FR')} | Période : ${periodLabelForExcel}`;
      dateCell.font = { name: fontName, size: 9.5, italic: true, color: { argb: 'FF6B7280' } };
      dateCell.alignment = { horizontal: 'left', vertical: 'middle' };
      wsDb.getRow(2).height = 20;

      // --- SECTION 1 : INDICATEURS CLÉS ---
      wsDb.mergeCells('A4:B4');
      const sec1Cell = wsDb.getCell('A4');
      sec1Cell.value = "INDICATEURS CLÉS";
      sec1Cell.font = { name: fontName, size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      sec1Cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF374151' } }; // Gris foncé
      sec1Cell.alignment = { horizontal: 'left', vertical: 'middle' };
      wsDb.getRow(4).height = 24;

      // Entêtes Indicateurs
      wsDb.getCell('A5').value = "Indicateur";
      wsDb.getCell('B5').value = "Valeurs";
      ['A5', 'B5'].forEach(cellRef => {
        const c = wsDb.getCell(cellRef);
        c.font = { name: fontName, size: 10, bold: true, color: { argb: 'FF111827' } };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } }; // Gris clair
        c.alignment = { horizontal: 'left', vertical: 'middle' };
        c.border = borderThin;
      });
      wsDb.getCell('B5').alignment = { horizontal: 'right', vertical: 'middle' };
      wsDb.getRow(5).height = 20;

      // Lignes Indicateurs
      const kpis = [
        { label: 'Agents Actifs', val: activeAgents, numFmt: '#,##0' },
        { label: 'Total Agents', val: agents.length, numFmt: '#,##0' },
        { label: 'Terminaux TPE Assignés', val: activeDevices, numFmt: '#,##0' },
        { label: 'Total Terminaux TPE', val: totalDevices, numFmt: '#,##0' },
        { label: 'Tickets Émis (Total)', formula: `COUNTA(Tickets!B2:B${endRow})`, numFmt: '#,##0' },
        { label: 'Revenus Globaux (FCFA)', formula: `SUM(Tickets!E2:E${endRow})`, numFmt: '#,##0" FCFA"' },
        { label: 'Montant Moyen par Ticket (FCFA)', formula: `IF(B10>0, AVERAGE(Tickets!E2:E${endRow}), 0)`, numFmt: '#,##0" FCFA"' },
      ];

      kpis.forEach((kpi, idx) => {
        const rowNum = 6 + idx;
        const row = wsDb.getRow(rowNum);
        row.height = 20;

        const cellA = wsDb.getCell(`A${rowNum}`);
        cellA.value = kpi.label;
        cellA.font = { name: fontName, size: 10, color: { argb: 'FF374151' } };
        cellA.border = borderThin;

        const cellB = wsDb.getCell(`B${rowNum}`);
        if (kpi.formula) {
          cellB.value = { formula: kpi.formula };
        } else {
          cellB.value = kpi.val;
        }
        cellB.font = { name: fontName, size: 10, bold: true, color: { argb: 'FF111827' } };
        cellB.numFmt = kpi.numFmt;
        cellB.alignment = { horizontal: 'right', vertical: 'middle' };
        cellB.border = borderThin;
      });

      // --- SECTION 2 : VENTES PAR SERVICE ---
      const serviceStartRow = 14;
      wsDb.mergeCells(`A${serviceStartRow}:D${serviceStartRow}`);
      const sec2Cell = wsDb.getCell(`A${serviceStartRow}`);
      sec2Cell.value = "RÉPARTITION DES VENTES PAR SERVICE";
      sec2Cell.font = { name: fontName, size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      sec2Cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF374151' } };
      sec2Cell.alignment = { horizontal: 'left', vertical: 'middle' };
      wsDb.getRow(serviceStartRow).height = 24;

      // Entêtes Ventes par Service
      const serviceHeaders = ['Service', 'Nombre de ventes', 'Revenus (FCFA)', 'Part (%)'];
      const serviceHeaderCols = ['A', 'B', 'C', 'D'];
      serviceHeaderCols.forEach((col, idx) => {
        const cell = wsDb.getCell(`${col}${serviceStartRow + 1}`);
        cell.value = serviceHeaders[idx];
        cell.font = { name: fontName, size: 10, bold: true, color: { argb: 'FF111827' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
        cell.alignment = { horizontal: idx === 0 ? 'left' : 'right', vertical: 'middle' };
        cell.border = borderThin;
      });
      wsDb.getRow(serviceStartRow + 1).height = 20;

      // Données Service
      const services = [
        { name: 'PASSAGER', countFormula: `COUNTIF(Tickets!G2:G${endRow}, "PASSAGER")`, sumFormula: `SUMIF(Tickets!G2:G${endRow}, "PASSAGER", Tickets!E2:E${endRow})`, partFormula: 'IF(B11>0, C16/B11, 0)' },
        { name: 'COLIS', countFormula: `COUNTIF(Tickets!G2:G${endRow}, "COLIS")`, sumFormula: `SUMIF(Tickets!G2:G${endRow}, "COLIS", Tickets!E2:E${endRow})`, partFormula: 'IF(B11>0, C17/B11, 0)' }
      ];

      services.forEach((s, idx) => {
        const rowNum = serviceStartRow + 2 + idx; // 16 and 17
        wsDb.getRow(rowNum).height = 20;

        const cellA = wsDb.getCell(`A${rowNum}`);
        cellA.value = s.name;
        cellA.font = { name: fontName, size: 10, color: { argb: 'FF111827' } };
        cellA.border = borderThin;

        const cellB = wsDb.getCell(`B${rowNum}`);
        cellB.value = { formula: s.countFormula };
        cellB.font = { name: fontName, size: 10, color: { argb: 'FF111827' } };
        cellB.numFmt = '#,##0';
        cellB.alignment = { horizontal: 'right', vertical: 'middle' };
        cellB.border = borderThin;

        const cellC = wsDb.getCell(`C${rowNum}`);
        cellC.value = { formula: s.sumFormula };
        cellC.font = { name: fontName, size: 10, color: { argb: 'FF111827' } };
        cellC.numFmt = '#,##0" FCFA"';
        cellC.alignment = { horizontal: 'right', vertical: 'middle' };
        cellC.border = borderThin;

        const cellD = wsDb.getCell(`D${rowNum}`);
        cellD.value = { formula: s.partFormula };
        cellD.font = { name: fontName, size: 10, bold: true, color: { argb: 'FF111827' } };
        cellD.numFmt = '0.0%';
        cellD.alignment = { horizontal: 'right', vertical: 'middle' };
        cellD.border = borderThin;
      });

      // --- SECTION 3 : RÉPARTITION DES PAIEMENTS ---
      const paymentStartRow = 19;
      wsDb.mergeCells(`A${paymentStartRow}:D${paymentStartRow}`);
      const sec3Cell = wsDb.getCell(`A${paymentStartRow}`);
      sec3Cell.value = "RÉPARTITION DES PAIEMENTS";
      sec3Cell.font = { name: fontName, size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      sec3Cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF374151' } };
      sec3Cell.alignment = { horizontal: 'left', vertical: 'middle' };
      wsDb.getRow(paymentStartRow).height = 24;

      // Entêtes Paiements
      const paymentHeaders = ['Mode de paiement', 'Nombre de ventes', 'Revenus (FCFA)', 'Part (%)'];
      serviceHeaderCols.forEach((col, idx) => {
        const cell = wsDb.getCell(`${col}${paymentStartRow + 1}`);
        cell.value = paymentHeaders[idx];
        cell.font = { name: fontName, size: 10, bold: true, color: { argb: 'FF111827' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
        cell.alignment = { horizontal: idx === 0 ? 'left' : 'right', vertical: 'middle' };
        cell.border = borderThin;
      });
      wsDb.getRow(paymentStartRow + 1).height = 20;

      // Données Paiements (Row 21, 22, 23)
      const payments = [
        { name: 'Espèces (Cash)', countFormula: `COUNTIF(Tickets!F2:F${endRow}, "cash")`, sumFormula: `SUMIF(Tickets!F2:F${endRow}, "cash", Tickets!E2:E${endRow})`, partFormula: 'IF(B11>0, C21/B11, 0)' },
        { name: 'Carte bancaire (Card)', countFormula: `COUNTIF(Tickets!F2:F${endRow}, "card")`, sumFormula: `SUMIF(Tickets!F2:F${endRow}, "card", Tickets!E2:E${endRow})`, partFormula: 'IF(B11>0, C22/B11, 0)' },
        { name: 'Paiement Mobile (Mobile)', countFormula: `COUNTIF(Tickets!F2:F${endRow}, "mobile")`, sumFormula: `SUMIF(Tickets!F2:F${endRow}, "mobile", Tickets!E2:E${endRow})`, partFormula: 'IF(B11>0, C23/B11, 0)' }
      ];

      payments.forEach((p, idx) => {
        const rowNum = paymentStartRow + 2 + idx; // 21, 22, 23
        wsDb.getRow(rowNum).height = 20;

        const cellA = wsDb.getCell(`A${rowNum}`);
        cellA.value = p.name;
        cellA.font = { name: fontName, size: 10, color: { argb: 'FF111827' } };
        cellA.border = borderThin;

        const cellB = wsDb.getCell(`B${rowNum}`);
        cellB.value = { formula: p.countFormula };
        cellB.font = { name: fontName, size: 10, color: { argb: 'FF111827' } };
        cellB.numFmt = '#,##0';
        cellB.alignment = { horizontal: 'right', vertical: 'middle' };
        cellB.border = borderThin;

        const cellC = wsDb.getCell(`C${rowNum}`);
        cellC.value = { formula: p.sumFormula };
        cellC.font = { name: fontName, size: 10, color: { argb: 'FF111827' } };
        cellC.numFmt = '#,##0" FCFA"';
        cellC.alignment = { horizontal: 'right', vertical: 'middle' };
        cellC.border = borderThin;

        const cellD = wsDb.getCell(`D${rowNum}`);
        cellD.value = { formula: p.partFormula };
        cellD.font = { name: fontName, size: 10, bold: true, color: { argb: 'FF111827' } };
        cellD.numFmt = '0.0%';
        cellD.alignment = { horizontal: 'right', vertical: 'middle' };
        cellD.border = borderThin;
      });

      // --- SECTION 4 : GUIDE D'UTILISATION ---
      const guideStartRow = 25;
      wsDb.mergeCells(`A${guideStartRow}:D${guideStartRow}`);
      const sec4Cell = wsDb.getCell(`A${guideStartRow}`);
      sec4Cell.value = "GUIDE DE MODIFICATION & DE MANIPULATION DES DONNÉES";
      sec4Cell.font = { name: fontName, size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      sec4Cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111827' } }; // Noir
      sec4Cell.alignment = { horizontal: 'center', vertical: 'middle' };
      wsDb.getRow(guideStartRow).height = 24;

      const guideTexts = [
        "Ce classeur Excel est dynamique. Les indicateurs et répartitions ci-dessus se recalculent automatiquement.",
        "1. AJOUTER UN TICKET : Insérez une ligne à la suite du tableau de l'onglet 'Tickets'. Remplissez les cellules.",
        "   Pour vous aider, des menus déroulants sont configurés pour les colonnes 'Statut', 'Mode paiement' et 'Service'.",
        "2. MODIFIER UN TICKET : Double-cliquez et modifiez n'importe quelle valeur (ex: le Montant). Tout est mis à jour.",
        "3. SUPPRIMER : Faites un clic droit sur le numéro de ligne dans l'onglet 'Tickets' et sélectionnez 'Supprimer'."
      ];

      guideTexts.forEach((text, idx) => {
        const rowNum = guideStartRow + 1 + idx;
        wsDb.mergeCells(`A${rowNum}:D${rowNum}`);
        const cell = wsDb.getCell(`A${rowNum}`);
        cell.value = text;
        cell.font = { name: fontName, size: 9.5, italic: idx === 0, color: { argb: idx === 0 ? 'FF111827' : 'FF374151' } };
        cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
        
        cell.border = {
          left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          top: idx === 0 ? { style: 'thin', color: { argb: 'FFD1D5DB' } } : undefined,
          bottom: idx === guideTexts.length - 1 ? { style: 'thin', color: { argb: 'FFD1D5DB' } } : undefined
        } as any;
        wsDb.getRow(rowNum).height = 20;
      });

      // 2. FEUILLE : TICKETS
      const wsTickets = wb.addWorksheet('Tickets');
      wsTickets.views = [{ showGridLines: true }];

      // Définition des colonnes de l'onglet Tickets
      wsTickets.columns = [
        { header: 'ID', key: 'id', width: 10 },
        { header: 'Référence', key: 'reference', width: 22 },
        { header: 'Date émission', key: 'created_at', width: 26 },
        { header: 'Statut', key: 'status', width: 15 },
        { header: 'Montant', key: 'amount', width: 16 },
        { header: 'Mode paiement', key: 'payment_mode', width: 18 },
        { header: 'Service', key: 'service_type', width: 14 },
        { header: 'Trajet', key: 'route', width: 18 },
        { header: 'Nom passager', key: 'passenger_name', width: 24 },
        { header: 'Téléphone passager', key: 'passenger_phone', width: 18 },
        { header: 'Détails colis', key: 'package_details', width: 25 },
        { header: 'Nom expéditeur', key: 'sender_name', width: 22 },
        { header: 'Téléphone expéditeur', key: 'sender_phone', width: 18 },
        { header: 'Nom destinataire', key: 'receiver_name', width: 22 },
        { header: 'Téléphone destinataire', key: 'receiver_phone', width: 18 },
        { header: 'ID Terminal', key: 'device_id', width: 15 },
        { header: 'Nom Terminal', key: 'device_label', width: 20 },
        { header: 'ID Agent', key: 'agent_id', width: 10 },
        { header: 'Code Agent', key: 'agent_code', width: 14 },
        { header: 'Nom Agent', key: 'agent_name', width: 22 }
      ];

      // Appliquer les données
      filteredExportTickets.forEach((t: any) => {
        wsTickets.addRow({
          id: t.id,
          reference: t.reference,
          created_at: formatToBeninTime(t.created_at),
          status: t.status || 'en attente',
          amount: t.amount,
          payment_mode: t.payment_mode,
          service_type: t.service_type,
          route: t.route,
          passenger_name: t.passenger_name || '',
          passenger_phone: t.passenger_phone || '',
          package_details: t.package_details || '',
          sender_name: t.sender_name || '',
          sender_phone: t.sender_phone || '',
          receiver_name: t.receiver_name || '',
          receiver_phone: t.receiver_phone || '',
          device_id: t.device_id,
          device_label: t.device_label || '',
          agent_id: t.agent_id,
          agent_code: t.agent_code || '',
          agent_name: t.agent_name || ''
        });
      });

      // Formater la feuille Tickets
      const headerRow = wsTickets.getRow(1);
      headerRow.height = 26;
      headerRow.eachCell((cell) => {
        cell.font = { name: fontName, size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111827' } }; // Noir
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = borderThin;
      });

      // Zebra striping et formatage pour les lignes de données
      for (let i = 0; i < dataRowsCount; i++) {
        const rowNum = 2 + i;
        const row = wsTickets.getRow(rowNum);
        row.height = 20;

        const isEven = i % 2 === 1;
        const bgColor = isEven ? 'FFF9FAFB' : 'FFFFFFFF'; // Zebra striping

        row.eachCell((cell, colNumber) => {
          cell.font = { name: fontName, size: 10, color: { argb: 'FF374151' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
          cell.border = borderThin;

          if ([1, 4, 6, 7, 18, 19].includes(colNumber)) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          } else if (colNumber === 5) {
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
          } else {
            cell.alignment = { horizontal: 'left', vertical: 'middle' };
          }
        });

        const amountCell = wsTickets.getCell(`E${rowNum}`);
        amountCell.numFmt = '#,##0" FCFA"';
      }

      // Validations de données (Dropdowns)
      const lastRow = dataRowsCount + 1000;
      (wsTickets as any).dataValidations.add(`D2:D${lastRow}`, {
        type: 'list',
        allowBlank: true,
        formulae: ['"en attente,validé,annulé"'],
        showErrorMessage: true,
        errorTitle: 'Valeur invalide',
        error: 'Veuillez sélectionner un statut dans la liste (en attente, validé, annulé)'
      });

      (wsTickets as any).dataValidations.add(`F2:F${lastRow}`, {
        type: 'list',
        allowBlank: true,
        formulae: ['"cash,card,mobile"'],
        showErrorMessage: true,
        errorTitle: 'Valeur invalide',
        error: 'Veuillez sélectionner un mode de paiement dans la liste (cash, card, mobile)'
      });

      (wsTickets as any).dataValidations.add(`G2:G${lastRow}`, {
        type: 'list',
        allowBlank: true,
        formulae: ['"PASSAGER,COLIS"'],
        showErrorMessage: true,
        errorTitle: 'Valeur invalide',
        error: 'Veuillez sélectionner un type de service dans la liste (PASSAGER, COLIS)'
      });

      // Ligne de Totaux / Bilan dynamique
      const totalRow1 = dataRowsCount + 3;
      const totalRow2 = dataRowsCount + 4;
      wsTickets.getRow(totalRow1).height = 22;
      wsTickets.getRow(totalRow2).height = 22;

      const labelCellTotal = wsTickets.getCell(`D${totalRow1}`);
      labelCellTotal.value = "TOTAL :";
      labelCellTotal.font = { name: fontName, size: 10, bold: true, color: { argb: 'FF111827' } };
      labelCellTotal.alignment = { horizontal: 'right', vertical: 'middle' };

      const sumCell = wsTickets.getCell(`E${totalRow1}`);
      sumCell.value = { formula: `SUM(E2:E${dataRowsCount + 1})` };
      sumCell.font = { name: fontName, size: 10, bold: true, color: { argb: 'FF111827' } };
      sumCell.numFmt = '#,##0" FCFA"';
      sumCell.alignment = { horizontal: 'right', vertical: 'middle' };
      sumCell.border = {
        top: { style: 'thin', color: { argb: 'FF111827' } },
        bottom: { style: 'double', color: { argb: 'FF111827' } }
      } as any;

      const labelCellMoy = wsTickets.getCell(`D${totalRow2}`);
      labelCellMoy.value = "MOYENNE :";
      labelCellMoy.font = { name: fontName, size: 10, bold: true, color: { argb: 'FF111827' } };
      labelCellMoy.alignment = { horizontal: 'right', vertical: 'middle' };

      const avgCell = wsTickets.getCell(`E${totalRow2}`);
      avgCell.value = { formula: `AVERAGE(E2:E${dataRowsCount + 1})` };
      avgCell.font = { name: fontName, size: 10, bold: true, color: { argb: 'FF111827' } };
      avgCell.numFmt = '#,##0" FCFA"';
      avgCell.alignment = { horizontal: 'right', vertical: 'middle' };
      avgCell.border = {
        bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } }
      } as any;

      // Activer les filtres automatiques sur le tableau des Tickets
      wsTickets.autoFilter = `A1:T${dataRowsCount + 1}`;

      // Enregistrer le classeur et télécharger
      const dateStr = now.toISOString().split('T')[0];
      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fifa_transport_export_${periodSuffix}_${dateStr}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur inconnue lors de l\'export');
    } finally {
      setExporting(false);
    }
  };


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
        actions={
          <button
            onClick={() => setShowExportModal(true)}
            disabled={exporting}
            className="btn btn-primary"
            type="button"
          >
            {exporting ? 'Exportation...' : 'Exporter Base (Excel)'}
          </button>
        }
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

      {/* Modale d'export Excel avec filtre de période */}
      <Modal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        title="Exporter les données (Excel)"
        size="sm"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, width: '100%' }}>
            <button
              className="btn btn-secondary"
              onClick={() => setShowExportModal(false)}
              type="button"
              style={{ padding: '8px 16px', fontSize: '0.85rem' }}
            >
              Annuler
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                setShowExportModal(false);
                handleExportExcel(exportPeriod);
              }}
              disabled={exporting}
              type="button"
              style={{ padding: '8px 16px', fontSize: '0.85rem' }}
            >
              {exporting ? 'Exportation...' : 'Exporter'}
            </button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Sélectionnez la période des données de tickets à exporter. Les autres données (agents, terminaux) seront exportées dans leur totalité.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(['today', 'week', 'month', 'year', 'all'] as const).map((p) => {
              const label = p === 'today' ? "Aujourd'hui" :
                            p === 'week' ? "Cette semaine" :
                            p === 'month' ? "Ce mois" :
                            p === 'year' ? "Cette année" :
                            "Toutes les données";
              return (
                <label
                  key={p}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border)',
                    background: exportPeriod === p ? 'rgba(245, 197, 24, 0.08)' : 'transparent',
                    borderColor: exportPeriod === p ? '#F5C518' : 'var(--border)',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    color: exportPeriod === p ? '#FFF' : 'var(--text-secondary)',
                    fontWeight: exportPeriod === p ? 600 : 400,
                    transition: 'all 0.15s ease'
                  }}
                >
                  <input
                    type="radio"
                    name="exportPeriod"
                    value={p}
                    checked={exportPeriod === p}
                    onChange={() => setExportPeriod(p)}
                    style={{ accentColor: '#F5C518', cursor: 'pointer' }}
                  />
                  {label}
                </label>
              );
            })}
          </div>
        </div>
      </Modal>
    </>
  );
}
