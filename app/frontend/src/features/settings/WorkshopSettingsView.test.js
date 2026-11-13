import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import { renderAsSuperuser } from '../security/permissions/permissionsTestUtils';
import WorkshopSettingsView from './WorkshopSettingsView';
import * as ordersApi from '../orders/ordersApi';

jest.mock('../orders/ordersApi');

describe('WorkshopSettingsView', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        ordersApi.getSettings.mockResolvedValue({
            id: 1,
            kwh_cost: 278.0,
            waste_purge_pct: 10.0,
            labor_cost: 1500.0,
            profit_multiplier: 2,
            default_printer_id: 1,
        });
        ordersApi.listPrinters.mockResolvedValue([
            {
                id: 1,
                name: 'Bambu Lab A1',
                model: 'A1',
                power_watts: 120.0,
                cost_per_hour: 100.0,
                is_active: true,
            },
        ]);
    });

    test('renders settings, currency section and printers tables', async () => {
        renderAsSuperuser(<WorkshopSettingsView />);

        expect(screen.getByText(/Valores Constantes del Taller/i)).toBeInTheDocument();
        expect(screen.getByText(/Moneda del Taller/i)).toBeInTheDocument();
        expect(screen.getByText(/Impresoras del Taller/i)).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.getByText('Bambu Lab A1')).toBeInTheDocument();
        });
    });

    test('saves settings with currency configuration', async () => {
        ordersApi.updateSettings.mockResolvedValueOnce({
            id: 1,
            kwh_cost: 278.0,
            waste_purge_pct: 10.0,
            labor_cost: 1500.0,
            labor_cost_per_hour: 650.0,
            default_labor_time_minutes: 15,
            profit_multiplier: 2,
            currency_code: 'USD',
            currency_symbol: 'US$',
            default_printer_id: 1,
        });

        const { fireEvent } = require('@testing-library/react');
        renderAsSuperuser(<WorkshopSettingsView />);

        await waitFor(() => {
            expect(screen.getByText('Bambu Lab A1')).toBeInTheDocument();
        });

        const saveBtn = screen.getByRole('button', { name: /Guardar Constantes/i });
        fireEvent.click(saveBtn);

        await waitFor(() => {
            expect(ordersApi.updateSettings).toHaveBeenCalled();
        });
    });
});
