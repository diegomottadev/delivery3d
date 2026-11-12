import axios from 'axios';

// Sin sesión no se envía Authorization: el backend responde 401 y AuthContext redirige al login.
const getHeaders = () => {
    const token = localStorage.getItem('token');
    const headers = { 'Content-Type': 'application/json' };
    if (token && token !== 'null' && token !== 'undefined' && token.trim() !== '') {
        headers.Authorization = `Bearer ${token}`;
    }
    return headers;
};

/**
 * Permisos efectivos del usuario autenticado.
 * @returns {Promise<{user_id: number, is_superuser: boolean, permissions: string[]}>}
 */
export const getMyPermissions = async () => {
    const response = await axios.get('/api/auth/me/permissions', { headers: getHeaders() });
    return response.data;
};
