import React from 'react';
import { render, screen } from '@testing-library/react';
import { ForbiddenNotice } from './ForbiddenNotice';

describe('<ForbiddenNotice>', () => {
    test('muestra un mensaje claro por defecto', () => {
        render(<ForbiddenNotice />);
        expect(screen.getByTestId('forbidden-notice')).toHaveTextContent(/No tenés permiso para ver esta información/i);
    });

    test('acepta un mensaje propio', () => {
        render(<ForbiddenNotice message="No podés ver el catálogo" />);
        expect(screen.getByTestId('forbidden-notice')).toHaveTextContent('No podés ver el catálogo');
    });
});
