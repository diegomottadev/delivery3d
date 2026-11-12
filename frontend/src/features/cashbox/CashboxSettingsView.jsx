import React, { useState, useEffect, useRef } from 'react';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { InputSwitch } from 'primereact/inputswitch';
import { TabView, TabPanel } from 'primereact/tabview';
import { Toast } from 'primereact/toast';
import {
    getCashIncomeCategories,
    createCashIncomeCategory,
    updateCashIncomeCategory,
    getCashExpenseCategories,
    createCashExpenseCategory,
    updateCashExpenseCategory,
} from './cashboxApi';
import { Can } from '../security/permissions/Can';
import { PERM } from '../security/permissions/perms';

const CashboxSettingsView = () => {
    const toast = useRef(null);

    const [incomeCategories, setIncomeCategories] = useState([]);
    const [expenseCategories, setExpenseCategories] = useState([]);
    const [loading, setLoading] = useState(true);

    // Dialog: Create
    const [createDialogVisible, setCreateDialogVisible] = useState(false);
    const [createType, setCreateType] = useState('income'); // 'income' | 'expense'
    const [createForm, setCreateForm] = useState({ code: '', name: '', description: '' });
    const [savingCreate, setSavingCreate] = useState(false);

    // Dialog: Edit
    const [editDialogVisible, setEditDialogVisible] = useState(false);
    const [editType, setEditType] = useState('income');
    const [editForm, setEditForm] = useState({ id: null, code: '', name: '', description: '', is_active: true, is_system: false });
    const [savingEdit, setSavingEdit] = useState(false);

    const loadCategories = async () => {
        setLoading(true);
        try {
            const [incomes, expenses] = await Promise.all([
                getCashIncomeCategories(true),
                getCashExpenseCategories(true),
            ]);
            setIncomeCategories(incomes);
            setExpenseCategories(expenses);
        } catch (err) {
            toast.current?.show({
                severity: 'error',
                summary: 'Error al cargar categorías',
                detail: err.response?.data?.error || err.message,
                life: 4000,
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadCategories();
    }, []);

    const openCreateDialog = (type) => {
        setCreateType(type);
        setCreateForm({ code: '', name: '', description: '' });
        setCreateDialogVisible(true);
    };

    const handleCreate = async () => {
        if (!createForm.code.trim() || !createForm.name.trim()) {
            toast.current?.show({
                severity: 'warn',
                summary: 'Campos requeridos',
                detail: 'El código y el nombre son obligatorios.',
                life: 3000,
            });
            return;
        }

        setSavingCreate(true);
        try {
            const payload = {
                code: createForm.code.trim().toLowerCase().replace(/\s+/g, '_'),
                name: createForm.name.trim(),
                description: createForm.description.trim() || null,
            };

            if (createType === 'income') {
                await createCashIncomeCategory(payload);
            } else {
                await createCashExpenseCategory(payload);
            }

            toast.current?.show({
                severity: 'success',
                summary: 'Categoría Creada',
                detail: `Categoría de ${createType === 'income' ? 'ingreso' : 'egreso'} creada con éxito.`,
                life: 3000,
            });
            setCreateDialogVisible(false);
            loadCategories();
        } catch (err) {
            const errDetail = err.response?.data?.errors
                ? Object.values(err.response.data.errors).join(', ')
                : (err.response?.data?.error || err.message);
            toast.current?.show({
                severity: 'error',
                summary: 'Error al crear',
                detail: errDetail,
                life: 4000,
            });
        } finally {
            setSavingCreate(false);
        }
    };

    const openEditDialog = (category, type) => {
        setEditType(type);
        setEditForm({
            id: category.id,
            code: category.code,
            name: category.name,
            description: category.description || '',
            is_active: category.is_active,
            is_system: category.is_system,
        });
        setEditDialogVisible(true);
    };

    const handleEdit = async () => {
        if (!editForm.name.trim()) {
            toast.current?.show({
                severity: 'warn',
                summary: 'Atención',
                detail: 'El nombre no puede estar vacío.',
                life: 3000,
            });
            return;
        }

        setSavingEdit(true);
        try {
            const payload = {
                name: editForm.name.trim(),
                description: editForm.description.trim() || null,
                is_active: editForm.is_active,
            };

            if (editType === 'income') {
                await updateCashIncomeCategory(editForm.id, payload);
            } else {
                await updateCashExpenseCategory(editForm.id, payload);
            }

            toast.current?.show({
                severity: 'success',
                summary: 'Categoría Actualizada',
                detail: 'Cambios guardados correctamente.',
                life: 3000,
            });
            setEditDialogVisible(false);
            loadCategories();
        } catch (err) {
            const errDetail = err.response?.data?.errors
                ? Object.values(err.response.data.errors).join(', ')
                : (err.response?.data?.error || err.message);
            toast.current?.show({
                severity: 'error',
                summary: 'Error al actualizar',
                detail: errDetail,
                life: 4000,
            });
        } finally {
            setSavingEdit(false);
        }
    };

    const statusBodyTemplate = (rowData) => {
        return (
            <Tag
                severity={rowData.is_active ? 'success' : 'danger'}
                value={rowData.is_active ? 'Activo' : 'Inactivo'}
            />
        );
    };

    const typeBodyTemplate = (rowData) => {
        return (
            <Tag
                severity={rowData.is_system ? 'info' : 'warning'}
                value={rowData.is_system ? 'Sistema' : 'Personalizada'}
            />
        );
    };

    return (
        <div>
            <Toast ref={toast} />

            <div className="flex flex-column md:flex-row md:justify-content-between md:align-items-center gap-2 mb-4">
                <div>
                    <h3 className="m-0 font-bold flex align-items-center gap-2">
                        <i className="pi pi-sliders-h text-primary text-2xl" />
                        Configuración de Caja — Formas y Categorías
                    </h3>
                    <span className="text-500 text-sm">
                        Catálogo normalizado en MySQL (1FN a 4FN/BCNF) para registrar y clasificar ingresos y egresos.
                    </span>
                </div>
                <div className="flex gap-2">
                    <Button
                        label="Actualizar"
                        icon="pi pi-refresh"
                        className="p-button-outlined p-button-sm"
                        loading={loading}
                        onClick={loadCategories}
                    />
                </div>
            </div>

            <Card className="shadow-1">
                <TabView>
                    {/* Tab 1: Ingresos */}
                    <TabPanel header="Formas de Ingreso" leftIcon="pi pi-arrow-down-left mr-2">
                        <div className="flex justify-content-between align-items-center mb-3">
                            <span className="text-600 font-semibold">
                                Categorías habilitadas para cobros de señas, saldos e ingresos extraordinarios
                            </span>
                            <Can perm={PERM.CASH_CATEGORIES_CREATE}>
                                <Button
                                    label="Nueva Forma de Ingreso"
                                    icon="pi pi-plus"
                                    className="p-button-sm p-button-success"
                                    onClick={() => openCreateDialog('income')}
                                />
                            </Can>
                        </div>

                        <DataTable
                            value={incomeCategories}
                            loading={loading}
                            emptyMessage="No se encontraron categorías de ingreso."
                            className="p-datatable-sm"
                            responsiveLayout="scroll"
                        >
                            <Column field="code" header="Código" style={{ width: '150px' }} />
                            <Column field="name" header="Nombre / Etiqueta" style={{ width: '220px' }} className="font-semibold" />
                            <Column field="description" header="Descripción" body={(r) => r.description || <span className="text-400 italic">Sin descripción</span>} />
                            <Column header="Tipo" body={typeBodyTemplate} style={{ width: '130px' }} />
                            <Column header="Estado" body={statusBodyTemplate} style={{ width: '110px' }} />
                            <Column
                                header="Acciones"
                                body={(rowData) => (
                                    <Can perm={PERM.CASH_CATEGORIES_UPDATE}>
                                        <Button
                                            icon="pi pi-pencil"
                                            className="p-button-text p-button-sm p-button-rounded"
                                            tooltip="Editar"
                                            data-testid={`edit-category-income-${rowData.id}`}
                                            onClick={() => openEditDialog(rowData, 'income')}
                                        />
                                    </Can>
                                )}
                                style={{ width: '80px', textAlign: 'center' }}
                            />
                        </DataTable>
                    </TabPanel>

                    {/* Tab 2: Egresos */}
                    <TabPanel header="Formas de Egreso" leftIcon="pi pi-arrow-up-right mr-2">
                        <div className="flex justify-content-between align-items-center mb-3">
                            <span className="text-600 font-semibold">
                                Categorías habilitadas para compra de filamentos, repuestos A1, servicios y embalaje
                            </span>
                            <Can perm={PERM.CASH_CATEGORIES_CREATE}>
                                <Button
                                    label="Nueva Forma de Egreso"
                                    icon="pi pi-plus"
                                    className="p-button-sm p-button-danger"
                                    onClick={() => openCreateDialog('expense')}
                                />
                            </Can>
                        </div>

                        <DataTable
                            value={expenseCategories}
                            loading={loading}
                            emptyMessage="No se encontraron categorías de egreso."
                            className="p-datatable-sm"
                            responsiveLayout="scroll"
                        >
                            <Column field="code" header="Código" style={{ width: '150px' }} />
                            <Column field="name" header="Nombre / Etiqueta" style={{ width: '220px' }} className="font-semibold" />
                            <Column field="description" header="Descripción" body={(r) => r.description || <span className="text-400 italic">Sin descripción</span>} />
                            <Column header="Tipo" body={typeBodyTemplate} style={{ width: '130px' }} />
                            <Column header="Estado" body={statusBodyTemplate} style={{ width: '110px' }} />
                            <Column
                                header="Acciones"
                                body={(rowData) => (
                                    <Can perm={PERM.CASH_CATEGORIES_UPDATE}>
                                        <Button
                                            icon="pi pi-pencil"
                                            className="p-button-text p-button-sm p-button-rounded"
                                            tooltip="Editar"
                                            data-testid={`edit-category-expense-${rowData.id}`}
                                            onClick={() => openEditDialog(rowData, 'expense')}
                                        />
                                    </Can>
                                )}
                                style={{ width: '80px', textAlign: 'center' }}
                            />
                        </DataTable>
                    </TabPanel>
                </TabView>
            </Card>

            {/* Modal: Crear Categoría */}
            <Dialog
                header={`Nueva Forma de ${createType === 'income' ? 'Ingreso' : 'Egreso'}`}
                visible={createDialogVisible}
                style={{ width: '450px' }}
                modal
                onHide={() => setCreateDialogVisible(false)}
                footer={
                    <div>
                        <Button
                            label="Cancelar"
                            icon="pi pi-times"
                            className="p-button-text"
                            onClick={() => setCreateDialogVisible(false)}
                            disabled={savingCreate}
                        />
                        <Button
                            label="Guardar"
                            icon="pi pi-check"
                            className={createType === 'income' ? 'p-button-success' : 'p-button-danger'}
                            onClick={handleCreate}
                            loading={savingCreate}
                        />
                    </div>
                }
            >
                <div className="p-fluid flex flex-column gap-3 pt-2">
                    <div className="field m-0">
                        <label className="font-semibold block mb-1">Nombre / Concepto *</label>
                        <InputText
                            value={createForm.name}
                            onChange={(e) => {
                                const nameVal = e.target.value;
                                setCreateForm((prev) => ({
                                    ...prev,
                                    name: nameVal,
                                    code: prev.code ? prev.code : nameVal.toLowerCase().replace(/[^a-z0-9]/g, '_'),
                                }));
                            }}
                            placeholder="Ej. Clases de Modelado 3D, Publicidad..."
                            maxLength={100}
                            autoFocus
                        />
                    </div>

                    <div className="field m-0">
                        <label className="font-semibold block mb-1">Código Único (Slug) *</label>
                        <InputText
                            value={createForm.code}
                            onChange={(e) => setCreateForm((prev) => ({ ...prev, code: e.target.value }))}
                            placeholder="Ej. clases_modelado, publicidad"
                            maxLength={50}
                        />
                        <small className="text-500">Identificador técnico normalizado para la base de datos.</small>
                    </div>

                    <div className="field m-0">
                        <label className="font-semibold block mb-1">Descripción</label>
                        <InputText
                            value={createForm.description}
                            onChange={(e) => setCreateForm((prev) => ({ ...prev, description: e.target.value }))}
                            placeholder="Detalle o propósito de esta categoría..."
                            maxLength={255}
                        />
                    </div>
                </div>
            </Dialog>

            {/* Modal: Editar Categoría */}
            <Dialog
                header={`Editar Categoría: ${editForm.code}`}
                visible={editDialogVisible}
                style={{ width: '450px' }}
                modal
                onHide={() => setEditDialogVisible(false)}
                footer={
                    <div>
                        <Button
                            label="Cancelar"
                            icon="pi pi-times"
                            className="p-button-text"
                            onClick={() => setEditDialogVisible(false)}
                            disabled={savingEdit}
                        />
                        <Button
                            label="Guardar Cambios"
                            icon="pi pi-check"
                            className="p-button-primary"
                            onClick={handleEdit}
                            loading={savingEdit}
                        />
                    </div>
                }
            >
                <div className="p-fluid flex flex-column gap-3 pt-2">
                    <div className="field m-0">
                        <label className="font-semibold block mb-1">Código (No editable)</label>
                        <InputText value={editForm.code} disabled />
                    </div>

                    <div className="field m-0">
                        <label className="font-semibold block mb-1">Nombre / Etiqueta *</label>
                        <InputText
                            value={editForm.name}
                            onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                            maxLength={100}
                        />
                    </div>

                    <div className="field m-0">
                        <label className="font-semibold block mb-1">Descripción</label>
                        <InputText
                            value={editForm.description}
                            onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
                            maxLength={255}
                        />
                    </div>

                    <div className="field m-0 flex align-items-center justify-content-between pt-2">
                        <div>
                            <span className="font-semibold block">Estado Activo</span>
                            <small className="text-500">
                                {editForm.is_system
                                    ? 'Las categorías del sistema no pueden desactivarse.'
                                    : 'Las categorías inactivas no se muestran en el registro de caja.'}
                            </small>
                        </div>
                        <InputSwitch
                            checked={editForm.is_active}
                            disabled={editForm.is_system}
                            onChange={(e) => setEditForm((prev) => ({ ...prev, is_active: e.value }))}
                        />
                    </div>
                </div>
            </Dialog>
        </div>
    );
};

export default CashboxSettingsView;
