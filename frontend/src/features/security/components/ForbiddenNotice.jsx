import React from 'react';
import { Message } from 'primereact/message';

/** Aviso para un 403 de la API: la pantalla sigue en pie, solo se reemplaza el contenido denegado. */
export const ForbiddenNotice = ({ message = 'No tenés permiso para ver esta información. Si creés que es un error, pedile acceso a un administrador.' }) => (
    <div data-testid="forbidden-notice" className="my-3">
        <Message severity="warn" text={message} className="w-full justify-content-start" />
    </div>
);

export default ForbiddenNotice;
