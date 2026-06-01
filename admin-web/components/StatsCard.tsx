type StatsCardProps = {
  icon: string;
  label: string;
  value: number;
  color?: 'yellow' | 'green' | 'blue' | 'red';
  trend?: { value: string; direction: 'up' | 'down' };
};

export function StatsCard({ label, value, color = 'yellow', trend }: Omit<StatsCardProps, 'icon'>) {
  return (
    <div className="stat-card" id={`stat-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="stat-card-header">
        <div className={`stat-card-icon ${color}`}>
          <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
        </div>
        {trend && (
          <div className={`stat-card-trend ${trend.direction}`}>
            <span aria-hidden="true">{trend.direction === 'up' ? '↑' : '↓'}</span>
            {trend.value}
          </div>
        )}
      </div>
      <div className="stat-card-value">{value.toLocaleString('fr-FR')}</div>
      <div className="stat-card-label">{label}</div>
      <div className="stat-card-glow" aria-hidden="true" />
    </div>
  );
}
