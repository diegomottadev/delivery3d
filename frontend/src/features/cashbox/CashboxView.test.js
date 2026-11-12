import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderAsSuperuser } from '../security/permissions/permissionsTestUtils';
import { BrowserRouter } from 'react-router-dom';
import CashboxView from './CashboxView';
import * as cashboxApi from './cashboxApi';

jest.mock('./cashboxApi');

const mockSummary = {
    total_ingresos: 25000.0,
    total_egresos: 10000.0,
    current_balance: 15000.0,
    currency_code: 'ARS',
    currency_symbol: 'AR$',
    movements_count: 2,
};

const mockMovements = [
    {
        id: 1,
        type: 'ingreso',
        amount: 25000.0,
        category: 'seña',
        category_name: 'Seña / Anticipo',
        description: 'Seña inicial pedido #1',
        order_id: 1,
        operator_username: 'operador',
        created_at: '2026-09-16T10:00:00Z',
    },
    {
        id: 2,
        type: 'egreso',
        amount: 10000.0,
        category: 'filamento',
        category_name: 'Filamento',
        description: 'Bobina PLA Grilon Negro',
        order_id: null,
        operator_username: 'operador',
        created_at: '2026-09-16T11:00:00Z',
    },
];

const mockIncomeCategories = [
    { id: 1, code: 'seña', name: 'Seña / Anticipo', is_system: true, is_active: true },
    { id: 2, code: 'extraordinario', name: 'Ingreso Extraordinario', is_system: false, is_active: true },
];

const mockExpenseCategories = [
    { id: 1, code: 'filamento', name: 'Filamento', is_system: false, is_active: true },
    { id: 2, code: 'repuestos', name: 'Repuestos A1', is_system: false, is_active: true },
];

describe('CashboxView', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        cashboxApi.getCashSummary.mockResolvedValue(mockSummary);
        cashboxApi.listCashMovements.mockResolvedValue(mockMovements);
        cashboxApi.getCashIncomeCategories.mockResolvedValue(mockIncomeCategories);
        cashboxApi.getCashExpenseCategories.mockResolvedValue(mockExpenseCategories);
    });

    test('renders financial metrics summary cards and table', async () => {
        renderAsSuperuser(
            <BrowserRouter>
                <CashboxView />
            </BrowserRouter>
        );

        expect(screen.getByText(/Control Financiero y Caja Diaria/i)).toBeInTheDocument();
        expect(screen.getByText(/Saldo Actual en Caja/i)).toBeInTheDocument();
        expect(screen.getByText(/Total Ingresos/i)).toBeInTheDocument();
        expect(screen.getByText(/Total Egresos/i)).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.getByText(/Bobina PLA Grilon Negro/i)).toBeInTheDocument();
            expect(screen.getByText(/Seña inicial pedido #1/i)).toBeInTheDocument();
        });
    });

    test('opens movement registration dialog and creates movement', async () => {
        cashboxApi.createCashMovement.mockResolvedValue({ id: 3 });

        renderAsSuperuser(
            <BrowserRouter>
                <CashboxView />
            </BrowserRouter>
        );

        const egresoBtn = screen.getByRole('button', { name: /Registrar Egreso/i });
        fireEvent.click(egresoBtn);

        expect(screen.getByText(/Registrar Egreso de Caja/i)).toBeInTheDocument();

        const amountInput = screen.getByPlaceholderText('0.00');
        fireEvent.change(amountInput, { target: { value: '4500' } });
        fireEvent.blur(amountInput, { target: { value: '4500' } });

        const descInput = screen.getByPlaceholderText(/Bobina PLA Blanco/i);
        fireEvent.change(descInput, { target: { value: 'Compra de spray fijador' } });

        const saveButtons = screen.getAllByRole('button', { name: /Registrar Egreso/i });
        const modalSubmitBtn = saveButtons[saveButtons.length - 1];
        fireEvent.click(modalSubmitBtn);

        await waitFor(() => {
            expect(cashboxApi.createCashMovement).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'egreso',
                    amount: 4500.0,
                    category: 'filamento',
                    description: 'Compra de spray fijador',
                })
            );
        });
    });
});
