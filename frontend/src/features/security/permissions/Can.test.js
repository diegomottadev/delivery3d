import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { Can } from './Can';
import { PERM } from './perms';
import {
    AllProviders,
    PermissionsStatusProbe,
    startSession,
    mockMyPermissions,
    mockMyPermissionsPending,
} from './permissionsTestUtils';

jest.mock('../securityApi');
jest.mock('../../auth/authApi');

const renderCan = (ui) => render(ui, { wrapper: AllProviders });

describe('<Can>', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        localStorage.clear();
        startSession();
    });

    test('muestra el contenido si el usuario tiene el permiso', async () => {
        mockMyPermissions({ permissions: [PERM.RBAC_MANAGE] });
        renderCan(
            <Can perm={PERM.RBAC_MANAGE}>
                <button>Nuevo rol</button>
            </Can>
        );
        expect(await screen.findByRole('button', { name: 'Nuevo rol' })).toBeInTheDocument();
    });

    test('oculta el contenido si no tiene el permiso', async () => {
        mockMyPermissions({ permissions: [PERM.RBAC_READ] });
        renderCan(
            <>
                <Can perm={PERM.RBAC_MANAGE}>
                    <button>Nuevo rol</button>
                </Can>
                <Can perm={PERM.RBAC_READ}>
                    <span>listo</span>
                </Can>
            </>
        );
        await screen.findByText('listo');
        expect(screen.queryByRole('button', { name: 'Nuevo rol' })).not.toBeInTheDocument();
    });

    test('renderiza fallback cuando no tiene el permiso', async () => {
        mockMyPermissions({ permissions: [] });
        renderCan(
            <>
                <PermissionsStatusProbe />
                <Can perm={PERM.RBAC_MANAGE} fallback={<span>Solo lectura</span>}>
                    <button>Editar</button>
                </Can>
            </>
        );
        await waitFor(() => expect(screen.getByTestId('permissions-status')).toHaveTextContent('ready'));
        expect(screen.getByText('Solo lectura')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
    });

    test('anyOf: muestra el contenido si tiene alguno de los permisos', async () => {
        mockMyPermissions({ permissions: [PERM.RBAC_READ] });
        renderCan(
            <Can anyOf={[PERM.RBAC_MANAGE, PERM.RBAC_READ]}>
                <span>visible</span>
            </Can>
        );
        expect(await screen.findByText('visible')).toBeInTheDocument();
    });

    test('superusuario ve todo aunque la lista venga vacía', async () => {
        mockMyPermissions({ permissions: [], isSuperuser: true });
        renderCan(
            <Can perm={PERM.RBAC_MANAGE}>
                <span>admin</span>
            </Can>
        );
        expect(await screen.findByText('admin')).toBeInTheDocument();
    });

    test('mientras los permisos cargan no muestra el contenido', async () => {
        mockMyPermissionsPending();
        renderCan(
            <Can perm={PERM.RBAC_READ} fallback={<span>fallback</span>}>
                <span>secreto</span>
            </Can>
        );
        expect(await screen.findByText('fallback')).toBeInTheDocument();
        expect(screen.queryByText('secreto')).not.toBeInTheDocument();
    });
});
