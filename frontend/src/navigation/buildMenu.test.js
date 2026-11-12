import { buildMenu, buildBreadcrumb } from './buildMenu';
import { MENU_CONFIG } from './menuConfig';
import { PERM } from '../features/security/permissions/perms';

const CONFIG = [
    {
        label: 'Taller',
        icon: 'pi pi-box',
        items: [{ label: 'Pedidos', icon: 'pi pi-list', path: '/orders' }],
    },
    {
        label: 'Seguridad',
        icon: 'pi pi-shield',
        items: [
            { label: 'Usuarios', icon: 'pi pi-users', path: '/seguridad/usuarios', perm: PERM.RBAC_READ },
            { label: 'Roles', icon: 'pi pi-id-card', path: '/seguridad/roles', perm: PERM.RBAC_MANAGE },
        ],
    },
];

const canWith = (granted) => (perm) => granted.includes(perm);

describe('buildMenu', () => {
    test('mapea path → to en el formato que espera AppMenu', () => {
        const menu = buildMenu(CONFIG, canWith([]));
        expect(menu[0]).toEqual({
            label: 'Taller',
            icon: 'pi pi-box',
            items: [{ label: 'Pedidos', icon: 'pi pi-list', to: '/orders' }],
        });
    });

    test('los ítems sin perm se muestran siempre (solo requieren login)', () => {
        const menu = buildMenu(CONFIG, canWith([]));
        expect(menu.map((g) => g.label)).toContain('Taller');
    });

    test('el grupo Seguridad no aparece si el usuario no ve ninguno de sus ítems', () => {
        const menu = buildMenu(CONFIG, canWith([]));
        expect(menu.map((g) => g.label)).not.toContain('Seguridad');
    });

    test('el grupo Seguridad aparece con solo los ítems permitidos', () => {
        const menu = buildMenu(CONFIG, canWith([PERM.RBAC_READ]));
        const security = menu.find((g) => g.label === 'Seguridad');
        expect(security.items.map((i) => i.label)).toEqual(['Usuarios']);
    });

    test('con todos los permisos muestra todos los ítems', () => {
        const menu = buildMenu(CONFIG, canWith([PERM.RBAC_READ, PERM.RBAC_MANAGE]));
        const security = menu.find((g) => g.label === 'Seguridad');
        expect(security.items).toHaveLength(2);
    });

    test('no muta la config original', () => {
        const snapshot = JSON.stringify(CONFIG);
        buildMenu(CONFIG, canWith([PERM.RBAC_READ]));
        expect(JSON.stringify(CONFIG)).toBe(snapshot);
    });
});

describe('MENU_CONFIG', () => {
    const securityGroup = MENU_CONFIG.find((g) => g.label === 'Seguridad');

    test('Seguridad tiene Usuarios, Grupos, Roles y Permisos bajo /seguridad, todos con perm del enum', () => {
        expect(securityGroup.items.map((i) => [i.label, i.path])).toEqual([
            ['Usuarios', '/seguridad/usuarios'],
            ['Grupos', '/seguridad/grupos'],
            ['Roles', '/seguridad/roles'],
            ['Permisos', '/seguridad/permisos'],
        ]);
        securityGroup.items.forEach((item) => expect(item.perm).toBe(PERM.RBAC_READ));
    });

    test('un usuario sin permisos ve el menú del taller pero no Seguridad', () => {
        const menu = buildMenu(MENU_CONFIG, () => false);
        expect(menu.map((g) => g.label)).toEqual(['Delivery3D - Taller']);
        expect(menu[0].items.map((i) => i.to)).toEqual(['/', '/orders', '/cashbox', '/cashbox/settings', '/settings']);
    });
});

describe('buildBreadcrumb', () => {
    test('deriva las entradas del breadcrumb de la config (usa breadcrumbLabel si existe)', () => {
        const crumbs = buildBreadcrumb(MENU_CONFIG);
        expect(crumbs).toContainEqual({ path: '/', parent: 'Delivery3D', label: 'Tablero Operativo y Finanzas' });
        expect(crumbs).toContainEqual({ path: '/seguridad/usuarios', parent: 'Seguridad', label: 'Usuarios' });
    });
});
