import React, { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import { useLoader, useMyAccess, useSecurityMutation } from '../useSecurityData';
import { Can } from '../permissions/Can';
import { PERM } from '../permissions/perms';
import { LoadState, BlockedHint } from './LoadState';
import { NameDescriptionDialog } from './NameDescriptionDialog';
import { ConfirmImpactDialog } from './ConfirmImpactDialog';
import { useImpactConfirm } from './useImpactConfirm';

/**
 * Hook del alta/edición con NameDescriptionDialog. save(values) → { ok }.
 * 422 y NAME_TAKEN se muestran en el campo (además del toast).
 */
export const useNameDescriptionEditor = (mutate) => {
    const [editor, setEditor] = useState({ visible: false, header: '', initial: null, saving: false, fieldErrors: {}, save: null });

    const open = ({ header, initial = null, save, successMessage }) =>
        setEditor({
            visible: true,
            header,
            initial,
            saving: false,
            fieldErrors: {},
            save: async (values) => {
                setEditor((prev) => ({ ...prev, saving: true, fieldErrors: {} }));
                const outcome = await mutate(() => save(values), successMessage);
                if (outcome.ok) {
                    setEditor((prev) => ({ ...prev, visible: false, saving: false }));
                } else {
                    const fieldErrors = outcome.error.code === 'NAME_TAKEN' ? { name: outcome.error.message } : outcome.error.fieldErrors || {};
                    setEditor((prev) => ({ ...prev, saving: false, fieldErrors }));
                }
                return outcome;
            },
        });

    const dialogProps = {
        visible: editor.visible,
        header: editor.header,
        initial: editor.initial,
        saving: editor.saving,
        fieldErrors: editor.fieldErrors,
        onSave: (values) => editor.save && editor.save(values),
        onHide: () => setEditor((prev) => ({ ...prev, visible: false })),
    };

    return { open, dialogProps };
};

/**
 * Listado con búsqueda en el front y CRUD (grupos y roles). Escrituras solo con rbac:manage.
 * config: { title, intro, noun, newLabel, basePath, load, create, update, remove, removalImpact,
 *           extraColumns: [{ field, header }], deleteBlockedReason(item, myAccess) → string|null }
 */
const CrudListView = ({ config }) => {
    const toast = useRef(null);
    const { myAccess, reloadMyAccess } = useMyAccess();
    const list = useLoader(() => config.load());
    const [search, setSearch] = useState('');
    const mutate = useSecurityMutation(toast, () => Promise.all([list.reload({ silent: true }), reloadMyAccess()]));
    const editor = useNameDescriptionEditor(mutate);
    const impact = useImpactConfirm();

    const items = useMemo(() => {
        const all = Array.isArray(list.data) ? list.data : [];
        const term = search.trim().toLowerCase();
        return term ? all.filter((i) => `${i.name} ${i.description || ''}`.toLowerCase().includes(term)) : all;
    }, [list.data, search]);

    const openCreate = () => editor.open({ header: config.newLabel, save: config.create, successMessage: `${config.noun} creado` });
    const openEdit = (item) =>
        editor.open({ header: `Editar ${item.name}`, initial: item, save: (values) => config.update(item.id, values), successMessage: `${config.noun} actualizado` });
    const openDelete = (item) =>
        impact.open({
            header: `Eliminar ${config.noun.toLowerCase()}`,
            message: `¿Eliminar "${item.name}"? No se puede deshacer.`,
            confirmLabel: 'Eliminar',
            loadImpact: () => config.removalImpact(item.id),
            onConfirm: () => mutate(() => config.remove(item.id), `${config.noun} eliminado`),
        });

    const actions = (item) => {
        const blocked = config.deleteBlockedReason(item, myAccess);
        return (
            <Can perm={PERM.RBAC_MANAGE}>
                <div className="flex gap-1">
                    <Button icon="pi pi-pencil" className="p-button-sm p-button-text" aria-label={`Editar ${item.name}`} onClick={() => openEdit(item)} />
                    <Button
                        icon="pi pi-trash"
                        className="p-button-sm p-button-text p-button-danger"
                        aria-label={`Eliminar ${item.name}`}
                        disabled={Boolean(blocked)}
                        onClick={() => openDelete(item)}
                    />
                </div>
                <BlockedHint reason={blocked} testId={`delete-blocked-${item.id}`} />
            </Can>
        );
    };

    const ready = !list.loading && !list.error;

    return (
        <div className="card">
            <Toast ref={toast} />
            <div className="flex flex-wrap justify-content-between align-items-center gap-2">
                <h3 className="m-0">{config.title}</h3>
                <Can perm={PERM.RBAC_MANAGE}>
                    <Button label={config.newLabel} icon="pi pi-plus" onClick={openCreate} />
                </Can>
            </div>
            <p className="text-600">{config.intro}</p>
            <LoadState loading={list.loading} error={list.error} onRetry={list.reload} />
            {ready && (
                <>
                    <span className="p-input-icon-left mb-3 w-full md:w-20rem">
                        <i className="pi pi-search" />
                        <InputText aria-label="Buscar" placeholder="Buscar" className="w-full" value={search} onChange={(e) => setSearch(e.target.value)} />
                    </span>
                    <DataTable value={items} dataKey="id" size="small" responsiveLayout="stack" breakpoint="768px" emptyMessage="No hay resultados.">
                        <Column header="Nombre" body={(i) => <Link to={`${config.basePath}/${i.id}`}>{i.name}</Link>} />
                        <Column field="description" header="Descripción" />
                        {config.extraColumns.map((c) => (
                            <Column key={c.field} field={c.field} header={c.header} />
                        ))}
                        <Column header="" body={actions} />
                    </DataTable>
                </>
            )}
            <NameDescriptionDialog {...editor.dialogProps} />
            <ConfirmImpactDialog {...impact.dialogProps} />
        </div>
    );
};

export default CrudListView;
