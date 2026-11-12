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
                .filter((item) => !item.perm || can(item.perm))
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
