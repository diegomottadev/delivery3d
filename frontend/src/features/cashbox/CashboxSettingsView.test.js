import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderAsSuperuser } from '../security/permissions/permissionsTestUtils';
import CashboxSettingsView from './CashboxSettingsView';
import * as cashboxApi from './cashboxApi';

jest.mock('./cashboxApi');

const mockIncomeCategories = [
    {
        id: 1,
        code: 'seña',
        name: 'Seña / Anticipo',
        description: 'Pago inicial',
        is_system: true,
        is_active: true,
    },
    {
        id: 2,
        code: 'extraordinario',
        name: 'Ingreso Extraordinario',
        description: 'Ventas fuera de circuito',
        is_system: false,
        is_active: true,
    },
];

const mockExpenseCategories = [
    {
        id: 1,
        code: 'filamento',
        name: 'Filamento',
        description: 'Bobinas de filamento',
        is_system: false,
        is_active: true,
    },
    {
        id: 2,
        code: 'mantenimiento',
        name: 'Mantenimiento',
        description: 'Lubricación y limpieza',
        is_system: false,
        is_active: true,
    },
];

describe('CashboxSettingsView', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        cashboxApi.getCashIncomeCategories.mockResolvedValue(mockIncomeCategories);
        cashboxApi.getCashExpenseCategories.mockResolvedValue(mockExpenseCategories);
    });

    test('renders tabs and lists income and expense categories', async () => {
        renderAsSuperuser(<CashboxSettingsView />);

        expect(screen.getByText(/Configuración de Caja — Formas y Categorías/i)).toBeInTheDocument();
        expect(screen.getByText('Formas de Ingreso')).toBeInTheDocument();
        expect(screen.getByText('Formas de Egreso')).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.getByText('Seña / Anticipo')).toBeInTheDocument();
            expect(screen.getByText('Ingreso Extraordinario')).toBeInTheDocument();
        });
    });

    test('opens create income category modal and submits', async () => {
        cashboxApi.createCashIncomeCategory.mockResolvedValue({ id: 3, code: 'capacitacion', name: 'Capacitaciones' });

        renderAsSuperuser(<CashboxSettingsView />);

        await waitFor(() => {
            expect(screen.getByText('Seña / Anticipo')).toBeInTheDocument();
        });

        const newBtn = screen.getByRole('button', { name: /Nueva Forma de Ingreso/i });
        fireEvent.click(newBtn);

        expect(screen.getByRole('dialog')).toBeInTheDocument();

        const nameInput = screen.getByPlaceholderText(/Clases de Modelado 3D/i);
        fireEvent.change(nameInput, { target: { value: 'Capacitaciones' } });

        const codeInput = screen.getByPlaceholderText(/clases_modelado/i);
        fireEvent.change(codeInput, { target: { value: 'capacitacion' } });

        const saveBtn = screen.getByRole('button', { name: /Guardar/i });
        fireEvent.click(saveBtn);

        await waitFor(() => {
            expect(cashboxApi.createCashIncomeCategory).toHaveBeenCalledWith(
                expect.objectContaining({
                    code: 'capacitacion',
                    name: 'Capacitaciones',
                })
            );
        });
    });

    test('opens edit modal and submits updates', async () => {
        cashboxApi.updateCashIncomeCategory.mockResolvedValue({ id: 2, name: 'Extraordinario Modificado' });

        renderAsSuperuser(<CashboxSettingsView />);

        await waitFor(() => {
            expect(screen.getByText('Ingreso Extraordinario')).toBeInTheDocument();
        });

        const editButtons = screen.getAllByRole('button', { name: '' });
        // The edit buttons are rendered with icon pi pi-pencil
        fireEvent.click(editButtons[0]);

        await waitFor(() => {
            expect(screen.getByText(/Editar Categoría/i)).toBeInTheDocument();
        });

        const saveChangesBtn = screen.getByRole('button', { name: /Guardar Cambios/i });
        fireEvent.click(saveChangesBtn);

        await waitFor(() => {
            expect(cashboxApi.updateCashIncomeCategory).toHaveBeenCalled();
        });
    });
});
