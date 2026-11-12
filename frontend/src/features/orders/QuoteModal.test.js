import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderAsSuperuser } from '../security/permissions/permissionsTestUtils';
import QuoteModal from './QuoteModal';
import * as ordersApi from './ordersApi';

jest.mock('./ordersApi');

const mockOrder = {
    id: 10,
    status: 'nuevo',
    client: { name: 'Maria Fernandez' },
    items: [
        { id: 1, piece_description: 'Soporte', weight_g: 120, print_time_minutes: 210, quantity: 1 },
    ],
    pricing: null,
};

describe('QuoteModal', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('renders quote parameters inputs', () => {
        renderAsSuperuser(<QuoteModal visible={true} order={mockOrder} onHide={() => {}} onQuoteConfirmed={() => {}} />);

        expect(screen.getByText(/Cotizar Pedido #10/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Merma \/ Purga/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Potencia A1/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Costo kWh/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Amortización \/ Hora/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Mano de Obra/i)).toBeInTheDocument();
        expect(screen.getByText(/Margen de Ganancia/i)).toBeInTheDocument();
        expect(screen.getByText('x2')).toBeInTheDocument();
        expect(screen.getByText('x3')).toBeInTheDocument();
        expect(screen.getByText('x4')).toBeInTheDocument();
        expect(screen.getByText('x5')).toBeInTheDocument();
    });

    test('can calculate quote and confirm informed price', async () => {
        const onQuoteConfirmed = jest.fn();
        ordersApi.calculateQuote.mockResolvedValueOnce({
            id: 10,
            status: 'nuevo',
            pricing: {
                production_cost: '4881.00',
                suggested_sale_price: '9762.00',
                filament_cost: '2268.00',
                electricity_cost: '63.00',
                machine_cost: '1050.00',
                labor_cost: '1500.00',
            },
        });
        ordersApi.confirmQuote.mockResolvedValueOnce({
            id: 10,
            status: 'presupuestado',
            pricing: { informed_price: '9700.00' },
        });

        renderAsSuperuser(<QuoteModal visible={true} order={mockOrder} onHide={() => {}} onQuoteConfirmed={onQuoteConfirmed} />);

        // Click calculate button
        const calcBtn = screen.getByRole('button', { name: /Calcular Costos/i });
        fireEvent.click(calcBtn);

        await waitFor(() => {
            expect(ordersApi.calculateQuote).toHaveBeenCalledTimes(1);
            expect(ordersApi.calculateQuote).toHaveBeenCalledWith(
                10,
                expect.objectContaining({ profit_multiplier: 2 })
            );
            expect(screen.getByText(/\$4881.00/i)).toBeInTheDocument();
            expect(screen.getByText(/\$9762.00/i)).toBeInTheDocument();
        });

        // Click confirm quote button
        const confirmBtn = screen.getByRole('button', { name: /Confirmar Presupuesto/i });
        fireEvent.click(confirmBtn);

        await waitFor(() => {
            expect(ordersApi.confirmQuote).toHaveBeenCalledWith(10, expect.any(Number));
            expect(onQuoteConfirmed).toHaveBeenCalled();
        });
    });

    test('allows choosing x3 multiplier which sends profit_multiplier 3', async () => {
        ordersApi.calculateQuote.mockResolvedValueOnce({
            id: 10,
            status: 'nuevo',
            pricing: {
                production_cost: '1000.00',
                suggested_sale_price: '3000.00',
            },
        });

        renderAsSuperuser(<QuoteModal visible={true} order={mockOrder} onHide={() => {}} onQuoteConfirmed={() => {}} />);

        // Click x3 multiplier option
        const x3Btn = screen.getByText('x3');
        fireEvent.click(x3Btn);

        // Click calculate
        const calcBtn = screen.getByRole('button', { name: /Calcular Costos/i });
        fireEvent.click(calcBtn);

        await waitFor(() => {
            expect(ordersApi.calculateQuote).toHaveBeenCalledWith(
                10,
                expect.objectContaining({ profit_multiplier: 3 })
            );
        });
    });

    test('renders labor rate and time inputs, and sends labor_cost_per_hour and labor_time_minutes', async () => {
        ordersApi.getSettings.mockResolvedValueOnce({
            labor_cost_per_hour: 650.0,
            default_labor_time_minutes: 15,
        });
        ordersApi.calculateQuote.mockResolvedValueOnce({
            id: 10,
            status: 'nuevo',
            pricing: {
                production_cost: '2000.00',
                suggested_sale_price: '4000.00',
            },
        });

        renderAsSuperuser(<QuoteModal visible={true} order={mockOrder} onHide={() => {}} onQuoteConfirmed={() => {}} />);

        // Verify labor labels and preview
        expect(screen.getByText(/Tarifa Mano de Obra/i)).toBeInTheDocument();
        expect(screen.getByText(/Tiempo Mano de Obra del Operador/i)).toBeInTheDocument();
        expect(screen.getByText(/Mano de Obra Calculada/i)).toBeInTheDocument();

        // Click calculate
        const calcBtn = screen.getByRole('button', { name: /Calcular Costos/i });
        fireEvent.click(calcBtn);

        await waitFor(() => {
            expect(ordersApi.calculateQuote).toHaveBeenCalledWith(
                10,
                expect.objectContaining({
                    labor_cost_per_hour: 650,
                    labor_time_minutes: 15,
                    labor_cost: 162.5,
                })
            );
        });
    });
});

