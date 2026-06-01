import type { ReactNode } from 'react';
import Link from 'next/link';

type PageHeaderProps = {
  icon: string;
  title: string;
  subtitle: string;
  breadcrumb?: { label: string; href?: string }[];
  actions?: ReactNode;
};

export function PageHeader({ icon, title, subtitle, breadcrumb, actions }: PageHeaderProps) {
  return (
    <div className="page-header">
      <div className="page-header-info">
        {breadcrumb && breadcrumb.length > 0 && (
          <nav className="page-breadcrumb" aria-label="Fil d'Ariane">
            {breadcrumb.map((crumb, i) => (
              <span key={i}>
                {i > 0 && <span aria-hidden="true"> / </span>}
                {crumb.href ? (
                  <Link href={crumb.href}>{crumb.label}</Link>
                ) : (
                  <span>{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        <h1 className="page-title" id="page-title">
          {title}
        </h1>
        <p className="page-subtitle">{subtitle}</p>
      </div>
      {actions && (
        <div className="page-header-actions">
          {actions}
        </div>
      )}
    </div>
  );
}
