import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderAsSuperuser } from '../security/permissions/permissionsTestUtils';
import { MemoryRouter } from 'react-router-dom';
import OrderList from './OrderList';
import * as ordersApi from './ordersApi';

jest.mock('./ordersApi');

const mockOrders = [
    {
        id: 1,
        status: 'nuevo',
        created_at: '2026-09-14T19:00:00Z',
        client: { id: 10, name: 'Laura Gonzalez', origin: 'whatsapp', phone: '+5491112345678' },
        items: [
            { id: 101, piece_description: 'Soporte Auricular', weight_g: '120.00', print_time_minutes: 210, quantity: 1 },
        ],
        pricing: null,
    },
    {
        id: 2,
        status: 'presupuestado',
        created_at: '2026-09-14T19:10:00Z',
        client: { id: 11, name: 'Lucas Rossi', origin: 'instagram_dm', phone: null },
        items: [
            { id: 102, piece_description: 'Maceta Geométrica', weight_g: '250.00', print_time_minutes: 360, quantity: 2 },
        ],
        pricing: { production_cost: '4881.00', suggested_sale_price: '6833.40', informed_price: '6800.00' },
    },
];

describe('OrderList', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        ordersApi.listOrders.mockResolvedValue(mockOrders);
        ordersApi.listMaterials.mockResolvedValue([]);
    });

    test('renders orders in the table', async () => {
        renderAsSuperuser(
            <MemoryRouter>
                <OrderList />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Laura Gonzalez')).toBeInTheDocument();
            expect(screen.getByText('Lucas Rossi')).toBeInTheDocument();
        });

        expect(screen.getByText(/Soporte Auricular/i)).toBeInTheDocument();
        expect(screen.getByText('nuevo')).toBeInTheDocument();
        expect(screen.getByText('presupuestado')).toBeInTheDocument();
    });

    test('renders with real backend response format', async () => {
        const realOrder = [
            {
                id: 1,
                created_at: '2026-09-15T16:23:32',
                created_by: 1,
                status: 'entregado',
                client: { id: 1, name: 'Aylin', origin: 'whatsapp', phone: '+5468522889', instagram_username: null, notes: null },
                items: [{ id: 1, material_id: 3, piece_description: 'Soporte para pared', print_time_minutes: 148, quantity: 1, reference_url: null, weight_g: '78.00' }],
                production_cost: '2780.76',
                suggested_sale_price: '5561.52',
                quote: { informed_price: '5561.52', kwh_cost: '278.00', labor_cost: '650.00', machine_cost_per_hour: '100.00', machine_power_watts: '120.00', profit_margin_pct: '100.00', quoted_at: '2026-09-15T16:24:35', waste_purge_pct: '5.00' },
            },
        ];
        ordersApi.listOrders.mockResolvedValue(realOrder);
        renderAsSuperuser(
            <MemoryRouter>
                <OrderList />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Aylin')).toBeInTheDocument();
        });
        expect(screen.getByText(/Soporte para pared/i)).toBeInTheDocument();
        expect(screen.getByText('entregado')).toBeInTheDocument();
    });

    test('clicking delete button opens confirmation modal and confirms deletion in OrderList', async () => {
        ordersApi.deleteOrder.mockResolvedValueOnce({ message: 'Pedido 1 eliminado correctamente.' });

        renderAsSuperuser(
            <MemoryRouter>
                <OrderList />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Laura Gonzalez')).toBeInTheDocument();
        });

        const deleteBtn = screen.getByTestId('delete-order-1');
        fireEvent.click(deleteBtn);

        expect(screen.getByText(/Confirmar Eliminación de Pedido/i)).toBeInTheDocument();
        expect(screen.getByText(/¿Estás seguro de que deseas eliminar el pedido #1\?/i)).toBeInTheDocument();
        expect(screen.getAllByText(/Laura Gonzalez/i).length).toBeGreaterThanOrEqual(2);

        const confirmBtn = screen.getByTestId('confirm-delete-button');
        fireEvent.click(confirmBtn);

        await waitFor(() => {
            expect(ordersApi.deleteOrder).toHaveBeenCalledWith(1);
        });
        await waitFor(() => {
            expect(screen.queryByText(/Confirmar Eliminación de Pedido/i)).not.toBeInTheDocument();
        });
    });
});
