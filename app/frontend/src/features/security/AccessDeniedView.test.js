import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AccessDeniedView from './AccessDeniedView';

describe('AccessDeniedView (/acceso-denegado)', () => {
    test('muestra un mensaje claro en español y un link al tablero', () => {
        render(
            <MemoryRouter>
                <AccessDeniedView />
            </MemoryRouter>
        );
        expect(screen.getByRole('heading', { name: /Acceso denegado/i })).toBeInTheDocument();
        expect(screen.getByText(/No tenés permiso para ver esta sección/i)).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Volver al tablero/i })).toHaveAttribute('href', '/');
    });
});
