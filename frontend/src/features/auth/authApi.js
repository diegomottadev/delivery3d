import axios from 'axios';

/**
 * Autentica al usuario en el sistema contra el endpoint seguro de la API.
 * @param {string} username - Nombre de usuario
 * @param {string} password - Contraseña en texto plano (enviada sobre HTTPS)
 * @returns {Promise<{token: string, user: Object, expires_in: number}>}
 */
export const login = async (username, password) => {
    const response = await axios.post('/api/auth/login', { username, password });
    return response.data;
};

/**
 * Obtiene el perfil del usuario autenticado actual a partir del token JWT.
 * @param {string} [token] - Token JWT opcional (si no se envía, usa el configurado en axios o localStorage)
 * @returns {Promise<Object>} Datos del usuario { id, username, role, is_active, created_at }
 */
export const getMe = async (token = null) => {
    const headers = {};
    const effectiveToken = token || localStorage.getItem('token');
    if (effectiveToken) {
        headers['Authorization'] = `Bearer ${effectiveToken}`;
    }
    const response = await axios.get('/api/auth/me', { headers });
    return response.data;
};
