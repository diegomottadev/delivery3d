import { screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SplitDashboardView from './SplitDashboardView';
import * as ordersApi from '../orders/ordersApi';
import * as cashboxApi from '../cashbox/cashboxApi';
import { PERM } from '../security/permissions/perms';
import { renderWithPermissions, flushPromises, OPERATOR_PERMISSIONS } from '../security/permissions/permissionsTestUtils';

jest.mock('../orders/ordersApi');
jest.mock('../cashbox/cashboxApi');

const renderDashboard = async (permissions) => {
    renderWithPermissions(
        <MemoryRouter>
            <SplitDashboardView />
        </MemoryRouter>,
        { permissions }
    );
    await flushPromises();
};

describe('SplitDashboardView: paneles según permisos', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        ordersApi.listOrders.mockResolvedValue([]);
        cashboxApi.getCashSummary.mockResolvedValue({ total_ingresos: 0, total_egresos: 0, current_balance: 0, currency_symbol: 'AR$', movements_count: 0 });
        cashboxApi.listCashMovements.mockResolvedValue([]);
        cashboxApi.getCashIncomeCategories.mockResolvedValue([]);
        cashboxApi.getCashExpenseCategories.mockResolvedValue([]);
    });

    test('rol Operador: tablero de pedidos y caja', async () => {
        await renderDashboard(OPERATOR_PERMISSIONS);
        expect(await screen.findByText(/Tablero de Pedidos/i)).toBeInTheDocument();
        expect(await screen.findByText(/Caja Diaria/i)).toBeInTheDocument();
    });

    test('solo cash_movements:read: solo el widget de caja, sin pedir pedidos', async () => {
        await renderDashboard([PERM.CASH_MOVEMENTS_READ]);
        expect(await screen.findByText(/Caja Diaria/i)).toBeInTheDocument();
        expect(screen.queryByText(/Tablero de Pedidos/i)).not.toBeInTheDocument();
        expect(ordersApi.listOrders).not.toHaveBeenCalled();
    });

    test('solo orders:read: solo el tablero, sin caja ni selector de vista', async () => {
        await renderDashboard([PERM.ORDERS_READ]);
        expect(await screen.findByText(/Tablero de Pedidos/i)).toBeInTheDocument();
        expect(screen.queryByText(/Caja Diaria/i)).not.toBeInTheDocument();
        expect(screen.queryByText('Dividida')).not.toBeInTheDocument();
        expect(cashboxApi.getCashSummary).not.toHaveBeenCalled();
    });

    test('sin impresoras activas el aviso aparece arriba de pedidos y caja', async () => {
        ordersApi.listPrinters.mockResolvedValue([]);
        await renderDashboard(OPERATOR_PERMISSIONS);
        const warning = screen.getByTestId('no-printers-warning');
        const board = screen.getByText(/Tablero de Pedidos/i);
        // eslint-disable-next-line no-bitwise
        expect(warning.compareDocumentPosition(board) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
});
