import React, { useRef, useState } from 'react';
import { useDetailBreadcrumbLabel } from '../../../navigation/DetailBreadcrumbContext';
import { Link, useParams } from 'react-router-dom';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { Tag } from 'primereact/tag';
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
import { SELF_ASSIGNMENT_REASON, SELF_LOCKOUT_REASON, wouldLoseManage, viaGroup, viaGroupRole } from '../securityRules';

const asList = (value) => (Array.isArray(value) ? value : []);

const loadOptions = async (canManage) => {
    if (!canManage) return { users: [], roles: [] };
    const [users, roles] = await Promise.all([api.listUsers(), api.listRoles()]);
    return { users: asList(users), roles: asList(roles) };
};

const AddPicker = ({ id, label, placeholder, buttonLabel, items, disabled, isOptionDisabled = () => false, optionLabel, onAdd }) => {
    const [value, setValue] = useState('');
    const add = async () => {
        const outcome = await onAdd(Number(value));
        if (outcome.ok) setValue('');
    };
    return (
        <div className="flex flex-column md:flex-row md:align-items-end gap-2 mb-2">
            <div className="flex flex-column">
                <label htmlFor={id} className="font-medium mb-1">
                    {label}
                </label>
                <select id={id} className="p-inputtext p-component" value={value} disabled={disabled} onChange={(e) => setValue(e.target.value)}>
                    <option value="">{placeholder}</option>
                    {items.map((item) => (
                        <option key={item.id} value={item.id} disabled={isOptionDisabled(item)}>
                            {optionLabel(item)}
                        </option>
                    ))}
                </select>
            </div>
            <Button label={buttonLabel} icon="pi pi-plus" disabled={!value || disabled} onClick={add} />
        </div>
    );
};

const RemoveButton = ({ label, lockout, onClick }) => (
    <div>
        <Button label="Quitar" icon="pi pi-trash" className="p-button-sm p-button-text p-button-danger" aria-label={label} disabled={lockout} onClick={onClick} />
        {lockout && <BlockedHint reason={SELF_LOCKOUT_REASON} testId="lockout-reason" />}
    </div>
);

