import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import AppBreadcrumb from './AppBreadcrumb';
import { DetailBreadcrumbProvider, useDetailBreadcrumbLabel } from './navigation/DetailBreadcrumbContext';

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

    test('ruta de detalle: usa el nombre que publica la pantalla de detalle', () => {
        const Detail = () => {
            useDetailBreadcrumbLabel('ana');
            return null;
        };
        render(
            <DetailBreadcrumbProvider>
                <MemoryRouter initialEntries={['/seguridad/usuarios/7']}>
                    <AppBreadcrumb meta={{ label: 'Detalle de usuario', backLabel: 'Usuarios', backPath: '/seguridad/usuarios' }} />
                    <Detail />
                </MemoryRouter>
            </DetailBreadcrumbProvider>
        );
        expect(screen.getByText('ana')).toBeInTheDocument();
        expect(screen.queryByText('Detalle de usuario')).not.toBeInTheDocument();
    });

    test('ruta simple: ignora el nombre de detalle y muestra solo el label', () => {
        const Detail = () => {
            useDetailBreadcrumbLabel('ana');
            return null;
        };
        render(
            <DetailBreadcrumbProvider>
                <MemoryRouter initialEntries={['/seguridad/roles']}>
                    <AppBreadcrumb meta={{ label: 'Roles' }} />
                    <Detail />
                </MemoryRouter>
            </DetailBreadcrumbProvider>
        );
        expect(screen.getByText('Roles')).toBeInTheDocument();
        expect(screen.queryByText('ana')).not.toBeInTheDocument();
    });

    test('ruta simple: solo el label', () => {
        renderAt('/seguridad/roles', { label: 'Roles' });
        expect(screen.getByText('Roles')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Usuarios' })).not.toBeInTheDocument();
    });
});
