import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { Navigate, useLocation } from 'react-router-dom';
import * as authApi from './authApi';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [token, setToken] = useState(() => {
        const saved = localStorage.getItem('token');
        return saved && saved !== 'null' && saved !== 'undefined' && saved.trim() !== '' ? saved : null;
    });

    const [user, setUser] = useState(() => {
        try {
            const savedUser = localStorage.getItem('user');
            return savedUser ? JSON.parse(savedUser) : null;
        } catch {
            return null;
        }
    });

    const [loading, setLoading] = useState(false);

    // Axios interceptor for automatic 401 handling
    useEffect(() => {
        const interceptor = axios.interceptors.response.use(
            (response) => response,
            (error) => {
                if (error.response && error.response.status === 401) {
                    const url = error.config ? error.config.url : '';
                    // Don't auto-logout if the error was in the login endpoint itself
                    if (!url.includes('/api/auth/login')) {
                        logout();
                        window.location.hash = '#/login';
                    }
                }
                return Promise.reject(error);
            }
        );

        return () => {
            axios.interceptors.response.eject(interceptor);
        };
    }, []);

    // Verify token validity on load if token exists
    useEffect(() => {
        let isMounted = true;
        if (token && !user) {
            setLoading(true);
            authApi
                .getMe(token)
                .then((userData) => {
                    if (isMounted) {
                        setUser(userData);
                        localStorage.setItem('user', JSON.stringify(userData));
                    }
                })
                .catch(() => {
                    if (isMounted) {
                        logout();
                    }
                })
                .finally(() => {
                    if (isMounted) {
                        setLoading(false);
                    }
                });
        }
        return () => {
            isMounted = false;
        };
    }, [token, user]);

    const login = async (username, password) => {
        const data = await authApi.login(username, password);
        const receivedToken = data.token;
        const receivedUser = data.user;

        setToken(receivedToken);
        setUser(receivedUser);

        localStorage.setItem('token', receivedToken);
        localStorage.setItem('user', JSON.stringify(receivedUser));

        return receivedUser;
    };

    const logout = () => {
        setToken(null);
        setUser(null);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    };

    const isAuthenticated = Boolean(token);

    const value = {
        token,
        user,
        isAuthenticated,
        loading,
        login,
        logout,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const ProtectedRoute = ({ children }) => {
    const { isAuthenticated, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="flex align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
                <i className="pi pi-spin pi-spinner text-4xl text-primary"></i>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return children;
};
