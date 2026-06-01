"use client";

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, type Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { Modal } from '@/components/Modal';
import { ActionForm } from '@/components/ActionForm';

const apiBase = process.env.NEXT_PUBLIC_ADMIN_API_BASE_URL ?? '/api';

type Device = {
  id: number;
  device_id: string;
  label: string;
  agent_id: number | null;
  agent_code: string | null;
  agent_name: string | null;
  status: string;
  created_at: string;
  updated_at: string;
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

const columns: Column<Device>[] = [
  {
    key: 'device_id',
    label: 'ID Terminal',
    sortable: true,
    render: (row) => <span className="cell-mono">{row.device_id}</span>,
  },
  {
    key: 'label',
    label: 'Libellé',
    sortable: true,
    render: (row) => <span className="cell-primary">{row.label}</span>,
  },
  {
    key: 'agent_name',
    label: 'Agent assigné',
    sortable: true,
    render: (row) => {
      if (!row.agent_name) return <span className="text-muted">Non assigné</span>;
      return (
        <div>
          <span className="cell-primary">{row.agent_name}</span>
          {row.agent_code && (
            <div className="text-muted" style={{ fontSize: '0.75rem' }}>
              {row.agent_code}
            </div>
          )}
        </div>
      );
    },
  },
  {
    key: 'status',
    label: 'Statut',
    sortable: true,
    render: (row) => <StatusBadge status={row.status} />,
  },
  {
    key: 'created_at',
    label: 'Enregistré le',
    sortable: true,
    render: (row) => formatDate(row.created_at),
  },
];

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);

  const fetchDevices = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${apiBase}/devices`, { cache: 'no-store' });
      if (!response.ok) throw new Error('Impossible de charger les TPE');
      const data = await response.json();
      setDevices(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  const handleCreateSuccess = useCallback(() => {
    setShowCreateModal(false);
    fetchDevices();
  }, [fetchDevices]);

  const handleAssignSuccess = useCallback(() => {
    setShowAssignModal(false);
    setSelectedDevice(null);
    fetchDevices();
  }, [fetchDevices]);

  const handleEditSuccess = useCallback(() => {
    setShowEditModal(false);
    setSelectedDevice(null);
    fetchDevices();
  }, [fetchDevices]);

  // Extend columns with assign action
  const columnsWithAction: Column<Device>[] = [
    ...columns,
    {
      key: '_actions',
      label: 'Actions',
      render: (row) => (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            className="btn btn-ghost"
            onClick={() => {
              setSelectedDevice(row);
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
              setSelectedDevice(row);
              setShowAssignModal(true);
            }}
            type="button"
            style={{ fontSize: '0.8rem' }}
          >
            {row.agent_id ? 'Réassigner' : 'Assigner'}
          </button>
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <>
        <PageHeader
          icon="📱"
          title="Terminaux TPE"
          subtitle="Gestion des terminaux de paiement"
          breadcrumb={[
            { label: 'Dashboard', href: '/' },
            { label: 'TPE' },
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
          icon="📱"
          title="Terminaux TPE"
          subtitle="Gestion des terminaux de paiement"
          breadcrumb={[
            { label: 'Dashboard', href: '/' },
            { label: 'TPE' },
          ]}
        />
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon"></div>
            <div className="empty-state-title">Erreur de chargement</div>
            <div className="empty-state-desc">{error}</div>
            <button className="btn btn-primary mt-md" onClick={fetchDevices} type="button">
              Réessayer
            </button>
          </div>
        </div>
      </>
    );
  }

  const assignedCount = devices.filter((d) => d.status === 'assigned').length;
  const pendingCount = devices.filter((d) => d.status !== 'assigned').length;

  return (
    <>
      <PageHeader
        icon="📱"
        title="Terminaux TPE"
        subtitle={`${devices.length} terminal${devices.length !== 1 ? 'ux' : ''} enregistré${devices.length !== 1 ? 's' : ''}`}
        breadcrumb={[
          { label: 'Dashboard', href: '/' },
          { label: 'TPE' },
        ]}
        actions={
          <button
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
            type="button"
            id="add-device-btn"
          >
            <span className="btn-icon-left" aria-hidden="true">+</span>
            Nouveau TPE
          </button>
        }
      />

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon green">
              <span aria-hidden="true">✓</span>
            </div>
          </div>
          <div className="stat-card-value">{assignedCount}</div>
          <div className="stat-card-label">TPE assignés</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon yellow">
              <span aria-hidden="true">⏳</span>
            </div>
          </div>
          <div className="stat-card-value">{pendingCount}</div>
          <div className="stat-card-label">En attente d{"'"}assignation</div>
        </div>
      </div>

      <DataTable<Device>
        columns={columnsWithAction}
        data={devices}
        searchKeys={['device_id', 'label', 'agent_name', 'agent_code']}
        searchPlaceholder="Rechercher un TPE par ID, nom ou agent..."
        idKey="device_id"
        emptyIcon="—"
        emptyTitle="Aucun terminal"
        emptyDesc="Enregistrez votre premier TPE pour commencer."
      />

      {/* Create Device Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Nouveau terminal TPE"
      >
        <ActionForm
          endpoint={`${apiBase}/devices`}
          buttonLabel="Enregistrer le TPE"
          onSuccess={handleCreateSuccess}
          fields={[
            {
              name: 'deviceId',
              label: 'ID Terminal',
              placeholder: 'Ex: TPE-001',
              required: true,
            },
            {
              name: 'label',
              label: 'Libellé',
              placeholder: 'Ex: Terminal Gare Routière',
              required: true,
            },
            {
              name: 'agentId',
              label: 'ID Agent (optionnel)',
              placeholder: 'Ex: 1',
              type: 'number',
            },
          ]}
        />
      </Modal>

      {/* Assign Device Modal */}
      <Modal
        isOpen={showAssignModal}
        onClose={() => {
          setShowAssignModal(false);
          setSelectedDevice(null);
        }}
        title={`Assigner ${selectedDevice?.label ?? 'le TPE'}`}
      >
        {selectedDevice && (
          <ActionForm
            endpoint={`${apiBase}/devices/${selectedDevice.device_id}/assign`}
            method="PATCH"
            buttonLabel="Assigner l'agent"
            onSuccess={handleAssignSuccess}
            fields={[
              {
                name: 'agentId',
                label: 'ID de l\'agent',
                placeholder: 'Ex: 1',
                type: 'number',
                required: true,
              },
            ]}
          />
        )}
      </Modal>

      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedDevice(null);
        }}
        title={`Modifier ${selectedDevice?.label ?? 'le TPE'}`}
      >
        {selectedDevice && (
          <ActionForm
            key={`edit-device-${selectedDevice.device_id}`}
            endpoint={`${apiBase}/devices/${selectedDevice.device_id}`}
            method="PATCH"
            buttonLabel="Enregistrer les modifications"
            onSuccess={handleEditSuccess}
            fields={[
              {
                name: 'label',
                label: 'Libellé',
                placeholder: 'Ex: Terminal Gare Routière',
                required: true,
                initialValue: selectedDevice.label,
              },
              {
                name: 'agentId',
                label: 'ID Agent',
                placeholder: 'Ex: 1',
                type: 'number',
                initialValue: selectedDevice.agent_id ?? '',
              },
              {
                name: 'status',
                label: 'Statut',
                type: 'select',
                initialValue: selectedDevice.status,
                options: [
                  { value: 'pending', label: 'pending' },
                  { value: 'assigned', label: 'assigned' },
                  { value: 'revoked', label: 'revoked' },
                ],
              },
            ]}
          />
        )}
      </Modal>
    </>
  );
}
