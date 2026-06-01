"use client";

import { useState, useCallback } from 'react';

type Field = {
  name: string;
  label: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
  initialValue?: string | number | boolean;
  options?: { value: string; label: string }[];
};

type ActionFormProps = {
  endpoint: string;
  fields: Field[];
  buttonLabel: string;
  onSuccess?: () => void;
  method?: 'POST' | 'PATCH' | 'PUT';
};

export function ActionForm({ endpoint, fields, buttonLabel, onSuccess, method = 'POST' }: ActionFormProps) {
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    setLoading(true);
    setStatus(null);

    const formData = new FormData(formElement);
    const payload: Record<string, unknown> = {};

    for (const [key, value] of formData.entries()) {
      if (key === 'password' && value === '') {
        continue;
      }
      const field = fields.find((f) => f.name === key);
      if (field?.type === 'number' && value !== '') {
        payload[key] = Number(value);
      } else if (value === 'true') {
        payload[key] = true;
      } else if (value === 'false') {
        payload[key] = false;
      } else {
        payload[key] = value;
      }
    }

    try {
      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errorMessage = method === 'POST' ? 'Erreur lors de la création' : 'Erreur lors de la modification';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch {
          const errorText = await response.text();
          if (errorText) errorMessage = errorText;
        }

        // Translate database unique constraint errors to user-friendly messages
        const lowerMsg = errorMessage.toLowerCase();
        if (lowerMsg.includes('duplicate key') && lowerMsg.includes('agents_code_key')) {
          errorMessage = 'Ce code agent est déjà utilisé. Veuillez saisir un code unique (ex: AGENT03).';
        } else if (lowerMsg.includes('duplicate key') && lowerMsg.includes('agents_email_key')) {
          errorMessage = 'Cet email est déjà utilisé. Veuillez saisir un email unique.';
        } else if (lowerMsg.includes('duplicate key') && lowerMsg.includes('devices_device_id_key')) {
          errorMessage = 'Ce numéro de terminal (ID TPE) existe déjà. Veuillez saisir un ID unique.';
        } else if (lowerMsg.includes('duplicate key')) {
          errorMessage = 'Cette valeur existe déjà dans la base de données et doit être unique.';
        }

        setStatus({ type: 'error', message: errorMessage });
        setLoading(false);
        return;
      }

      setStatus({ type: 'success', message: 'Enregistré avec succès !' });
      formElement.reset();
      setLoading(false);
  
      if (onSuccess) {
        setTimeout(() => {
          onSuccess();
        }, 800);
      }
    } catch (err) {
      console.error("Erreur d'envoi du formulaire (ActionForm):", err);
      const detail = err instanceof Error ? `: ${err.message}` : '';
      setStatus({
        type: 'error',
        message: `Erreur réseau${detail}. Vérifiez votre connexion et les logs de la console.`,
      });
      setLoading(false);
    }
  }, [endpoint, fields, onSuccess, method]);

  return (
    <form onSubmit={onSubmit} className="form-grid" id="action-form">
      {fields.map((field) => (
        <div className="form-group" key={field.name}>
          <label className="form-label" htmlFor={`field-${field.name}`}>
            {field.label}
            {field.required && <span className="text-danger"> *</span>}
          </label>
          {field.type === 'select' ? (
            <select
              className="form-input"
              id={`field-${field.name}`}
              name={field.name}
              defaultValue={field.initialValue !== undefined ? String(field.initialValue) : undefined}
              required={field.required}
            >
              {field.options?.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              className="form-input"
              id={`field-${field.name}`}
              name={field.name}
              placeholder={field.placeholder}
              type={field.type ?? 'text'}
              required={field.required}
              defaultValue={field.initialValue !== undefined ? String(field.initialValue) : undefined}
            />
          )}
        </div>
      ))}

      <button
        type="submit"
        className="btn btn-primary w-full"
        disabled={loading}
        id="action-form-submit"
      >
        {loading ? (
          <>
            <span className="loading-spinner" aria-hidden="true" />
            En cours...
          </>
        ) : (
          buttonLabel
        )}
      </button>

      {status && (
        <div className={status.type === 'success' ? 'form-success' : 'form-error'}>
          <span aria-hidden="true">{status.type === 'success' ? '✓' : '✕'}</span>
          {status.message}
        </div>
      )}
    </form>
  );
}
