import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import SplitDashboardView from './SplitDashboardView';
import * as ordersApi from '../orders/ordersApi';
import * as cashboxApi from '../cashbox/cashboxApi';

jest.mock('../orders/ordersApi');
jest.mock('../cashbox/cashboxApi');

const mockOrders = [
    {
        id: 1,
        status: 'nuevo',
        client: { name: 'Cliente Test', origin: 'whatsapp' },
        items: [{ id: 1, piece_description: 'Pieza Test', weight_g: '50.000', print_time_minutes: 60 }],
        pricing: null,
    },
];

const mockCashSummary = {
    total_ingresos: 10000.0,
    total_egresos: 4000.0,
    current_balance: 6000.0,
    currency_code: 'ARS',
    currency_symbol: 'AR$',
    movements_count: 2,
};

describe('SplitDashboardView', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        ordersApi.listOrders.mockResolvedValue(mockOrders);
        cashboxApi.getCashSummary.mockResolvedValue(mockCashSummary);
        cashboxApi.listCashMovements.mockResolvedValue([]);
        cashboxApi.getCashIncomeCategories.mockResolvedValue([]);
        cashboxApi.getCashExpenseCategories.mockResolvedValue([]);
    });

    test('renders split screen with both order board and cashbox widget', async () => {
        render(
            <BrowserRouter>
                <SplitDashboardView />
            </BrowserRouter>
        );

        expect(screen.getByText(/Tablero Operativo y Finanzas/i)).toBeInTheDocument();
        expect(screen.getByText(/Tablero de Pedidos/i)).toBeInTheDocument();
        expect(screen.getByText(/Caja Diaria/i)).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.getByText('Cliente Test')).toBeInTheDocument();
            expect(screen.getByText('AR$ 6.000,00')).toBeInTheDocument();
        });
    });

    test('toggles view mode from split to full kanban and hides cashbox widget', async () => {
        render(
            <BrowserRouter>
                <SplitDashboardView />
            </BrowserRouter>
        );

        expect(screen.getByText(/Caja Diaria/i)).toBeInTheDocument();

        const fullBtn = screen.getByRole('button', { name: /Solo Pedidos/i });
        fireEvent.click(fullBtn);

        expect(screen.queryByText(/Saldo Disponible/i)).not.toBeInTheDocument();

        const splitBtn = screen.getByRole('button', { name: /Dividida/i });
        fireEvent.click(splitBtn);

        expect(screen.getByText(/Caja Diaria/i)).toBeInTheDocument();
    });
});
