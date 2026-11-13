import React from 'react';
import * as api from '../securityApi';
import CrudListView from '../components/CrudListView';
import { SELF_LOCKOUT_REASON, wouldLoseManage, viaGroup } from '../securityRules';

const GROUPS_CONFIG = Object.freeze({
    title: 'Grupos',
    intro: 'Los grupos reúnen usuarios y les dan roles. Es la forma normal de dar acceso.',
    noun: 'Grupo',
    newLabel: 'Nuevo grupo',
    basePath: '/seguridad/grupos',
    load: () => api.listGroups(),
    create: api.createGroup,
    update: api.updateGroup,
    remove: api.deleteGroup,
    removalImpact: api.getGroupRemovalImpact,
    extraColumns: [
        { field: 'members_count', header: 'Miembros' },
        { field: 'roles_count', header: 'Roles' },
    ],
    // Borrar el grupo me deja sin rbac:manage si todas mis fuentes pasan por él.
    deleteBlockedReason: (group, myAccess) => (wouldLoseManage(myAccess, viaGroup(group.id)) ? SELF_LOCKOUT_REASON : null),
});

const GroupsListView = () => <CrudListView config={GROUPS_CONFIG} />;

export default GroupsListView;
