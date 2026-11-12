import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import * as authApi from './authApi';

jest.mock('./authApi');

const TestConsumer = () => {
    const { token, user, isAuthenticated, login, logout } = useAuth();
    return (
        <div>
            <div data-testid="auth-status">{isAuthenticated ? 'authenticated' : 'unauthenticated'}</div>
            <div data-testid="user-name">{user ? user.username : 'none'}</div>
            <div data-testid="token-val">{token || 'none'}</div>
            <button
                data-testid="btn-login"
                onClick={() => login('testuser', 'password123')}
            >
                Login
            </button>
            <button data-testid="btn-logout" onClick={logout}>
                Logout
            </button>
        </div>
    );
};

describe('AuthContext', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        localStorage.clear();
    });

    test('initializes with unauthenticated state when localStorage is empty', () => {
        render(
            <AuthProvider>
                <TestConsumer />
            </AuthProvider>
        );

        expect(screen.getByTestId('auth-status').textContent).toBe('unauthenticated');
        expect(screen.getByTestId('user-name').textContent).toBe('none');
        expect(screen.getByTestId('token-val').textContent).toBe('none');
    });

    test('initializes with stored token and user from localStorage', () => {
        localStorage.setItem('token', 'stored-token-xyz');
        localStorage.setItem('user', JSON.stringify({ id: 2, username: 'admin_taller', role: 'admin' }));

        render(
            <AuthProvider>
                <TestConsumer />
            </AuthProvider>
        );

        expect(screen.getByTestId('auth-status').textContent).toBe('authenticated');
        expect(screen.getByTestId('user-name').textContent).toBe('admin_taller');
        expect(screen.getByTestId('token-val').textContent).toBe('stored-token-xyz');
    });

    test('login updates context state and stores token in localStorage', async () => {
        authApi.login.mockResolvedValue({
            token: 'new-token-abc',
            user: { id: 1, username: 'operador', role: 'operator' },
        });

        render(
            <AuthProvider>
                <TestConsumer />
            </AuthProvider>
        );

        await act(async () => {
            screen.getByTestId('btn-login').click();
        });

        expect(screen.getByTestId('auth-status').textContent).toBe('authenticated');
        expect(screen.getByTestId('user-name').textContent).toBe('operador');
        expect(screen.getByTestId('token-val').textContent).toBe('new-token-abc');
        expect(localStorage.getItem('token')).toBe('new-token-abc');
    });

    test('logout clears context state and removes items from localStorage', async () => {
        localStorage.setItem('token', 'active-token');
        localStorage.setItem('user', JSON.stringify({ id: 1, username: 'operador' }));

        render(
            <AuthProvider>
                <TestConsumer />
            </AuthProvider>
        );

        expect(screen.getByTestId('auth-status').textContent).toBe('authenticated');

        act(() => {
            screen.getByTestId('btn-logout').click();
        });

        expect(screen.getByTestId('auth-status').textContent).toBe('unauthenticated');
        expect(screen.getByTestId('user-name').textContent).toBe('none');
        expect(screen.getByTestId('token-val').textContent).toBe('none');
        expect(localStorage.getItem('token')).toBeNull();
        expect(localStorage.getItem('user')).toBeNull();
    });
});
