import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { InputNumber } from 'primereact/inputnumber';
import { Dropdown } from 'primereact/dropdown';
import { SelectButton } from 'primereact/selectbutton';
import { Toast } from 'primereact/toast';
import {
    getCashSummary,
    listCashMovements,
    createCashMovement,
    getCashIncomeCategories,
    getCashExpenseCategories,
} from './cashboxApi';

const TYPE_FILTER_OPTIONS = [
    { label: 'Todos', value: 'all' },
    { label: 'Ingresos', value: 'ingreso' },
    { label: 'Egresos', value: 'egreso' },
];

const DEFAULT_EGRESO_CATEGORIES = [
    { label: 'Filamento', value: 'filamento' },
    { label: 'Repuestos A1', value: 'repuestos' },
    { label: 'Servicios', value: 'servicios' },
    { label: 'Embalaje', value: 'embalaje' },
    { label: 'Mantenimiento', value: 'mantenimiento' },
    { label: 'Otro Egreso', value: 'otro' },
];

const DEFAULT_INGRESO_CATEGORIES = [
    { label: 'Seña / Anticipo', value: 'seña' },
    { label: 'Saldo de Pedido', value: 'saldo_pedido' },
    { label: 'Ingreso Extraordinario', value: 'extraordinario' },
    { label: 'Otro Ingreso', value: 'otro' },
];

