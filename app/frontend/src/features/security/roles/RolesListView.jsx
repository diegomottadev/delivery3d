import React from 'react';
import * as api from '../securityApi';
import CrudListView from '../components/CrudListView';

export const ROLE_IN_USE_REASON = 'Está asignado a grupos o usuarios: quitáselo antes de eliminarlo (ROLE_IN_USE).';

const ROLES_CONFIG = Object.freeze({
    title: 'Roles',
    intro: 'Un rol es un conjunto de permisos. Se asigna a grupos (o, como excepción, directo a un usuario).',
    noun: 'Rol',
    newLabel: 'Nuevo rol',
    basePath: '/seguridad/roles',
    load: () => api.listRoles(),
    create: api.createRole,
    update: api.updateRole,
    remove: api.deleteRole,
    removalImpact: api.getRoleRemovalImpact,
    extraColumns: [
        { field: 'permissions_count', header: 'Permisos' },
        { field: 'groups_count', header: 'Grupos' },
        { field: 'direct_users_count', header: 'Usuarios directos' },
    ],
    // Un rol asignado no se borra (409 ROLE_IN_USE); uno sin asignar no le quita nada a nadie (§6.bis: nunca SELF_LOCKOUT).
    deleteBlockedReason: (role) => ((role.groups_count || 0) + (role.direct_users_count || 0) > 0 ? ROLE_IN_USE_REASON : null),
});

const RolesListView = () => <CrudListView config={ROLES_CONFIG} />;

export default RolesListView;
