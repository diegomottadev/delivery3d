import { screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import OrderList from './OrderList';
import * as ordersApi from './ordersApi';
import { PERM } from '../security/permissions/perms';
import { renderWithPermissions, flushPromises, OPERATOR_PERMISSIONS } from '../security/permissions/permissionsTestUtils';

jest.mock('./ordersApi');

const ORDERS = [{ id: 1, status: 'nuevo', client: { name: 'Lucas' }, items: [], created_at: '2026-11-10T10:00:00' }];

const renderList = async (permissions) => {
    renderWithPermissions(
        <MemoryRouter>
            <OrderList />
        </MemoryRouter>,
        { permissions }
    );
    await screen.findByText('Lucas');
    await flushPromises();
};

describe('OrderList: acciones según permisos', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        ordersApi.listOrders.mockResolvedValue(ORDERS);
    });

    test('solo orders:read: sin alta, edición, cotización ni borrado', async () => {
        await renderList([PERM.ORDERS_READ]);
        expect(screen.queryByRole('button', { name: /Nuevo Pedido/i })).not.toBeInTheDocument();
        expect(screen.queryByTestId('edit-order-1')).not.toBeInTheDocument();
        expect(screen.queryByTestId('quote-order-1')).not.toBeInTheDocument();
        expect(screen.queryByTestId('delete-order-1')).not.toBeInTheDocument();
        expect(screen.getByTestId('history-order-1')).toBeInTheDocument();
    });

    test('rol Operador: alta, edición y cotización; sin borrado', async () => {
        await renderList(OPERATOR_PERMISSIONS);
        expect(screen.getByRole('button', { name: /Nuevo Pedido/i })).toBeInTheDocument();
        expect(screen.getByTestId('edit-order-1')).toBeInTheDocument();
        expect(screen.getByTestId('quote-order-1')).toBeInTheDocument();
        expect(screen.queryByTestId('delete-order-1')).not.toBeInTheDocument();
    });

    test('orders:delete muestra el botón de borrar', async () => {
        await renderList([PERM.ORDERS_READ, PERM.ORDERS_DELETE]);
        expect(screen.getByTestId('delete-order-1')).toBeInTheDocument();
    });
});
