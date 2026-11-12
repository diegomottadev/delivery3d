import React from 'react';
import { render, screen, waitFor, fireEvent, within, act } from '@testing-library/react';
import PermissionsCatalogView from './PermissionsCatalogView';
import * as securityApi from '../securityApi';
import { AllProviders, startSession, mockMyPermissions } from '../permissions/permissionsTestUtils';

jest.mock('../securityApi');
jest.mock('../../auth/authApi');

const CATALOG = [
    {
        resource: 'orders',
        resource_label: 'Pedidos',
        permissions: [
            { code: 'orders:read', action: 'read', description: 'Ver pedidos', roles: [{ id: 2, name: 'Operador' }, { id: 3, name: 'Encargado' }] },
            { code: 'orders:delete', action: 'delete', description: 'Eliminar pedidos', roles: [] },
        ],
    },
    {
        resource: 'rbac',
        resource_label: 'Seguridad',
        permissions: [{ code: 'rbac:read', action: 'read', description: 'Ver la configuración de seguridad', roles: [{ id: 3, name: 'Encargado' }] }],
    },
];

const axiosError = (status, data) => Object.assign(new Error(`HTTP ${status}`), { response: { status, data } });

// Renderiza y deja resolver las promesas mockeadas (permisos + catálogo) dentro de act.
const flush = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));
const renderView = async () => {
    const utils = render(<PermissionsCatalogView />, { wrapper: AllProviders });
    await flush();
    return utils;
};

describe('PermissionsCatalogView (/seguridad/permisos)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        localStorage.clear();
        startSession();
        mockMyPermissions({ permissions: ['rbac:read'] });
    });

    test('agrupa por resource_label y muestra la descripción de cada permiso con los roles que lo usan', async () => {
        securityApi.listPermissionCatalog.mockResolvedValue(CATALOG);
        await renderView();

        const orders = await screen.findByTestId('catalog-group-orders');
        expect(within(orders).getByRole('heading', { name: 'Pedidos' })).toBeInTheDocument();
        expect(within(orders).getByText('Ver pedidos')).toBeInTheDocument();
        expect(within(orders).getByText('Operador')).toBeInTheDocument();
        expect(within(orders).getByText('Encargado')).toBeInTheDocument();

        const rbac = screen.getByTestId('catalog-group-rbac');
        expect(within(rbac).getByRole('heading', { name: 'Seguridad' })).toBeInTheDocument();
        expect(within(rbac).getByText('Ver la configuración de seguridad')).toBeInTheDocument();
    });

    test('no muestra los codes como texto (se muestra la descripción)', async () => {
        securityApi.listPermissionCatalog.mockResolvedValue(CATALOG);
        await renderView();
        await screen.findByText('Ver pedidos');
        expect(screen.queryByText('orders:read')).not.toBeInTheDocument();
        expect(screen.queryByText('rbac:read')).not.toBeInTheDocument();
    });

    test('un permiso sin roles lo indica', async () => {
        securityApi.listPermissionCatalog.mockResolvedValue(CATALOG);
        await renderView();
        const orders = await screen.findByTestId('catalog-group-orders');
        expect(within(orders).getByText(/Ningún rol lo usa/i)).toBeInTheDocument();
    });

    test('si falta resource_label usa el resource tal cual (sin mapa propio en el front)', async () => {
        securityApi.listPermissionCatalog.mockResolvedValue([{ resource: 'printers', permissions: [] }]);
        await renderView();
        const group = await screen.findByTestId('catalog-group-printers');
        expect(within(group).getByRole('heading', { name: 'printers' })).toBeInTheDocument();
    });

    test('es solo lectura: no hay botones de crear, editar ni borrar', async () => {
        securityApi.listPermissionCatalog.mockResolvedValue(CATALOG);
        await renderView();
        await screen.findByText('Ver pedidos');
        expect(screen.queryAllByRole('button')).toHaveLength(0);
    });

    test('catálogo vacío muestra un mensaje', async () => {
        securityApi.listPermissionCatalog.mockResolvedValue([]);
        await renderView();
        expect(await screen.findByText(/No hay permisos definidos/i)).toBeInTheDocument();
    });

    test('403 de la API: aviso claro sin romper la pantalla y refresca /me/permissions', async () => {
        securityApi.listPermissionCatalog.mockRejectedValue(axiosError(403, { error: 'Acceso denegado: permisos insuficientes', code: 'FORBIDDEN' }));
        await renderView();
        expect(await screen.findByTestId('forbidden-notice')).toBeInTheDocument();
        await waitFor(() => expect(securityApi.getMyPermissions).toHaveBeenCalledTimes(2));
        await flush();
        expect(screen.getByRole('heading', { name: /Catálogo de permisos/i })).toBeInTheDocument();
    });

    test('otro error: muestra el mensaje y "Reintentar" vuelve a cargar', async () => {
        securityApi.listPermissionCatalog.mockRejectedValueOnce(axiosError(500, { error: 'boom' }));
        securityApi.listPermissionCatalog.mockResolvedValueOnce(CATALOG);
        await renderView();
        fireEvent.click(await screen.findByRole('button', { name: /Reintentar/i }));
        expect(await screen.findByText('Ver pedidos')).toBeInTheDocument();
        expect(securityApi.listPermissionCatalog).toHaveBeenCalledTimes(2);
    });

    test('mientras carga muestra un indicador', async () => {
        securityApi.listPermissionCatalog.mockReturnValue(new Promise(() => {}));
        await renderView();
        expect(screen.getByTestId('catalog-loading')).toBeInTheDocument();
    });
});
