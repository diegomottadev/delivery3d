import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import AppBreadcrumb from './AppBreadcrumb';

const Where = () => <span data-testid="location">{useLocation().pathname}</span>;

const renderAt = (path, meta) =>
    render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route path="*" element={<AppBreadcrumb meta={meta} />} />
            </Routes>
            <Where />
        </MemoryRouter>
    );

describe('AppBreadcrumb', () => {
    test('ruta de detalle: muestra el listado como link y el detalle como texto', () => {
        renderAt('/seguridad/usuarios/7', { label: 'Detalle de usuario', backLabel: 'Usuarios', backPath: '/seguridad/usuarios' });
        expect(screen.getByText('Detalle de usuario')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Usuarios' }));
        expect(screen.getByTestId('location')).toHaveTextContent('/seguridad/usuarios');
    });

    test('ruta simple: solo el label', () => {
        renderAt('/seguridad/roles', { label: 'Roles' });
        expect(screen.getByText('Roles')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Usuarios' })).not.toBeInTheDocument();
    });
});
