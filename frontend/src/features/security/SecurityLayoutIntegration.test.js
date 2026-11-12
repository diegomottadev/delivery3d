import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AppWrapper from '../../AppWrapper';
import { PERM } from './permissions/perms';
import { startSession, mockMyPermissions } from './permissions/permissionsTestUtils';

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
        window.scrollTo.mockRestore();
    });

    test('con rbac:read el menú muestra el grupo Seguridad y la ruta protegida renderiza', async () => {
        mockMyPermissions({ permissions: [PERM.RBAC_READ] });
        renderAppAt('/seguridad/usuarios');
        expect(await screen.findByText('Pantalla en construcción.')).toBeInTheDocument();
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
});
