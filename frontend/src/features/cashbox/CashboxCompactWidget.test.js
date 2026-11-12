import React, { createRef } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import CashboxCompactWidget from './CashboxCompactWidget';
import * as cashboxApi from './cashboxApi';

jest.mock('./cashboxApi');

const mockSummary = {
    total_ingresos: 30000.0,
    total_egresos: 12000.0,
    current_balance: 18000.0,
    currency_code: 'ARS',
    currency_symbol: 'AR$',
    movements_count: 5,
};

const mockMovements = [
    {
        id: 1,
        type: 'ingreso',
        amount: 5000.0,
        category: 'seña',
        category_name: 'Seña / Anticipo',
        description: 'Seña pedido #10',
        order_id: 10,
        created_at: '2026-09-16T12:00:00Z',
    },
    {
        id: 2,
        type: 'egreso',
        amount: 8000.0,
        category: 'filamento',
        category_name: 'Filamento',
        description: 'Bobina PLA Negro',
        order_id: null,
        created_at: '2026-09-16T12:30:00Z',
    },
];

const mockIncomeCategories = [
    { id: 1, code: 'seña', name: 'Seña / Anticipo' },
    { id: 2, code: 'extraordinario', name: 'Ingreso Extraordinario' },
];

const mockExpenseCategories = [
    { id: 1, code: 'filamento', name: 'Filamento' },
    { id: 2, code: 'repuestos', name: 'Repuestos A1' },
];

describe('CashboxCompactWidget', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        cashboxApi.getCashSummary.mockResolvedValue(mockSummary);
        cashboxApi.listCashMovements.mockResolvedValue(mockMovements);
        cashboxApi.getCashIncomeCategories.mockResolvedValue(mockIncomeCategories);
        cashboxApi.getCashExpenseCategories.mockResolvedValue(mockExpenseCategories);
    });

    test('renders balance and compact movements list', async () => {
        render(
            <BrowserRouter>
                <CashboxCompactWidget />
            </BrowserRouter>
        );

        expect(screen.getByText(/Caja Diaria/i)).toBeInTheDocument();
        expect(screen.getByText(/Saldo Disponible/i)).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.getByText('AR$ 18.000,00')).toBeInTheDocument();
            expect(screen.getByText(/Bobina PLA Negro/i)).toBeInTheDocument();
            expect(screen.getByText(/Seña pedido #10/i)).toBeInTheDocument();
        });
    });

    test('opens quick egreso dialog and registers movement', async () => {
        cashboxApi.createCashMovement.mockResolvedValue({ id: 3 });

        render(
            <BrowserRouter>
                <CashboxCompactWidget />
            </BrowserRouter>
        );

        const egresoBtn = screen.getByRole('button', { name: /Egreso/i });
        fireEvent.click(egresoBtn);

        expect(screen.getByRole('dialog')).toBeInTheDocument();

        const amountInput = screen.getByPlaceholderText('0.00');
        fireEvent.change(amountInput, { target: { value: '1500' } });
        fireEvent.blur(amountInput, { target: { value: '1500' } });

        const saveButtons = screen.getAllByRole('button', { name: /Registrar Egreso/i });
        const modalSubmitBtn = saveButtons[saveButtons.length - 1];
        fireEvent.click(modalSubmitBtn);

        await waitFor(() => {
            expect(cashboxApi.createCashMovement).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'egreso',
                    amount: 1500,
                    category: 'filamento',
                })
            );
        });
    });

    test('exposes refresh method via ref', async () => {
        const ref = createRef();
        render(
            <BrowserRouter>
                <CashboxCompactWidget ref={ref} />
            </BrowserRouter>
        );

        await waitFor(() => {
            expect(cashboxApi.getCashSummary).toHaveBeenCalledTimes(1);
        });

        ref.current.refresh();

        await waitFor(() => {
            expect(cashboxApi.getCashSummary).toHaveBeenCalledTimes(2);
        });
    });
});
