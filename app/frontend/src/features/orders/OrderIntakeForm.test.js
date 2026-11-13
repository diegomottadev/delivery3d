import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import OrderIntakeForm from './OrderIntakeForm';
import * as ordersApi from './ordersApi';

jest.mock('./ordersApi');

const mockFilaments = [
    { id: 1, name: 'PLA' },
    { id: 2, name: 'PETG' },
];

describe('OrderIntakeForm', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        ordersApi.listFilaments.mockResolvedValue(mockFilaments);
    });

    test('renders client and items input fields', async () => {
        render(<OrderIntakeForm visible={true} onHide={() => {}} onOrderCreated={() => {}} />);

        expect(screen.getByLabelText(/Nombre del cliente/i)).toBeInTheDocument();
        expect(screen.getByText(/Alta Manual de Pedido/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Descripción de la pieza/i)).toBeInTheDocument();
    });

    test('can submit a new order successfully with filament_id', async () => {
        const onOrderCreated = jest.fn();
        ordersApi.createOrder.mockResolvedValueOnce({ id: 99, status: 'nuevo' });

        render(<OrderIntakeForm visible={true} onHide={() => {}} onOrderCreated={onOrderCreated} />);

        // Fill client
        fireEvent.change(screen.getByLabelText(/Nombre del cliente/i), { target: { value: 'Carlos Gomez' } });

        // Fill piece description
        fireEvent.change(screen.getByLabelText(/Descripción de la pieza/i), { target: { value: 'Soporte Auricular' } });

        // Submit button
        const submitBtn = screen.getByRole('button', { name: /Guardar Pedido/i });
        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(ordersApi.createOrder).toHaveBeenCalledTimes(1);
            const payload = ordersApi.createOrder.mock.calls[0][0];
            expect(payload.items[0].filament_id).toBe(1);
            expect(onOrderCreated).toHaveBeenCalledWith(expect.objectContaining({ id: 99 }));
        });
    });

    test('renders filament cost input and sends custom material_cost_per_kg', async () => {
        const onOrderCreated = jest.fn();
        ordersApi.createOrder.mockResolvedValueOnce({ id: 100, status: 'nuevo' });

        render(<OrderIntakeForm visible={true} onHide={() => {}} onOrderCreated={onOrderCreated} />);

        expect(screen.getByLabelText(/Costo Filamento/i)).toBeInTheDocument();

        // Fill client
        fireEvent.change(screen.getByLabelText(/Nombre del cliente/i), { target: { value: 'Lucia Diaz' } });

        // Fill piece description
        fireEvent.change(screen.getByLabelText(/Descripción de la pieza/i), { target: { value: 'Engranaje' } });

        // Submit button
        const submitBtn = screen.getByRole('button', { name: /Guardar Pedido/i });
        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(ordersApi.createOrder).toHaveBeenCalledTimes(1);
            const callArg = ordersApi.createOrder.mock.calls[0][0];
            expect(callArg.items[0]).toHaveProperty('material_cost_per_kg');
            expect(callArg.items[0].material_cost_per_kg).toBeGreaterThan(0);
            expect(callArg.items[0].filament_id).toBe(1);
        });
    });

    test('renders separate hours and minutes inputs and computes print_time_minutes', async () => {
        const onOrderCreated = jest.fn();
        ordersApi.createOrder.mockResolvedValueOnce({ id: 101, status: 'nuevo' });

        render(<OrderIntakeForm visible={true} onHide={() => {}} onOrderCreated={onOrderCreated} />);

        expect(screen.getByLabelText(/Horas \(h\)/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Minutos \(min\)/i)).toBeInTheDocument();

        // Fill client
        fireEvent.change(screen.getByLabelText(/Nombre del cliente/i), { target: { value: 'Lucas V' } });

        // Fill piece description
        fireEvent.change(screen.getByLabelText(/Descripción de la pieza/i), { target: { value: 'Clip' } });

        // Submit button
        const submitBtn = screen.getByRole('button', { name: /Guardar Pedido/i });
        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(ordersApi.createOrder).toHaveBeenCalledTimes(1);
            const callArg = ordersApi.createOrder.mock.calls[0][0];
            expect(callArg.items[0].print_time_minutes).toBe(60);
        });
    });

    test('allows entering up to 3 decimal places for weight_g', async () => {
        const onOrderCreated = jest.fn();
        ordersApi.createOrder.mockResolvedValueOnce({ id: 102, status: 'nuevo' });

        render(<OrderIntakeForm visible={true} onHide={() => {}} onOrderCreated={onOrderCreated} />);

        // Fill client
        fireEvent.change(screen.getByLabelText(/Nombre del cliente/i), { target: { value: 'Lucas V' } });

        // Fill piece description
        fireEvent.change(screen.getByLabelText(/Descripción de la pieza/i), { target: { value: 'Clip' } });

        // Fill weight with 3 decimals
        const weightInput = screen.getByLabelText(/Peso \(g\) \*/i);
        fireEvent.change(weightInput, { target: { value: '12,345' } });
        fireEvent.blur(weightInput);

        // Submit button
        const submitBtn = screen.getByRole('button', { name: /Guardar Pedido/i });
        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(ordersApi.createOrder).toHaveBeenCalledTimes(1);
            const callArg = ordersApi.createOrder.mock.calls[0][0];
            expect(callArg.items[0].weight_g).toBe(12.345);
        });
    });

    test('intercepts dot key and maps it to comma in weight_g', async () => {
        render(<OrderIntakeForm visible={true} onHide={() => {}} onOrderCreated={() => {}} />);

        const weightInput = screen.getByLabelText(/Peso \(g\) \*/i);
        fireEvent.focus(weightInput);

        const dispatchSpy = jest.spyOn(weightInput, 'dispatchEvent');
        fireEvent.keyDown(weightInput, { key: '.', code: 'Period' });

        expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ key: ',' }));
    });

    test('pre-fills data and calls updateOrder when editing an order in any step', async () => {
        const onOrderUpdated = jest.fn();
        const orderToEdit = {
            id: 42,
            status: 'imprimiendo',
            client: {
                name: 'Valeria Rossi',
                origin: 'instagram_dm',
                phone: '+54 9 11 1234-5678',
                instagram_username: '@valeria3d',
                notes: 'Color azul brillante',
            },
            items: [
                {
                    filament_id: 2,
                    material_cost_per_kg: '22000.00',
                    piece_description: 'Figura Coleccionable',
                    reference_url: 'https://makerworld.com/figura',
                    weight_g: '120.00',
                    print_time_minutes: 150, // 2h 30m
                    quantity: 2,
                },
            ],
        };

        ordersApi.updateOrder.mockResolvedValueOnce({ ...orderToEdit, status: 'imprimiendo' });

        render(
            <OrderIntakeForm
                visible={true}
                orderToEdit={orderToEdit}
                onHide={() => {}}
                onOrderUpdated={onOrderUpdated}
            />
        );

        // Header shows edit title
        expect(screen.getByText(/Editar Pedido #42/i)).toBeInTheDocument();

        // Client name input is prefilled
        const clientInput = screen.getByLabelText(/Nombre del cliente/i);
        expect(clientInput.value).toBe('Valeria Rossi');

        // Piece description input is prefilled
        const pieceInput = screen.getByLabelText(/Descripción de la pieza/i);
        expect(pieceInput.value).toBe('Figura Coleccionable');

        // Edit client name
        fireEvent.change(clientInput, { target: { value: 'Valeria Rossi Modificada' } });

        // Submit edit
        const submitBtn = screen.getByRole('button', { name: /Guardar Cambios/i });
        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(ordersApi.updateOrder).toHaveBeenCalledTimes(1);
            expect(ordersApi.updateOrder).toHaveBeenCalledWith(
                42,
                expect.objectContaining({
                    client: expect.objectContaining({ name: 'Valeria Rossi Modificada' }),
                    items: expect.arrayContaining([
                        expect.objectContaining({
                            piece_description: 'Figura Coleccionable',
                            print_time_minutes: 150,
                            quantity: 2,
                        }),
                    ]),
                })
            );
            expect(onOrderUpdated).toHaveBeenCalledTimes(1);
        });
    });
});
