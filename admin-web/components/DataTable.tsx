"use client";

import { useState, useMemo, useCallback } from 'react';

export type Column<T> = {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (row: T) => React.ReactNode;
};

type DataTableProps<T> = {
  columns: Column<T>[];
  data: T[];
  searchKeys?: string[];
  searchPlaceholder?: string;
  pageSize?: number;
  idKey?: string;
  emptyIcon?: string;
  emptyTitle?: string;
  emptyDesc?: string;
};

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  searchKeys = [],
  searchPlaceholder = 'Rechercher...',
  pageSize = 15,
  idKey = 'id',
  emptyIcon = '—',
  emptyTitle = 'Aucune donnée',
  emptyDesc = 'Il n\'y a pas encore de données à afficher.',
}: DataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);

  const handleSort = useCallback((key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(1);
  }, [sortKey]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q || searchKeys.length === 0) return data;
    return data.filter((row) =>
      searchKeys.some((key) => {
        const val = row[key];
        return val != null && String(val).toLowerCase().includes(q);
      })
    );
  }, [data, search, searchKeys]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      const cmp = String(aVal).localeCompare(String(bVal), 'fr');
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginated = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, currentPage + 2);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }, [currentPage, totalPages]);

  return (
    <div className="card" id="data-table-card">
      <div className="table-controls">
        <div className="table-search">
          <span className="search-icon" aria-hidden="true">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </span>
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={search}
            onChange={handleSearchChange}
            id="table-search-input"
            aria-label="Rechercher dans le tableau"
          />
        </div>
        <div className="table-info">
          {sorted.length} résultat{sorted.length !== 1 ? 's' : ''}
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon" aria-hidden="true">{emptyIcon}</div>
          <div className="empty-state-title">{emptyTitle}</div>
          <div className="empty-state-desc">{emptyDesc}</div>
        </div>
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className={`${col.sortable ? 'sortable' : ''} ${sortKey === col.key ? 'sorted' : ''}`}
                      onClick={col.sortable ? () => handleSort(col.key) : undefined}
                    >
                      {col.label}
                      {col.sortable && (
                        <span className="sort-arrow" aria-hidden="true">
                          {sortKey === col.key ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map((row) => (
                  <tr key={String(row[idKey] ?? Math.random())}>
                    {columns.map((col) => (
                      <td key={col.key}>
                        {col.render
                          ? col.render(row)
                          : row[col.key] != null
                          ? String(row[col.key])
                          : '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="table-pagination">
              <div className="pagination-info">
                Page {currentPage} sur {totalPages}
              </div>
              <div className="pagination-controls">
                <button
                  className="pagination-btn"
                  onClick={() => setPage(1)}
                  disabled={currentPage <= 1}
                  aria-label="Première page"
                  type="button"
                >
                  «
                </button>
                <button
                  className="pagination-btn"
                  onClick={() => setPage(currentPage - 1)}
                  disabled={currentPage <= 1}
                  aria-label="Page précédente"
                  type="button"
                >
                  ‹
                </button>
                {pageNumbers.map((n) => (
                  <button
                    key={n}
                    className={`pagination-btn ${n === currentPage ? 'active' : ''}`}
                    onClick={() => setPage(n)}
                    type="button"
                  >
                    {n}
                  </button>
                ))}
                <button
                  className="pagination-btn"
                  onClick={() => setPage(currentPage + 1)}
                  disabled={currentPage >= totalPages}
                  aria-label="Page suivante"
                  type="button"
                >
                  ›
                </button>
                <button
                  className="pagination-btn"
                  onClick={() => setPage(totalPages)}
                  disabled={currentPage >= totalPages}
                  aria-label="Dernière page"
                  type="button"
                >
                  »
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
