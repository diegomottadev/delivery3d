import React, { useState } from 'react';
import { InputText } from 'primereact/inputtext';
import { Password } from 'primereact/password';
import { Button } from 'primereact/button';
import { Message } from 'primereact/message';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

export const LoginView = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const { login, isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    // If already logged in, redirect to origin or root
    React.useEffect(() => {
        if (isAuthenticated) {
            const destination = location.state?.from?.pathname || '/';
            navigate(destination, { replace: true });
        }
    }, [isAuthenticated, navigate, location]);

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        setErrorMessage('');

        if (!username.trim() || !password) {
            setErrorMessage('Por favor ingrese usuario y contraseña');
            return;
        }

        setSubmitting(true);
        try {
            await login(username.trim(), password);
            const destination = location.state?.from?.pathname || '/';
            navigate(destination, { replace: true });
        } catch (err) {
            const msg =
                err.response?.data?.error ||
                err.response?.data?.message ||
                'Error al iniciar sesión. Verifique sus credenciales.';
            setErrorMessage(msg);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="login-body">
            <div className="login-panel"></div>

            <div className="login-content">
                <img
                    src="assets/layout/images/logo-black.png"
                    alt="Delivery3D"
                    style={{ maxWidth: '180px', marginBottom: '1.5rem' }}
                />

                <h1 style={{ marginBottom: '0.25rem' }}>
                    <span style={{ fontWeight: 'bold', color: '#3949ab' }}>DELIVERY3D</span>
                </h1>
                <p style={{ marginTop: '0', marginBottom: '2rem', color: '#666' }}>
                    Gestión de Pedidos y Caja para Taller 3D
                </p>

                <form
                    onSubmit={handleSubmit}
                    style={{ maxWidth: '340px', margin: '0 auto', textAlign: 'left' }}
                >
                    {errorMessage && (
                        <div className="mb-3" data-testid="login-error-message">
                            <Message
                                severity="error"
                                text={errorMessage}
                                style={{ width: '100%' }}
                            />
                        </div>
                    )}

                    <div className="field mb-4">
                        <label
                            htmlFor="username"
                            className="block text-900 font-medium mb-2"
                        >
                            Usuario
                        </label>
                        <div className="p-input-icon-left w-full">
                            <i className="pi pi-user" />
                            <InputText
                                id="username"
                                type="text"
                                className="w-full"
                                placeholder="Ej: operador"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                disabled={submitting}
                                autoFocus
                                data-testid="login-username-input"
                            />
                        </div>
                    </div>

                    <div className="field mb-4">
                        <label
                            htmlFor="password"
                            className="block text-900 font-medium mb-2"
                        >
                            Contraseña
                        </label>
                        <div className="p-input-icon-left w-full">
                            <i className="pi pi-lock" style={{ zIndex: 1 }} />
                            <Password
                                id="password"
                                className="w-full"
                                inputClassName="w-full pl-5"
                                placeholder="Contraseña de acceso"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                toggleMask
                                feedback={false}
                                disabled={submitting}
                                data-testid="login-password-input"
                            />
                        </div>
                    </div>

                    <Button
                        label={submitting ? 'Iniciando sesión...' : 'Ingresar al Taller'}
                        icon={submitting ? 'pi pi-spin pi-spinner' : 'pi pi-sign-in'}
                        type="submit"
                        className="w-full p-button-primary mt-2"
                        disabled={submitting}
                        data-testid="login-submit-button"
                    />
                </form>

                <div className="mt-4 text-xs text-500">
                    Bambu Lab A1 &bull; Seguridad JWT (OWASP Top 10)
                </div>
            </div>
        </div>
    );
};

export default LoginView;
