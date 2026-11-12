import { screen, fireEvent } from '@testing-library/react';
import CashboxSettingsView from './CashboxSettingsView';
import * as cashboxApi from './cashboxApi';
import { PERM } from '../security/permissions/perms';
import { renderWithPermissions, flushPromises, OPERATOR_PERMISSIONS } from '../security/permissions/permissionsTestUtils';

jest.mock('./cashboxApi');

const INCOME = [{ id: 1, code: 'seña', name: 'Seña / Anticipo', is_system: true, is_active: true }];
const EXPENSE = [{ id: 2, code: 'filamento', name: 'Filamento', is_system: false, is_active: true }];

const renderView = async (permissions) => {
    renderWithPermissions(<CashboxSettingsView />, { permissions });
    await screen.findByText('Seña / Anticipo');
    await flushPromises();
};

describe('CashboxSettingsView: acciones según permisos', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        cashboxApi.getCashIncomeCategories.mockResolvedValue(INCOME);
        cashboxApi.getCashExpenseCategories.mockResolvedValue(EXPENSE);
    });

    test('rol Operador (solo lectura de categorías): sin alta ni edición', async () => {
        await renderView(OPERATOR_PERMISSIONS);
        expect(screen.queryByRole('button', { name: /Nueva Forma de Ingreso/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Nueva Forma de Egreso/i })).not.toBeInTheDocument();
        expect(screen.queryByTestId('edit-category-income-1')).not.toBeInTheDocument();
    });

    test('cash_categories:create habilita las altas; cash_categories:update la edición', async () => {
        await renderView([PERM.CASH_CATEGORIES_READ, PERM.CASH_CATEGORIES_CREATE]);
        expect(screen.getByRole('button', { name: /Nueva Forma de Ingreso/i })).toBeInTheDocument();
        expect(screen.queryByTestId('edit-category-income-1')).not.toBeInTheDocument();
        // La pestaña de egresos se monta al activarla.
        fireEvent.click(screen.getByText('Formas de Egreso'));
        expect(await screen.findByRole('button', { name: /Nueva Forma de Egreso/i })).toBeInTheDocument();
    });

    test('cash_categories:update muestra la edición de categorías', async () => {
        await renderView([PERM.CASH_CATEGORIES_READ, PERM.CASH_CATEGORIES_UPDATE]);
        expect(screen.getByTestId('edit-category-income-1')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Nueva Forma de Ingreso/i })).not.toBeInTheDocument();
    });
});
