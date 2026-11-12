import { PERM } from '../features/security/permissions/perms';

/**
 * Única fuente del side menu y del breadcrumb.
 * Ítem: { label, icon, path, perm?, breadcrumbLabel? }. Sin `perm` = visible con solo estar logueado.
 */
export const MENU_CONFIG = Object.freeze([
    {
        label: 'Delivery3D - Taller',
        icon: 'pi pi-fw pi-box',
        breadcrumbParent: 'Delivery3D',
        items: [
            { label: 'Tablero y Finanzas (Split)', icon: 'pi pi-fw pi-th-large', path: '/', breadcrumbLabel: 'Tablero Operativo y Finanzas' },
            { label: 'Listado de Pedidos', icon: 'pi pi-fw pi-list', path: '/orders' },
            { label: 'Caja Diaria y Finanzas', icon: 'pi pi-fw pi-wallet', path: '/cashbox' },
            { label: 'Configuración de Caja', icon: 'pi pi-fw pi-sliders-h', path: '/cashbox/settings' },
            { label: 'Configuración del Taller', icon: 'pi pi-fw pi-cog', path: '/settings' },
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
