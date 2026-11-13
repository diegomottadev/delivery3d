import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { Tag } from 'primereact/tag';
import { listUsers } from '../securityApi';
import { useLoader } from '../useSecurityData';
import { usePermissions } from '../permissions/PermissionsContext';
import { LoadState } from '../components/LoadState';

export const UserTags = ({ user, isMe }) => (
    <span className="inline-flex flex-wrap gap-1">
        <Tag value={user.is_active ? 'Activo' : 'Inactivo'} severity={user.is_active ? 'success' : 'danger'} />
        {user.is_superuser && <Tag value="Superusuario" severity="warning" />}
        {isMe && <Tag value="Vos" severity="info" />}
    </span>
);

/** Listado de usuarios: sin paginar; la búsqueda filtra en el front. Solo lectura (los usuarios salen de seed/CLI). */
const UsersListView = () => {
    const navigate = useNavigate();
    const { userId: myUserId } = usePermissions();
    const { data, loading, error, reload } = useLoader(() => listUsers());
    const [search, setSearch] = useState('');

    const users = useMemo(() => {
        const all = Array.isArray(data) ? data : [];
        const term = search.trim().toLowerCase();
        return term ? all.filter((u) => String(u.username).toLowerCase().includes(term)) : all;
    }, [data, search]);

    const ready = !loading && !error;

    return (
        <div className="card">
            <h3 className="mt-0">Usuarios</h3>
            <p className="text-600 mt-0">Grupos, roles directos y acceso efectivo de cada usuario. Los usuarios se crean por seed.</p>
            <LoadState loading={loading} error={error} onRetry={reload} />
            {ready && (
                <>
                    <span className="p-input-icon-left mb-3 w-full md:w-20rem">
                        <i className="pi pi-search" />
                        <InputText aria-label="Buscar usuario" placeholder="Buscar usuario" className="w-full" value={search} onChange={(e) => setSearch(e.target.value)} />
                    </span>
                    <DataTable value={users} dataKey="id" size="small" responsiveLayout="stack" breakpoint="768px" emptyMessage="Ningún usuario coincide con la búsqueda.">
                        <Column field="username" header="Usuario" />
                        <Column header="Estado" body={(u) => <UserTags user={u} isMe={u.id === myUserId} />} />
                        <Column field="groups_count" header="Grupos" />
                        <Column field="direct_roles_count" header="Roles directos" />
                        <Column
                            header=""
                            body={(u) => (
                                <Button
                                    label="Ver"
                                    icon="pi pi-eye"
                                    className="p-button-sm p-button-text"
                                    aria-label={`Ver ${u.username}`}
                                    onClick={() => navigate(`/seguridad/usuarios/${u.id}`)}
                                />
                            )}
                        />
                    </DataTable>
                </>
            )}
        </div>
    );
};

export default UsersListView;
