import React, { useRef, useState } from 'react';
import { useDetailBreadcrumbLabel } from '../../../navigation/DetailBreadcrumbContext';
import { Link, useParams } from 'react-router-dom';
import { TabView, TabPanel } from 'primereact/tabview';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { InputTextarea } from 'primereact/inputtextarea';
import { Message } from 'primereact/message';
import { Toast } from 'primereact/toast';
import * as api from '../securityApi';
import { useLoader, useMyAccess, useSecurityMutation } from '../useSecurityData';
import { usePermissions } from '../permissions/PermissionsContext';
import { Can } from '../permissions/Can';
import { PERM } from '../permissions/perms';
import { LoadState, BlockedHint } from '../components/LoadState';
import { ConfirmImpactDialog } from '../components/ConfirmImpactDialog';
import { useImpactConfirm } from '../components/useImpactConfirm';
import { UserTags } from './UsersListView';
import {
    SELF_ASSIGNMENT_REASON,
    SELF_LOCKOUT_REASON,
    formatUtcDateTime,
    wouldLoseManage,
    viaGroup,
    viaDirectRole,
    describeSource,
} from '../securityRules';

const REASON_MAX = 255;
const asList = (value) => (Array.isArray(value) ? value : []);

const loadUserDetail = async (userId) => {
    const [user, groups, directRoles, access] = await Promise.all([
        api.getUser(userId),
        api.listUserGroups(userId),
        api.listUserDirectRoles(userId),
        api.getUserAccess(userId),
    ]);
    return { user, groups: asList(groups), directRoles: asList(directRoles), access };
};

// Opciones de los selectores de asignación (solo hacen falta con rbac:manage).
const loadOptions = async (canManage) => {
    if (!canManage) return { groups: [], roles: [] };
    const [groups, roles] = await Promise.all([api.listGroups(), api.listRoles()]);
    return { groups: asList(groups), roles: asList(roles) };
};

/** Botón "Quitar" que se deshabilita con explicación si me dejaría sin rbac:manage. */
const RemoveButton = ({ label, lockout, onClick }) => (
    <div>
        <Button label="Quitar" icon="pi pi-trash" className="p-button-sm p-button-text p-button-danger" aria-label={label} disabled={lockout} onClick={onClick} />
        {lockout && <BlockedHint reason={SELF_LOCKOUT_REASON} testId="lockout-reason" />}
    </div>
);