const CashboxView = () => {
    const navigate = useNavigate();
    const toast = useRef(null);

    const [summary, setSummary] = useState({
        total_ingresos: 0,
        total_egresos: 0,
        current_balance: 0,
        currency_code: 'ARS',
        currency_symbol: 'AR$',
        movements_count: 0,
    });
    const [movements, setMovements] = useState([]);
    const [incomeCategories, setIncomeCategories] = useState(DEFAULT_INGRESO_CATEGORIES);
    const [expenseCategories, setExpenseCategories] = useState(DEFAULT_EGRESO_CATEGORIES);
    const [loading, setLoading] = useState(true);
    const [typeFilter, setTypeFilter] = useState('all');

    // Dialog state
    const [dialogVisible, setDialogVisible] = useState(false);
    const [saving, setSaving] = useState(false);
    const [movementForm, setMovementForm] = useState({
        type: 'egreso',
        amount: null,
        category: 'filamento',
        description: '',
        order_id: null,
    });

    const loadData = async () => {
        setLoading(true);
        try {
            const [sumData, movData, incCats, expCats] = await Promise.all([
                getCashSummary(),
                listCashMovements(typeFilter !== 'all' ? { type: typeFilter } : {}),
                getCashIncomeCategories().catch(() => []),
                getCashExpenseCategories().catch(() => []),
            ]);
            setSummary(sumData);
            setMovements(movData);
            if (incCats && incCats.length > 0) {
                setIncomeCategories(incCats.map((c) => ({ label: c.name, value: c.code })));
            }
            if (expCats && expCats.length > 0) {
                setExpenseCategories(expCats.map((c) => ({ label: c.name, value: c.code })));
            }
        } catch (err) {
            toast.current?.show({
                severity: 'error',
                summary: 'Error al cargar caja',
                detail: err.response?.data?.error || err.message,
                life: 4000,
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [typeFilter]);

    const openNewMovement = (initialType = 'egreso') => {
        const availableCats = initialType === 'egreso' ? expenseCategories : incomeCategories;
        const defaultCat = availableCats[0]?.value || (initialType === 'egreso' ? 'filamento' : 'extraordinario');
        setMovementForm({
            type: initialType,
            amount: null,
            category: defaultCat,
            description: '',
            order_id: null,
        });
        setDialogVisible(true);
    };

    const handleSaveMovement = async () => {
        if (!movementForm.amount || movementForm.amount <= 0) {
            toast.current?.show({
                severity: 'warn',
                summary: 'Atención',
                detail: 'El monto debe ser mayor a 0.',
                life: 3000,
            });
            return;
        }
        if (!movementForm.category) {
            toast.current?.show({
                severity: 'warn',
                summary: 'Atención',
                detail: 'Debe seleccionar una categoría.',
                life: 3000,
            });
            return;
        }

        setSaving(true);
        try {
            await createCashMovement({
                type: movementForm.type,
                amount: movementForm.amount,
                category: movementForm.category,
                description: movementForm.description.trim() || null,
                order_id: movementForm.order_id || null,
            });
            toast.current?.show({
                severity: 'success',
                summary: 'Movimiento Registrado',
                detail: `${movementForm.type === 'ingreso' ? 'Ingreso' : 'Egreso'} registrado correctamente.`,
                life: 3000,
            });
            setDialogVisible(false);
            loadData();
        } catch (err) {
            const errDetail = err.response?.data?.errors
                ? Object.values(err.response.data.errors).join(', ')
                : (err.response?.data?.error || err.message);
            toast.current?.show({
                severity: 'error',
                summary: 'Error al registrar',
                detail: errDetail,
                life: 4000,
            });
        } finally {
            setSaving(false);
        }
    };

    const formatMoney = (val) => {
        const num = parseFloat(val) || 0;
        return `${summary.currency_symbol} ${num.toLocaleString('es-AR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })}`;
    };

    const formatDate = (isoString) => {
        if (!isoString) return '-';
        try {
            const d = new Date(isoString);
            return d.toLocaleString('es-AR', {
                dateStyle: 'short',
                timeStyle: 'short',
            });
        } catch {
            return isoString;
        }
    };

    const typeBodyTemplate = (rowData) => {
        const isIngreso = rowData.type === 'ingreso';
        return (
            <Tag
                severity={isIngreso ? 'success' : 'danger'}
                value={isIngreso ? 'Ingreso' : 'Egreso'}
                icon={isIngreso ? 'pi pi-arrow-down-left' : 'pi pi-arrow-up-right'}
            />
        );
    };

    const amountBodyTemplate = (rowData) => {
        const isIngreso = rowData.type === 'ingreso';
        return (
            <span className={`font-bold ${isIngreso ? 'text-green-600' : 'text-red-600'}`}>
                {isIngreso ? '+ ' : '- '}
                {formatMoney(rowData.amount)}
            </span>
        );
    };

    const orderBodyTemplate = (rowData) => {
        if (!rowData.order_id) return <span className="text-400 italic">Sin pedido</span>;
        return (
            <Tag
                severity="info"
                value={`Pedido #${rowData.order_id}`}
                icon="pi pi-box"
                className="cursor-pointer"
                onClick={() => navigate('/orders')}
            />
        );
    };

    const categoryBodyTemplate = (rowData) => {
        const label = rowData.category_name || rowData.category?.replace('_', ' ') || '-';
        return <span className="capitalize text-700">{label}</span>;
    };

    return (
        <div>
            <Toast ref={toast} />

            {/* Cabecera */}
            <div className="flex flex-column md:flex-row md:justify-content-between md:align-items-center gap-2 mb-4">
                <div>
                    <h3 className="m-0 font-bold flex align-items-center gap-2">
                        <i className="pi pi-wallet text-primary text-2xl" />
                        Control Financiero y Caja Diaria
                    </h3>
                    <span className="text-500 text-sm">
                        Moneda: <Tag value={`${summary.currency_symbol} (${summary.currency_code})`} severity="info" /> &bull; Balance dinámico en tiempo real (3FN)
                    </span>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <Button
                        label="Categorías"
                        icon="pi pi-sliders-h"
                        className="p-button-outlined p-button-secondary p-button-sm"
                        onClick={() => navigate('/cashbox/settings')}
                    />
                    <Button
                        label="Actualizar"
                        icon="pi pi-refresh"
                        className="p-button-outlined p-button-sm"
                        loading={loading}
                        onClick={loadData}
                    />
                    <Button
                        label="Registrar Ingreso"
                        icon="pi pi-plus"
                        className="p-button-sm p-button-success"
                        onClick={() => openNewMovement('ingreso')}
                    />
                    <Button
                        label="Registrar Egreso"
                        icon="pi pi-minus"
                        className="p-button-sm p-button-danger"
                        onClick={() => openNewMovement('egreso')}
                    />
                </div>
            </div>

            {/* Tarjetas de Resumen Financiero */}
            <div className="grid mb-4">
                <div className="col-12 md:col-6 lg:col-3">
                    <Card className="surface-card border-left-3 border-green-500 shadow-1">
                        <div className="flex justify-content-between align-items-center mb-2">
                            <span className="text-600 font-semibold text-sm">Saldo Actual en Caja</span>
                            <i className="pi pi-dollar text-green-500 text-xl" />
                        </div>
                        <div className={`text-2xl font-bold ${summary.current_balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatMoney(summary.current_balance)}
                        </div>
                        <small className="text-500">Balance neto disponible</small>
                    </Card>
                </div>

                <div className="col-12 md:col-6 lg:col-3">
                    <Card className="surface-card border-left-3 border-teal-500 shadow-1">
                        <div className="flex justify-content-between align-items-center mb-2">
                            <span className="text-600 font-semibold text-sm">Total Ingresos</span>
                            <i className="pi pi-arrow-down-left text-teal-500 text-xl" />
                        </div>
                        <div className="text-2xl font-bold text-teal-700">
                            {formatMoney(summary.total_ingresos)}
                        </div>
                        <small className="text-500">Señas, saldos y extras</small>
                    </Card>
                </div>

                <div className="col-12 md:col-6 lg:col-3">
                    <Card className="surface-card border-left-3 border-orange-500 shadow-1">
                        <div className="flex justify-content-between align-items-center mb-2">
                            <span className="text-600 font-semibold text-sm">Total Egresos</span>
                            <i className="pi pi-arrow-up-right text-orange-500 text-xl" />
                        </div>
                        <div className="text-2xl font-bold text-orange-700">
                            {formatMoney(summary.total_egresos)}
                        </div>
                        <small className="text-500">Filamento, repuestos e insumos</small>
                    </Card>
                </div>

                <div className="col-12 md:col-6 lg:col-3">
                    <Card className="surface-card border-left-3 border-blue-500 shadow-1">
                        <div className="flex justify-content-between align-items-center mb-2">
                            <span className="text-600 font-semibold text-sm">Movimientos</span>
                            <i className="pi pi-list text-blue-500 text-xl" />
                        </div>
                        <div className="text-2xl font-bold text-blue-700">
                            {summary.movements_count}
                        </div>
                        <small className="text-500">Transacciones registradas</small>
                    </Card>
                </div>
            </div>

            {/* Listado Cronológico de Movimientos */}
            <Card className="shadow-1">
                <div className="flex flex-column md:flex-row md:justify-content-between md:align-items-center gap-3 mb-3">
                    <div>
                        <h4 className="m-0 font-bold">Historial de Movimientos</h4>
                        <span className="text-500 text-sm">Orden cronológico (más recientes primero)</span>
                    </div>
                    <div>
                        <SelectButton
                            value={typeFilter}
                            options={TYPE_FILTER_OPTIONS}
                            onChange={(e) => e.value && setTypeFilter(e.value)}
                            className="p-button-sm"
                        />
                    </div>
                </div>

                <DataTable
                    value={movements}
                    loading={loading}
                    paginator
                    rows={10}
                    rowsPerPageOptions={[10, 25, 50]}
                    emptyMessage="No se encontraron movimientos registrados en caja."
                    className="p-datatable-sm"
                    responsiveLayout="scroll"
                >
                    <Column header="Fecha / Hora" body={(r) => formatDate(r.created_at)} style={{ width: '150px' }} />
                    <Column header="Tipo" body={typeBodyTemplate} style={{ width: '120px' }} />
                    <Column header="Categoría" body={categoryBodyTemplate} style={{ width: '160px' }} />
                    <Column field="description" header="Descripción" body={(r) => r.description || <span className="text-400 italic">Sin detalle</span>} />
                    <Column header="Pedido Vinculado" body={orderBodyTemplate} style={{ width: '150px' }} />
                    <Column header="Operador" field="operator_username" body={(r) => r.operator_username || 'Sistema'} style={{ width: '120px' }} />
                    <Column header="Monto" body={amountBodyTemplate} align="right" style={{ width: '140px' }} />
                </DataTable>
            </Card>

            {/* Modal: Registrar Ingreso / Egreso */}
            <Dialog
                header={
                    <span className="flex align-items-center gap-2">
                        <i className={`pi ${movementForm.type === 'ingreso' ? 'pi-plus text-green-500' : 'pi-minus text-red-500'}`} />
                        {movementForm.type === 'ingreso' ? 'Registrar Ingreso de Caja' : 'Registrar Egreso de Caja'}
                    </span>
                }
                visible={dialogVisible}
                style={{ width: '450px' }}
                modal
                onHide={() => setDialogVisible(false)}
                footer={
                    <div>
                        <Button
                            label="Cancelar"
                            icon="pi pi-times"
                            className="p-button-text"
                            onClick={() => setDialogVisible(false)}
                            disabled={saving}
                        />
                        <Button
                            label={movementForm.type === 'ingreso' ? 'Registrar Ingreso' : 'Registrar Egreso'}
                            icon="pi pi-check"
                            className={movementForm.type === 'ingreso' ? 'p-button-success' : 'p-button-danger'}
                            onClick={handleSaveMovement}
                            loading={saving}
                        />
                    </div>
                }
            >
                <div className="p-fluid flex flex-column gap-3 pt-2">
                    <div className="field m-0">
                        <label className="font-semibold block mb-2">Tipo de Movimiento</label>
                        <SelectButton
                            value={movementForm.type}
                            options={[
                                { label: 'Ingreso (+)', value: 'ingreso' },
                                { label: 'Egreso (-)', value: 'egreso' },
                            ]}
                            onChange={(e) => {
                                if (e.value) {
                                    const availableCats = e.value === 'egreso' ? expenseCategories : incomeCategories;
                                    const defaultCat = availableCats[0]?.value || (e.value === 'egreso' ? 'filamento' : 'extraordinario');
                                    setMovementForm((prev) => ({
                                        ...prev,
                                        type: e.value,
                                        category: defaultCat,
                                    }));
                                }
                            }}
                        />
                    </div>

                    <div className="field m-0">
                        <label className="font-semibold block mb-1">Monto ({summary.currency_symbol}) *</label>
                        <InputNumber
                            value={movementForm.amount}
                            onValueChange={(e) => setMovementForm((prev) => ({ ...prev, amount: e.value }))}
                            onBlur={(e) => {
                                let raw = (e.target.value || '').trim();
                                if (raw) {
                                    if (raw.includes(',') && raw.includes('.')) {
                                        raw = raw.replace(/\./g, '').replace(',', '.');
                                    } else if (raw.includes(',')) {
                                        raw = raw.replace(',', '.');
                                    }
                                    const parsed = parseFloat(raw.replace(/[^0-9.-]/g, ''));
                                    if (!isNaN(parsed) && parsed > 0) {
                                        setMovementForm((prev) => ({ ...prev, amount: parsed }));
                                    }
                                }
                            }}
                            mode="decimal"
                            minFractionDigits={2}
                            maxFractionDigits={2}
                            min={0.01}
                            placeholder="0.00"
                            autoFocus
                        />
                    </div>

                    <div className="field m-0">
                        <label className="font-semibold block mb-1">Categoría / Concepto *</label>
                        <Dropdown
                            value={movementForm.category}
                            options={movementForm.type === 'egreso' ? expenseCategories : incomeCategories}
                            onChange={(e) => setMovementForm((prev) => ({ ...prev, category: e.value }))}
                            placeholder="Seleccione categoría"
                        />
                    </div>

                    <div className="field m-0">
                        <label className="font-semibold block mb-1">Descripción / Detalle</label>
                        <InputText
                            value={movementForm.description}
                            onChange={(e) => setMovementForm((prev) => ({ ...prev, description: e.target.value }))}
                            placeholder="Ej. Bobina PLA Blanco Grilon3, Boquilla 0.4mm..."
                            maxLength={255}
                        />
                    </div>

                    <div className="field m-0">
                        <label className="font-semibold block mb-1">ID de Pedido Vinculado (Opcional)</label>
                        <InputNumber
                            value={movementForm.order_id}
                            onValueChange={(e) => setMovementForm((prev) => ({ ...prev, order_id: e.value }))}
                            useGrouping={false}
                            placeholder="Ej. 12"
                        />
                        <small className="text-500">Dejar en blanco si es un movimiento general del taller.</small>
                    </div>
                </div>
            </Dialog>
        </div>
    );
};

export default CashboxView;
