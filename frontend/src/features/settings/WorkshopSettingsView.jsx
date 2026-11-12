import React, { useState, useEffect, useRef } from 'react';
import { Card } from 'primereact/card';
import { InputNumber } from 'primereact/inputnumber';
import { InputText } from 'primereact/inputtext';
import { Dropdown } from 'primereact/dropdown';
import { SelectButton } from 'primereact/selectbutton';
import { Button } from 'primereact/button';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Dialog } from 'primereact/dialog';
import { Tag } from 'primereact/tag';
import { Toast } from 'primereact/toast';
import { getSettings, updateSettings, listPrinters, createPrinter, updatePrinter } from '../orders/ordersApi';

const MULTIPLIER_OPTIONS = [
    { label: 'x2', value: 2 },
    { label: 'x3', value: 3 },
    { label: 'x4', value: 4 },
    { label: 'x5', value: 5 },
];

export const CURRENCY_PRESETS = [
    { label: 'Argentina (AR$ - ARS)', code: 'ARS', symbol: 'AR$' },
    { label: 'Dólar Estadounidense (US$ - USD)', code: 'USD', symbol: 'US$' },
    { label: 'Chile ($ - CLP)', code: 'CLP', symbol: '$' },
    { label: 'Colombia ($ - COP)', code: 'COP', symbol: '$' },
    { label: 'México ($ - MXN)', code: 'MXN', symbol: '$' },
    { label: 'Uruguay ($U - UYU)', code: 'UYU', symbol: '$U' },
    { label: 'Perú (S/ - PEN)', code: 'PEN', symbol: 'S/' },
    { label: 'España / Europa (€ - EUR)', code: 'EUR', symbol: '€' },
];

