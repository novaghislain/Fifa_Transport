type StatusBadgeProps = {
  status: string;
};

const statusMap: Record<string, { label: string; variant: string }> = {
  assigned: { label: 'Assigné', variant: 'badge-success' },
  active: { label: 'Actif', variant: 'badge-success' },
  true: { label: 'Actif', variant: 'badge-success' },
  pending: { label: 'En attente', variant: 'badge-warning' },
  inactive: { label: 'Inactif', variant: 'badge-danger' },
  false: { label: 'Inactif', variant: 'badge-danger' },
  cash: { label: 'Espèces', variant: 'badge-info' },
  mobile: { label: 'Mobile', variant: 'badge-info' },
  card: { label: 'Carte', variant: 'badge-info' },
  'en attente': { label: 'En attente', variant: 'badge-neutral' },
  'validé': { label: 'Validé', variant: 'badge-success' },
  'annulé': { label: 'Annulé', variant: 'badge-danger' },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const key = String(status).toLowerCase();
  const config = statusMap[key] ?? { label: status, variant: 'badge-neutral' };

  return (
    <span className={`badge ${config.variant}`}>
      {config.label}
    </span>
  );
}
