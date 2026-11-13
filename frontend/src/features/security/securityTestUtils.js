// Utilidades SOLO para tests de las pantallas de Seguridad (requieren jest.mock('<ruta>/securityApi')).
import React from 'react';
import { render, act, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { StaticPermissionsProvider } from './permissions/PermissionsContext';
import { PERM } from './permissions/perms';

export const READ = [PERM.RBAC_READ];
export const MANAGE = [PERM.RBAC_READ, PERM.RBAC_MANAGE];

export const axiosError = (status, data = {}) => Object.assign(new Error(`HTTP ${status}`), { response: { status, data } });

const LocationProbe = () => {
    const location = useLocation();
    return <span data-testid="location">{location.pathname}</span>;
};

/**
 * Renderiza una vista en `route` (patrón con params) arrancando en `path`, con permisos fijos.
 * `refresh` permite espiar el refresh() de permisos. Deja resolver las promesas mockeadas.
 */
export const renderSecurityView = async (element, { route, path, permissions = MANAGE, isSuperuser = false, userId = 1, refresh = jest.fn(() => Promise.resolve()) } = {}) => {
    const utils = render(
        <StaticPermissionsProvider permissions={permissions} isSuperuser={isSuperuser} userId={userId} refresh={refresh}>
            <MemoryRouter initialEntries={[path || route]}>
                <Routes>
                    <Route path={route} element={element} />
                    <Route path="*" element={<span>otra ruta</span>} />
                </Routes>
                <LocationProbe />
            </MemoryRouter>
        </StaticPermissionsProvider>
    );
    await flush();
    return { ...utils, refresh };
};

export const flush = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));

/** Hace click y deja resolver las promesas que dispara. */
export const clickAndFlush = async (element) => {
    fireEvent.click(element);
    await flush();
    await flush();
};

/** Elige una opción de un <select> nativo por su label accesible. */
export const selectOption = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value: String(value) } });

/** Fila de tabla que contiene `text` (sin acceder a nodos del DOM a mano). */
export const rowWith = (text) => {
    const row = screen.getAllByRole('row').find((r) => within(r).queryByText(text));
    if (!row) throw new Error(`No hay ninguna fila con "${text}"`);
    return row;
};
