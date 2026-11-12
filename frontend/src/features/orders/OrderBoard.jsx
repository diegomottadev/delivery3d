import React, { useState, useEffect, useRef } from 'react';
import { Button } from 'primereact/button';
import { Tag } from 'primereact/tag';
import { Toast } from 'primereact/toast';
import { Dialog } from 'primereact/dialog';
import { InputNumber } from 'primereact/inputnumber';
import { Timeline } from 'primereact/timeline';
import {
    listOrders,
    approveOrder,
    startPrinting,
    markReady,
    deliverOrder,
    getOrderHistory,
    deleteOrder,
} from './ordersApi';
import { getStatusSeverity } from './OrderList';
import OrderIntakeForm from './OrderIntakeForm';
import QuoteModal from './QuoteModal';

const COLUMNS = [
    { key: 'nuevo', title: 'Por Cotizar', severity: 'info', icon: 'pi-inbox' },
    { key: 'presupuestado', title: 'Presupuestados', severity: 'warning', icon: 'pi-file' },
    { key: 'aprobado', title: 'En Cola / Aprobados', severity: 'success', icon: 'pi-check-circle' },
    { key: 'imprimiendo', title: 'Imprimiendo', severity: 'primary', icon: 'pi-spin pi-cog' },
    { key: 'listo', title: 'Listos para Retiro', severity: 'help', icon: 'pi-box' },
    { key: 'entregado', title: 'Entregados', severity: 'secondary', icon: 'pi-check' },
];

