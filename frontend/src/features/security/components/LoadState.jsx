import React from 'react';
import { Button } from 'primereact/button';
import { Message } from 'primereact/message';
import { ForbiddenNotice } from './ForbiddenNotice';

/**
 * Estados comunes de carga de una pantalla de Seguridad. Devuelve null si ya hay datos.
 * 403 → ForbiddenNotice (la pantalla y el layout siguen en pie); 404 → `notFoundText`.
 */
export const LoadState = ({ loading, error, onRetry, notFoundText = 'No se encontró lo que buscabas.' }) => {
    if (loading) {
        return (
            <div data-testid="security-loading" className="flex align-items-center justify-content-center p-4">
                <i className="pi pi-spin pi-spinner text-3xl text-primary" aria-label="Cargando" />
            </div>
        );
    }
    if (!error) return null;
    if (error.isForbidden) return <ForbiddenNotice />;
    if (error.status === 404) return <Message severity="warn" text={notFoundText} />;
    return (
        <div className="flex flex-column md:flex-row align-items-start md:align-items-center gap-3">
            <Message severity="error" text={error.message} />
            {onRetry && <Button label="Reintentar" icon="pi pi-refresh" className="p-button-sm p-button-outlined" onClick={() => onRetry()} />}
        </div>
    );
};

/** Motivo por el que una acción está deshabilitada (se muestra junto al botón). */
export const BlockedHint = ({ reason, testId = 'blocked-reason' }) =>
    reason ? (
        <small data-testid={testId} className="block text-orange-700 mt-1">
            <i className="pi pi-lock mr-1" />
            {reason}
        </small>
    ) : null;

export default LoadState;