const WorkshopSettingsView = () => {
    const toast = useRef(null);

    // Settings state
    const [settings, setSettings] = useState({
        kwh_cost: 278.0,
        waste_purge_pct: 10.0,
        labor_cost: 1500.0,
        labor_cost_per_hour: 650.0,
        default_labor_time_minutes: 15,
        profit_multiplier: 2,
        default_printer_id: null,
        currency_code: 'ARS',
        currency_symbol: 'AR$',
    });
    const [loadingSettings, setLoadingSettings] = useState(false);
    const [savingSettings, setSavingSettings] = useState(false);

    // Printers state
    const [printers, setPrinters] = useState([]);
    const [loadingPrinters, setLoadingPrinters] = useState(false);
    const [printerDialog, setPrinterDialog] = useState(false);
    const [editingPrinter, setEditingPrinter] = useState(null);
    const [printerForm, setPrinterForm] = useState({
        name: '',
        model: '',
        power_watts: 120,
        cost_per_hour: 100,
        is_active: true,
    });
    const [savingPrinter, setSavingPrinter] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoadingSettings(true);
        setLoadingPrinters(true);
        try {
            const [settingsData, printersData] = await Promise.all([
                getSettings(),
                listPrinters(true),
            ]);
            setSettings({
                kwh_cost: parseFloat(settingsData.kwh_cost || 278),
                waste_purge_pct: parseFloat(settingsData.waste_purge_pct || 10),
                labor_cost: parseFloat(settingsData.labor_cost || 1500),
                labor_cost_per_hour: parseFloat(settingsData.labor_cost_per_hour || 650),
                default_labor_time_minutes: parseInt(settingsData.default_labor_time_minutes ?? 15, 10),
                profit_multiplier: Math.round(parseFloat(settingsData.profit_multiplier || 2)),
                default_printer_id: settingsData.default_printer_id,
                currency_code: settingsData.currency_code || 'ARS',
                currency_symbol: settingsData.currency_symbol || 'AR$',
            });
            setPrinters(printersData);
        } catch (err) {
            toast.current?.show({
                severity: 'error',
                summary: 'Error',
                detail: 'No se pudieron cargar las configuraciones: ' + (err.response?.data?.error || err.message),
                life: 4000,
            });
        } finally {
            setLoadingSettings(false);
            setLoadingPrinters(false);
        }
    };

    const handleSaveSettings = async () => {
        setSavingSettings(true);
        try {
            const updated = await updateSettings({
                kwh_cost: settings.kwh_cost,
                waste_purge_pct: settings.waste_purge_pct,
                labor_cost: settings.labor_cost,
                labor_cost_per_hour: settings.labor_cost_per_hour,
                default_labor_time_minutes: settings.default_labor_time_minutes,
                profit_multiplier: settings.profit_multiplier,
                default_printer_id: settings.default_printer_id,
                currency_code: settings.currency_code,
                currency_symbol: settings.currency_symbol,
            });
            setSettings({
                kwh_cost: parseFloat(updated.kwh_cost),
                waste_purge_pct: parseFloat(updated.waste_purge_pct),
                labor_cost: parseFloat(updated.labor_cost),
                labor_cost_per_hour: parseFloat(updated.labor_cost_per_hour),
                default_labor_time_minutes: parseInt(updated.default_labor_time_minutes ?? 15, 10),
                profit_multiplier: Math.round(parseFloat(updated.profit_multiplier)),
                default_printer_id: updated.default_printer_id,
                currency_code: updated.currency_code || 'ARS',
                currency_symbol: updated.currency_symbol || 'AR$',
            });
            toast.current?.show({
                severity: 'success',
                summary: 'Guardado',
                detail: 'Valores constantes del taller actualizados con éxito.',
                life: 3000,
            });
        } catch (err) {
            toast.current?.show({
                severity: 'error',
                summary: 'Error al guardar',
                detail: err.response?.data?.error || err.message,
                life: 4000,
            });
        } finally {
            setSavingSettings(false);
        }
    };

    const openNewPrinterDialog = () => {
        setEditingPrinter(null);
        setPrinterForm({
            name: '',
            model: '',
            power_watts: 120,
            cost_per_hour: 100,
            is_active: true,
        });
        setPrinterDialog(true);
    };

    const openEditPrinterDialog = (printer) => {
        setEditingPrinter(printer);
        setPrinterForm({
            name: printer.name,
            model: printer.model || '',
            power_watts: parseFloat(printer.power_watts),
            cost_per_hour: parseFloat(printer.cost_per_hour),
            is_active: printer.is_active,
        });
        setPrinterDialog(true);
    };

    const handleSavePrinter = async () => {
        if (!printerForm.name.trim()) {
            toast.current?.show({
                severity: 'warn',
                summary: 'Atención',
                detail: 'El nombre de la impresora es obligatorio.',
                life: 3000,
            });
            return;
        }
        setSavingPrinter(true);
        try {
            if (editingPrinter) {
                await updatePrinter(editingPrinter.id, printerForm);
                toast.current?.show({
                    severity: 'success',
                    summary: 'Actualizada',
                    detail: `Impresora '${printerForm.name}' actualizada correctamente.`,
                    life: 3000,
                });
            } else {
                await createPrinter(printerForm);
                toast.current?.show({
                    severity: 'success',
                    summary: 'Creada',
                    detail: `Impresora '${printerForm.name}' registrada correctamente.`,
                    life: 3000,
                });
            }
            setPrinterDialog(false);
            const printersData = await listPrinters(true);
            setPrinters(printersData);
        } catch (err) {
            toast.current?.show({
                severity: 'error',
                summary: 'Error',
                detail: err.response?.data?.error || err.message,
                life: 4000,
            });
        } finally {
            setSavingPrinter(false);
        }
    };

    const printerOptions = printers
        .filter((p) => p.is_active)
        .map((p) => ({
            label: `${p.name} (${p.power_watts}W - $${p.cost_per_hour}/h)`,
            value: p.id,
        }));

    return (
        <div className="grid">
            <Toast ref={toast} />

            {/* Panel de Constantes Globales */}
            <div className="col-12 lg:col-5">
                <Card
                    title="Valores Constantes del Taller"
                    subTitle="Parámetros predeterminados normalizados que se cargan automáticamente en las cotizaciones"
                    className="h-full"
                >
                    <div className="p-fluid">
                        <div className="field mb-4 p-3 surface-100 border-round">
                            <label className="font-semibold block mb-2 text-primary">
                                <i className="pi pi-dollar mr-1" />
                                Moneda del Taller (Latinoamérica / Global)
                            </label>
                            <div className="field mb-2">
                                <label htmlFor="currency_preset" className="text-sm text-600">Monedas Frecuentes</label>
                                <Dropdown
                                    id="currency_preset"
                                    value={CURRENCY_PRESETS.find(
                                        (p) => p.code === settings.currency_code && p.symbol === settings.currency_symbol
                                    )?.code || null}
                                    options={CURRENCY_PRESETS.map((p) => ({ label: p.label, value: p.code }))}
                                    onChange={(e) => {
                                        const found = CURRENCY_PRESETS.find((p) => p.code === e.value);
                                        if (found) {
                                            setSettings({
                                                ...settings,
                                                currency_code: found.code,
                                                currency_symbol: found.symbol,
                                            });
                                        }
                                    }}
                                    placeholder="Elegir moneda..."
                                    disabled={loadingSettings}
                                />
                            </div>
                            <div className="grid">
                                <div className="col-6">
                                    <label htmlFor="currency_code" className="text-sm text-600">Código ISO</label>
                                    <InputText
                                        id="currency_code"
                                        value={settings.currency_code}
                                        onChange={(e) => setSettings({ ...settings, currency_code: e.target.value.toUpperCase() })}
                                        maxLength={3}
                                        placeholder="ARS"
                                        disabled={loadingSettings}
                                    />
                                </div>
                                <div className="col-6">
                                    <label htmlFor="currency_symbol" className="text-sm text-600">Símbolo</label>
                                    <InputText
                                        id="currency_symbol"
                                        value={settings.currency_symbol}
                                        onChange={(e) => setSettings({ ...settings, currency_symbol: e.target.value })}
                                        maxLength={10}
                                        placeholder="AR$"
                                        disabled={loadingSettings}
                                    />
                                </div>
                            </div>
                            <small className="text-500 block mt-1">
                                Moneda para registrar ingresos, egresos y calcular balances en caja y pedidos.
                            </small>
                        </div>

                        <div className="field mb-3">
                            <label htmlFor="kwh_cost" className="font-semibold">Costo kWh de Electricidad ({settings.currency_symbol})</label>
                            <InputNumber
                                id="kwh_cost"
                                value={settings.kwh_cost}
                                onValueChange={(e) => setSettings({ ...settings, kwh_cost: e.value })}
                                mode="currency"
                                currency="ARS"
                                locale="es-AR"
                                disabled={loadingSettings}
                            />
                            <small className="text-500">Valor fijo por defecto de electricidad para el cálculo de consumo.</small>
                        </div>

                        <div className="field mb-3">
                            <label htmlFor="waste_purge_pct" className="font-semibold">Merma / Purga Predeterminada (%)</label>
                            <InputNumber
                                id="waste_purge_pct"
                                value={settings.waste_purge_pct}
                                onValueChange={(e) => setSettings({ ...settings, waste_purge_pct: e.value })}
                                suffix="%"
                                min={0}
                                max={100}
                                disabled={loadingSettings}
                            />
                            <small className="text-500">Porcentaje de pérdida o purga de filamento por impresión.</small>
                        </div>

                        <div className="field mb-3">
                            <label htmlFor="labor_cost_per_hour" className="font-semibold">Tarifa Mano de Obra ($/h)</label>
                            <InputNumber
                                id="labor_cost_per_hour"
                                value={settings.labor_cost_per_hour}
                                onValueChange={(e) => setSettings({ ...settings, labor_cost_per_hour: e.value })}
                                mode="currency"
                                currency="ARS"
                                locale="es-AR"
                                disabled={loadingSettings}
                            />
                            <small className="text-500">Tarifa horaria para cálculo de mano de obra del operador.</small>
                        </div>

                        <div className="field mb-3">
                            <label htmlFor="default_labor_time_minutes" className="font-semibold">Tiempo Mano de Obra por Defecto (Minutos)</label>
                            <InputNumber
                                id="default_labor_time_minutes"
                                value={settings.default_labor_time_minutes}
                                onValueChange={(e) => setSettings({ ...settings, default_labor_time_minutes: e.value })}
                                suffix=" min"
                                showButtons
                                min={0}
                                disabled={loadingSettings}
                            />
                            <small className="text-500">
                                Tiempo estimado base por pedido ({settings.default_labor_time_minutes || 0} min = {((settings.default_labor_time_minutes || 0) / 60).toFixed(2)} h &rarr; Costo base: ${(((settings.labor_cost_per_hour || 0) * (settings.default_labor_time_minutes || 0)) / 60).toFixed(2)}).
                            </small>
                        </div>

                        <div className="field mb-3">
                            <label className="font-semibold block mb-2">Margen de Ganancia por Defecto</label>
                            <SelectButton
                                value={settings.profit_multiplier}
                                options={MULTIPLIER_OPTIONS}
                                onChange={(e) => {
                                    if (e.value) setSettings({ ...settings, profit_multiplier: e.value });
                                }}
                                disabled={loadingSettings}
                                className="w-full flex"
                            />
                        </div>

                        <div className="field mb-4">
                            <label htmlFor="default_printer" className="font-semibold">Impresora por Defecto</label>
                            <Dropdown
                                id="default_printer"
                                value={settings.default_printer_id}
                                options={printerOptions}
                                onChange={(e) => setSettings({ ...settings, default_printer_id: e.value })}
                                placeholder="Seleccione una impresora"
                                disabled={loadingSettings}
                            />
                            <small className="text-500">Sus especificaciones (potencia y amortización) se asignan automáticamente al cotizar.</small>
                        </div>

                        <Button
                            label="Guardar Constantes"
                            icon="pi pi-check"
                            onClick={handleSaveSettings}
                            loading={savingSettings}
                            className="w-full"
                        />
                    </div>
                </Card>
            </div>

            {/* Panel de Impresoras */}
            <div className="col-12 lg:col-7">
                <Card
                    title="Impresoras del Taller"
                    subTitle="Gestión de hardware: potencia y costo de amortización por hora (1FN, 2FN, 3FN)"
                    className="h-full"
                >
                    <div className="flex justify-content-end mb-3">
                        <Button
                            label="Nueva Impresora"
                            icon="pi pi-plus"
                            className="p-button-sm p-button-success"
                            onClick={openNewPrinterDialog}
                        />
                    </div>

                    <DataTable
                        value={printers}
                        loading={loadingPrinters}
                        responsiveLayout="scroll"
                        emptyMessage="No hay impresoras registradas"
                        className="p-datatable-sm"
                    >
                        <Column field="id" header="ID" style={{ width: '60px' }} />
                        <Column field="name" header="Nombre" className="font-semibold" />
                        <Column field="model" header="Modelo" />
                        <Column
                            field="power_watts"
                            header="Potencia"
                            body={(row) => `${row.power_watts} W`}
                        />
                        <Column
                            field="cost_per_hour"
                            header="Amortización/h"
                            body={(row) => `$${row.cost_per_hour}`}
                        />
                        <Column
                            field="is_active"
                            header="Estado"
                            body={(row) => (
                                <Tag
                                    value={row.is_active ? 'Activa' : 'Inactiva'}
                                    severity={row.is_active ? 'success' : 'danger'}
                                />
                            )}
                        />
                        <Column
                            header="Acciones"
                            body={(row) => (
                                <Button
                                    icon="pi pi-pencil"
                                    className="p-button-rounded p-button-text p-button-sm"
                                    onClick={() => openEditPrinterDialog(row)}
                                    tooltip="Editar Impresora"
                                    tooltipOptions={{ position: 'top' }}
                                />
                            )}
                            style={{ width: '80px', textAlign: 'center' }}
                        />
                    </DataTable>
                </Card>
            </div>

            {/* Dialog para crear / editar impresora */}
            <Dialog
                header={editingPrinter ? `Editar Impresora: ${editingPrinter.name}` : 'Nueva Impresora'}
                visible={printerDialog}
                style={{ width: '480px', maxWidth: '95vw' }}
                onHide={() => setPrinterDialog(false)}
                footer={
                    <div className="flex justify-content-end gap-2">
                        <Button label="Cancelar" icon="pi pi-times" className="p-button-text" onClick={() => setPrinterDialog(false)} />
                        <Button label="Guardar" icon="pi pi-check" onClick={handleSavePrinter} loading={savingPrinter} />
                    </div>
                }
            >
                <div className="p-fluid">
                    <div className="field mb-3">
                        <label htmlFor="printer_name" className="font-semibold">Nombre de la Impresora *</label>
                        <InputText
                            id="printer_name"
                            value={printerForm.name}
                            onChange={(e) => setPrinterForm({ ...printerForm, name: e.target.value })}
                            placeholder="Ej: Bambu Lab A1"
                        />
                    </div>
                    <div className="field mb-3">
                        <label htmlFor="printer_model">Modelo</label>
                        <InputText
                            id="printer_model"
                            value={printerForm.model}
                            onChange={(e) => setPrinterForm({ ...printerForm, model: e.target.value })}
                            placeholder="Ej: A1 o P1S"
                        />
                    </div>
                    <div className="field mb-3">
                        <label htmlFor="printer_power" className="font-semibold">Consumo / Potencia (Watts) *</label>
                        <InputNumber
                            id="printer_power"
                            value={printerForm.power_watts}
                            onValueChange={(e) => setPrinterForm({ ...printerForm, power_watts: e.value })}
                            suffix=" W"
                            min={1}
                        />
                    </div>
                    <div className="field mb-3">
                        <label htmlFor="printer_cost" className="font-semibold">Amortización / Desgaste por Hora ($) *</label>
                        <InputNumber
                            id="printer_cost"
                            value={printerForm.cost_per_hour}
                            onValueChange={(e) => setPrinterForm({ ...printerForm, cost_per_hour: e.value })}
                            mode="currency"
                            currency="ARS"
                            locale="es-AR"
                            min={0}
                        />
                    </div>
                </div>
            </Dialog>
        </div>
    );
};

export default WorkshopSettingsView;
