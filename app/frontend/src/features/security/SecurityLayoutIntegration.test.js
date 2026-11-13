import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AppWrapper from '../../AppWrapper';
import { PERM } from './permissions/perms';
import { startSession, mockMyPermissions, OPERATOR_PERMISSIONS } from './permissions/permissionsTestUtils';
import * as securityApi from './securityApi';

jest.mock('./securityApi');
jest.mock('../auth/authApi');

const renderAppAt = (path) =>
    render(
        <MemoryRouter initialEntries={[path]}>
            <AppWrapper />
        </MemoryRouter>
    );

// Textos de los ítems del side menu (AppMenu renderiza cada ítem como role="menuitem").
const menuTexts = () => screen.getAllByRole('menuitem').map((item) => item.textContent);
const menuHas = (label) => menuTexts().some((text) => text.includes(label));

describe('Integración: menú de Seguridad y guard dentro del layout', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        localStorage.clear();
        startSession();
        jest.spyOn(window, 'scrollTo').mockImplementation(() => {});
    });

    afterEach(() => {
        // Desmontar antes de restaurar: los efectos pendientes del layout llaman a scrollTo.
        cleanup();
        window.scrollTo.mockRestore();
    });

    test('con rbac:read el menú muestra el grupo Seguridad y la ruta protegida renderiza', async () => {
        mockMyPermissions({ permissions: [PERM.RBAC_READ] });
        securityApi.listUsers.mockResolvedValue([{ id: 7, username: 'ana', is_active: true, is_superuser: false, groups_count: 1, direct_roles_count: 0 }]);
        renderAppAt('/seguridad/usuarios');
        expect(await screen.findByText('ana')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Usuarios' })).toBeInTheDocument();
        expect(menuHas('Seguridad')).toBe(true);
        ['Usuarios', 'Grupos', 'Roles', 'Permisos'].forEach((label) => expect(menuHas(label)).toBe(true));
    });

    test('sin permisos de Seguridad: el grupo no aparece y la ruta va a /acceso-denegado conservando el menú', async () => {
        mockMyPermissions({ permissions: ['orders:read'] });
        renderAppAt('/seguridad/usuarios');
        expect(await screen.findByRole('heading', { name: /Acceso denegado/i })).toBeInTheDocument();
        expect(menuHas('Listado de Pedidos')).toBe(true);
        expect(menuHas('Seguridad')).toBe(false);
    });

    test('sin permisos: las rutas del taller van a /acceso-denegado y el menú queda vacío', async () => {
        mockMyPermissions({ permissions: [] });
        renderAppAt('/orders');
        expect(await screen.findByRole('heading', { name: /Acceso denegado/i })).toBeInTheDocument();
        ['Tablero', 'Listado de Pedidos', 'Caja Diaria y Finanzas', 'Configuración de Caja', 'Configuración del Taller', 'Seguridad'].forEach((label) =>
            expect(menuHas(label)).toBe(false)
        );
    });

    test('rol Operador: ve el menú del taller pero Seguridad le da acceso denegado', async () => {
        mockMyPermissions({ permissions: [...OPERATOR_PERMISSIONS] });
        renderAppAt('/seguridad/usuarios');
        expect(await screen.findByRole('heading', { name: /Acceso denegado/i })).toBeInTheDocument();
        ['Listado de Pedidos', 'Caja Diaria y Finanzas', 'Configuración del Taller'].forEach((label) => expect(menuHas(label)).toBe(true));
        expect(menuHas('Seguridad')).toBe(false);
    });

    test('ruta de detalle: renderiza el detalle con breadcrumb "Usuarios / Detalle de usuario"', async () => {
        mockMyPermissions({ permissions: [PERM.RBAC_READ] });
        securityApi.getUser.mockResolvedValue({ id: 7, username: 'ana', is_active: true, is_superuser: false });
        securityApi.listUserGroups.mockResolvedValue([]);
        securityApi.listUserDirectRoles.mockResolvedValue([]);
        securityApi.getUserAccess.mockResolvedValue({ user_id: 7, is_superuser: false, roles: [], permissions: [] });
        renderAppAt('/seguridad/usuarios/7');
        expect(await screen.findByRole('heading', { name: 'ana' })).toBeInTheDocument();
        expect(screen.getByText('Detalle de usuario')).toBeInTheDocument();
    });

    test('ruta de detalle sin rbac:read → acceso denegado', async () => {
        mockMyPermissions({ permissions: [...OPERATOR_PERMISSIONS] });
        renderAppAt('/seguridad/roles/2');
        expect(await screen.findByRole('heading', { name: /Acceso denegado/i })).toBeInTheDocument();
        expect(securityApi.getRole).not.toHaveBeenCalled();
    });
});
