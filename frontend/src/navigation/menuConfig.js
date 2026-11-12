import { PERM } from '../features/security/permissions/perms';

/**
 * Única fuente del side menu y del breadcrumb.
 * Ítem: { label, icon, path, perm | anyOf, breadcrumbLabel? }. El permiso es el del endpoint principal
 * de la pantalla y protege tanto el ítem del menú como la ruta (ver guardFor).
 */
export const MENU_CONFIG = Object.freeze([
    {
        label: 'Delivery3D - Taller',
        icon: 'pi pi-fw pi-box',
        breadcrumbParent: 'Delivery3D',
        items: [
            { label: 'Tablero y Finanzas (Split)', icon: 'pi pi-fw pi-th-large', path: '/', anyOf: [PERM.ORDERS_READ, PERM.CASH_MOVEMENTS_READ], breadcrumbLabel: 'Tablero Operativo y Finanzas' },
            { label: 'Listado de Pedidos', icon: 'pi pi-fw pi-list', path: '/orders', perm: PERM.ORDERS_READ },
            { label: 'Caja Diaria y Finanzas', icon: 'pi pi-fw pi-wallet', path: '/cashbox', perm: PERM.CASH_MOVEMENTS_READ },
            { label: 'Configuración de Caja', icon: 'pi pi-fw pi-sliders-h', path: '/cashbox/settings', perm: PERM.CASH_CATEGORIES_READ },
            { label: 'Configuración del Taller', icon: 'pi pi-fw pi-cog', path: '/settings', perm: PERM.SETTINGS_READ },
        ],
    },
    {
        label: 'Seguridad',
        icon: 'pi pi-fw pi-shield',
        items: [
            { label: 'Usuarios', icon: 'pi pi-fw pi-users', path: '/seguridad/usuarios', perm: PERM.RBAC_READ },
            { label: 'Grupos', icon: 'pi pi-fw pi-sitemap', path: '/seguridad/grupos', perm: PERM.RBAC_READ },
            { label: 'Roles', icon: 'pi pi-fw pi-id-card', path: '/seguridad/roles', perm: PERM.RBAC_READ },
            { label: 'Permisos', icon: 'pi pi-fw pi-key', path: '/seguridad/permisos', perm: PERM.RBAC_READ },
        ],
    },
]);
