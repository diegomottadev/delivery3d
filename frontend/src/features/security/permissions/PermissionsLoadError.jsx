import React, { useState } from 'react';
import { Message } from 'primereact/message';
import { Button } from 'primereact/button';
import { usePermissions } from './PermissionsContext';

/** Aviso de falla al cargar permisos (estado cerrado) con opción de reintentar. */
export const PermissionsLoadError = () => {
    const { refresh } = usePermissions();
    const [retrying, setRetrying] = useState(false);

    const onRetry = async () => {
        setRetrying(true);
        try {
            await refresh();
        } finally {
            setRetrying(false);
        }
    };

    return (
        <div className="flex flex-column md:flex-row align-items-start md:align-items-center gap-3 mb-3" data-testid="permissions-error">
            <Message severity="error" text="No se pudieron cargar tus permisos. Algunas secciones quedan ocultas." />
            <Button label="Reintentar" icon="pi pi-refresh" className="p-button-sm p-button-outlined" loading={retrying} onClick={onRetry} />
        </div>
    );
};

export default PermissionsLoadError;
