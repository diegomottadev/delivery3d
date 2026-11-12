import React, { useState, useEffect, useRef } from 'react';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import { Card } from 'primereact/card';
import { Dialog } from 'primereact/dialog';
import { Timeline } from 'primereact/timeline';
import { useNavigate } from 'react-router-dom';
import { listOrders, getOrderHistory, deleteOrder } from './ordersApi';
import OrderIntakeForm from './OrderIntakeForm';
import QuoteModal from './QuoteModal';
import { Can } from '../security/permissions/Can';
import { PERM } from '../security/permissions/perms';

export const getStatusSeverity = (status) => {
    switch (status) {
        case 'nuevo':
            return 'info';
        case 'presupuestado':
            return 'warning';
        case 'aprobado':
            return 'success';
        case 'imprimiendo':
            return 'primary';
        case 'listo':
            return 'help';
        case 'entregado':
            return 'secondary';
        case 'cancelado':
            return 'danger';
        default:
            return null;
    }
};

const OrderList = ({ onSelectOrder, onQuoteOrder, onTransitionOrder }) => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showIntakeModal, setShowIntakeModal] = useState(false);
    const [selectedOrderForEdit, setSelectedOrderForEdit] = useState(null);
    const [selectedOrderForQuote, setSelectedOrderForQuote] = useState(null);
    const [orderToDelete, setOrderToDelete] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [historyOrder, setHistoryOrder] = useState(null);
    const toast = useRef(null);
    const navigate = useNavigate();

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

    const handleOrderCreated = (newOrder) => {
        if (toast.current) {
            toast.current.show({
                severity: 'success',
                summary: 'Pedido Creado',
                detail: `Pedido #${newOrder.id} registrado con éxito.`,
                life: 3000,
            });
        }
        loadOrders();
    };

    const handleOrderUpdated = (updatedOrder) => {
        if (toast.current) {
            toast.current.show({
                severity: 'success',
                summary: 'Pedido Actualizado',
                detail: `Pedido #${updatedOrder.id} modificado con éxito.`,
                life: 3000,
            });
        }
        setSelectedOrderForEdit(null);
        loadOrders();
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

    const statusBodyTemplate = (rowData) => {
        return <Tag value={rowData.status} severity={getStatusSeverity(rowData.status)} />;
    };

    const clientBodyTemplate = (rowData) => {
        const client = rowData.client;
        if (!client) return '-';
        return (
            <div>
                <span className="font-semibold block">{client.name}</span>
                <span className="text-500 text-xs">
                    <i
                        className={`pi mr-1 ${
                            client.origin === 'whatsapp'
                                ? 'pi-whatsapp text-green-500'
                                : client.origin === 'instagram_dm'
                                ? 'pi-instagram text-pink-500'
                                : 'pi-comment text-blue-500'
                        }`}
                    />
                    {client.phone || client.instagram_username || client.origin}
                </span>
            </div>
        );
    };

    const itemsBodyTemplate = (rowData) => {
        const items = rowData.items || [];
        if (items.length === 0) return '-';
        if (items.length === 1) {
            const it = items[0];
            return (
                <span>
                    {it.quantity}x {it.piece_description} ({it.weight_g}g)
                </span>
            );
        }
        return (
            <div>
                <span className="font-medium">{items.length} piezas:</span>
                <div className="text-500 text-xs">
                    {items.map((it) => `${it.quantity}x ${it.piece_description}`).join(', ')}
                </div>
            </div>
        );
    };

    const priceBodyTemplate = (rowData) => {
        const informedPrice = rowData.quote?.informed_price || rowData.pricing?.informed_price;
        const productionCost = rowData.production_cost || rowData.pricing?.production_cost;
        const suggestedPrice = rowData.suggested_sale_price || rowData.pricing?.suggested_sale_price;

        if (informedPrice) {
            return (
                <div>
                    <span className="font-bold text-green-600 block">${informedPrice}</span>
                    {productionCost && <span className="text-500 text-xs">Costo: ${productionCost}</span>}
                </div>
            );
        }
        if (suggestedPrice) {
            return (
                <div>
                    <span className="font-semibold text-orange-600 block">Sugerido: ${suggestedPrice}</span>
                    {productionCost && <span className="text-500 text-xs">Costo: ${productionCost}</span>}
                </div>
            );
        }
        return <span className="text-500 italic text-sm">Sin cotizar</span>;
    };

    const dateBodyTemplate = (rowData) => {
        if (!rowData.created_at) return '-';
        const d = new Date(rowData.created_at);
        return d.toLocaleDateString('es-AR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const actionsBodyTemplate = (rowData) => {
        return (
            <div className="flex gap-1 justify-content-end">
                <Can perm={PERM.ORDERS_UPDATE}>
                    <Button
                        icon="pi pi-pencil"
                        className="p-button-rounded p-button-text p-button-primary p-button-sm"
                        tooltip="Editar Pedido"
                        tooltipOptions={{ position: 'top' }}
                        data-testid={`edit-order-${rowData.id}`}
                        onClick={() => setSelectedOrderForEdit(rowData)}
                    />
                </Can>
                <Can perm={PERM.ORDERS_QUOTE}>
                    <Button
                        icon="pi pi-calculator"
                        className="p-button-rounded p-button-text p-button-warning p-button-sm"
                        tooltip="Cotizar / Ver Cálculo"
                        tooltipOptions={{ position: 'top' }}
                        data-testid={`quote-order-${rowData.id}`}
                        onClick={() => setSelectedOrderForQuote(rowData)}
                    />
                </Can>
                <Button
                    icon="pi pi-history"
                    className="p-button-rounded p-button-text p-button-info p-button-sm"
                    tooltip="Ver Historial"
                    tooltipOptions={{ position: 'top' }}
                    data-testid={`history-order-${rowData.id}`}
                    onClick={() => handleShowHistory(rowData.id)}
                />
                <Button
                    icon="pi pi-th-large"
                    className="p-button-rounded p-button-text p-button-secondary p-button-sm"
                    tooltip="Ver en Tablero"
                    tooltipOptions={{ position: 'top' }}
                    onClick={() => navigate('/')}
                />
                <Can perm={PERM.ORDERS_DELETE}>
                    <Button
                        icon="pi pi-trash"
                        className="p-button-rounded p-button-text p-button-danger p-button-sm"
                        tooltip="Eliminar Pedido"
                        tooltipOptions={{ position: 'top' }}
                        data-testid={`delete-order-${rowData.id}`}
                        onClick={() => setOrderToDelete(rowData)}
                    />
                </Can>
            </div>
        );
    };

    const header = (
        <div className="flex flex-column md:flex-row md:justify-content-between md:align-items-center gap-2">
            <h4 className="m-0 font-bold">Gestión de Pedidos</h4>
            <div className="flex gap-2">
                <Button
                    label="Actualizar"
                    icon="pi pi-refresh"
                    className="p-button-outlined p-button-sm"
                    onClick={loadOrders}
                />
                <Can perm={PERM.ORDERS_CREATE}>
                    <Button
                        label="Nuevo Pedido"
                        icon="pi pi-plus"
                        className="p-button-sm p-button-primary"
                        onClick={() => setShowIntakeModal(true)}
                    />
                </Can>
            </div>
        </div>
    );

    return (
        <Card className="shadow-2">
            <Toast ref={toast} />
            <DataTable
                value={orders}
                loading={loading}
                header={header}
                responsiveLayout="scroll"
                emptyMessage="No se encontraron pedidos."
                rowHover
                stripedRows
                paginator
                rows={10}
                rowsPerPageOptions={[5, 10, 25, 50]}
            >
                <Column header="ID" field="id" sortable style={{ width: '4rem' }} />
                <Column header="Cliente" body={clientBodyTemplate} sortable field="client.name" />
                <Column header="Piezas" body={itemsBodyTemplate} />
                <Column header="Estado" body={statusBodyTemplate} sortable field="status" style={{ width: '8rem' }} />
                <Column header="Valor / Cotización" body={priceBodyTemplate} />
                <Column header="Fecha de Alta" body={dateBodyTemplate} sortable field="created_at" style={{ width: '10rem' }} />
                <Column header="Acciones" body={actionsBodyTemplate} style={{ width: '13rem', textAlign: 'right' }} />
            </DataTable>

            <OrderIntakeForm
                visible={showIntakeModal}
                onHide={() => setShowIntakeModal(false)}
                onOrderCreated={handleOrderCreated}
            />

            {selectedOrderForEdit && (
                <OrderIntakeForm
                    visible={!!selectedOrderForEdit}
                    orderToEdit={selectedOrderForEdit}
                    onHide={() => setSelectedOrderForEdit(null)}
                    onOrderUpdated={handleOrderUpdated}
                />
            )}

            {selectedOrderForQuote && (
                <QuoteModal
                    visible={!!selectedOrderForQuote}
                    order={selectedOrderForQuote}
                    onHide={() => setSelectedOrderForQuote(null)}
                    onQuoteConfirmed={() => {
                        setSelectedOrderForQuote(null);
                        loadOrders();
                    }}
                />
            )}

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
        </Card>
    );
};

export default OrderList;
