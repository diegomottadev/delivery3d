import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmImpactDialog } from './ConfirmImpactDialog';

const IMPACT = {
    affected_users_count: 4,
    users_losing_permissions_count: 2,
    affected_users: [
        { id: 7, username: 'ana', lost_permissions: ['orders:update'] },
        { id: 9, username: 'beto', lost_permissions: [] },
    ],
    removes_own_rbac_manage: false,
};

const renderDialog = (props = {}) => {
    const onConfirm = jest.fn();
    const onHide = jest.fn();
    render(
        <ConfirmImpactDialog
            visible
            header="Quitar rol del grupo"
            message="¿Quitar el rol Operador del grupo Operadores?"
            confirmLabel="Quitar rol"
            impact={IMPACT}
            onConfirm={onConfirm}
            onHide={onHide}
            {...props}
        />
    );
    return { onConfirm, onHide };
};

describe('<ConfirmImpactDialog>', () => {
    test('muestra el mensaje y los dos números de impacto', () => {
        renderDialog();
        expect(screen.getByText('¿Quitar el rol Operador del grupo Operadores?')).toBeInTheDocument();
        expect(screen.getByTestId('impact-affected-count')).toHaveTextContent('4');
        expect(screen.getByTestId('impact-losing-count')).toHaveTextContent('2');
    });

    test('lista solo los usuarios que pierden permisos, con lo que pierden (descripción si se provee)', () => {
        renderDialog({ describePermission: (code) => (code === 'orders:update' ? 'Editar pedidos' : code) });
        expect(screen.getByText('ana')).toBeInTheDocument();
        expect(screen.getByText(/Editar pedidos/)).toBeInTheDocument();
        expect(screen.queryByText('beto')).not.toBeInTheDocument();
    });

    test('usa la descripción de lost_permissions_detail cuando el backend la manda', () => {
        renderDialog({
            impact: {
                ...IMPACT,
                affected_users: [
                    {
                        id: 7,
                        username: 'ana',
                        lost_permissions: ['orders:update'],
                        lost_permissions_detail: [{ code: 'orders:update', description: 'Editar pedidos y cambiar su estado' }],
                    },
                ],
            },
        });
        expect(screen.getByText(/Editar pedidos y cambiar su estado/)).toBeInTheDocument();
        expect(screen.queryByText(/orders:update/)).not.toBeInTheDocument();
    });

    test('confirmar llama a onConfirm; cancelar llama a onHide', () => {
        const { onConfirm, onHide } = renderDialog();
        fireEvent.click(screen.getByRole('button', { name: 'Quitar rol' }));
        expect(onConfirm).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
        expect(onHide).toHaveBeenCalledTimes(1);
    });

    test('mientras se calcula el impacto no se puede confirmar', () => {
        renderDialog({ impact: null, impactLoading: true });
        expect(screen.getByTestId('impact-loading')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Quitar rol' })).toBeDisabled();
    });

    test('si falla el cálculo del impacto muestra el error y no permite confirmar', () => {
        renderDialog({ impact: null, impactError: 'No se pudo calcular el impacto' });
        expect(screen.getByText('No se pudo calcular el impacto')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Quitar rol' })).toBeDisabled();
    });

    test('removes_own_rbac_manage → explica el auto-bloqueo y deshabilita confirmar', () => {
        renderDialog({ impact: { ...IMPACT, removes_own_rbac_manage: true } });
        expect(screen.getByTestId('impact-blocked')).toHaveTextContent(/No podés quitarte a vos mismo/i);
        expect(screen.getByRole('button', { name: 'Quitar rol' })).toBeDisabled();
    });

    test('blockedReason genérico (ej. SELF_ASSIGNMENT) deshabilita confirmar y muestra el motivo', () => {
        renderDialog({ blockedReason: 'No podés asignarte roles a vos mismo.' });
        expect(screen.getByTestId('impact-blocked')).toHaveTextContent('No podés asignarte roles a vos mismo.');
        expect(screen.getByRole('button', { name: 'Quitar rol' })).toBeDisabled();
    });

    test('mientras confirma, el botón queda deshabilitado (evita doble envío)', () => {
        renderDialog({ confirming: true });
        expect(screen.getByRole('button', { name: /Quitar rol/ })).toBeDisabled();
    });
});
