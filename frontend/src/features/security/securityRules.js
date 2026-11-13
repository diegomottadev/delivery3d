import { PERM } from './permissions/perms';

// ---------------------------------------------------------------------------
// Fechas: la API manda ISO-8601 en UTC sin sufijo de zona (api-contract.md §0).
// ---------------------------------------------------------------------------
const HAS_ZONE = /(Z|[+-]\d{2}:?\d{2})$/i;

/** Interpreta un ISO de la API como UTC. Devuelve null si no es una fecha válida. */
export const parseUtc = (iso) => {
    if (typeof iso !== 'string' || !iso.trim()) return null;
    const date = new Date(HAS_ZONE.test(iso) ? iso : `${iso}Z`);
    return Number.isNaN(date.getTime()) ? null : date;
};

/** Fecha y hora local (es-AR) de un ISO UTC de la API. */
export const formatUtcDateTime = (iso) => {
    const date = parseUtc(iso);
    return date ? date.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
};

// ---------------------------------------------------------------------------
// Reglas SELF_ASSIGNMENT / SELF_LOCKOUT del lado del front (solo UX: el backend
// responde 409 igual). Se calculan con GET /api/rbac/users/<yo>/access.
// ---------------------------------------------------------------------------
export const SELF_ASSIGNMENT_REASON = 'No podés asignarte roles, grupos ni permisos a vos mismo (SELF_ASSIGNMENT).';
export const SELF_LOCKOUT_REASON = 'Te quitarías a vos mismo el permiso de administrar la seguridad (SELF_LOCKOUT).';

/** Ids de los roles que tengo (directos o por grupo). */
export const myRoleIds = (access) => new Set((access?.roles || []).map((entry) => entry.role?.id).filter(Boolean));

/**
 * ¿La operación me deja sin rbac:manage? True solo si TODAS las fuentes de rbac:manage
 * de mi acceso efectivo cumplen `removesSource`. Superusuario o acceso sin cargar → false.
 */
export const wouldLoseManage = (access, removesSource) => {
    if (!access || access.is_superuser) return false;
    const entry = (access.permissions || []).find((p) => p.code === PERM.RBAC_MANAGE);
    const sources = entry?.sources || [];
    return sources.length > 0 && sources.every(removesSource);
};

// Predicados de fuente (para wouldLoseManage).
export const viaGroup = (groupId) => (s) => s.type === 'group' && s.group?.id === groupId;
export const viaRole = (roleId) => (s) => s.type !== 'superuser' && s.role?.id === roleId;
export const viaGroupRole = (groupId, roleId) => (s) => viaGroup(groupId)(s) && s.role?.id === roleId;
export const viaDirectRole = (roleId) => (s) => s.type === 'direct' && s.role?.id === roleId;

/** Texto del origen de un permiso en "Acceso efectivo". */
export const describeSource = (source) => {
    if (source?.type === 'superuser') return 'superusuario';
    if (source?.type === 'direct') return `directo → rol ${source.role?.name ?? '?'}`;
    if (source?.type === 'group') return `vía grupo ${source.group?.name ?? '?'} → rol ${source.role?.name ?? '?'}`;
    return 'origen desconocido';
};

// ---------------------------------------------------------------------------
// Mensajes de error de mutaciones (toast).
// ---------------------------------------------------------------------------
const CONFLICTS = {
    NAME_TAKEN: { summary: 'Nombre repetido', detail: 'Ya existe otro con ese nombre.' },
    ALREADY_MEMBER: { summary: 'Ya es miembro', detail: 'El usuario ya pertenece a ese grupo.' },
    ALREADY_ASSIGNED: { summary: 'Ya asignado', detail: 'Ese rol ya está asignado.' },
    ROLE_IN_USE: { summary: 'Rol en uso', detail: 'El rol está asignado a grupos o usuarios: quitáselo antes de eliminarlo.' },
    SELF_LOCKOUT: { summary: 'Auto-bloqueo', detail: 'No podés quitarte a vos mismo el permiso de administrar la seguridad.' },
    SELF_ASSIGNMENT: { summary: 'Auto-asignación', detail: 'No podés asignarte roles ni permisos a vos mismo.' },
};

const GENERIC = /error inesperado/i;

/** Normaliza un apiError (getApiError) a { summary, detail } para un toast de error. */
export const describeMutationError = (apiError) => {
    if (apiError.isForbidden) {
        return { summary: 'Acceso denegado', detail: 'No tenés permiso para realizar esta acción.' };
    }
    if (apiError.status === 409) {
        const known = CONFLICTS[apiError.code] || { summary: 'Conflicto', detail: 'La operación entra en conflicto con el estado actual.' };
        const text = apiError.message && !GENERIC.test(apiError.message) ? apiError.message : known.detail;
        return { summary: known.summary, detail: apiError.code ? `${text} (${apiError.code})` : text };
    }
    if (apiError.status === 422) {
        const fields = Object.values(apiError.fieldErrors || {}).filter((v) => typeof v === 'string');
        return { summary: 'Datos inválidos', detail: [apiError.message, ...fields].join(' ') };
    }
    if (apiError.status === 404) {
        return { summary: 'No encontrado', detail: apiError.message };
    }
    return { summary: 'Error', detail: apiError.message };
};
