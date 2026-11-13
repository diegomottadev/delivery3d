import axios from 'axios';
import {
    listOrders,
    getOrder,
    createOrder,
    updateOrder,
    listMaterials,
    calculateQuote,
    confirmQuote,
    approveOrder,
    startPrinting,
    markReady,
    deliverOrder,
    getOrderHistory,
} from './ordersApi';

jest.mock('axios');

describe('ordersApi', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    test('listOrders calls GET /api/orders', async () => {
        const mockData = [{ id: 1, status: 'nuevo' }];
        axios.get.mockResolvedValueOnce({ data: mockData });

        const result = await listOrders();
        expect(axios.get).toHaveBeenCalledWith('/api/orders', expect.any(Object));
        expect(result).toEqual(mockData);
    });

    test('getOrder calls GET /api/orders/:id', async () => {
        const mockData = { id: 1, status: 'nuevo' };
        axios.get.mockResolvedValueOnce({ data: mockData });

        const result = await getOrder(1);
        expect(axios.get).toHaveBeenCalledWith('/api/orders/1', expect.any(Object));
        expect(result).toEqual(mockData);
    });

    test('createOrder calls POST /api/orders with payload', async () => {
        const payload = {
            client: { name: 'Mario', origin: 'whatsapp' },
            items: [{ material_id: 1, piece_description: 'pieza', weight_g: 50, print_time_minutes: 60, quantity: 1 }],
        };
        const mockResponse = { id: 1, ...payload, status: 'nuevo' };
        axios.post.mockResolvedValueOnce({ data: mockResponse });

        const result = await createOrder(payload);
        expect(axios.post).toHaveBeenCalledWith('/api/orders', payload, expect.any(Object));
        expect(result).toEqual(mockResponse);
    });

    test('updateOrder calls PUT /api/orders/:id with payload', async () => {
        const payload = {
            client: { name: 'Mario Editado', origin: 'whatsapp' },
            items: [{ filament_id: 1, piece_description: 'pieza mod', weight_g: 60, print_time_minutes: 90, quantity: 2 }],
        };
        const mockResponse = { id: 1, ...payload, status: 'aprobado' };
        axios.put.mockResolvedValueOnce({ data: mockResponse });

        const result = await updateOrder(1, payload);
        expect(axios.put).toHaveBeenCalledWith('/api/orders/1', payload, expect.any(Object));
        expect(result).toEqual(mockResponse);
    });

    test('listMaterials calls GET /api/materials', async () => {
        const mockMaterials = [{ id: 1, brand: 'eSun', color: 'Blanco' }];
        axios.get.mockResolvedValueOnce({ data: mockMaterials });

        const result = await listMaterials();
        expect(axios.get).toHaveBeenCalledWith('/api/materials', expect.any(Object));
        expect(result).toEqual(mockMaterials);
    });

    test('calculateQuote calls POST /api/orders/:id/quote', async () => {
        const quoteVars = { labor_cost: 1500 };
        const mockResponse = { production_cost: '4881.00' };
        axios.post.mockResolvedValueOnce({ data: mockResponse });

        const result = await calculateQuote(1, quoteVars);
        expect(axios.post).toHaveBeenCalledWith('/api/orders/1/quote', { quote_vars: quoteVars }, expect.any(Object));
        expect(result).toEqual(mockResponse);
    });

    test('confirmQuote calls POST /api/orders/:id/quote/confirm', async () => {
        const mockResponse = { status: 'presupuestado' };
        axios.post.mockResolvedValueOnce({ data: mockResponse });

        const result = await confirmQuote(1, 6800.0);
        expect(axios.post).toHaveBeenCalledWith('/api/orders/1/quote/confirm', { informed_price: 6800.0 }, expect.any(Object));
        expect(result).toEqual(mockResponse);
    });

    test('approveOrder calls POST /api/orders/:id/approve with optional deposit', async () => {
        const mockResponse = { status: 'aprobado' };
        axios.post.mockResolvedValueOnce({ data: mockResponse });

        const result = await approveOrder(1, 1500.0);
        expect(axios.post).toHaveBeenCalledWith('/api/orders/1/approve', { deposit_amount: 1500.0 }, expect.any(Object));
        expect(result).toEqual(mockResponse);
    });

    test('startPrinting calls POST /api/orders/:id/start-printing', async () => {
        const mockResponse = { status: 'imprimiendo' };
        axios.post.mockResolvedValueOnce({ data: mockResponse });

        const result = await startPrinting(1);
        expect(axios.post).toHaveBeenCalledWith('/api/orders/1/start-printing', {}, expect.any(Object));
        expect(result).toEqual(mockResponse);
    });

    test('markReady calls POST /api/orders/:id/mark-ready', async () => {
        const mockResponse = { status: 'listo' };
        axios.post.mockResolvedValueOnce({ data: mockResponse });

        const result = await markReady(1);
        expect(axios.post).toHaveBeenCalledWith('/api/orders/1/mark-ready', {}, expect.any(Object));
        expect(result).toEqual(mockResponse);
    });

    test('deliverOrder calls POST /api/orders/:id/deliver', async () => {
        const mockResponse = { status: 'entregado' };
        axios.post.mockResolvedValueOnce({ data: mockResponse });

        const result = await deliverOrder(1);
        expect(axios.post).toHaveBeenCalledWith('/api/orders/1/deliver', {}, expect.any(Object));
        expect(result).toEqual(mockResponse);
    });

    test('getOrderHistory calls GET /api/orders/:id/history', async () => {
        const mockResponse = { id: 1, status: 'listo', status_history: [] };
        axios.get.mockResolvedValueOnce({ data: mockResponse });

        const result = await getOrderHistory(1);
        expect(axios.get).toHaveBeenCalledWith('/api/orders/1/history', expect.any(Object));
        expect(result).toEqual(mockResponse);
    });
});
