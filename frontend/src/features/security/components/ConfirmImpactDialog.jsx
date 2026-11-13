import React from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { Message } from 'primereact/message';

const SELF_LOCKOUT_REASON = 'No podés quitarte a vos mismo el permiso de administrar la seguridad.';

/**
 * Confirmación genérica de una acción con impacto sobre usuarios (api-contract.md §6).
 * impact: { affected_users_count, users_losing_permissions_count, affected_users[], removes_own_rbac_manage }
 * blockedReason: motivo propio para bloquear la acción (ej. SELF_ASSIGNMENT). Bloquear en el front es solo UX.
 */
export const ConfirmImpactDialog = ({
    visible,
    header,
    message,
    impact = null,
    impactLoading = false,
    impactError = null,
    blockedReason = null,
    confirmLabel = 'Confirmar',
    confirming = false,
    describePermission = (code) => code,
    onConfirm,
    onHide,
}) => {
    const reason = blockedReason || (impact && impact.removes_own_rbac_manage ? SELF_LOCKOUT_REASON : null);
    const canConfirm = Boolean(impact) && !impactLoading && !impactError && !reason && !confirming;
    const losing = impact ? (impact.affected_users || []).filter((u) => (u.lost_permissions || []).length > 0) : [];

    const footer = (
        <div>
            <Button label="Cancelar" icon="pi pi-times" className="p-button-text" disabled={confirming} onClick={onHide} />
            <Button label={confirmLabel} icon="pi pi-check" className="p-button-danger" loading={confirming} disabled={!canConfirm} onClick={onConfirm} />
        </div>
    );

    return (
        <Dialog
            header={header}
            visible={visible}
            modal
            style={{ width: '520px', maxWidth: '95vw' }}
            footer={footer}
            onHide={() => {
                if (!confirming) onHide();
            }}
        >
            <div className="flex flex-column gap-3">
                <p className="m-0 font-medium">{message}</p>

                {impactLoading && (
                    <div data-testid="impact-loading" className="flex align-items-center gap-2 text-600">
                        <i className="pi pi-spin pi-spinner" /> Calculando usuarios afectados…
                    </div>
                )}

                {impactError && <Message severity="error" text={impactError} />}

                {impact && !impactLoading && (
                    <div className="flex flex-column gap-2">
                        <div>
                            Usuarios afectados: <strong data-testid="impact-affected-count">{impact.affected_users_count}</strong>
                        </div>
                        <div>
                            Pierden algún permiso: <strong data-testid="impact-losing-count">{impact.users_losing_permissions_count}</strong>
                        </div>
                        {losing.length > 0 && (
                            <ul className="m-0 pl-4 text-sm">
                                {losing.map((u) => (
                                    <li key={u.id}>
                                        <strong>{u.username}</strong>
                                        {': '}
                                        {(u.lost_permissions_detail?.length === u.lost_permissions.length
                                            ? u.lost_permissions_detail.map((p) => p.description || describePermission(p.code))
                                            : u.lost_permissions.map(describePermission)
                                        ).join(', ')}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}

                {reason && (
                    <div data-testid="impact-blocked">
                        <Message severity="warn" text={reason} />
                    </div>
                )}
            </div>
        </Dialog>
    );
};

export default ConfirmImpactDialog;
