import React, { useState, useEffect } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { InputNumber } from 'primereact/inputnumber';
import { Dropdown } from 'primereact/dropdown';
import { Divider } from 'primereact/divider';
import { Message } from 'primereact/message';
import { listFilaments, createOrder, updateOrder } from './ordersApi';

const DEFAULT_ITEM = {
    piece_description: '',
    reference_url: '',
    filament_id: 1,
    cost_per_kg: 18000.0,
    weight_g: 50.0,
    print_time_hours: 1,
    print_time_minutes: 0,
    quantity: 1,
};

const ORIGIN_OPTIONS = [
    { label: 'WhatsApp', value: 'whatsapp' },
    { label: 'Instagram DM', value: 'instagram_dm' },
    { label: 'Otro', value: 'otro' },
];

const OrderIntakeForm = ({ visible, onHide, onOrderCreated, onOrderUpdated, orderToEdit = null }) => {
    const [clientName, setClientName] = useState('');
    const [clientOrigin, setClientOrigin] = useState('whatsapp');
    const [clientPhone, setClientPhone] = useState('');
    const [clientInstagram, setClientInstagram] = useState('');
    const [clientNotes, setClientNotes] = useState('');
    const [items, setItems] = useState([{ ...DEFAULT_ITEM }]);
    const [filaments, setFilaments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        if (visible) {
            listFilaments()
                .then((data) => {
                    setFilaments(data);
                    if (!orderToEdit && data.length > 0) {
                        setItems((prev) =>
                            prev.map((it) => ({
                                ...it,
                                filament_id: it.filament_id || data[0].id,
                            }))
                        );
                    }
                })
                .catch(() => {
                    // Fallback default starter filaments if api unavailable
                    const fallback = [
                        { id: 1, name: 'PLA' },
                        { id: 2, name: 'PETG' },
                    ];
                    setFilaments(fallback);
                    if (!orderToEdit) {
                        setItems((prev) =>
                            prev.map((it) => ({
                                ...it,
                                filament_id: it.filament_id || fallback[0].id,
                            }))
                        );
                    }
                });

            if (orderToEdit) {
                setClientName(orderToEdit.client?.name || '');
                setClientOrigin(orderToEdit.client?.origin || 'whatsapp');
                setClientPhone(orderToEdit.client?.phone || '');
                setClientInstagram(orderToEdit.client?.instagram_username || '');
                setClientNotes(orderToEdit.client?.notes || '');
                if (orderToEdit.items && orderToEdit.items.length > 0) {
                    setItems(
                        orderToEdit.items.map((it) => {
                            const totalMins = parseInt(it.print_time_minutes || 0, 10);
                            return {
                                piece_description: it.piece_description || '',
                                reference_url: it.reference_url || '',
                                filament_id: it.filament_id || 1,
                                cost_per_kg: parseFloat(it.material_cost_per_kg || 18000),
                                weight_g: parseFloat(it.weight_g || 50),
                                print_time_hours: Math.floor(totalMins / 60),
                                print_time_minutes: totalMins % 60,
                                quantity: it.quantity || 1,
                            };
                        })
                    );
                } else {
                    setItems([{ ...DEFAULT_ITEM }]);
                }
                setErrorMessage('');
            } else {
                resetForm();
            }
        }
    }, [visible, orderToEdit]);

    const resetForm = () => {
        setClientName('');
        setClientOrigin('whatsapp');
        setClientPhone('');
        setClientInstagram('');
        setClientNotes('');
        setItems([{ ...DEFAULT_ITEM }]);
        setErrorMessage('');
    };

    const handleAddItem = () => {
        const firstFilId = filaments.length > 0 ? filaments[0].id : 1;
        setItems([...items, { ...DEFAULT_ITEM, filament_id: firstFilId }]);
    };

    const handleRemoveItem = (index) => {
        if (items.length <= 1) return;
        setItems(items.filter((_, i) => i !== index));
    };

    const handleItemChange = (index, field, value) => {
        const updated = [...items];
        updated[index][field] = value;
        setItems(updated);
    };

    const handleDecimalKeyDown = (e) => {
        if (e.key === '.' || e.key === 'Decimal') {
            e.preventDefault();
            const event = new KeyboardEvent('keypress', {
                key: ',',
                charCode: 44,
                keyCode: 44,
                which: 44,
                bubbles: true,
                cancelable: true,
            });
            e.target.dispatchEvent(event);
        }
    };

    const handleSubmit = async () => {
        setErrorMessage('');
        if (!clientName.trim()) {
            setErrorMessage('El nombre del cliente es obligatorio.');
            return;
        }

        for (let i = 0; i < items.length; i++) {
            if (!items[i].piece_description.trim()) {
                setErrorMessage(`La pieza #${i + 1} requiere una descripción.`);
                return;
            }
            if (!items[i].cost_per_kg || items[i].cost_per_kg <= 0) {
                setErrorMessage(`La pieza #${i + 1} requiere un costo de filamento ($/kg) mayor a 0.`);
                return;
            }
            if (!items[i].weight_g || items[i].weight_g <= 0) {
                setErrorMessage(`La pieza #${i + 1} requiere un peso en gramos mayor a 0.`);
                return;
            }
            const hours = parseInt(items[i].print_time_hours || 0, 10);
            const minutes = parseInt(items[i].print_time_minutes || 0, 10);
            const totalMinutes = hours * 60 + minutes;
            if (totalMinutes <= 0) {
                setErrorMessage(`La pieza #${i + 1} requiere un tiempo estimado mayor a 0 minutos.`);
                return;
            }
        }

        const payload = {
            client: {
                name: clientName.trim(),
                origin: clientOrigin,
                phone: clientPhone.trim() || null,
                instagram_username: clientInstagram.trim() || null,
                notes: clientNotes.trim() || null,
            },
            items: items.map((it) => {
                const hours = parseInt(it.print_time_hours || 0, 10);
                const minutes = parseInt(it.print_time_minutes || 0, 10);
                const totalMinutes = hours * 60 + minutes;
                return {
                    filament_id: it.filament_id,
                    material_cost_per_kg: parseFloat(it.cost_per_kg),
                    piece_description: it.piece_description.trim(),
                    reference_url: it.reference_url.trim() || null,
                    weight_g: parseFloat(it.weight_g),
                    print_time_minutes: totalMinutes,
                    quantity: parseInt(it.quantity || 1, 10),
                };
            }),
        };

        try {
            setLoading(true);
            if (orderToEdit) {
                const updated = await updateOrder(orderToEdit.id, payload);
                resetForm();
                if (onOrderUpdated) {
                    onOrderUpdated(updated);
                }
                onHide();
            } else {
                const created = await createOrder(payload);
                resetForm();
                if (onOrderCreated) {
                    onOrderCreated(created);
                }
                onHide();
            }
        } catch (err) {
            const errDetail =
                err.response?.data?.error ||
                (err.response?.data?.errors ? JSON.stringify(err.response.data.errors) : err.message);
            setErrorMessage(`Error al guardar: ${errDetail}`);
        } finally {
            setLoading(false);
        }
    };

    const filamentOptions = filaments.map((f) => ({
        label: f.name,
        value: f.id,
    }));

    const footer = (
        <div>
            <Button
                label="Cancelar"
                icon="pi pi-times"
                className="p-button-text"
                onClick={() => {
                    resetForm();
                    onHide();
                }}
            />
            <Button
                label={orderToEdit ? 'Guardar Cambios' : 'Guardar Pedido'}
                icon="pi pi-check"
                loading={loading}
                onClick={handleSubmit}
            />
        </div>
    );

    return (
        <Dialog
            header={orderToEdit ? `Editar Pedido #${orderToEdit.id}` : 'Alta Manual de Pedido'}
            visible={visible}
            style={{ width: '650px', maxWidth: '95vw' }}
            footer={footer}
            onHide={() => {
                resetForm();
                onHide();
            }}
        >
            {errorMessage && (
                <div className="mb-3">
                    <Message severity="error" text={errorMessage} className="w-full" />
                </div>
            )}

            <div className="p-fluid">
                <h5>Datos del Cliente</h5>
                <div className="field mb-3">
                    <label htmlFor="clientName">Nombre del cliente *</label>
                    <InputText
                        id="clientName"
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        placeholder="Ej. Juan Pérez / @juan3d"
                    />
                </div>

                <div className="grid">
                    <div className="col-12 md:col-6 field mb-3">
                        <label htmlFor="clientOrigin">Canal de origen</label>
                        <Dropdown
                            id="clientOrigin"
                            value={clientOrigin}
                            options={ORIGIN_OPTIONS}
                            onChange={(e) => setClientOrigin(e.value)}
                        />
                    </div>
                    <div className="col-12 md:col-6 field mb-3">
                        <label htmlFor="clientPhone">Teléfono / WhatsApp</label>
                        <InputText
                            id="clientPhone"
                            value={clientPhone}
                            onChange={(e) => setClientPhone(e.target.value)}
                            placeholder="+54 9 11 ..."
                        />
                    </div>
                </div>

                <div className="grid">
                    <div className="col-12 md:col-6 field mb-3">
                        <label htmlFor="clientInstagram">Usuario Instagram</label>
                        <InputText
                            id="clientInstagram"
                            value={clientInstagram}
                            onChange={(e) => setClientInstagram(e.target.value)}
                            placeholder="@usuario"
                        />
                    </div>
                    <div className="col-12 md:col-6 field mb-3">
                        <label htmlFor="clientNotes">Notas del cliente</label>
                        <InputText
                            id="clientNotes"
                            value={clientNotes}
                            onChange={(e) => setClientNotes(e.target.value)}
                            placeholder="Detalles especiales"
                        />
                    </div>
                </div>

                <Divider />

                <div className="flex justify-content-between align-items-center mb-3">
                    <h5 className="m-0">Piezas a Imprimir ({items.length})</h5>
                    <Button
                        type="button"
                        label="Agregar Pieza"
                        icon="pi pi-plus"
                        className="p-button-sm p-button-outlined"
                        onClick={handleAddItem}
                    />
                </div>

                {items.map((item, idx) => (
                    <div key={idx} className="p-3 mb-3 surface-ground border-round">
                        <div className="flex justify-content-between align-items-center mb-2">
                            <span className="font-semibold text-sm text-700">Pieza #{idx + 1}</span>
                            {items.length > 1 && (
                                <Button
                                    icon="pi pi-trash"
                                    className="p-button-rounded p-button-danger p-button-text p-button-sm"
                                    onClick={() => handleRemoveItem(idx)}
                                    tooltip="Eliminar pieza"
                                />
                            )}
                        </div>

                        <div className="field mb-2">
                            <label htmlFor={`pieceDesc_${idx}`}>Descripción de la pieza *</label>
                            <InputText
                                id={`pieceDesc_${idx}`}
                                value={item.piece_description}
                                onChange={(e) => handleItemChange(idx, 'piece_description', e.target.value)}
                                placeholder="Ej: Soporte de auriculares, Maceta low-poly"
                            />
                        </div>

                        <div className="field mb-2">
                            <label htmlFor={`refUrl_${idx}`}>Enlace de referencia / STL (opcional)</label>
                            <InputText
                                id={`refUrl_${idx}`}
                                value={item.reference_url}
                                onChange={(e) => handleItemChange(idx, 'reference_url', e.target.value)}
                                placeholder="https://makerworld.com/..."
                            />
                        </div>

                        <div className="grid">
                            <div className="col-12 md:col-7 field mb-2">
                                <label htmlFor={`filament_${idx}`}>Filamento *</label>
                                <Dropdown
                                    id={`filament_${idx}`}
                                    value={item.filament_id}
                                    options={filamentOptions}
                                    onChange={(e) => handleItemChange(idx, 'filament_id', e.value)}
                                    placeholder="Seleccionar filamento"
                                />
                            </div>
                            <div className="col-12 md:col-5 field mb-2">
                                <label htmlFor={`cost_per_kg_input_${idx}`}>Costo Filamento ($/kg) *</label>
                                <InputNumber
                                    id={`cost_per_kg_${idx}`}
                                    inputId={`cost_per_kg_input_${idx}`}
                                    value={item.cost_per_kg}
                                    onValueChange={(e) => handleItemChange(idx, 'cost_per_kg', e.value)}
                                    mode="currency"
                                    currency="ARS"
                                    locale="es-AR"
                                    min={0.01}
                                    maxFractionDigits={2}
                                    placeholder="18000"
                                />
                            </div>
                        </div>

                        <div className="grid">
                            <div className="col-12 sm:col-3 field mb-2">
                                <label htmlFor={`weight_input_${idx}`}>Peso (g) *</label>
                                <InputNumber
                                    id={`weight_${idx}`}
                                    inputId={`weight_input_${idx}`}
                                    value={item.weight_g}
                                    onValueChange={(e) => handleItemChange(idx, 'weight_g', e.value)}
                                    onKeyDown={handleDecimalKeyDown}
                                    mode="decimal"
                                    locale="es-AR"
                                    min={0.001}
                                    minFractionDigits={0}
                                    maxFractionDigits={3}
                                    placeholder="50"
                                />
                            </div>
                            <div className="col-12 sm:col-6 field mb-2">
                                <label htmlFor={`hours_input_${idx}`}>Tiempo estimado (Horas / Minutos) *</label>
                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <InputNumber
                                            id={`hours_${idx}`}
                                            inputId={`hours_input_${idx}`}
                                            aria-label="Horas (h)"
                                            value={item.print_time_hours}
                                            onValueChange={(e) => handleItemChange(idx, 'print_time_hours', e.value)}
                                            showButtons
                                            min={0}
                                            max={999}
                                            suffix=" h"
                                            placeholder="0"
                                            className="w-full"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <InputNumber
                                            id={`minutes_${idx}`}
                                            inputId={`minutes_input_${idx}`}
                                            aria-label="Minutos (min)"
                                            value={item.print_time_minutes}
                                            onValueChange={(e) => handleItemChange(idx, 'print_time_minutes', e.value)}
                                            showButtons
                                            min={0}
                                            max={59}
                                            suffix=" min"
                                            placeholder="0"
                                            className="w-full"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="col-12 sm:col-3 field mb-2">
                                <label htmlFor={`qty_input_${idx}`}>Cantidad *</label>
                                <InputNumber
                                    id={`qty_${idx}`}
                                    inputId={`qty_input_${idx}`}
                                    value={item.quantity}
                                    onValueChange={(e) => handleItemChange(idx, 'quantity', e.value)}
                                    showButtons
                                    min={1}
                                    placeholder="1"
                                />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </Dialog>
    );
};

export default OrderIntakeForm;
