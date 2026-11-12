import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Message } from 'primereact/message';
import { Button } from 'primereact/button';
import { listPrinters } from '../orders/ordersApi';
import { usePermissions } from '../security/permissions/PermissionsContext';
import { PERM } from '../security/permissions/perms';

const OPERATOR_TEXT =
    'Todavía no hay ninguna impresora configurada en el taller. Podés cargar pedidos, pero no vas a poder presupuestarlos hasta que se configure una. Avisale al administrador.';
const ADMIN_TEXT = 'Todavía no hay ninguna impresora configurada. Los operadores no pueden presupuestar pedidos hasta que des de alta una.';

/**
 * Aviso amarillo cuando el taller no tiene ninguna impresora activa (sin impresora no se puede presupuestar).
 * Sin printers:read no muestra nada ni consulta. Ante un error de carga no avisa (no alarmar por la red).
 * Se reconsulta al montarse: al volver al tablero después de dar de alta una impresora, desaparece.
 */
const NoPrintersWarning = () => {
    const navigate = useNavigate();
    const { can } = usePermissions();
    const canReadPrinters = can(PERM.PRINTERS_READ);
    const canCreatePrinters = can(PERM.PRINTERS_CREATE);
    const [noActivePrinters, setNoActivePrinters] = useState(false);

    useEffect(() => {
        if (!canReadPrinters) {
            setNoActivePrinters(false);
            return undefined;
        }
        let isMounted = true;
        const load = async () => {
            try {
                const printers = await listPrinters(false);
                // Solo una lista vacía confirmada dispara el aviso; cualquier otra respuesta no.
                if (isMounted) setNoActivePrinters(Array.isArray(printers) && printers.length === 0);
            } catch {
                if (isMounted) setNoActivePrinters(false);
            }
        };
        load();
        return () => {
            isMounted = false;
        };
    }, [canReadPrinters]);

    if (!canReadPrinters || !noActivePrinters) {
        return null;
    }

    const content = (
        <div className="flex flex-column md:flex-row md:align-items-center gap-2 w-full">
            <i className="pi pi-exclamation-triangle p-inline-message-icon" />
            <span className="p-inline-message-text flex-1">{canCreatePrinters ? ADMIN_TEXT : OPERATOR_TEXT}</span>
            {canCreatePrinters && (
                <Button label="Configurar impresora" icon="pi pi-cog" className="p-button-sm p-button-warning" onClick={() => navigate('/settings')} />
            )}
        </div>
    );

    return (
        <div className="mb-3" data-testid="no-printers-warning">
            <Message severity="warn" content={content} className="w-full justify-content-start" />
        </div>
    );
};

export default NoPrintersWarning;
