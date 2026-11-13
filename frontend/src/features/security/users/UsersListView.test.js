import React from 'react';
import { screen, fireEvent, within } from '@testing-library/react';
import UsersListView from './UsersListView';
import * as securityApi from '../securityApi';
import { renderSecurityView, axiosError, READ, MANAGE, rowWith } from '../securityTestUtils';

jest.mock('../securityApi');

const USERS = [
    { id: 1, username: 'operador', is_active: true, is_superuser: false, groups_count: 1, direct_roles_count: 0 },
    { id: 7, username: 'Ana', is_active: true, is_superuser: false, groups_count: 2, direct_roles_count: 1 },
    { id: 8, username: 'beto', is_active: false, is_superuser: true, groups_count: 0, direct_roles_count: 0 },
];

const renderList = (options = {}) => renderSecurityView(<UsersListView />, { route: '/seguridad/usuarios', ...options });

describe('UsersListView (/seguridad/usuarios)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        securityApi.listUsers.mockResolvedValue(USERS);
    });

    test('lista los usuarios con estado, superusuario y cantidades', async () => {
        await renderList();
        const row = rowWith('Ana');
        expect(within(row).getByText('Activo')).toBeInTheDocument();
        expect(within(row).getByText('2')).toBeInTheDocument();
        expect(within(row).getByText('1')).toBeInTheDocument();
        const beto = rowWith('beto');
        expect(within(beto).getByText('Inactivo')).toBeInTheDocument();
        expect(within(beto).getByText('Superusuario')).toBeInTheDocument();
    });

    test('marca al usuario actual', async () => {
        await renderList({ userId: 1 });
        expect(within(rowWith('operador')).getByText('Vos')).toBeInTheDocument();
    });

    test('la búsqueda filtra en el front, sin volver a pedir a la API (case-insensitive)', async () => {
        await renderList();
        fireEvent.change(screen.getByLabelText('Buscar usuario'), { target: { value: 'an' } });
        expect(screen.getByText('Ana')).toBeInTheDocument();
        expect(screen.queryByText('beto')).not.toBeInTheDocument();
        expect(securityApi.listUsers).toHaveBeenCalledTimes(1);
        expect(securityApi.listUsers).toHaveBeenCalledWith();
    });

    test('sin coincidencias muestra un mensaje', async () => {
        await renderList();
        fireEvent.change(screen.getByLabelText('Buscar usuario'), { target: { value: 'zzz' } });
        expect(screen.getByText(/Ningún usuario coincide/i)).toBeInTheDocument();
    });

    test('"Ver" lleva al detalle del usuario', async () => {
        await renderList();
        fireEvent.click(within(rowWith('Ana')).getByRole('button', { name: /Ver/ }));
        expect(screen.getByTestId('location')).toHaveTextContent('/seguridad/usuarios/7');
    });

    test('solo lectura: no hay acciones de escritura, ni con rbac:manage', async () => {
        await renderList({ permissions: MANAGE });
        expect(screen.queryByRole('button', { name: /Nuevo|Eliminar|Editar/i })).not.toBeInTheDocument();
    });

    test('403 de la API → ForbiddenNotice sin romper la pantalla', async () => {
        securityApi.listUsers.mockRejectedValue(axiosError(403, { error: 'Acceso denegado: permisos insuficientes', code: 'FORBIDDEN' }));
        const { refresh } = await renderList({ permissions: READ });
        expect(screen.getByTestId('forbidden-notice')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Usuarios' })).toBeInTheDocument();
        expect(refresh).toHaveBeenCalled();
    });
});
