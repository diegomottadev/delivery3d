import { screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CashboxCompactWidget from './CashboxCompactWidget';
import * as cashboxApi from './cashboxApi';
import { PERM } from '../security/permissions/perms';
import { renderWithPermissions, flushPromises, OPERATOR_PERMISSIONS } from '../security/permissions/permissionsTestUtils';

jest.mock('./cashboxApi');

const renderWidget = async (permissions) => {
    renderWithPermissions(
        <MemoryRouter>
            <CashboxCompactWidget />
        </MemoryRouter>,
        { permissions }
    );
    await screen.findByText(/Caja Diaria/i);
    await flushPromises();
};

describe('CashboxCompactWidget: acciones según permisos', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        cashboxApi.getCashSummary.mockResolvedValue({ total_ingresos: 0, total_egresos: 0, current_balance: 0, currency_symbol: 'AR$', movements_count: 0 });
        cashboxApi.listCashMovements.mockResolvedValue([]);
        cashboxApi.getCashIncomeCategories.mockResolvedValue([]);
        cashboxApi.getCashExpenseCategories.mockResolvedValue([]);
    });

    test('solo cash_movements:read: no puede registrar ingresos ni egresos', async () => {
        await renderWidget([PERM.CASH_MOVEMENTS_READ]);
        expect(screen.queryByRole('button', { name: /^Ingreso$/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /^Egreso$/i })).not.toBeInTheDocument();
    });

    test('rol Operador: registra ingresos y egresos', async () => {
        await renderWidget(OPERATOR_PERMISSIONS);
        expect(screen.getByRole('button', { name: /^Ingreso$/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^Egreso$/i })).toBeInTheDocument();
    });
});