const UserGroupsTab = ({ user, groups, options, isMe, selfBlocked, myAccess, impact, mutate }) => {
    const [groupId, setGroupId] = useState('');
    const memberOf = new Set(groups.map((g) => g.id));
    const available = options.groups.filter((g) => !memberOf.has(g.id));

    const add = async () => {
        const outcome = await mutate(() => api.addUserToGroup(user.id, Number(groupId)), 'Usuario agregado al grupo');
        if (outcome.ok) setGroupId('');
    };

    const remove = (group) =>
        impact.open({
            header: 'Quitar del grupo',
            message: `¿Quitar a ${user.username} del grupo ${group.name}?`,
            confirmLabel: 'Quitar del grupo',
            loadImpact: () => api.getGroupMemberRemovalImpact(group.id, user.id),
            onConfirm: () => mutate(() => api.removeUserFromGroup(user.id, group.id), 'Usuario quitado del grupo'),
        });

    return (
        <>
            <Can perm={PERM.RBAC_MANAGE}>
                <div className="flex flex-column md:flex-row md:align-items-end gap-2 mb-3">
                    <div className="flex flex-column">
                        <label htmlFor="add-group" className="font-medium mb-1">
                            Grupo a agregar
                        </label>
                        <select id="add-group" className="p-inputtext p-component" value={groupId} disabled={selfBlocked} onChange={(e) => setGroupId(e.target.value)}>
                            <option value="">Elegí un grupo…</option>
                            {available.map((g) => (
                                <option key={g.id} value={g.id}>
                                    {g.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <Button label="Agregar al grupo" icon="pi pi-plus" disabled={!groupId || selfBlocked} onClick={add} />
                </div>
                {selfBlocked && <BlockedHint reason={SELF_ASSIGNMENT_REASON} />}
            </Can>
            <DataTable value={groups} dataKey="id" size="small" responsiveLayout="stack" breakpoint="768px" emptyMessage="No pertenece a ningún grupo.">
                <Column header="Grupo" body={(g) => <Link to={`/seguridad/grupos/${g.id}`}>{g.name}</Link>} />
                <Column field="description" header="Descripción" />
                <Column
                    header=""
                    body={(g) => (
                        <Can perm={PERM.RBAC_MANAGE}>
                            <RemoveButton label={`Quitar del grupo ${g.name}`} lockout={isMe && wouldLoseManage(myAccess, viaGroup(g.id))} onClick={() => remove(g)} />
                        </Can>
                    )}
                />
            </DataTable>
        </>
    );
};

const UserDirectRolesTab = ({ user, directRoles, options, isMe, selfBlocked, myAccess, impact, mutate }) => {
    const [roleId, setRoleId] = useState('');
    const [reason, setReason] = useState('');
    const [reasonError, setReasonError] = useState(null);
    const assigned = new Set(directRoles.map((a) => a.role?.id));
    const available = options.roles.filter((r) => !assigned.has(r.id));
    const trimmed = reason.trim();
    const tooLong = reason.length > REASON_MAX;
    const canAssign = Boolean(roleId) && trimmed.length > 0 && !tooLong && !selfBlocked;

    const assign = async () => {
        setReasonError(null);
        const outcome = await mutate(() => api.assignDirectRole(user.id, Number(roleId), trimmed), 'Rol asignado');
        if (outcome.ok) {
            setRoleId('');
            setReason('');
        } else if (outcome.error.fieldErrors?.reason) {
            setReasonError(outcome.error.fieldErrors.reason);
        }
    };

    const remove = (assignment) =>
        impact.open({
            header: 'Quitar rol directo',
            message: `¿Quitar el rol ${assignment.role.name} asignado directamente a ${user.username}?`,
            confirmLabel: 'Quitar rol',
            loadImpact: () => api.getDirectRoleRemovalImpact(user.id, assignment.role.id),
            onConfirm: () => mutate(() => api.removeDirectRole(user.id, assignment.role.id), 'Rol directo quitado'),
        });

    return (
        <>
            <p className="text-600 mt-0">Los roles directos son excepciones: lo normal es dar acceso por grupos. El motivo es obligatorio y queda registrado.</p>
            <Can perm={PERM.RBAC_MANAGE}>
                <div className="grid formgrid p-fluid mb-2">
                    <div className="field col-12 md:col-4">
                        <label htmlFor="assign-role" className="font-medium">
                            Rol a asignar
                        </label>
                        <select id="assign-role" className="p-inputtext p-component w-full" value={roleId} disabled={selfBlocked} onChange={(e) => setRoleId(e.target.value)}>
                            <option value="">Elegí un rol…</option>
                            {available.map((r) => (
                                <option key={r.id} value={r.id}>
                                    {r.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="field col-12 md:col-8">
                        <label htmlFor="assign-reason" className="font-medium">
                            Motivo *
                        </label>
                        <InputTextarea
                            id="assign-reason"
                            rows={2}
                            value={reason}
                            disabled={selfBlocked}
                            className={tooLong || reasonError ? 'p-invalid' : ''}
                            onChange={(e) => {
                                setReason(e.target.value);
                                setReasonError(null);
                            }}
                        />
                        <small className={tooLong ? 'p-error' : 'text-500'}>
                            {reason.length}/{REASON_MAX}
                        </small>
                        {reasonError && <small className="p-error block">{reasonError}</small>}
                    </div>
                </div>
                <Button label="Asignar rol" icon="pi pi-plus" className="mb-3" disabled={!canAssign} onClick={assign} />
                {selfBlocked && <BlockedHint reason={SELF_ASSIGNMENT_REASON} />}
            </Can>
            <DataTable value={directRoles} dataKey="id" size="small" responsiveLayout="stack" breakpoint="768px" emptyMessage="No tiene roles directos.">
                <Column header="Rol" body={(a) => <Link to={`/seguridad/roles/${a.role.id}`}>{a.role.name}</Link>} />
                <Column field="reason" header="Motivo" />
                <Column header="Asignado por" body={(a) => (a.assigned_by ? a.assigned_by.username : 'Sistema (seed)')} />
                <Column header="Fecha" body={(a) => formatUtcDateTime(a.assigned_at)} />
                <Column
                    header=""
                    body={(a) => (
                        <Can perm={PERM.RBAC_MANAGE}>
                            <RemoveButton label={`Quitar rol ${a.role.name}`} lockout={isMe && wouldLoseManage(myAccess, viaDirectRole(a.role.id))} onClick={() => remove(a)} />
                        </Can>
                    )}
                />
            </DataTable>
        </>
    );
};

const UserAccessTab = ({ access }) => (
    <>
        {access?.is_superuser && (
            <Message severity="warn" className="mb-3 w-full justify-content-start" text="Es superusuario: tiene todos los permisos del sistema, sin importar sus roles." />
        )}
        <DataTable value={asList(access?.permissions)} dataKey="code" size="small" responsiveLayout="stack" breakpoint="768px" emptyMessage="No tiene ningún permiso.">
            <Column field="description" header="Permiso" />
            <Column
                header="Origen"
                body={(p) => (
                    <ul className="m-0 pl-3" data-testid={`sources-${p.code}`}>
                        {asList(p.sources).map((s, index) => (
                            <li key={index}>{describeSource(s)}</li>
                        ))}
                    </ul>
                )}
            />
        </DataTable>
    </>
);

/** Detalle de usuario (/seguridad/usuarios/:userId): grupos, roles directos y acceso efectivo. */
const UserDetailView = () => {
    const { userId } = useParams();
    const toast = useRef(null);
    const { can } = usePermissions();
    const canManage = can(PERM.RBAC_MANAGE);
    const { myAccess, myUserId, isSuperuser, reloadMyAccess } = useMyAccess();
    const detail = useLoader(() => loadUserDetail(userId), [userId]);
    const options = useLoader(() => loadOptions(canManage), [canManage]);
    const impact = useImpactConfirm();
    const mutate = useSecurityMutation(toast, () => Promise.all([detail.reload({ silent: true }), reloadMyAccess()]));

    const data = detail.data;
    const user = data?.user;
    useDetailBreadcrumbLabel(user?.username);
    const isMe = Boolean(user) && user.id === myUserId;
    // SELF_ASSIGNMENT directo: nadie se agrega grupos ni roles a sí mismo (el superusuario está exento).
    const selfBlocked = isMe && !isSuperuser;
    const tabProps = { user, isMe, selfBlocked, myAccess, impact, mutate, options: options.data || { groups: [], roles: [] } };

    return (
        <div className="card">
            <Toast ref={toast} />
            <div className="mb-3">
                <Link to="/seguridad/usuarios">
                    <i className="pi pi-arrow-left mr-1" />
                    Usuarios
                </Link>
            </div>
            <LoadState loading={detail.loading} error={detail.error} onRetry={detail.reload} notFoundText="El usuario no existe." />
            {user && (
                <>
                    <div className="flex flex-wrap align-items-center gap-2 mb-3">
                        <h3 className="m-0">{user.username}</h3>
                        <UserTags user={user} isMe={isMe} />
                    </div>
                    <TabView>
                        <TabPanel header="Grupos">
                            <UserGroupsTab {...tabProps} groups={data.groups} />
                        </TabPanel>
                        <TabPanel header="Roles directos">
                            <UserDirectRolesTab {...tabProps} directRoles={data.directRoles} />
                        </TabPanel>
                        <TabPanel header="Acceso efectivo">
                            <UserAccessTab access={data.access} />
                        </TabPanel>
                    </TabView>
                </>
            )}
            <ConfirmImpactDialog {...impact.dialogProps} />
        </div>
    );
};

export default UserDetailView;
