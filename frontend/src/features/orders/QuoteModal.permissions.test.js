import { screen, fireEvent, waitFor } from '@testing-library/react';
import QuoteModal from './QuoteModal';
import * as ordersApi from './ordersApi';
import { PERM } from '../security/permissions/perms';
import { renderWithPermissions, OPERATOR_PERMISSIONS } from '../security/permissions/permissionsTestUtils';

jest.mock('./ordersApi');

const SETTINGS = {
    kwh_cost: 278,
    waste_purge_pct: 10,
    labor_cost_per_hour: 650,
    default_labor_time_minutes: 15,
    profit_multiplier: 2,
    default_printer_id: 1,
};

const PRINTERS = [
    { id: 1, name: 'Bambu A1', power_watts: 120, cost_per_hour: 100 },
    { id: 2, name: 'Prusa MK4', power_watts: 200, cost_per_hour: 150 },
];

// Pedido ya cotizado con valores propios (distintos de los del taller).
const ORDER = {
    id: 10,
    status: 'presupuestado',
    client: { name: 'Maria' },
    items: [{ id: 1, piece_description: 'Soporte', weight_g: 120, print_time_minutes: 60, quantity: 1 }],
    quote: {
        printer_id: 2,
        waste_purge_pct: 25,
        machine_power_watts: 999,
        kwh_cost: 999,
        machine_cost_per_hour: 999,
        labor_cost_per_hour: 999,
        labor_time_minutes: 30,
        profit_multiplier: 4,
    },
    pricing: { production_cost: '1000.00', suggested_sale_price: '4000.00', informed_price: '4200.00' },
};

const COST_FIELDS = [/Merma \/ Purga/i, /Potencia A1/i, /Costo kWh/i, /Amortización \/ Hora/i, /Tarifa Mano de Obra/i];

const renderModal = async (permissions) => {
    renderWithPermissions(<QuoteModal visible order={ORDER} onHide={() => {}} onQuoteConfirmed={() => {}} />, { permissions });
    await waitFor(() => expect(ordersApi.getSettings).toHaveBeenCalled());
    await screen.findByDisplayValue(/4\.?200/);
};

describe('QuoteModal: opción B (sin settings:update no se tocan costos ni margen)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        ordersApi.getSettings.mockResolvedValue(SETTINGS);
        ordersApi.listPrinters.mockResolvedValue(PRINTERS);
    });

    test('rol Operador: costos y margen de solo lectura, con explicación', async () => {
        await renderModal(OPERATOR_PERMISSIONS);
        COST_FIELDS.forEach((label) => expect(screen.getByLabelText(label)).toBeDisabled());
        expect(screen.getByTestId('quote-costs-readonly')).toHaveTextContent(/configuración del taller/i);
    });

    test('rol Operador: los costos y el margen muestran los valores del taller y de la impresora, no los guardados en el pedido', async () => {
        await renderModal(OPERATOR_PERMISSIONS);
        // Potencia de la impresora del pedido (Prusa, 200 W), no la guardada en la cotización (999 W).
        await waitFor(() => expect(screen.getByLabelText(/Potencia A1/i)).toHaveValue('200 W'));
        expect(screen.getByLabelText(/Merma \/ Purga/i)).toHaveValue('10%');
        expect(screen.getByRole('button', { name: 'x2' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('button', { name: 'x4' })).toHaveAttribute('aria-pressed', 'false');
    });

    test('rol Operador: el margen no cambia al hacer clic', async () => {
        await renderModal(OPERATOR_PERMISSIONS);
        fireEvent.click(screen.getByRole('button', { name: 'x3' }));
        expect(screen.getByRole('button', { name: 'x3' })).toHaveAttribute('aria-pressed', 'false');
    });

    test('rol Operador: impresora, tiempo de mano de obra y precio informado siguen editables', async () => {
        await renderModal(OPERATOR_PERMISSIONS);
        expect(screen.getByDisplayValue(/4\.?200/)).toBeEnabled();
        expect(screen.getByLabelText('Horas')).toBeEnabled();
        expect(screen.getByLabelText(/Minutos/i)).toBeEnabled();
        expect(screen.getByTestId('quote-printer-select')).not.toHaveClass('p-disabled');
    });

    test('con settings:update los costos y el margen son editables y usan lo guardado en el pedido', async () => {
        await renderModal([...OPERATOR_PERMISSIONS, PERM.SETTINGS_UPDATE]);
        COST_FIELDS.forEach((label) => expect(screen.getByLabelText(label)).toBeEnabled());
        expect(screen.queryByTestId('quote-costs-readonly')).not.toBeInTheDocument();
        await waitFor(() => expect(screen.getByLabelText(/Merma \/ Purga/i)).toHaveValue('25%'));
        expect(screen.getByLabelText(/Potencia A1/i)).toHaveValue('999 W');
        expect(screen.getByRole('button', { name: 'x4' })).toHaveAttribute('aria-pressed', 'true');
    });
});
