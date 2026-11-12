import React from 'react';
import { Link } from 'react-router-dom';

/** Página 403 dentro del layout (conserva el menú). */
const AccessDeniedView = () => (
    <div className="card flex flex-column align-items-center text-center p-5">
        <i className="pi pi-lock text-red-500 mb-3" style={{ fontSize: '3rem' }}></i>
        <h2 className="mt-0 mb-2">Acceso denegado</h2>
        <p className="text-700 mb-4">No tenés permiso para ver esta sección. Si creés que es un error, pedile acceso a un administrador.</p>
        <Link to="/" className="p-button p-component p-button-outlined">
            <i className="pi pi-home mr-2"></i>
            Volver al tablero
        </Link>
    </div>
);

export default AccessDeniedView;
