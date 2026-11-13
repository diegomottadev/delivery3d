import axios from 'axios';

// Endpoints según openspec/changes/rbac-access-control/api-contract.md (fuente única del contrato).

// Sin sesión no se envía Authorization: el backend responde 401 y AuthContext redirige al login.
const getHeaders = () => {
    const token = localStorage.getItem('token');
    const headers = { 'Content-Type': 'application/json' };
    if (token && token !== 'null' && token !== 'undefined' && token.trim() !== '') {
        headers.Authorization = `Bearer ${token}`;
    }
    return headers;
};

// Los ids van en el path: solo enteros positivos (evita armar URLs arbitrarias).
const toId = (value) => {
    const text = String(value);
    if (!/^[1-9]\d*$/.test(text)) {
        throw new Error(`id inválido: ${text}`);
    }
    return text;
};

const searchParams = (q) => (typeof q === 'string' && q.trim() ? { q: q.trim() } : {});

// Lista blanca de campos editables de grupos y roles (sin mass assignment).
const nameAndDescription = ({ name, description }) => ({ name, description });

const get = (url, params) => axios.get(url, { headers: getHeaders(), ...(params ? { params } : {}) }).then((r) => r.data);
const post = (url, body) => axios.post(url, body, { headers: getHeaders() }).then((r) => r.data);
const put = (url, body) => axios.put(url, body, { headers: getHeaders() }).then((r) => r.data);
const del = (url) => axios.delete(url, { headers: getHeaders() }).then((r) => r.data);

const RBAC = '/api/rbac';

// §1 Mis permisos (FIJO)
/** @returns {Promise<{user_id: number, is_superuser: boolean, permissions: string[]}>} */
export const getMyPermissions = () => get('/api/auth/me/permissions');

// §2 Usuarios
export const listUsers = (q) => get(`${RBAC}/users`, searchParams(q));
export const getUser = (userId) => get(`${RBAC}/users/${toId(userId)}`);
export const listUserGroups = (userId) => get(`${RBAC}/users/${toId(userId)}/groups`);
export const addUserToGroup = (userId, groupId) => post(`${RBAC}/users/${toId(userId)}/groups`, { group_id: Number(toId(groupId)) });
export const removeUserFromGroup = (userId, groupId) => del(`${RBAC}/users/${toId(userId)}/groups/${toId(groupId)}`);
export const listUserDirectRoles = (userId) => get(`${RBAC}/users/${toId(userId)}/roles`);
export const assignDirectRole = (userId, roleId, reason) =>
    post(`${RBAC}/users/${toId(userId)}/roles`, { role_id: Number(toId(roleId)), reason });
export const removeDirectRole = (userId, roleId) => del(`${RBAC}/users/${toId(userId)}/roles/${toId(roleId)}`);
export const getUserAccess = (userId) => get(`${RBAC}/users/${toId(userId)}/access`);

// §3 Grupos
export const listGroups = (q) => get(`${RBAC}/groups`, searchParams(q));
export const createGroup = (data) => post(`${RBAC}/groups`, nameAndDescription(data));
export const getGroup = (groupId) => get(`${RBAC}/groups/${toId(groupId)}`);
export const updateGroup = (groupId, data) => put(`${RBAC}/groups/${toId(groupId)}`, nameAndDescription(data));
export const deleteGroup = (groupId) => del(`${RBAC}/groups/${toId(groupId)}`);
export const listGroupMembers = (groupId) => get(`${RBAC}/groups/${toId(groupId)}/members`);
export const addGroupMember = (groupId, userId) => post(`${RBAC}/groups/${toId(groupId)}/members`, { user_id: Number(toId(userId)) });
export const removeGroupMember = (groupId, userId) => del(`${RBAC}/groups/${toId(groupId)}/members/${toId(userId)}`);
export const listGroupRoles = (groupId) => get(`${RBAC}/groups/${toId(groupId)}/roles`);
export const addGroupRole = (groupId, roleId) => post(`${RBAC}/groups/${toId(groupId)}/roles`, { role_id: Number(toId(roleId)) });
export const removeGroupRole = (groupId, roleId) => del(`${RBAC}/groups/${toId(groupId)}/roles/${toId(roleId)}`);

// §4 Roles
export const listRoles = (q) => get(`${RBAC}/roles`, searchParams(q));
export const createRole = (data) => post(`${RBAC}/roles`, nameAndDescription(data));
export const getRole = (roleId) => get(`${RBAC}/roles/${toId(roleId)}`);
export const updateRole = (roleId, data) => put(`${RBAC}/roles/${toId(roleId)}`, nameAndDescription(data));
export const deleteRole = (roleId) => del(`${RBAC}/roles/${toId(roleId)}`);
/** Reemplazo completo del set de permisos del rol. */
export const setRolePermissions = (roleId, permissions) => put(`${RBAC}/roles/${toId(roleId)}/permissions`, { permissions });

// §5 Catálogo (solo lectura)
export const listPermissionCatalog = () => get(`${RBAC}/permissions`);

// §6 Impacto previo (cerrado en la etapa 6): solo lectura, mismo shape para todos.
export const getGroupRoleRemovalImpact = (groupId, roleId) => get(`${RBAC}/groups/${toId(groupId)}/roles/${toId(roleId)}/removal-impact`);
export const getGroupMemberRemovalImpact = (groupId, userId) =>
    get(`${RBAC}/groups/${toId(groupId)}/members/${toId(userId)}/removal-impact`);
export const getDirectRoleRemovalImpact = (userId, roleId) => get(`${RBAC}/users/${toId(userId)}/roles/${toId(roleId)}/removal-impact`);
export const getGroupRemovalImpact = (groupId) => get(`${RBAC}/groups/${toId(groupId)}/removal-impact`);
export const getRoleRemovalImpact = (roleId) => get(`${RBAC}/roles/${toId(roleId)}/removal-impact`);
export const previewRolePermissionsImpact = (roleId, permissions) => post(`${RBAC}/roles/${toId(roleId)}/permissions/impact`, { permissions });