const OrderBoard = ({ onOrderStateChanged, isSplitView = false, showHeader = true, extraActions = null }) => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showIntakeModal, setShowIntakeModal] = useState(false);
    const [selectedOrderForEdit, setSelectedOrderForEdit] = useState(null);
    const [selectedOrderForQuote, setSelectedOrderForQuote] = useState(null);
    const [selectedOrderForApprove, setSelectedOrderForApprove] = useState(null);
    const [selectedOrderForDeliver, setSelectedOrderForDeliver] = useState(null);
    const [orderToDelete, setOrderToDelete] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [collectBalanceOnDeliver, setCollectBalanceOnDeliver] = useState(true);
    const [depositAmount, setDepositAmount] = useState(null);
    const [historyOrder, setHistoryOrder] = useState(null);
    const toast = useRef(null);

    const loadOrders = async () => {
        setLoading(true);
        try {
            const data = await listOrders();
            setOrders(data);
        } catch (err) {
            if (toast.current) {
                toast.current.show({
                    severity: 'error',
                    summary: 'Error',
                    detail: 'No se pudieron cargar los pedidos.',
                    life: 4000,
                });
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadOrders();
    }, []);

    const handleApprove = async () => {
        if (!selectedOrderForApprove) return;
        try {
            await approveOrder(
                selectedOrderForApprove.id,
                depositAmount !== null && depositAmount > 0 ? parseFloat(depositAmount) : null
            );
            if (toast.current) {
                toast.current.show({
                    severity: 'success',
                    summary: 'Pedido Aprobado',
                    detail: `Pedido #${selectedOrderForApprove.id} aprobado con éxito.`,
                    life: 3000,
                });
            }
            setSelectedOrderForApprove(null);
            setDepositAmount(null);
            loadOrders();
            if (onOrderStateChanged) {
                onOrderStateChanged('approved');
            }
        } catch (err) {
            const detail = err.response?.data?.error || err.message;
            if (toast.current) {
                toast.current.show({ severity: 'error', summary: 'Error', detail, life: 4000 });
            }
        }
    };

    const handleStartPrinting = async (orderId) => {
        try {
            await startPrinting(orderId);
            if (toast.current) {
                toast.current.show({
                    severity: 'success',
                    summary: 'Impresión Iniciada',
                    detail: `Pedido #${orderId} está imprimiéndose.`,
                    life: 3000,
                });
            }
            loadOrders();
        } catch (err) {
            const detail = err.response?.data?.error || err.message;
            if (toast.current) {
                toast.current.show({ severity: 'error', summary: 'Error', detail, life: 4000 });
            }
        }
    };

    const handleMarkReady = async (orderId) => {
        try {
            await markReady(orderId);
            if (toast.current) {
                toast.current.show({
                    severity: 'success',
                    summary: 'Pedido Listo',
                    detail: `Pedido #${orderId} listo para retiro o entrega.`,
                    life: 3000,
                });
            }
            loadOrders();
        } catch (err) {
            const detail = err.response?.data?.error || err.message;
            if (toast.current) {
                toast.current.show({ severity: 'error', summary: 'Error', detail, life: 4000 });
            }
        }
    };

    const handleDeliver = (order) => {
        setSelectedOrderForDeliver(order);
        setCollectBalanceOnDeliver(true);
    };

    const confirmDeliver = async () => {
        if (!selectedOrderForDeliver) return;
        try {
            await deliverOrder(selectedOrderForDeliver.id, {
                collect_balance: collectBalanceOnDeliver,
            });
            if (toast.current) {
                toast.current.show({
                    severity: 'success',
                    summary: 'Pedido Entregado',
                    detail: `Pedido #${selectedOrderForDeliver.id} entregado y finalizado.${collectBalanceOnDeliver ? ' Saldo registrado en caja.' : ''}`,
                    life: 3000,
                });
            }
            setSelectedOrderForDeliver(null);
            loadOrders();
            if (onOrderStateChanged) {
                onOrderStateChanged('delivered');
            }
        } catch (err) {
            const detail = err.response?.data?.error || err.message;
            if (toast.current) {
                toast.current.show({ severity: 'error', summary: 'Error', detail, life: 4000 });
            }
        }
    };

    const handleShowHistory = async (orderId) => {
        try {
            const data = await getOrderHistory(orderId);
            setHistoryOrder(data);
        } catch (err) {
            if (toast.current) {
                toast.current.show({
                    severity: 'error',
                    summary: 'Error',
                    detail: 'No se pudo cargar el historial.',
                    life: 3000,
                });
            }
        }
    };

    const handleConfirmDelete = async () => {
        if (!orderToDelete) return;
        setDeleting(true);
        try {
            await deleteOrder(orderToDelete.id);
            if (toast.current) {
                toast.current.show({
                    severity: 'success',
                    summary: 'Pedido Eliminado',
                    detail: `El pedido #${orderToDelete.id} fue eliminado con éxito.`,
                    life: 3000,
                });
            }
            setOrderToDelete(null);
            loadOrders();
            if (onOrderStateChanged) {
                onOrderStateChanged('deleted');
            }
        } catch (err) {
            const detail = err.response?.data?.error || err.message;
            if (toast.current) {
                toast.current.show({
                    severity: 'error',
                    summary: 'Error',
                    detail: `No se pudo eliminar el pedido: ${detail}`,
                    life: 4000,
                });
            }
        } finally {
            setDeleting(false);
        }
    };

    const ordersByStatus = (statusKey) => {
        return orders.filter((o) => o.status === statusKey);
    };

    return (
        <div>
            <Toast ref={toast} />

            {showHeader && (
                <div className="flex justify-content-between align-items-center gap-2 mb-3" style={{ minHeight: '33px' }}>
                    <div className="flex align-items-center gap-2">
                        <i className="pi pi-desktop text-primary text-base" />
                        <span className="font-bold text-base text-800">Tablero de Pedidos</span>
                        <span className="text-400 font-light hidden lg:inline">|</span>
                        <span className="text-600 text-xs font-semibold hidden lg:inline">Tablero Operativo y Finanzas</span>
                    </div>
                    <div className="flex align-items-center gap-2 flex-wrap">
                        <Button
                            label="Actualizar"
                            icon="pi pi-refresh"
                            className="p-button-outlined p-button-sm"
                            loading={loading}
                            onClick={loadOrders}
                        />
                        <Button
                            label="Nuevo Pedido"
                            icon="pi pi-plus"
                            className="p-button-sm p-button-primary font-bold"
                            onClick={() => setShowIntakeModal(true)}
                        />
                        {extraActions}
                    </div>
                </div>
            )}

            <div className="grid">
                {COLUMNS.map((col) => {
                    const colOrders = ordersByStatus(col.key);
                    return (
                        <div
                            key={col.key}
                            className={isSplitView ? 'col-12 sm:col-6 lg:col-4 p-2' : 'col-12 md:col-6 lg:col-2 p-2'}
                        >
                            <div className="surface-card border-round p-3 shadow-1 h-full flex flex-column">
                                <div className="flex justify-content-between align-items-center mb-3">
                                    <span className="font-bold text-sm text-700 flex align-items-center gap-1">
                                        <i className={`pi ${col.icon} text-xs`} />
                                        {col.title}
                                    </span>
                                    <Tag value={colOrders.length} severity={col.severity} />
                                </div>

                                <div className="flex-1 flex flex-column gap-2 overflow-y-auto" style={{ minHeight: '300px' }}>
                                    {colOrders.length === 0 && (
                                        <div className="text-center text-400 text-xs italic py-4">
                                            Sin pedidos
                                        </div>
                                    )}

                                    {colOrders.map((ord) => (
                                        <div
                                            key={ord.id}
                                            className="surface-100 p-2 border-round border-1 surface-border hover:shadow-2 transition-duration-150"
                                        >
                                            <div className="flex justify-content-between align-items-center mb-1">
                                                <span className="font-bold text-sm">#{ord.id}</span>
                                                <div className="flex gap-1">
                                                    <Button
                                                        icon="pi pi-pencil"
                                                        className="p-button-rounded p-button-text p-button-primary p-button-xs"
                                                        tooltip="Editar Pedido"
                                                        tooltipOptions={{ position: 'top' }}
                                                        onClick={() => setSelectedOrderForEdit(ord)}
                                                    />
                                                    <Button
                                                        icon="pi pi-calculator"
                                                        className="p-button-rounded p-button-text p-button-warning p-button-xs"
                                                        tooltip="Cotizar / Ver Cálculo"
                                                        tooltipOptions={{ position: 'top' }}
                                                        onClick={() => setSelectedOrderForQuote(ord)}
                                                    />
                                                    <Button
                                                        icon="pi pi-history"
                                                        className="p-button-rounded p-button-text p-button-secondary p-button-xs"
                                                        tooltip="Ver Historial"
                                                        tooltipOptions={{ position: 'top' }}
                                                        onClick={() => handleShowHistory(ord.id)}
                                                    />
                                                    <Button
                                                        icon="pi pi-trash"
                                                        className="p-button-rounded p-button-text p-button-danger p-button-xs"
                                                        tooltip="Eliminar Pedido"
                                                        tooltipOptions={{ position: 'top' }}
                                                        data-testid={`delete-order-${ord.id}`}
                                                        onClick={() => setOrderToDelete(ord)}
                                                    />
                                                </div>
                                            </div>

                                            <div className="font-semibold text-xs text-800 mb-1">
                                                {ord.client?.name || 'Cliente'}
                                            </div>

                                            <div className="text-500 text-xs mb-2">
                                                {(ord.items || []).map((it) => `${it.quantity}x ${it.piece_description}`).join(', ')}
                                            </div>

                                            {ord.pricing && (
                                                <div
                                                    className="text-xs mb-2 cursor-pointer hover:surface-200 p-1 border-round transition-duration-150 inline-block"
                                                    title="Clic para ver o recalcular cotización"
                                                    onClick={() => setSelectedOrderForQuote(ord)}
                                                >
                                                    {ord.pricing.informed_price ? (
                                                        <span className="font-bold text-green-600 hover:underline">
                                                            ${ord.pricing.informed_price}
                                                        </span>
                                                    ) : (
                                                        <span className="font-medium text-orange-600 hover:underline">
                                                            Sug: ${ord.pricing.suggested_sale_price}
                                                        </span>
                                                    )}
                                                </div>
                                            )}

                                            <div className="flex flex-column gap-1 mt-2">
                                                {ord.status === 'nuevo' && (
                                                    <Button
                                                        label="Cotizar"
                                                        icon="pi pi-calculator"
                                                        className="p-button-sm p-button-outlined w-full"
                                                        onClick={() => setSelectedOrderForQuote(ord)}
                                                    />
                                                )}

                                                {ord.status === 'presupuestado' && (
                                                    <Button
                                                        label="Aprobar"
                                                        icon="pi pi-check"
                                                        className="p-button-sm p-button-success w-full"
                                                        onClick={() => {
                                                            setSelectedOrderForApprove(ord);
                                                            setDepositAmount(null);
                                                        }}
                                                    />
                                                )}

                                                {ord.status === 'aprobado' && (
                                                    <Button
                                                        label="Imprimir"
                                                        icon="pi pi-play"
                                                        className="p-button-sm p-button-primary w-full"
                                                        onClick={() => handleStartPrinting(ord.id)}
                                                    />
                                                )}

                                                {ord.status === 'imprimiendo' && (
                                                    <Button
                                                        label="Marcar Listo"
                                                        icon="pi pi-box"
                                                        className="p-button-sm p-button-help w-full"
                                                        onClick={() => handleMarkReady(ord.id)}
                                                    />
                                                )}

                                                {ord.status === 'listo' && (
                                                    <Button
                                                        label="Entregar"
                                                        icon="pi pi-check-circle"
                                                        className="p-button-sm p-button-secondary w-full"
                                                        onClick={() => handleDeliver(ord)}
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Modal Alta */}
            <OrderIntakeForm
                visible={showIntakeModal}
                onHide={() => setShowIntakeModal(false)}
                onOrderCreated={() => {
                    if (toast.current) {
                        toast.current.show({
                            severity: 'success',
                            summary: 'Pedido Creado',
                            detail: 'Nuevo pedido registrado con éxito.',
                            life: 3000,
                        });
                    }
                    loadOrders();
                }}
            />

            {/* Modal Edición */}
            {selectedOrderForEdit && (
                <OrderIntakeForm
                    visible={!!selectedOrderForEdit}
                    orderToEdit={selectedOrderForEdit}
                    onHide={() => setSelectedOrderForEdit(null)}
                    onOrderUpdated={(updated) => {
                        if (toast.current) {
                            toast.current.show({
                                severity: 'success',
                                summary: 'Pedido Actualizado',
                                detail: `Pedido #${updated.id} modificado con éxito.`,
                                life: 3000,
                            });
                        }
                        setSelectedOrderForEdit(null);
                        loadOrders();
                    }}
                />
            )}

            {/* Modal Cotización */}
            <QuoteModal
                visible={!!selectedOrderForQuote}
                order={selectedOrderForQuote}
                onHide={() => {
                    setSelectedOrderForQuote(null);
                    loadOrders();
                }}
                onQuoteConfirmed={(updated) => {
                    if (toast.current) {
                        toast.current.show({
                            severity: 'success',
                            summary: updated?.status === 'nuevo' ? 'Presupuestado' : 'Cotización Actualizada',
                            detail: `Cotización del Pedido #${updated?.id || ''} guardada con éxito.`,
                            life: 3000,
                        });
                    }
                    setSelectedOrderForQuote(null);
                    loadOrders();
                }}
            />

            {/* Modal Aprobar con Seña */}
            <Dialog
                header={`Aprobar Pedido #${selectedOrderForApprove?.id}`}
                visible={!!selectedOrderForApprove}
                style={{ width: '420px', maxWidth: '95vw' }}
                footer={
                    <div>
                        <Button
                            label="Cancelar"
                            icon="pi pi-times"
                            className="p-button-text"
                            onClick={() => setSelectedOrderForApprove(null)}
                        />
                        <Button
                            label="Confirmar Aprobación"
                            icon="pi pi-check"
                            className="p-button-success"
                            onClick={handleApprove}
                        />
                    </div>
                }
                onHide={() => setSelectedOrderForApprove(null)}
            >
                <div className="p-fluid">
                    <p className="text-sm text-600 mb-3">
                        Cliente:{' '}
                        <strong>{selectedOrderForApprove?.client?.name}</strong>
                    </p>
                    <div className="field mb-3">
                        <label htmlFor="deposit">Monto de Seña / Anticipo ($) (Opcional)</label>
                        <InputNumber
                            id="deposit_wrapper"
                            inputId="deposit"
                            value={depositAmount}
                            onValueChange={(e) => setDepositAmount(e.value)}
                            mode="currency"
                            currency="ARS"
                            locale="es-AR"
                            min={0}
                            placeholder="$ 0,00"
                        />
                        <small className="text-500 block mt-1">
                            Si se ingresa un monto mayor a 0, se registrará automáticamente en la Caja Diaria.
                        </small>
                    </div>
                </div>
            </Dialog>

            {/* Modal Historial */}
            <Dialog
                header={`Historial del Pedido #${historyOrder?.id}`}
                visible={!!historyOrder}
                style={{ width: '500px', maxWidth: '95vw' }}
                onHide={() => setHistoryOrder(null)}
            >
                {historyOrder && (
                    <div>
                        <div className="mb-3">
                            <span className="text-500 text-sm">Estado actual: </span>
                            <Tag
                                value={historyOrder.status}
                                severity={getStatusSeverity(historyOrder.status)}
                            />
                        </div>
                        <Timeline
                            value={historyOrder.status_history || []}
                            content={(item) => (
                                <div className="mb-2">
                                    <div className="font-semibold text-sm">
                                        {item.from_status ? `${item.from_status} → ` : ''}
                                        {item.to_status}
                                    </div>
                                    <div className="text-500 text-xs">
                                        {item.changed_at
                                            ? new Date(item.changed_at).toLocaleString('es-AR')
                                            : ''}
                                    </div>
                                </div>
                            )}
                        />
                    </div>
                )}
            </Dialog>

            {/* Modal Entrega y Cobro de Saldo */}
            <Dialog
                header={`Confirmar Entrega — Pedido #${selectedOrderForDeliver?.id || ''}`}
                visible={!!selectedOrderForDeliver}
                style={{ width: '450px', maxWidth: '95vw' }}
                onHide={() => setSelectedOrderForDeliver(null)}
                footer={
                    <div>
                        <Button
                            label="Cancelar"
                            icon="pi pi-times"
                            className="p-button-text"
                            onClick={() => setSelectedOrderForDeliver(null)}
                        />
                        <Button
                            label="Confirmar Entrega"
                            icon="pi pi-check"
                            className="p-button-secondary"
                            onClick={confirmDeliver}
                        />
                    </div>
                }
            >
                <div className="p-fluid">
                    <p className="text-sm text-700 mb-3">
                        ¿Deseas marcar como entregado y finalizado el pedido del cliente{' '}
                        <strong>{selectedOrderForDeliver?.client?.name}</strong>?
                    </p>

                    {selectedOrderForDeliver?.pricing?.informed_price && (
                        <div className="p-3 surface-100 border-round mb-2">
                            <div className="flex justify-content-between align-items-center mb-2">
                                <span className="text-600 text-sm">Precio Cotizado:</span>
                                <span className="font-bold text-primary">
                                    ${parseFloat(selectedOrderForDeliver.pricing.informed_price).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                </span>
                            </div>

                            <div className="flex align-items-center mt-3 gap-2">
                                <input
                                    type="checkbox"
                                    id="collect_balance_chk"
                                    checked={collectBalanceOnDeliver}
                                    onChange={(e) => setCollectBalanceOnDeliver(e.target.checked)}
                                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                />
                                <label htmlFor="collect_balance_chk" className="font-semibold text-sm cursor-pointer select-none">
                                    Cobrar y asentar saldo pendiente en Caja Diaria
                                </label>
                            </div>
                            <small className="text-500 block mt-1">
                                Genera automáticamente un movimiento de ingreso en caja descontando señas previas.
                            </small>
                        </div>
                    )}
                </div>
            </Dialog>

            {/* Modal Confirmación de Eliminación */}
            <Dialog
                header="Confirmar Eliminación de Pedido"
                visible={!!orderToDelete}
                style={{ width: '460px', maxWidth: '95vw' }}
                modal
                onHide={() => {
                    if (!deleting) setOrderToDelete(null);
                }}
                footer={
                    <div>
                        <Button
                            label="Cancelar"
                            icon="pi pi-times"
                            className="p-button-text"
                            disabled={deleting}
                            onClick={() => setOrderToDelete(null)}
                        />
                        <Button
                            label="Sí, eliminar pedido"
                            icon="pi pi-trash"
                            className="p-button-danger"
                            loading={deleting}
                            data-testid="confirm-delete-button"
                            onClick={handleConfirmDelete}
                        />
                    </div>
                }
            >
                <div className="flex flex-column gap-3">
                    <div className="flex align-items-start gap-3">
                        <i className="pi pi-exclamation-triangle text-red-500 text-3xl mt-1" />
                        <div>
                            <p className="font-bold text-base text-900 m-0 mb-1">
                                ¿Estás seguro de que deseas eliminar el pedido #{orderToDelete?.id}?
                            </p>
                            <div className="text-sm text-700 mb-1">
                                Cliente: <strong>{orderToDelete?.client?.name || 'Sin nombre'}</strong>
                            </div>
                            <div className="text-xs text-600 flex align-items-center gap-1">
                                Estado actual:{' '}
                                <Tag
                                    value={orderToDelete?.status}
                                    severity={orderToDelete ? getStatusSeverity(orderToDelete.status) : null}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="p-3 surface-100 border-round border-left-3 border-red-500">
                        <span className="text-xs text-700 line-height-3 block">
                            <strong>Advertencia:</strong> Esta acción es irreversible. Se eliminarán los ítems, descripciones y cotizaciones vinculadas a este pedido. Si existen señas o cobros registrados en caja, se mantendrán para preservar el arqueo físico.
                        </span>
                    </div>
                </div>
            </Dialog>
        </div>
    );
};

export default OrderBoard;
