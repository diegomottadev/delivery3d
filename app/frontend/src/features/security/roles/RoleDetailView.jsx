import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDetailBreadcrumbLabel } from '../../../navigation/DetailBreadcrumbContext';
import { Link, useParams } from 'react-router-dom';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import * as api from '../securityApi';
import { useLoader, useMyAccess, useSecurityMutation } from '../useSecurityData';
import { usePermissions } from '../permissions/PermissionsContext';
import { Can } from '../permissions/Can';
import { PERM } from '../permissions/perms';
import { LoadState, BlockedHint } from '../components/LoadState';
import { ConfirmImpactDialog } from '../components/ConfirmImpactDialog';
import { useImpactConfirm } from '../components/useImpactConfirm';
import { NameDescriptionDialog } from '../components/NameDescriptionDialog';
import { useNameDescriptionEditor } from '../components/CrudListView';
import { PermissionChecklist } from './PermissionChecklist';
import { SELF_ASSIGNMENT_REASON, SELF_LOCKOUT_REASON, myRoleIds, wouldLoseManage, viaRole } from '../securityRules';

const loadRoleDetail = async (roleId) => {
    const [role, catalog] = await Promise.all([api.getRole(roleId), api.listPermissionCatalog()]);
    return { role, catalog: Array.isArray(catalog) ? catalog : [] };
};

/** Detalle de rol (/seguridad/roles/:roleId): datos y permisos (reemplazo completo del set). */
const RoleDetailView = () => {
    const { roleId } = useParams();
    const toast = useRef(null);
    const { can } = usePermissions();
    const canManage = can(PERM.RBAC_MANAGE);
    const { myAccess, isSuperuser, reloadMyAccess } = useMyAccess();
    const detail = useLoader(() => loadRoleDetail(roleId), [roleId]);
    const impact = useImpactConfirm();
    const mutate = useSecurityMutation(toast, () => Promise.all([detail.reload({ silent: true }), reloadMyAccess()]));
    const editor = useNameDescriptionEditor(mutate);

    const role = detail.data?.role;
    useDetailBreadcrumbLabel(role?.name);
    const catalog = useMemo(() => detail.data?.catalog || [], [detail.data]);
    const original = useMemo(() => new Set(role?.permissions || []), [role]);
    // Solo se guardan los cambios pendientes (code → marcado o no), aplicados sobre lo que vino del servidor.
    // Así una recarga (p.ej. tras un 409) trae los cambios de otros sin perder las casillas tocadas.
    const [pending, setPending] = useState(() => new Map());
    useEffect(() => {
        setPending(new Map());
    }, [roleId]);
    const selected = useMemo(() => {
        const next = new Set(original);
        pending.forEach((checked, code) => (checked ? next.add(code) : next.delete(code)));
        return next;
    }, [original, pending]);
    const clearPending = () => setPending(new Map());

    const descriptions = useMemo(() => {
        const map = new Map();
        catalog.forEach((g) => (g.permissions || []).forEach((p) => map.set(p.code, p.description)));
        return map;
    }, [catalog]);
    const describePermission = (code) => descriptions.get(code) || code;

    const added = [...selected].filter((c) => !original.has(c));
    const removed = [...original].filter((c) => !selected.has(c));
    const dirty = added.length > 0 || removed.length > 0;

    // SELF_ASSIGNMENT: si tengo este rol, no puedo sumarle permisos (quitar sí).
    const selfAssignBlocked = !isSuperuser && Boolean(role) && myRoleIds(myAccess).has(role.id) && added.length > 0;
    // SELF_LOCKOUT: sacarle rbac:manage al rol del que depende todo mi rbac:manage.
    const lockout = Boolean(role) && removed.includes(PERM.RBAC_MANAGE) && wouldLoseManage(myAccess, viaRole(role.id));
    const blockedReason = selfAssignBlocked ? `Tenés este rol: ${SELF_ASSIGNMENT_REASON}` : lockout ? SELF_LOCKOUT_REASON : null;

    const toggle = (code) =>
        setPending((prev) => {
            const next = new Map(prev);
            const checked = !selected.has(code);
            if (checked === original.has(code)) next.delete(code);
            else next.set(code, checked);
            return next;
        });

    const nextPermissions = () => [...selected].sort();
    const persist = async () => {
        const outcome = await mutate(() => api.setRolePermissions(role.id, nextPermissions()), 'Permisos del rol actualizados');
        if (outcome.ok) clearPending();
        return outcome;
    };

    const save = () => {
        if (removed.length === 0) {
            persist();
            return;
        }
        // Quitar permisos afecta a quienes tienen el rol: se confirma con el impacto.
        impact.open({
            header: 'Quitar permisos del rol',
            message: `¿Guardar los cambios del rol ${role.name}? Se quitan ${removed.length} permiso(s): ${removed.map(describePermission).join(', ')}.`,
            confirmLabel: 'Guardar cambios',
            loadImpact: () => api.previewRolePermissionsImpact(role.id, nextPermissions()),
            onConfirm: persist,
        });
    };

    return (
        <div className="card">
            <Toast ref={toast} />
            <div className="mb-3">
                <Link to="/seguridad/roles">
                    <i className="pi pi-arrow-left mr-1" />
                    Roles
                </Link>
            </div>
            <LoadState loading={detail.loading} error={detail.error} onRetry={detail.reload} notFoundText="El rol no existe." />
            {role && (
                <>
                    <div className="flex flex-wrap justify-content-between align-items-center gap-2">
                        <h3 className="m-0">{role.name}</h3>
                        <Can perm={PERM.RBAC_MANAGE}>
                            <Button
                                label="Editar"
                                icon="pi pi-pencil"
                                className="p-button-outlined p-button-sm"
                                onClick={() => editor.open({ header: `Editar ${role.name}`, initial: role, save: (values) => api.updateRole(role.id, values), successMessage: 'Rol actualizado' })}
                            />
                        </Can>
                    </div>
                    <p className="text-600">{role.description || 'Sin descripción.'}</p>

                    <div className="flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
                        <h4 className="m-0">
                            Permisos <span className="text-500 text-base font-normal">({selected.size} seleccionados)</span>
                        </h4>
                        <Can perm={PERM.RBAC_MANAGE}>
                            <div className="flex gap-2">
                                <Button label="Descartar" icon="pi pi-undo" className="p-button-text p-button-sm" disabled={!dirty} onClick={clearPending} />
                                <Button label="Guardar permisos" icon="pi pi-save" className="p-button-sm" disabled={!dirty || Boolean(blockedReason)} onClick={save} />
                            </div>
                        </Can>
                    </div>
                    <BlockedHint reason={canManage ? blockedReason : null} />
                    <PermissionChecklist catalog={catalog} selected={selected} disabled={!canManage} onToggle={toggle} />
                </>
            )}
            <NameDescriptionDialog {...editor.dialogProps} />
            <ConfirmImpactDialog {...impact.dialogProps} describePermission={describePermission} />
        </div>
    );
};

export default RoleDetailView;
