import { screen } from '@testing-library/react';
import WorkshopSettingsView from './WorkshopSettingsView';
import * as ordersApi from '../orders/ordersApi';
import { PERM } from '../security/permissions/perms';
import { renderWithPermissions, flushPromises, OPERATOR_PERMISSIONS } from '../security/permissions/permissionsTestUtils';

jest.mock('../orders/ordersApi');

const renderView = async (permissions) => {
    renderWithPermissions(<WorkshopSettingsView />, { permissions });
    await screen.findByText('Bambu Lab A1');
    await flushPromises();
};

describe('WorkshopSettingsView: acciones según permisos', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        ordersApi.getSettings.mockResolvedValue({ id: 1, kwh_cost: 278, waste_purge_pct: 10, profit_multiplier: 2, default_printer_id: 1 });
        ordersApi.listPrinters.mockResolvedValue([{ id: 1, name: 'Bambu Lab A1', model: 'A1', power_watts: 120, cost_per_hour: 100, is_active: true }]);
    });

    test('rol Operador: configuración de solo lectura y sin gestión de impresoras', async () => {
        await renderView(OPERATOR_PERMISSIONS);
        expect(screen.queryByRole('button', { name: /Guardar Constantes/i })).not.toBeInTheDocument();
        expect(screen.getByLabelText(/Costo kWh/i)).toBeDisabled();
        expect(screen.getByTestId('settings-readonly')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Nueva Impresora/i })).not.toBeInTheDocument();
        expect(screen.queryByTestId('edit-printer-1')).not.toBeInTheDocument();
    });

    test('settings:update habilita la edición y el guardado de la configuración', async () => {
        await renderView([PERM.SETTINGS_READ, PERM.PRINTERS_READ, PERM.SETTINGS_UPDATE]);
        expect(screen.getByRole('button', { name: /Guardar Constantes/i })).toBeInTheDocument();
        expect(screen.getByLabelText(/Costo kWh/i)).toBeEnabled();
        expect(screen.queryByTestId('settings-readonly')).not.toBeInTheDocument();
    });

    test('printers:create habilita el alta; printers:update la edición', async () => {
        await renderView([PERM.SETTINGS_READ, PERM.PRINTERS_READ, PERM.PRINTERS_CREATE]);
        expect(screen.getByRole('button', { name: /Nueva Impresora/i })).toBeInTheDocument();
        expect(screen.queryByTestId('edit-printer-1')).not.toBeInTheDocument();
    });

    test('printers:update muestra la edición de impresoras', async () => {
        await renderView([PERM.SETTINGS_READ, PERM.PRINTERS_READ, PERM.PRINTERS_UPDATE]);
        expect(screen.getByTestId('edit-printer-1')).toBeInTheDocument();
    });
});
