import { useCallback, useRef, useState } from 'react';
import { getApiError } from '../apiError';

const CLOSED = { visible: false, header: '', message: '', confirmLabel: 'Confirmar', impact: null, impactLoading: false, impactError: null, blockedReason: null, confirming: false };

/**
 * Estado de <ConfirmImpactDialog>: open({ header, message, confirmLabel, loadImpact, blockedReason, onConfirm })
 * pide el impacto (api-contract.md §6) y recién con el impacto se habilita confirmar.
 * onConfirm devuelve { ok } (useSecurityMutation): si ok, se cierra.
 */
export const useImpactConfirm = () => {
    const [state, setState] = useState(CLOSED);
    const onConfirmRef = useRef(null);
    const openId = useRef(0);

    const open = useCallback(async ({ header, message, confirmLabel = 'Confirmar', loadImpact, blockedReason = null, onConfirm }) => {
        const id = ++openId.current;
        onConfirmRef.current = onConfirm;
        setState({ ...CLOSED, visible: true, header, message, confirmLabel, blockedReason, impactLoading: true });
        try {
            const impact = await loadImpact();
            if (id === openId.current) setState((prev) => ({ ...prev, impact, impactLoading: false }));
        } catch (err) {
            const { message: text } = getApiError(err);
            if (id === openId.current) setState((prev) => ({ ...prev, impactLoading: false, impactError: `No se pudo calcular el impacto: ${text}` }));
        }
    }, []);

    const onHide = useCallback(() => {
        openId.current += 1;
        setState(CLOSED);
    }, []);

    const onConfirm = useCallback(async () => {
        setState((prev) => ({ ...prev, confirming: true }));
        const outcome = await onConfirmRef.current?.();
        if (outcome && outcome.ok) {
            onHide();
        } else {
            setState((prev) => ({ ...prev, confirming: false }));
        }
    }, [onHide]);

    return { open, dialogProps: { ...state, onConfirm, onHide } };
};

export default useImpactConfirm;
