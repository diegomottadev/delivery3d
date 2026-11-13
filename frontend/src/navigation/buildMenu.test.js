import { buildMenu, buildBreadcrumb, guardFor, findBreadcrumbMeta } from './buildMenu';
import { OPERATOR_PERMISSIONS } from '../features/security/permissions/permissionsTestUtils';
import { MENU_CONFIG, DETAIL_ROUTES } from './menuConfig';
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

    test('todos los ítems del taller declaran perm o anyOf con códigos del enum', () => {
        const taller = MENU_CONFIG.find((g) => g.label === 'Delivery3D - Taller');
        expect(taller.items.map((i) => [i.path, i.perm || i.anyOf])).toEqual([
            ['/', [PERM.ORDERS_READ, PERM.CASH_MOVEMENTS_READ]],
            ['/orders', PERM.ORDERS_READ],
            ['/cashbox', PERM.CASH_MOVEMENTS_READ],
            ['/cashbox/settings', PERM.CASH_CATEGORIES_READ],
            ['/settings', PERM.SETTINGS_READ],
        ]);
    });

    test('un usuario sin permisos no ve ningún grupo del menú', () => {
        expect(buildMenu(MENU_CONFIG, () => false)).toEqual([]);
    });

    test('el rol Operador ve todo el taller y no ve Seguridad', () => {
        const menu = buildMenu(MENU_CONFIG, canWith(OPERATOR_PERMISSIONS));
        expect(menu.map((g) => g.label)).toEqual(['Delivery3D - Taller']);
        expect(menu[0].items.map((i) => i.to)).toEqual(['/', '/orders', '/cashbox', '/cashbox/settings', '/settings']);
    });

    test('anyOf: el tablero aparece con solo uno de sus permisos', () => {
        const menu = buildMenu(MENU_CONFIG, canWith([PERM.CASH_MOVEMENTS_READ]));
        expect(menu[0].items.map((i) => i.to)).toEqual(['/', '/cashbox']);
    });
});

describe('guardFor', () => {
    test('devuelve las props de RequirePermission del ítem de la config', () => {
        expect(guardFor(MENU_CONFIG, '/orders')).toEqual({ perm: PERM.ORDERS_READ });
        expect(guardFor(MENU_CONFIG, '/')).toEqual({ anyOf: [PERM.ORDERS_READ, PERM.CASH_MOVEMENTS_READ] });
    });

    test('lanza si la ruta no está en la config (evita rutas sin guard por error)', () => {
        expect(() => guardFor(MENU_CONFIG, '/no-existe')).toThrow(/no-existe/);
    });
});

describe('buildBreadcrumb', () => {
    test('deriva las entradas del breadcrumb de la config (usa breadcrumbLabel si existe)', () => {
        const crumbs = buildBreadcrumb(MENU_CONFIG);
        expect(crumbs.every((c) => !('perm' in c) && !('anyOf' in c))).toBe(true);
        expect(crumbs).toContainEqual({ path: '/', parent: 'Delivery3D', label: 'Tablero Operativo y Finanzas' });
        expect(crumbs).toContainEqual({ path: '/seguridad/usuarios', parent: 'Seguridad', label: 'Usuarios' });
    });
});

describe('findBreadcrumbMeta (rutas de detalle)', () => {
    const entries = [...buildBreadcrumb(MENU_CONFIG), ...DETAIL_ROUTES];

    test('rutas exactas del menú (con o sin barra final)', () => {
        expect(findBreadcrumbMeta(entries, '/seguridad/usuarios')).toMatchObject({ label: 'Usuarios', parent: 'Seguridad' });
        expect(findBreadcrumbMeta(entries, '/seguridad/grupos/')).toMatchObject({ label: 'Grupos' });
    });

    test.each([
        ['/seguridad/usuarios/7', 'Detalle de usuario', 'Usuarios', '/seguridad/usuarios'],
        ['/seguridad/grupos/3', 'Detalle de grupo', 'Grupos', '/seguridad/grupos'],
        ['/seguridad/roles/2', 'Detalle de rol', 'Roles', '/seguridad/roles'],
    ])('%s → "%s" con vuelta a %s', (pathname, label, backLabel, backPath) => {
        expect(findBreadcrumbMeta(entries, pathname)).toMatchObject({ parent: 'Seguridad', label, backLabel, backPath });
    });

    test('ruta desconocida → null', () => {
        expect(findBreadcrumbMeta(entries, '/nada/por/aca')).toBeNull();
    });
});
