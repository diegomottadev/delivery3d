import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
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

const CashboxCompactWidget = forwardRef(({ onMovementCreated }, ref) => {
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
    const [recentMovements, setRecentMovements] = useState([]);
    const [incomeCategories, setIncomeCategories] = useState(DEFAULT_INGRESO_CATEGORIES);
    const [expenseCategories, setExpenseCategories] = useState(DEFAULT_EGRESO_CATEGORIES);
    const [loading, setLoading] = useState(true);

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
                listCashMovements({ limit: 8 }),
                getCashIncomeCategories().catch(() => []),
                getCashExpenseCategories().catch(() => []),
            ]);
            setSummary(sumData);
            setRecentMovements(movData);
            if (incCats && incCats.length > 0) {
                setIncomeCategories(incCats.map((c) => ({ label: c.name, value: c.code })));
            }
            if (expCats && expCats.length > 0) {
                setExpenseCategories(expCats.map((c) => ({ label: c.name, value: c.code })));
            }
        } catch (err) {
            toast.current?.show({
                severity: 'error',
                summary: 'Error en Caja',
                detail: err.response?.data?.error || err.message,
                life: 3000,
            });
        } finally {
            setLoading(false);
        }
    };

    useImperativeHandle(ref, () => ({
        refresh: () => {
            loadData();
        },
    }));

    useEffect(() => {
        loadData();
    }, []);

    const openNewMovement = (type = 'egreso') => {
        const availableCats = type === 'egreso' ? expenseCategories : incomeCategories;
        const defaultCat = availableCats[0]?.value || (type === 'egreso' ? 'filamento' : 'extraordinario');
        setMovementForm({
            type,
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
                detail: `${movementForm.type === 'ingreso' ? 'Ingreso' : 'Egreso'} registrado.`,
                life: 3000,
            });
            setDialogVisible(false);
            loadData();
            if (onMovementCreated) {
                onMovementCreated();
            }
        } catch (err) {
            const errDetail = err.response?.data?.errors
                ? Object.values(err.response.data.errors).join(', ')
                : err.response?.data?.error || err.message;
            toast.current?.show({
                severity: 'error',
                summary: 'Error',
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

    const formatTime = (isoString) => {
        if (!isoString) return '';
        try {
            const d = new Date(isoString);
            return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
        } catch {
            return '';
        }
    };

    return (
        <div className="h-full flex flex-column">
            <Toast ref={toast} />

            {/* Cabecera del Panel alineada horizontalmente con Tablero de Pedidos */}
            <div className="flex justify-content-between align-items-center gap-2 mb-3" style={{ minHeight: '33px' }}>
                <div className="flex align-items-center gap-2">
                    <i className="pi pi-wallet text-primary text-base" />
                    <span className="font-bold text-base text-800">Caja Diaria</span>
                </div>
                <div className="flex gap-1">
                    <Button
                        icon="pi pi-refresh"
                        className="p-button-text p-button-rounded p-button-sm text-600"
                        loading={loading}
                        tooltip="Actualizar Caja"
                        tooltipOptions={{ position: 'bottom' }}
                        onClick={loadData}
                    />
                    <Button
                        icon="pi pi-external-link"
                        className="p-button-text p-button-rounded p-button-sm text-600"
                        tooltip="Ver Libro Completo"
                        tooltipOptions={{ position: 'bottom' }}
                        onClick={() => navigate('/cashbox')}
                    />
                </div>
            </div>

            {/* Tarjeta Principal alineada en la misma fila que las tarjetas del Kanban */}
            <Card className="shadow-1 flex-1 flex flex-column surface-card border-round-xl border-1 surface-border">
                {/* Saldo Disponible: Claro, amplio y sin cajas oscuras */}
                <div className="text-center py-2 mb-3">
                <span className="text-xs font-semibold text-500 uppercase block mb-1" style={{ letterSpacing: '0.05em' }}>
                    Saldo Disponible
                </span>
                <div
                    className="font-black text-3xl md:text-4xl line-height-1"
                    style={{
                        color: summary.current_balance >= 0 ? '#15803d' : '#b91c1c',
                        letterSpacing: '-0.02em',
                    }}
                >
                    {formatMoney(summary.current_balance)}
                </div>
            </div>

            {/* Métricas e Ingreso/Egreso en 2 bloques limpios */}
            <div className="grid grid-nogutter gap-2 mb-3">
                {/* Ingresos */}
                <div className="col surface-50 p-2 border-round text-center border-1 surface-border">
                    <span className="text-xs text-600 font-semibold block">Ingresos</span>
                    <span className="text-base font-bold text-green-700 block my-1">
                        {formatMoney(summary.total_ingresos)}
                    </span>
                    <Button
                        label="Ingreso"
                        icon="pi pi-plus"
                        className="p-button-success p-button-sm p-button-outlined w-full font-bold mt-1"
                        style={{ padding: '0.35rem 0.5rem', fontSize: '0.85rem' }}
                        onClick={() => openNewMovement('ingreso')}
                    />
                </div>

                {/* Egresos */}
                <div className="col surface-50 p-2 border-round text-center border-1 surface-border">
                    <span className="text-xs text-600 font-semibold block">Egresos</span>
                    <span className="text-base font-bold text-red-700 block my-1">
                        {formatMoney(summary.total_egresos)}
                    </span>
                    <Button
                        label="Egreso"
                        icon="pi pi-minus"
                        className="p-button-danger p-button-sm p-button-outlined w-full font-bold mt-1"
                        style={{ padding: '0.35rem 0.5rem', fontSize: '0.85rem' }}
                        onClick={() => openNewMovement('egreso')}
                    />
                </div>
            </div>

            {/* Movimientos Recientes */}
            <div className="flex-1 flex flex-column">
                <div className="font-bold text-sm text-700 mb-2">Últimos Movimientos</div>

                {recentMovements.length === 0 ? (
                    <div className="p-3 text-center text-500 text-xs italic surface-50 border-round border-1 surface-border my-auto">
                        No hay movimientos registrados.
                    </div>
                ) : (
                    <div className="overflow-y-auto pr-1" style={{ maxHeight: '340px' }}>
                        {recentMovements.map((m) => {
                            const isIngreso = m.type === 'ingreso';
                            const categoryLabel = m.category_name || m.category?.replace('_', ' ') || '-';

                            return (
                                <div
                                    key={m.id}
                                    className="flex justify-content-between align-items-center p-2 mb-2 surface-50 border-round border-1 surface-border text-sm"
                                >
                                    <div className="flex align-items-center gap-2 overflow-hidden mr-2">
                                        <i
                                            className={`pi ${
                                                isIngreso
                                                    ? 'pi-arrow-down-left text-green-600'
                                                    : 'pi-arrow-up-right text-red-600'
                                            } font-bold text-xs`}
                                        />
                                        <div className="overflow-hidden">
                                            <div className="font-bold text-800 text-xs capitalize text-overflow-ellipsis overflow-hidden white-space-nowrap">
                                                {categoryLabel}
                                                {m.order_id && (
                                                    <Tag
                                                        severity="info"
                                                        value={`#${m.order_id}`}
                                                        className="ml-1 text-xs py-0 px-1 font-semibold"
                                                    />
                                                )}
                                            </div>
                                            {m.description && (
                                                <div className="text-500 text-xs text-overflow-ellipsis overflow-hidden white-space-nowrap">
                                                    {m.description}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right white-space-nowrap">
                                        <div
                                            className={`font-bold text-xs ${
                                                isIngreso ? 'text-green-700' : 'text-red-700'
                                            }`}
                                        >
                                            {isIngreso ? '+' : '-'}
                                            {formatMoney(m.amount)}
                                        </div>
                                        <div className="text-400 text-xs">{formatTime(m.created_at)}</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Modal: Registrar Ingreso / Egreso Rápido */}
            <Dialog
                header={
                    <span className="flex align-items-center gap-2">
                        <i
                            className={`pi ${
                                movementForm.type === 'ingreso' ? 'pi-plus text-green-600' : 'pi-minus text-red-600'
                            }`}
                        />
                        {movementForm.type === 'ingreso' ? 'Registrar Ingreso' : 'Registrar Egreso'}
                    </span>
                }
                visible={dialogVisible}
                style={{ width: '380px' }}
                modal
                onHide={() => setDialogVisible(false)}
                footer={
                    <div>
                        <Button
                            label="Cancelar"
                            icon="pi pi-times"
                            className="p-button-text p-button-sm text-600"
                            onClick={() => setDialogVisible(false)}
                            disabled={saving}
                        />
                        <Button
                            label={movementForm.type === 'ingreso' ? 'Registrar Ingreso' : 'Registrar Egreso'}
                            icon="pi pi-check"
                            className={`p-button-sm font-bold ${
                                movementForm.type === 'ingreso' ? 'p-button-success' : 'p-button-danger'
                            }`}
                            onClick={handleSaveMovement}
                            loading={saving}
                        />
                    </div>
                }
            >
                <div className="p-fluid flex flex-column gap-3 pt-2">
                    <div className="field m-0">
                        <label className="font-semibold text-xs block mb-1">Tipo</label>
                        <SelectButton
                            value={movementForm.type}
                            options={[
                                { label: 'Ingreso (+)', value: 'ingreso' },
                                { label: 'Egreso (-)', value: 'egreso' },
                            ]}
                            onChange={(e) => {
                                if (e.value) {
                                    const availableCats =
                                        e.value === 'egreso' ? expenseCategories : incomeCategories;
                                    const defaultCat =
                                        availableCats[0]?.value ||
                                        (e.value === 'egreso' ? 'filamento' : 'extraordinario');
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
                        <label className="font-semibold text-xs block mb-1">
                            Monto ({summary.currency_symbol}) *
                        </label>
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
                        <label className="font-semibold text-xs block mb-1">Categoría *</label>
                        <Dropdown
                            value={movementForm.category}
                            options={movementForm.type === 'egreso' ? expenseCategories : incomeCategories}
                            onChange={(e) => setMovementForm((prev) => ({ ...prev, category: e.value }))}
                            placeholder="Seleccione categoría"
                        />
                    </div>

                    <div className="field m-0">
                        <label className="font-semibold text-xs block mb-1">Descripción (Opcional)</label>
                        <InputText
                            value={movementForm.description}
                            onChange={(e) => setMovementForm((prev) => ({ ...prev, description: e.target.value }))}
                            placeholder="Detalle del movimiento..."
                            maxLength={255}
                        />
                    </div>
                </div>
            </Dialog>
        </Card>
    </div>
);
});

export default CashboxCompactWidget;
