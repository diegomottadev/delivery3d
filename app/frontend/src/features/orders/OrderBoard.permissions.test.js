import { screen } from '@testing-library/react';
import OrderBoard from './OrderBoard';
import * as ordersApi from './ordersApi';
import { PERM } from '../security/permissions/perms';
import { renderWithPermissions, flushPromises, OPERATOR_PERMISSIONS } from '../security/permissions/permissionsTestUtils';

jest.mock('./ordersApi');

const ORDERS = [
    { id: 1, status: 'nuevo', client: { name: 'Lucas' }, items: [{ piece_description: 'Engranaje', quantity: 1 }] },
    { id: 2, status: 'presupuestado', client: { name: 'Marta' }, items: [{ piece_description: 'Vaso', quantity: 1 }] },
    { id: 3, status: 'aprobado', client: { name: 'Julian' }, items: [{ piece_description: 'Llavero', quantity: 1 }] },
    { id: 4, status: 'imprimiendo', client: { name: 'Ana' }, items: [{ piece_description: 'Maceta', quantity: 1 }] },
    { id: 5, status: 'listo', client: { name: 'Carlos' }, items: [{ piece_description: 'Soporte', quantity: 1 }] },
];

const TRANSITIONS = ['Cotizar', 'Aprobar', 'Imprimir', 'Marcar Listo', 'Entregar'];

const renderBoard = async (permissions) => {
    renderWithPermissions(<OrderBoard />, { permissions });
    await screen.findByText(/Engranaje/);
    await flushPromises();
};

describe('OrderBoard: acciones según permisos', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        ordersApi.listOrders.mockResolvedValue(ORDERS);
    });

    test('solo orders:read: ve los pedidos e historial, sin alta, edición, cotización, transiciones ni borrado', async () => {
        await renderBoard([PERM.ORDERS_READ]);
        expect(screen.queryByRole('button', { name: /Nuevo Pedido/i })).not.toBeInTheDocument();
        TRANSITIONS.forEach((label) => expect(screen.queryByRole('button', { name: label })).not.toBeInTheDocument());
        expect(screen.queryByTestId('edit-order-1')).not.toBeInTheDocument();
        expect(screen.queryByTestId('quote-order-1')).not.toBeInTheDocument();
        expect(screen.queryByTestId('delete-order-1')).not.toBeInTheDocument();
        expect(screen.getByTestId('history-order-1')).toBeInTheDocument();
    });

    test('rol Operador: alta, edición, cotización y todas las transiciones; sin borrado', async () => {
        await renderBoard(OPERATOR_PERMISSIONS);
        expect(screen.getByRole('button', { name: /Nuevo Pedido/i })).toBeInTheDocument();
        TRANSITIONS.forEach((label) => expect(screen.getByRole('button', { name: label })).toBeInTheDocument());
        expect(screen.getByTestId('edit-order-1')).toBeInTheDocument();
        expect(screen.getByTestId('quote-order-1')).toBeInTheDocument();
        expect(screen.queryByTestId('delete-order-1')).not.toBeInTheDocument();
    });

    test('cada transición depende de su permiso (quote / approve / produce / deliver)', async () => {
        await renderBoard([PERM.ORDERS_READ, PERM.ORDERS_APPROVE, PERM.ORDERS_DELIVER]);
        expect(screen.getByRole('button', { name: 'Aprobar' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Entregar' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Cotizar' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Imprimir' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Marcar Listo' })).not.toBeInTheDocument();
    });

    test('orders:delete muestra el botón de borrar', async () => {
        await renderBoard([PERM.ORDERS_READ, PERM.ORDERS_DELETE]);
        expect(screen.getByTestId('delete-order-1')).toBeInTheDocument();
    });
});
