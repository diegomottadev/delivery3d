import React from 'react';
import { Checkbox } from 'primereact/checkbox';

/**
 * Checkboxes de permisos agrupados por resource_label (orden del catálogo del backend).
 * Se muestra la descripción, no el code. `selected` es un Set de codes.
 */
export const PermissionChecklist = ({ catalog, selected, disabled = false, onToggle }) => (
    <div className="grid">
        {catalog.map((group) => (
            <fieldset key={group.resource} data-testid={`perm-group-${group.resource}`} className="col-12 md:col-6 xl:col-4 border-none p-2 m-0">
                <legend className="font-semibold mb-2">{group.resource_label || group.resource}</legend>
                {(group.permissions || []).map((p) => {
                    const inputId = `perm-${p.code.replace(/[^a-z0-9_]/gi, '-')}`;
                    return (
                        <div key={p.code} className="field-checkbox mb-2">
                            <Checkbox inputId={inputId} checked={selected.has(p.code)} disabled={disabled} onChange={() => onToggle(p.code)} />
                            <label htmlFor={inputId}>{p.description}</label>
                        </div>
                    );
                })}
            </fieldset>
        ))}
    </div>
);

export default PermissionChecklist;
