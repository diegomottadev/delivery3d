import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import LoginView from './LoginView';
import { AuthProvider } from './AuthContext';
import * as authApi from './authApi';

jest.mock('./authApi');

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useNavigate: () => mockNavigate,
}));

describe('LoginView Component', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        localStorage.clear();
    });

    test('renders login form properly with inputs and submit button', () => {
        render(
            <BrowserRouter>
                <AuthProvider>
                    <LoginView />
                </AuthProvider>
            </BrowserRouter>
        );

        expect(screen.getByText('DELIVERY3D')).toBeInTheDocument();
        expect(screen.getByText(/Gestión de Pedidos y Caja/i)).toBeInTheDocument();
        expect(screen.getByTestId('login-username-input')).toBeInTheDocument();
        expect(screen.getByTestId('login-password-input')).toBeInTheDocument();
        expect(screen.getByTestId('login-submit-button')).toBeInTheDocument();
    });

    test('validates required fields and shows error without calling api', async () => {
        render(
            <BrowserRouter>
                <AuthProvider>
                    <LoginView />
                </AuthProvider>
            </BrowserRouter>
        );

        fireEvent.click(screen.getByTestId('login-submit-button'));

        expect(await screen.findByText(/Por favor ingrese usuario y contraseña/i)).toBeInTheDocument();
        expect(authApi.login).not.toHaveBeenCalled();
    });

    test('submits credentials to authApi.login and navigates on success', async () => {
        authApi.login.mockResolvedValue({
            token: 'jwt-mock-token-123',
            user: { id: 1, username: 'operador', role: 'admin' },
            expires_in: 86400,
        });

        render(
            <BrowserRouter>
                <AuthProvider>
                    <LoginView />
                </AuthProvider>
            </BrowserRouter>
        );

        fireEvent.change(screen.getByTestId('login-username-input'), {
            target: { value: 'operador' },
        });

        // PrimeReact Password input
        const passwordInput = screen.getByTestId('login-password-input').querySelector('input') ||
                              screen.getByTestId('login-password-input');
        fireEvent.change(passwordInput, {
            target: { value: 'operador123' },
        });

        fireEvent.click(screen.getByTestId('login-submit-button'));

        await waitFor(() => {
            expect(authApi.login).toHaveBeenCalledWith('operador', 'operador123');
            expect(localStorage.getItem('token')).toBe('jwt-mock-token-123');
            expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
        });
    });

    test('displays error message when login fails (OWASP generic response)', async () => {
        authApi.login.mockRejectedValue({
            response: {
                status: 401,
                data: { error: 'Credenciales inválidas' },
            },
        });

        render(
            <BrowserRouter>
                <AuthProvider>
                    <LoginView />
                </AuthProvider>
            </BrowserRouter>
        );

        fireEvent.change(screen.getByTestId('login-username-input'), {
            target: { value: 'hacker' },
        });

        const passwordInput = screen.getByTestId('login-password-input').querySelector('input') ||
                              screen.getByTestId('login-password-input');
        fireEvent.change(passwordInput, {
            target: { value: 'wrongpass' },
        });

        fireEvent.click(screen.getByTestId('login-submit-button'));

        await waitFor(() => {
            expect(authApi.login).toHaveBeenCalledWith('hacker', 'wrongpass');
            expect(screen.getByText('Credenciales inválidas')).toBeInTheDocument();
        });
    });
});
