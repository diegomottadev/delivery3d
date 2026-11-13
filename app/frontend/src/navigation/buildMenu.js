import { matchPath } from 'react-router-dom';

// Un ítem es visible si no declara permiso, si `can(perm)` o si tiene alguno de `anyOf`.
const isAllowed = (item, can) => {
    if (item.anyOf) return item.anyOf.some((perm) => can(perm));
    if (item.perm) return can(item.perm);
    return true;
};

/**
 * Arma el modelo de AppMenu filtrando por permiso. Descarta los grupos que quedan vacíos
 * (así "Seguridad" solo aparece si el usuario ve al menos uno de sus ítems).
 * @param {Array} config MENU_CONFIG
 * @param {(perm: string) => boolean} can
 */
export const buildMenu = (config, can) =>
    config
        .map((group) => ({
            label: group.label,
            icon: group.icon,
            items: group.items
                .filter((item) => isAllowed(item, can))
                .map((item) => ({ label: item.label, icon: item.icon, to: item.path })),
        }))
        .filter((group) => group.items.length > 0);

/** Entradas de breadcrumb { path, parent, label } derivadas de la misma config. */
export const buildBreadcrumb = (config) =>
    config.flatMap((group) =>
        group.items.map((item) => ({
            path: item.path,
            parent: group.breadcrumbParent || group.label,
            label: item.breadcrumbLabel || item.label,
        }))
    );

/**
 * Props de <RequirePermission> para una ruta, tomadas del mismo ítem del menú
 * (una sola fuente: el permiso que muestra el ítem es el que protege la ruta).
 */
export const guardFor = (config, path) => {
    const item = config.flatMap((group) => group.items).find((i) => i.path === path);
    if (!item || !(item.perm || item.anyOf)) {
        throw new Error(`guardFor: la ruta "${path}" no tiene permiso declarado en MENU_CONFIG`);
    }
    return item.anyOf ? { anyOf: item.anyOf } : { perm: item.perm };
};

/**
 * Entrada de breadcrumb para `pathname`: primero coincidencia exacta (ignora la barra final),
 * después patrones con params (rutas de detalle). null si no hay ninguna.
 */
export const findBreadcrumbMeta = (entries, pathname) => {
    const clean = pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname;
    return (
        entries.find((e) => e.path === clean) ||
        entries.find((e) => e.path.includes(':') && matchPath({ path: e.path, end: true }, clean)) ||
        null
    );
};
