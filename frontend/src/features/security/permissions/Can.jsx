import { usePermissions } from './PermissionsContext';

/**
 * Muestra `children` solo si el usuario tiene `perm` (o alguno de `anyOf`).
 * Es solo UX: el backend vuelve a validar cada acción.
 */
export const Can = ({ perm, anyOf, fallback = null, children }) => {
    const { can, canAny } = usePermissions();
    const allowed = anyOf ? canAny(...anyOf) : can(perm);
    return allowed ? children : fallback;
};

export default Can;
