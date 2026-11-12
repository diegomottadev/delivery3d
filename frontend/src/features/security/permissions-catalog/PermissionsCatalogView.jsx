import React, { useCallback, useEffect, useState } from 'react';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { Button } from 'primereact/button';
import { Message } from 'primereact/message';
import { listPermissionCatalog } from '../securityApi';
import { useApiErrorHandler } from '../useApiErrorHandler';
import { ForbiddenNotice } from '../components/ForbiddenNotice';

const rolesTemplate = (permission) =>
    permission.roles && permission.roles.length > 0 ? (
        <div className="flex flex-wrap gap-1">
            {permission.roles.map((role) => (
                <Tag key={role.id} value={role.name} severity="info" />
            ))}
        </div>
    ) : (
        <span className="text-500 text-sm">Ningún rol lo usa</span>
    );

/** Catálogo de permisos de solo lectura (sale del enum Perm del backend): sin crear, editar ni borrar. */
const PermissionsCatalogView = () => {
    const handleApiError = useApiErrorHandler();
    const [catalog, setCatalog] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await listPermissionCatalog();
            setCatalog(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(handleApiError(err));
        } finally {
            setLoading(false);
        }
    }, [handleApiError]);

    useEffect(() => {
        load();
        // Solo al montar: load cambia si cambia refresh() (token), y eso ya remonta la ruta.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const renderBody = () => {
        if (loading) {
            return (
                <div data-testid="catalog-loading" className="flex align-items-center justify-content-center p-4">
                    <i className="pi pi-spin pi-spinner text-3xl text-primary" aria-label="Cargando catálogo" />
                </div>
            );
        }
        if (error && error.isForbidden) {
            return <ForbiddenNotice />;
        }
        if (error) {
            return (
                <div className="flex flex-column md:flex-row align-items-start md:align-items-center gap-3">
                    <Message severity="error" text={error.message} />
                    <Button label="Reintentar" icon="pi pi-refresh" className="p-button-sm p-button-outlined" onClick={load} />
                </div>
            );
        }
        if (catalog.length === 0) {
            return <p className="text-600">No hay permisos definidos.</p>;
        }
        return catalog.map((group) => (
            <section key={group.resource} data-testid={`catalog-group-${group.resource}`} className="mb-4">
                <h4 className="mb-2">{group.resource_label || group.resource}</h4>
                <DataTable value={group.permissions || []} dataKey="code" size="small" responsiveLayout="stack" breakpoint="768px" emptyMessage="Sin permisos en este recurso.">
                    <Column field="description" header="Permiso" />
                    <Column header="Roles que lo usan" body={rolesTemplate} />
                </DataTable>
            </section>
        ));
    };

    return (
        <div className="card">
            <h3 className="mt-0">Catálogo de permisos</h3>
            <p className="text-600 mt-0 mb-4">Permisos disponibles en el sistema y los roles que los otorgan. Es de solo lectura: los permisos se asignan desde Roles.</p>
            {renderBody()}
        </div>
    );
};

export default PermissionsCatalogView;
