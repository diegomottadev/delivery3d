import { screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CashboxView from './CashboxView';
import * as cashboxApi from './cashboxApi';
import { PERM } from '../security/permissions/perms';
import { renderWithPermissions, flushPromises, OPERATOR_PERMISSIONS } from '../security/permissions/permissionsTestUtils';

jest.mock('./cashboxApi');

const renderView = async (permissions) => {
    renderWithPermissions(
        <MemoryRouter>
            <CashboxView />
        </MemoryRouter>,
        { permissions }
    );
    await screen.findByRole('button', { name: /Actualizar/i });
    await flushPromises();
};

describe('CashboxView: acciones según permisos', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        cashboxApi.getCashSummary.mockResolvedValue({ total_ingresos: 0, total_egresos: 0, current_balance: 0, currency_symbol: 'AR$', movements_count: 0 });
        cashboxApi.listCashMovements.mockResolvedValue([]);
        cashboxApi.getCashIncomeCategories.mockResolvedValue([]);
        cashboxApi.getCashExpenseCategories.mockResolvedValue([]);
    });

    test('solo cash_movements:read: sin registrar movimientos ni acceso a categorías', async () => {
        await renderView([PERM.CASH_MOVEMENTS_READ]);
        expect(screen.queryByRole('button', { name: /Registrar Ingreso/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Registrar Egreso/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Categorías/i })).not.toBeInTheDocument();
    });

    test('rol Operador: registra ingresos y egresos y ve categorías', async () => {
        await renderView(OPERATOR_PERMISSIONS);
        expect(screen.getByRole('button', { name: /Registrar Ingreso/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Registrar Egreso/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Categorías/i })).toBeInTheDocument();
    });
});