/** Detalle de grupo (/seguridad/grupos/:groupId): datos, miembros y roles. */
const GroupDetailView = () => {
    const { groupId } = useParams();
    const toast = useRef(null);
    const { can } = usePermissions();
    const canManage = can(PERM.RBAC_MANAGE);
    const { myAccess, myUserId, isSuperuser, reloadMyAccess } = useMyAccess();
    const detail = useLoader(() => api.getGroup(groupId), [groupId]);
    const options = useLoader(() => loadOptions(canManage), [canManage]);
    const impact = useImpactConfirm();
    const mutate = useSecurityMutation(toast, () => Promise.all([detail.reload({ silent: true }), reloadMyAccess()]));
    const editor = useNameDescriptionEditor(mutate);

    const group = detail.data;
    useDetailBreadcrumbLabel(group?.name);
    const id = group?.id;
    const members = asList(group?.members);
    const roles = asList(group?.roles);
    const memberIds = new Set(members.map((m) => m.id));
    const roleIds = new Set(roles.map((r) => r.id));
    const opts = options.data || { users: [], roles: [] };
    // SELF_ASSIGNMENT indirecto: si soy miembro, sumar un rol al grupo me lo daría a mí.
    const iAmMember = !isSuperuser && memberIds.has(myUserId);

    const removeMember = (member) =>
        impact.open({
            header: 'Quitar miembro',
            message: `¿Quitar a ${member.username} del grupo ${group.name}?`,
            confirmLabel: 'Quitar miembro',
            loadImpact: () => api.getGroupMemberRemovalImpact(id, member.id),
            onConfirm: () => mutate(() => api.removeGroupMember(id, member.id), 'Miembro quitado'),
        });

    const removeRole = (role) =>
        impact.open({
            header: 'Quitar rol del grupo',
            message: `¿Quitar el rol ${role.name} del grupo ${group.name}? Todos sus miembros dejan de tenerlo por esta vía.`,
            confirmLabel: 'Quitar rol',
            loadImpact: () => api.getGroupRoleRemovalImpact(id, role.id),
            onConfirm: () => mutate(() => api.removeGroupRole(id, role.id), 'Rol quitado del grupo'),
        });

    return (
        <div className="card">
            <Toast ref={toast} />
            <div className="mb-3">
                <Link to="/seguridad/grupos">
                    <i className="pi pi-arrow-left mr-1" />
                    Grupos
                </Link>
            </div>
            <LoadState loading={detail.loading} error={detail.error} onRetry={detail.reload} notFoundText="El grupo no existe." />
            {group && (
                <>
                    <div className="flex flex-wrap justify-content-between align-items-center gap-2">
                        <h3 className="m-0">{group.name}</h3>
                        <Can perm={PERM.RBAC_MANAGE}>
                            <Button
                                label="Editar"
                                icon="pi pi-pencil"
                                className="p-button-outlined p-button-sm"
                                onClick={() => editor.open({ header: `Editar ${group.name}`, initial: group, save: (values) => api.updateGroup(id, values), successMessage: 'Grupo actualizado' })}
                            />
                        </Can>
                    </div>
                    <p className="text-600">{group.description || 'Sin descripción.'}</p>

                    <section className="mb-5">
                        <h4>Miembros</h4>
                        <Can perm={PERM.RBAC_MANAGE}>
                            <AddPicker
                                id="add-member"
                                label="Usuario a agregar"
                                placeholder="Elegí un usuario…"
                                buttonLabel="Agregar miembro"
                                items={opts.users.filter((u) => !memberIds.has(u.id))}
                                isOptionDisabled={(u) => !isSuperuser && u.id === myUserId}
                                optionLabel={(u) => (!isSuperuser && u.id === myUserId ? `${u.username} (vos: no podés agregarte)` : u.username)}
                                onAdd={(userId) => mutate(() => api.addGroupMember(id, userId), 'Miembro agregado')}
                            />
                        </Can>
                        <DataTable value={members} dataKey="id" size="small" responsiveLayout="stack" breakpoint="768px" emptyMessage="El grupo no tiene miembros.">
                            <Column header="Usuario" body={(m) => <Link to={`/seguridad/usuarios/${m.id}`}>{m.username}</Link>} />
                            <Column header="Estado" body={(m) => <Tag value={m.is_active ? 'Activo' : 'Inactivo'} severity={m.is_active ? 'success' : 'danger'} />} />
                            <Column
                                header=""
                                body={(m) => (
                                    <Can perm={PERM.RBAC_MANAGE}>
                                        <RemoveButton
                                            label={`Quitar a ${m.username}`}
                                            lockout={m.id === myUserId && wouldLoseManage(myAccess, viaGroup(id))}
                                            onClick={() => removeMember(m)}
                                        />
                                    </Can>
                                )}
                            />
                        </DataTable>
                    </section>

                    <section>
                        <h4>Roles</h4>
                        <Can perm={PERM.RBAC_MANAGE}>
                            <AddPicker
                                id="add-role"
                                label="Rol a agregar"
                                placeholder="Elegí un rol…"
                                buttonLabel="Agregar rol"
                                items={opts.roles.filter((r) => !roleIds.has(r.id))}
                                disabled={iAmMember}
                                optionLabel={(r) => r.name}
                                onAdd={(roleId) => mutate(() => api.addGroupRole(id, roleId), 'Rol agregado al grupo')}
                            />
                            {iAmMember && <BlockedHint reason={`Sos miembro de este grupo: ${SELF_ASSIGNMENT_REASON}`} />}
                        </Can>
                        <DataTable value={roles} dataKey="id" size="small" responsiveLayout="stack" breakpoint="768px" emptyMessage="El grupo no tiene roles.">
                            <Column header="Rol" body={(r) => <Link to={`/seguridad/roles/${r.id}`}>{r.name}</Link>} />
                            <Column field="description" header="Descripción" />
                            <Column
                                header=""
                                body={(r) => (
                                    <Can perm={PERM.RBAC_MANAGE}>
                                        <RemoveButton label={`Quitar rol ${r.name}`} lockout={wouldLoseManage(myAccess, viaGroupRole(id, r.id))} onClick={() => removeRole(r)} />
                                    </Can>
                                )}
                            />
                        </DataTable>
                    </section>
                </>
            )}
            <NameDescriptionDialog {...editor.dialogProps} />
            <ConfirmImpactDialog {...impact.dialogProps} />
        </div>
    );
};

export default GroupDetailView;
