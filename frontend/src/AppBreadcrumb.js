import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDetailBreadcrumb } from './navigation/DetailBreadcrumbContext';

const AppBreadcrumb = (props) => {
    const location = useLocation();
    const navigate = useNavigate();
    const detailLabel = useDetailBreadcrumb();

    const routeLabel = props.meta?.label || (location.pathname.startsWith('/orders') ? 'Listado de Pedidos' : 'Tablero de Producción');
    const label = props.meta?.backPath && detailLabel ? detailLabel : routeLabel;

    return (
        <div className="route-bar">
            <div className="route-bar-breadcrumb">
                <ul>
                    <li>
                        <button type="button" className="p-link" onClick={() => navigate('/')}>
                            <i className="pi pi-home" />
                        </button>
                    </li>
                    <li>/</li>
                    {location.pathname === '/' ? (
                        <li>Dashboard</li>
                    ) : props.meta?.backPath ? (
                        <>
                            <li>
                                <button type="button" className="p-link" onClick={() => navigate(props.meta.backPath)}>
                                    {props.meta.backLabel}
                                </button>
                            </li>
                            <li>/</li>
                            <li>{label}</li>
                        </>
                    ) : (
                        <li>
                            <button className="p-link">{label}</button>
                        </li>
                    )}
                </ul>
            </div>
        </div>
    );
};

export default AppBreadcrumb;
