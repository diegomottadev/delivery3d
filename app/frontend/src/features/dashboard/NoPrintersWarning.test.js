import { screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import NoPrintersWarning from './NoPrintersWarning';
import * as ordersApi from '../orders/ordersApi';
import { PERM } from '../security/permissions/perms';
import { renderWithPermissions, flushPromises, OPERATOR_PERMISSIONS } from '../security/permissions/permissionsTestUtils';

jest.mock('../orders/ordersApi');

const OPERATOR_TEXT =
    'Todavía no hay ninguna impresora configurada en el taller. Podés cargar pedidos, pero no vas a poder presupuestarlos hasta que se configure una. Avisale al administrador.';
const ADMIN_TEXT = 'Todavía no hay ninguna impresora configurada. Los operadores no pueden presupuestar pedidos hasta que des de alta una.';

const renderWarning = async (permissions) => {
    renderWithPermissions(
        <MemoryRouter initialEntries={['/']}>
            <Routes>
                <Route path="/" element={<NoPrintersWarning />} />
                <Route path="/settings" element={<h2>Configuración del taller</h2>} />
            </Routes>
        </MemoryRouter>,
        { permissions }
    );
    await flushPromises();
};

describe('NoPrintersWarning (aviso de taller sin impresoras)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('rol Operador sin impresoras activas: aviso amarillo con el texto para operadores y sin botón', async () => {
        ordersApi.listPrinters.mockResolvedValue([]);
        await renderWarning(OPERATOR_PERMISSIONS);
        const warning = screen.getByTestId('no-printers-warning');
        expect(warning).toHaveTextContent(OPERATOR_TEXT);
        expect(screen.getByText(OPERATOR_TEXT)).toHaveClass('p-inline-message-text');
        expect(screen.queryByRole('button', { name: /Configurar impresora/i })).not.toBeInTheDocument();
        expect(ordersApi.listPrinters).toHaveBeenCalledWith(false);
    });

    test('es un aviso de severidad warn (amarillo)', async () => {
        ordersApi.listPrinters.mockResolvedValue([]);
        await renderWarning(OPERATOR_PERMISSIONS);
        expect(screen.getByRole('alert')).toHaveClass('p-inline-message-warn');
    });

    test('con printers:create: texto para administradores y botón que navega a /settings', async () => {
        ordersApi.listPrinters.mockResolvedValue([]);
        await renderWarning([...OPERATOR_PERMISSIONS, PERM.PRINTERS_CREATE]);
        expect(screen.getByTestId('no-printers-warning')).toHaveTextContent(ADMIN_TEXT);
        fireEvent.click(screen.getByRole('button', { name: /Configurar impresora/i }));
        expect(screen.getByRole('heading', { name: 'Configuración del taller' })).toBeInTheDocument();
    });

    test('con al menos una impresora activa no muestra el aviso', async () => {
        ordersApi.listPrinters.mockResolvedValue([{ id: 1, name: 'Bambu A1', is_active: true }]);
        await renderWarning([...OPERATOR_PERMISSIONS, PERM.PRINTERS_CREATE]);
        expect(screen.queryByTestId('no-printers-warning')).not.toBeInTheDocument();
    });

    test('sin printers:read no muestra nada ni pide impresoras', async () => {
        ordersApi.listPrinters.mockResolvedValue([]);
        await renderWarning([PERM.ORDERS_READ, PERM.CASH_MOVEMENTS_READ]);
        expect(screen.queryByTestId('no-printers-warning')).not.toBeInTheDocument();
        expect(ordersApi.listPrinters).not.toHaveBeenCalled();
    });

    test('si falla la carga de impresoras no muestra el aviso', async () => {
        ordersApi.listPrinters.mockRejectedValue(Object.assign(new Error('Network Error'), { request: {} }));
        await renderWarning(OPERATOR_PERMISSIONS);
        expect(screen.queryByTestId('no-printers-warning')).not.toBeInTheDocument();
    });

    test('respuesta inesperada (no es una lista) no muestra el aviso', async () => {
        ordersApi.listPrinters.mockResolvedValue(undefined);
        await renderWarning(OPERATOR_PERMISSIONS);
        expect(screen.queryByTestId('no-printers-warning')).not.toBeInTheDocument();
    });
});
