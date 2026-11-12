import React, { useState, useEffect } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputNumber } from 'primereact/inputnumber';
import { Dropdown } from 'primereact/dropdown';
import { SelectButton } from 'primereact/selectbutton';
import { Divider } from 'primereact/divider';
import { Message } from 'primereact/message';
import { calculateQuote, confirmQuote, listPrinters, getSettings } from './ordersApi';

const MULTIPLIER_OPTIONS = [
    { label: 'x2', value: 2 },
    { label: 'x3', value: 3 },
    { label: 'x4', value: 4 },
    { label: 'x5', value: 5 },
];

const DEFAULT_QUOTE_VARS = {
    printer_id: null,
    waste_purge_pct: 10.0,
    machine_power_watts: 120.0,
    kwh_cost: 278.0,
    machine_cost_per_hour: 100.0,
    labor_cost_per_hour: 650.0,
    labor_time_hours: 0,
    labor_time_minutes: 15,
    profit_multiplier: 2,
};

const formatPrintTime = (minutes) => {
    const mins = parseInt(minutes || 0, 10);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m} min`;
};

const QuoteModal = ({ visible, order, onHide, onQuoteConfirmed }) => {
    const [quoteVars, setQuoteVars] = useState({ ...DEFAULT_QUOTE_VARS });
    const [calculatedPricing, setCalculatedPricing] = useState(null);
    const [informedPrice, setInformedPrice] = useState(null);
    const [loadingCalc, setLoadingCalc] = useState(false);
    const [loadingConfirm, setLoadingConfirm] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [printers, setPrinters] = useState([]);
    const [selectedPrinter, setSelectedPrinter] = useState(null);

    useEffect(() => {
        let isMounted = true;
        if (visible && order) {
            setErrorMessage('');
            const fetchInit = async () => {
                let printersList = [];
                let currentSettings = null;
                try {
                    const [pData, sData] = await Promise.all([
                        listPrinters ? listPrinters() : Promise.resolve([]),
                        getSettings ? getSettings() : Promise.resolve(null),
                    ]);
                    printersList = Array.isArray(pData) ? pData : [];
                    currentSettings = sData;
                    if (isMounted) setPrinters(printersList);
                } catch (e) {
                    console.error('Error fetching printers or settings:', e);
                }

                if (!isMounted) return;

                let initialMultiplier = 2;
                if (order.quote) {
                    if (order.quote.profit_multiplier) {
                        initialMultiplier = Math.round(parseFloat(order.quote.profit_multiplier));
                    } else if (order.quote.profit_margin_pct) {
                        initialMultiplier = Math.round(1 + parseFloat(order.quote.profit_margin_pct) / 100);
                    }
                    const pId = order.quote.printer_id || null;
                    const foundP = printersList.find((p) => p.id === pId);
                    setSelectedPrinter(foundP || null);

                    const initialRate = parseFloat(
                        order.quote.labor_cost_per_hour ?? currentSettings?.labor_cost_per_hour ?? DEFAULT_QUOTE_VARS.labor_cost_per_hour
                    );
                    let totalMins = 15;
                    if (order.quote.labor_time_minutes !== undefined && order.quote.labor_time_minutes !== null) {
                        totalMins = parseInt(order.quote.labor_time_minutes, 10);
                    } else if (currentSettings?.default_labor_time_minutes !== undefined && currentSettings?.default_labor_time_minutes !== null) {
                        totalMins = parseInt(currentSettings.default_labor_time_minutes, 10);
                    }

                    setQuoteVars({
                        printer_id: pId,
                        waste_purge_pct: parseFloat(order.quote.waste_purge_pct ?? currentSettings?.waste_purge_pct ?? DEFAULT_QUOTE_VARS.waste_purge_pct),
                        machine_power_watts: parseFloat(order.quote.machine_power_watts ?? DEFAULT_QUOTE_VARS.machine_power_watts),
                        kwh_cost: parseFloat(order.quote.kwh_cost ?? currentSettings?.kwh_cost ?? DEFAULT_QUOTE_VARS.kwh_cost),
                        machine_cost_per_hour: parseFloat(order.quote.machine_cost_per_hour ?? DEFAULT_QUOTE_VARS.machine_cost_per_hour),
                        labor_cost_per_hour: initialRate,
                        labor_time_hours: Math.floor(totalMins / 60),
                        labor_time_minutes: totalMins % 60,
                        profit_multiplier: [2, 3, 4, 5].includes(initialMultiplier) ? initialMultiplier : 2,
                    });
                } else {
                    const defPrinterId = currentSettings?.default_printer_id || (printersList[0]?.id || null);
                    const defPrinter = printersList.find((p) => p.id === defPrinterId) || printersList[0] || null;
                    setSelectedPrinter(defPrinter);

                    const mult = currentSettings?.profit_multiplier ? Math.round(parseFloat(currentSettings.profit_multiplier)) : 2;
                    const initialRate = parseFloat(currentSettings?.labor_cost_per_hour ?? DEFAULT_QUOTE_VARS.labor_cost_per_hour);
                    const defMins = parseInt(currentSettings?.default_labor_time_minutes ?? 15, 10);

                    setQuoteVars({
                        printer_id: defPrinter?.id || null,
                        waste_purge_pct: parseFloat(currentSettings?.waste_purge_pct ?? DEFAULT_QUOTE_VARS.waste_purge_pct),
                        machine_power_watts: parseFloat(defPrinter?.power_watts ?? DEFAULT_QUOTE_VARS.machine_power_watts),
                        kwh_cost: parseFloat(currentSettings?.kwh_cost ?? DEFAULT_QUOTE_VARS.kwh_cost),
                        machine_cost_per_hour: parseFloat(defPrinter?.cost_per_hour ?? DEFAULT_QUOTE_VARS.machine_cost_per_hour),
                        labor_cost_per_hour: initialRate,
                        labor_time_hours: Math.floor(defMins / 60),
                        labor_time_minutes: defMins % 60,
                        profit_multiplier: [2, 3, 4, 5].includes(mult) ? mult : 2,
                    });
                }
                if (order.pricing) {
                    setCalculatedPricing(order.pricing);
                    setInformedPrice(order.pricing.informed_price ? parseFloat(order.pricing.informed_price) : parseFloat(order.pricing.suggested_sale_price));
                } else {
                    setCalculatedPricing(null);
                    setInformedPrice(null);
                }
            };
            fetchInit();
        }
        return () => {
            isMounted = false;
        };
    }, [visible, order]);

    const handlePrinterSelect = (printerId) => {
        const found = printers.find((p) => p.id === printerId);
        setSelectedPrinter(found || null);
        if (found) {
            setQuoteVars((prev) => ({
                ...prev,
                printer_id: found.id,
                machine_power_watts: parseFloat(found.power_watts),
                machine_cost_per_hour: parseFloat(found.cost_per_hour),
            }));
        } else {
            setQuoteVars((prev) => ({
                ...prev,
                printer_id: null,
            }));
        }
    };

    const handleVarChange = (field, value) => {
        setQuoteVars((prev) => ({ ...prev, [field]: value }));
        if (field === 'profit_multiplier' && calculatedPricing && calculatedPricing.production_cost) {
            const cost = parseFloat(calculatedPricing.production_cost);
            const mult = parseFloat(value || 2);
            const newSuggested = (cost * mult).toFixed(2);
            setCalculatedPricing((prev) => ({
                ...prev,
                suggested_sale_price: newSuggested,
            }));
            setInformedPrice(parseFloat(newSuggested));
        }
    };

    const handleCalculate = async () => {
        if (!order) return;
        setErrorMessage('');
        setLoadingCalc(true);
        const mult = parseFloat(quoteVars.profit_multiplier || 2);
        const totalMinutes = (parseInt(quoteVars.labor_time_hours || 0, 10) * 60) + parseInt(quoteVars.labor_time_minutes || 0, 10);
        const laborRate = parseFloat(quoteVars.labor_cost_per_hour || 0);
        const computedLaborCost = parseFloat((laborRate * (totalMinutes / 60)).toFixed(2));

        try {
            const resp = await calculateQuote(order.id, {
                printer_id: quoteVars.printer_id,
                waste_purge_pct: parseFloat(quoteVars.waste_purge_pct || 0),
                machine_power_watts: parseFloat(quoteVars.machine_power_watts || 0),
                kwh_cost: parseFloat(quoteVars.kwh_cost || 0),
                machine_cost_per_hour: parseFloat(quoteVars.machine_cost_per_hour || 0),
                labor_cost: computedLaborCost,
                labor_cost_per_hour: laborRate,
                labor_time_minutes: totalMinutes,
                profit_multiplier: mult,
                profit_margin_pct: (mult - 1) * 100,
            });
            const pricing = resp.pricing || resp;
            setCalculatedPricing(pricing);
            if (pricing.suggested_sale_price && (!informedPrice || !order.pricing?.informed_price)) {
                setInformedPrice(parseFloat(pricing.suggested_sale_price));
            }
        } catch (err) {
            const errDetail = err.response?.data?.error || err.message;
            setErrorMessage(`Error al calcular: ${errDetail}`);
        } finally {
            setLoadingCalc(false);
        }
    };

    const handleConfirm = async () => {
        if (!order || !informedPrice || informedPrice <= 0) {
            setErrorMessage('Debe ingresar un precio informado mayor a 0 para confirmar el presupuesto.');
            return;
        }
        setErrorMessage('');
        setLoadingConfirm(true);
        try {
            const currentTotalLaborMinutes = (parseInt(quoteVars.labor_time_hours || 0, 10) * 60) + parseInt(quoteVars.labor_time_minutes || 0, 10);
            const mult = parseFloat(quoteVars.profit_multiplier || 2);
            await calculateQuote(order.id, {
                printer_id: quoteVars.printer_id,
                waste_purge_pct: quoteVars.waste_purge_pct,
                machine_power_watts: quoteVars.machine_power_watts,
                kwh_cost: quoteVars.kwh_cost,
                machine_cost_per_hour: quoteVars.machine_cost_per_hour,
                labor_cost_per_hour: quoteVars.labor_cost_per_hour,
                labor_time_minutes: currentTotalLaborMinutes,
                profit_multiplier: mult,
                profit_margin_pct: (mult - 1) * 100,
            });
            const updated = await confirmQuote(order.id, parseFloat(informedPrice));
            if (onQuoteConfirmed) {
                onQuoteConfirmed(updated);
            }
            onHide();
        } catch (err) {
            const errDetail = err.response?.data?.error || err.message;
            setErrorMessage(`Error al confirmar: ${errDetail}`);
        } finally {
            setLoadingConfirm(false);
        }
    };

    if (!order) return null;

    const currentLaborH = parseInt(quoteVars.labor_time_hours || 0, 10);
    const currentLaborM = parseInt(quoteVars.labor_time_minutes || 0, 10);
    const totalLaborHoursDec = currentLaborH + (currentLaborM / 60);
    const previewLaborCost = ((parseFloat(quoteVars.labor_cost_per_hour || 0)) * totalLaborHoursDec).toFixed(2);

    const isNuevo = order.status === 'nuevo';

    const footer = (
        <div className="flex justify-content-between align-items-center">
            <Button
                label="Cerrar"
                icon="pi pi-times"
                className="p-button-text"
                onClick={onHide}
            />
            <div className="flex gap-2">
                <Button
                    label="Calcular Costos"
                    icon="pi pi-calculator"
                    className="p-button-outlined"
                    loading={loadingCalc}
                    onClick={handleCalculate}
                />
                <Button
                    label={isNuevo ? 'Confirmar Presupuesto' : 'Actualizar Cotización'}
                    icon="pi pi-check"
                    disabled={!calculatedPricing}
                    loading={loadingConfirm}
                    onClick={handleConfirm}
                />
            </div>
        </div>
    );

    return (
        <Dialog
            header={
                isNuevo
                    ? `Cotizar Pedido #${order.id} - ${order.client?.name || ''}`
                    : `Cotización / Recalcular Costos Pedido #${order.id} (${order.status.toUpperCase()}) - ${order.client?.name || ''}`
            }
            visible={visible}
            style={{ width: '650px', maxWidth: '95vw' }}
            footer={footer}
            onHide={onHide}
        >
            {errorMessage && (
                <div className="mb-3">
                    <Message severity="error" text={errorMessage} className="w-full" />
                </div>
            )}

            <div className="p-fluid">
                <div className="surface-ground p-3 border-round mb-3">
                    <span className="font-semibold text-sm text-700 block mb-2">Piezas del pedido:</span>
                    <ul className="m-0 pl-3 text-sm">
                        {(order.items || []).map((it, idx) => (
                            <li key={idx}>
                                {it.quantity}x {it.piece_description}
                                {it.filament_name ? ` (${it.filament_name})` : ''} — {it.weight_g}g ({formatPrintTime(it.print_time_minutes)})
                                {it.material_cost_per_kg ? ` — $${it.material_cost_per_kg}/kg` : ''}
                            </li>
                        ))}
                    </ul>
                </div>

                <h5>Variables del Taller {selectedPrinter ? `(${selectedPrinter.name})` : ''}</h5>
                <div className="grid">
                    <div className="col-12 md:col-6 field mb-2">
                        <label htmlFor="printer_select" className="font-semibold">Impresora</label>
                        <Dropdown
                            id="printer_select"
                            value={quoteVars.printer_id}
                            options={printers.map((p) => ({
                                label: `${p.name} (${p.power_watts}W - $${p.cost_per_hour}/h)`,
                                value: p.id,
                            }))}
                            onChange={(e) => handlePrinterSelect(e.value)}
                            placeholder="Seleccione Impresora"
                            className="w-full"
                        />
                    </div>
                    <div className="col-12 md:col-3 field mb-2">
                        <label htmlFor="waste_purge">Merma / Purga (%)</label>
                        <InputNumber
                            id="waste_purge_wrapper"
                            inputId="waste_purge"
                            value={quoteVars.waste_purge_pct}
                            onValueChange={(e) => handleVarChange('waste_purge_pct', e.value)}
                            suffix="%"
                            min={0}
                            max={100}
                        />
                    </div>
                    <div className="col-12 md:col-3 field mb-2">
                        <label htmlFor="machine_power">Potencia A1 / Impresora (Watts)</label>
                        <InputNumber
                            id="machine_power_wrapper"
                            inputId="machine_power"
                            value={quoteVars.machine_power_watts}
                            onValueChange={(e) => handleVarChange('machine_power_watts', e.value)}
                            suffix=" W"
                            min={1}
                        />
                    </div>
                </div>

                <div className="grid">
                    <div className="col-12 md:col-4 field mb-2">
                        <label htmlFor="kwh_cost">Costo kWh ($)</label>
                        <InputNumber
                            id="kwh_cost_wrapper"
                            inputId="kwh_cost"
                            value={quoteVars.kwh_cost}
                            onValueChange={(e) => handleVarChange('kwh_cost', e.value)}
                            mode="currency"
                            currency="ARS"
                            locale="es-AR"
                        />
                    </div>
                    <div className="col-12 md:col-4 field mb-2">
                        <label htmlFor="machine_cost">Amortización / Hora ($)</label>
                        <InputNumber
                            id="machine_cost_wrapper"
                            inputId="machine_cost"
                            value={quoteVars.machine_cost_per_hour}
                            onValueChange={(e) => handleVarChange('machine_cost_per_hour', e.value)}
                            mode="currency"
                            currency="ARS"
                            locale="es-AR"
                        />
                    </div>
                    <div className="col-12 md:col-4 field mb-2">
                        <label htmlFor="labor_cost_per_hour">Tarifa Mano de Obra ($/h)</label>
                        <InputNumber
                            id="labor_cost_per_hour_wrapper"
                            inputId="labor_cost_per_hour"
                            value={quoteVars.labor_cost_per_hour}
                            onValueChange={(e) => handleVarChange('labor_cost_per_hour', e.value)}
                            mode="currency"
                            currency="ARS"
                            locale="es-AR"
                        />
                    </div>
                </div>

                <div className="grid align-items-center mb-2">
                    <div className="col-12 md:col-7 field mb-2">
                        <label className="font-semibold block mb-1">Tiempo Mano de Obra del Operador</label>
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <label htmlFor="labor_time_hours" className="text-xs text-600 block mb-1">Horas</label>
                                <InputNumber
                                    id="labor_time_hours_wrapper"
                                    inputId="labor_time_hours"
                                    value={quoteVars.labor_time_hours}
                                    onValueChange={(e) => handleVarChange('labor_time_hours', e.value ?? 0)}
                                    showButtons
                                    min={0}
                                    suffix=" h"
                                    className="w-full"
                                />
                            </div>
                            <div className="flex-1">
                                <label htmlFor="labor_time_minutes" className="text-xs text-600 block mb-1">Minutos (0-59)</label>
                                <InputNumber
                                    id="labor_time_minutes_wrapper"
                                    inputId="labor_time_minutes"
                                    value={quoteVars.labor_time_minutes}
                                    onValueChange={(e) => handleVarChange('labor_time_minutes', e.value ?? 0)}
                                    showButtons
                                    min={0}
                                    max={59}
                                    suffix=" m"
                                    className="w-full"
                                />
                            </div>
                        </div>
                    </div>
                    <div className="col-12 md:col-5 field mb-2">
                        <div className="surface-100 p-2 border-round border-1 surface-border text-center">
                            <div className="text-xs text-600 font-medium">Mano de Obra Calculada</div>
                            <div className="text-xl font-bold text-primary">${previewLaborCost}</div>
                            <div className="text-xs text-500">
                                {currentLaborH}h {currentLaborM}m ({totalLaborHoursDec.toFixed(2)}h) &times; ${quoteVars.labor_cost_per_hour || 0}/h
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid mb-2">
                    <div className="col-12 field mb-2">
                        <label className="font-semibold block mb-2" htmlFor="profit_multiplier">
                            Margen de Ganancia
                        </label>
                        <SelectButton
                            id="profit_multiplier"
                            value={quoteVars.profit_multiplier}
                            options={MULTIPLIER_OPTIONS}
                            onChange={(e) => {
                                if (e.value) handleVarChange('profit_multiplier', e.value);
                            }}
                            className="w-full flex"
                        />
                    </div>
                </div>

                {calculatedPricing && (
                    <>
                        <Divider />
                        <h5>Desglose de Cotización</h5>
                        <div className="grid text-center mb-3">
                            {calculatedPricing.filament_cost && (
                                <div className="col-6 md:col-3 p-2">
                                    <div className="surface-100 p-2 border-round">
                                        <div className="text-500 text-xs">Filamento</div>
                                        <div className="font-bold text-lg">${calculatedPricing.filament_cost}</div>
                                    </div>
                                </div>
                            )}
                            {calculatedPricing.electricity_cost && (
                                <div className="col-6 md:col-3 p-2">
                                    <div className="surface-100 p-2 border-round">
                                        <div className="text-500 text-xs">Luz</div>
                                        <div className="font-bold text-lg">${calculatedPricing.electricity_cost}</div>
                                    </div>
                                </div>
                            )}
                            {calculatedPricing.machine_cost && (
                                <div className="col-6 md:col-3 p-2">
                                    <div className="surface-100 p-2 border-round">
                                        <div className="text-500 text-xs">Máquina</div>
                                        <div className="font-bold text-lg">${calculatedPricing.machine_cost}</div>
                                    </div>
                                </div>
                            )}
                            {calculatedPricing.labor_cost && (
                                <div className="col-6 md:col-3 p-2">
                                    <div className="surface-100 p-2 border-round">
                                        <div className="text-500 text-xs">Mano de Obra</div>
                                        <div className="font-bold text-lg">${calculatedPricing.labor_cost}</div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="grid mb-3">
                            <div className="col-12 md:col-6">
                                <div className="p-3 surface-card border-1 surface-border border-round">
                                    <div className="text-500 text-sm">Costo Total de Producción</div>
                                    <div className="text-2xl font-bold text-blue-600">${calculatedPricing.production_cost}</div>
                                </div>
                            </div>
                            <div className="col-12 md:col-6">
                                <div className="p-3 surface-card border-1 surface-border border-round">
                                    <div className="text-500 text-sm">
                                        Precio Sugerido de Venta (x{quoteVars.profit_multiplier || 2})
                                    </div>
                                    <div className="text-2xl font-bold text-orange-600">${calculatedPricing.suggested_sale_price}</div>
                                </div>
                            </div>
                        </div>

                        <div className="field mt-3">
                            <label htmlFor="informedPrice" className="font-bold">
                                Precio Final Informado al Cliente ($) *
                            </label>
                            <InputNumber
                                id="informedPrice"
                                value={informedPrice}
                                onValueChange={(e) => setInformedPrice(e.value)}
                                mode="currency"
                                currency="ARS"
                                locale="es-AR"
                                min={0.01}
                                className="w-full"
                            />
                        </div>
                    </>
                )}
            </div>
        </Dialog>
    );
};

export default QuoteModal;
