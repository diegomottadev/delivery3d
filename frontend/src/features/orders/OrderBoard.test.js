import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderAsSuperuser } from '../security/permissions/permissionsTestUtils';
import OrderBoard from './OrderBoard';
import * as ordersApi from './ordersApi';

jest.mock('./ordersApi');

const mockOrders = [
    {
        id: 1,
        status: 'nuevo',
        client: { name: 'Lucas' },
        items: [{ piece_description: 'Engranaje', quantity: 1, weight_g: '45.00' }],
    },
    {
        id: 2,
        status: 'presupuestado',
        client: { name: 'Marta' },
        pricing: { informed_price: '5000.00' },
        items: [{ piece_description: 'Vaso', quantity: 1, weight_g: '80.00' }],
    },
    {
        id: 3,
        status: 'aprobado',
        client: { name: 'Julian' },
        items: [{ piece_description: 'Llavero', quantity: 3, weight_g: '30.00' }],
    },
    {
        id: 4,
        status: 'listo',
        client: { name: 'Carlos' },
        pricing: { informed_price: '8000.00' },
        items: [{ piece_description: 'Soporte', quantity: 1, weight_g: '50.00' }],
    },
];

describe('OrderBoard', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        ordersApi.listOrders.mockResolvedValue(mockOrders);
        ordersApi.listMaterials.mockResolvedValue([]);
    });

    test('renders kanban columns and distributes orders', async () => {
        renderAsSuperuser(<OrderBoard />);

        await waitFor(() => {
            expect(screen.getByText(/Engranaje/i)).toBeInTheDocument();
            expect(screen.getByText(/Vaso/i)).toBeInTheDocument();
            expect(screen.getByText(/Llavero/i)).toBeInTheDocument();
            expect(screen.getByText(/Soporte/i)).toBeInTheDocument();
        });

        expect(screen.getByText(/Por Cotizar/i)).toBeInTheDocument();
        expect(screen.getByText(/Presupuestados/i)).toBeInTheDocument();
        expect(screen.getByText(/En Cola \/ Aprobados/i)).toBeInTheDocument();
    });

    test('advancing approved order to printing calls startPrinting', async () => {
        ordersApi.startPrinting.mockResolvedValueOnce({ id: 3, status: 'imprimiendo' });

        renderAsSuperuser(<OrderBoard />);

        await waitFor(() => {
            expect(screen.getByText(/Llavero/i)).toBeInTheDocument();
        });

        const printBtn = screen.getByRole('button', { name: /Imprimir/i });
        fireEvent.click(printBtn);

        await waitFor(() => {
            expect(ordersApi.startPrinting).toHaveBeenCalledWith(3);
        });
    });

    test('can open quote modal from any card status (e.g. presupuestado)', async () => {
        ordersApi.getSettings.mockResolvedValue({
            labor_cost_per_hour: 650.0,
            default_labor_time_minutes: 15,
        });
        ordersApi.listPrinters.mockResolvedValue([]);

        renderAsSuperuser(<OrderBoard />);

        await waitFor(() => {
            expect(screen.getByText(/Vaso/i)).toBeInTheDocument();
        });

        const priceElement = screen.getByText(/\$5000.00/i);
        fireEvent.click(priceElement);

        await waitFor(() => {
            expect(screen.getByText(/Cotización \/ Recalcular Costos Pedido #2/i)).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /Actualizar Cotización/i })).toBeInTheDocument();
        });
    });

    test('delivering an order opens confirmation dialog and calls deliverOrder with collect_balance', async () => {
        ordersApi.deliverOrder.mockResolvedValueOnce({ id: 4, status: 'entregado' });

        renderAsSuperuser(<OrderBoard />);

        await waitFor(() => {
            expect(screen.getByText(/Soporte/i)).toBeInTheDocument();
        });

        const deliverBtn = screen.getByRole('button', { name: /Entregar/i });
        fireEvent.click(deliverBtn);

        expect(screen.getByText(/Confirmar Entrega — Pedido #4/i)).toBeInTheDocument();
        expect(screen.getByText(/Cobrar y asentar saldo pendiente en Caja Diaria/i)).toBeInTheDocument();

        const confirmBtn = screen.getByRole('button', { name: /Confirmar Entrega/i });
        fireEvent.click(confirmBtn);

        await waitFor(() => {
            expect(ordersApi.deliverOrder).toHaveBeenCalledWith(4, { collect_balance: true });
        });
    });

    test('clicking delete button opens confirmation dialog and confirms deletion', async () => {
        ordersApi.deleteOrder.mockResolvedValueOnce({ message: 'Pedido 1 eliminado correctamente.' });

        renderAsSuperuser(<OrderBoard />);

        await waitFor(() => {
            expect(screen.getByText(/Engranaje/i)).toBeInTheDocument();
        });

        // Click delete on order 1 (which is in 'nuevo' status)
        const deleteBtn = screen.getByTestId('delete-order-1');
        fireEvent.click(deleteBtn);

        // Confirmation dialog is displayed
        expect(screen.getByText(/Confirmar Eliminación de Pedido/i)).toBeInTheDocument();
        expect(screen.getByText(/¿Estás seguro de que deseas eliminar el pedido #1\?/i)).toBeInTheDocument();
        expect(screen.getAllByText(/Lucas/i).length).toBeGreaterThanOrEqual(2);
        expect(screen.getByText(/Esta acción es irreversible/i)).toBeInTheDocument();

        // Click confirm deletion button
        const confirmDeleteBtn = screen.getByTestId('confirm-delete-button');
        fireEvent.click(confirmDeleteBtn);

        await waitFor(() => {
            expect(ordersApi.deleteOrder).toHaveBeenCalledWith(1);
        });
        await waitFor(() => {
            expect(screen.queryByText(/Confirmar Eliminación de Pedido/i)).not.toBeInTheDocument();
        });
    });

    test('canceling deletion does not call deleteOrder', async () => {
        renderAsSuperuser(<OrderBoard />);

        await waitFor(() => {
            expect(screen.getByText(/Engranaje/i)).toBeInTheDocument();
        });

        const deleteBtn = screen.getByTestId('delete-order-1');
        fireEvent.click(deleteBtn);

        expect(screen.getByText(/Confirmar Eliminación de Pedido/i)).toBeInTheDocument();

        const cancelBtn = screen.getByRole('button', { name: /Cancelar/i });
        fireEvent.click(cancelBtn);

        expect(ordersApi.deleteOrder).not.toHaveBeenCalled();
    });
});
