import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

/**
 * Nombre real del recurso en una ruta de detalle (usuario, grupo, rol) para el breadcrumb.
 * La pantalla de detalle lo publica con useDetailBreadcrumbLabel; AppBreadcrumb lo lee.
 * Sin provider, publicar es un no-op y el breadcrumb usa la etiqueta fija de la ruta.
 */
const DetailBreadcrumbContext = createContext({ label: null, setLabel: () => {} });

export const DetailBreadcrumbProvider = ({ children }) => {
    const [label, setLabel] = useState(null);
    const value = useMemo(() => ({ label, setLabel }), [label]);
    return <DetailBreadcrumbContext.Provider value={value}>{children}</DetailBreadcrumbContext.Provider>;
};

export const useDetailBreadcrumb = () => useContext(DetailBreadcrumbContext).label;

export const useDetailBreadcrumbLabel = (label) => {
    const { setLabel } = useContext(DetailBreadcrumbContext);
    useEffect(() => {
        setLabel(label || null);
        return () => setLabel(null);
    }, [label, setLabel]);
};
