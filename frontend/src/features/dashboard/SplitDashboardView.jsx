import React, { useState, useRef } from 'react';
import { SelectButton } from 'primereact/selectbutton';
import { Toast } from 'primereact/toast';
import OrderBoard from '../orders/OrderBoard';
import CashboxCompactWidget from '../cashbox/CashboxCompactWidget';

const VIEW_OPTIONS = [
    { label: 'Dividida', value: 'split', icon: 'pi pi-pause' },
    { label: 'Solo Pedidos', value: 'full', icon: 'pi pi-th-large' },
];

const SplitDashboardView = () => {
    const [viewMode, setViewMode] = useState('split');
    const cashboxRef = useRef(null);
    const toast = useRef(null);

    const handleOrderStateChanged = (action) => {
        // Automatically refresh cashbox metrics when order balance changes
        if (action === 'approved' || action === 'delivered') {
            cashboxRef.current?.refresh();
            if (action === 'delivered') {
                toast.current?.show({
                    severity: 'info',
                    summary: 'Caja Actualizada',
                    detail: 'El saldo cobrado se acreditó en la caja diaria.',
                    life: 2500,
                });
            }
        }
    };

    const viewModeSwitcher = (
        <div className="flex align-items-center">
            <span className="border-left-1 surface-border h-2rem mx-1 hidden sm:inline-block" />
            <SelectButton
                value={viewMode}
                options={VIEW_OPTIONS}
                onChange={(e) => e.value && setViewMode(e.value)}
                className="p-button-sm"
            />
        </div>
    );

    return (
        <div>
            <Toast ref={toast} />

            {/* Disposición Split-Screen Responsive con toolbar unificado en la misma fila */}
            <div className="grid">
                {/* Panel Izquierdo: Tablero Kanban de Pedidos */}
                <div className={viewMode === 'split' ? 'col-12 xl:col-8' : 'col-12'}>
                    <OrderBoard
                        onOrderStateChanged={handleOrderStateChanged}
                        isSplitView={viewMode === 'split'}
                        showHeader={true}
                        extraActions={viewModeSwitcher}
                    />
                </div>

                {/* Panel Derecho: Módulo Financiero de Caja */}
                {viewMode === 'split' && (
                    <div className="col-12 xl:col-4">
                        <CashboxCompactWidget
                            ref={cashboxRef}
                            onMovementCreated={() => {
                                toast.current?.show({
                                    severity: 'success',
                                    summary: 'Caja Diaria',
                                    detail: 'Movimiento sincronizado correctamente.',
                                    life: 2500,
                                });
                            }}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default SplitDashboardView;
