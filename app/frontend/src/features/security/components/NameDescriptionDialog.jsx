import React, { useEffect, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';

const NAME_MAX = 100;
const DESCRIPTION_MAX = 255;

/** Alta/edición de grupo o rol: nombre (obligatorio, ≤100) y descripción (opcional, ≤255). */
export const NameDescriptionDialog = ({ visible, header, initial, saving = false, fieldErrors = {}, onSave, onHide }) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');

    useEffect(() => {
        if (visible) {
            setName(initial?.name || '');
            setDescription(initial?.description || '');
        }
    }, [visible, initial]);

    const trimmedName = name.trim();
    const nameError = fieldErrors.name || (name.length > NAME_MAX ? `Máximo ${NAME_MAX} caracteres.` : null);
    const descriptionError = fieldErrors.description || (description.length > DESCRIPTION_MAX ? `Máximo ${DESCRIPTION_MAX} caracteres.` : null);
    const valid = trimmedName.length > 0 && name.length <= NAME_MAX && description.length <= DESCRIPTION_MAX;

    const footer = (
        <div>
            <Button label="Cancelar" icon="pi pi-times" className="p-button-text" disabled={saving} onClick={onHide} />
            <Button
                label="Guardar"
                icon="pi pi-check"
                loading={saving}
                disabled={!valid || saving}
                onClick={() => onSave({ name: trimmedName, description: description.trim() })}
            />
        </div>
    );

    return (
        <Dialog header={header} visible={visible} modal style={{ width: '480px', maxWidth: '95vw' }} footer={footer} onHide={() => !saving && onHide()}>
            <div className="p-fluid flex flex-column gap-3">
                <div>
                    <label htmlFor="nd-name" className="font-medium">
                        Nombre *
                    </label>
                    <InputText id="nd-name" value={name} maxLength={NAME_MAX + 1} className={nameError ? 'p-invalid' : ''} onChange={(e) => setName(e.target.value)} />
                    {nameError && <small className="p-error">{nameError}</small>}
                </div>
                <div>
                    <label htmlFor="nd-description" className="font-medium">
                        Descripción
                    </label>
                    <InputTextarea
                        id="nd-description"
                        rows={3}
                        value={description}
                        className={descriptionError ? 'p-invalid' : ''}
                        onChange={(e) => setDescription(e.target.value)}
                    />
                    {descriptionError && <small className="p-error">{descriptionError}</small>}
                </div>
            </div>
        </Dialog>
    );
};

export default NameDescriptionDialog;
