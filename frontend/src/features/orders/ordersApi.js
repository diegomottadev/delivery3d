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

export const listOrders = async () => {
    const response = await axios.get('/api/orders', { headers: getHeaders() });
    return response.data;
};

export const getOrder = async (orderId) => {
    const response = await axios.get(`/api/orders/${orderId}`, { headers: getHeaders() });
    return response.data;
};

export const createOrder = async (payload) => {
    const response = await axios.post('/api/orders', payload, { headers: getHeaders() });
    return response.data;
};

export const updateOrder = async (orderId, payload) => {
    const response = await axios.put(`/api/orders/${orderId}`, payload, { headers: getHeaders() });
    return response.data;
};

export const listMaterials = async () => {
    const response = await axios.get('/api/materials', { headers: getHeaders() });
    return response.data;
};

export const listFilaments = async () => {
    const response = await axios.get('/api/filaments', { headers: getHeaders() });
    return response.data;
};

export const calculateQuote = async (orderId, quoteVars) => {
    const response = await axios.post(
        `/api/orders/${orderId}/quote`,
        { quote_vars: quoteVars },
        { headers: getHeaders() }
    );
    return response.data;
};

export const confirmQuote = async (orderId, informedPrice) => {
    const response = await axios.post(
        `/api/orders/${orderId}/quote/confirm`,
        { informed_price: informedPrice },
        { headers: getHeaders() }
    );
    return response.data;
};

export const approveOrder = async (orderId, depositAmount = null) => {
    const body = depositAmount !== null ? { deposit_amount: depositAmount } : {};
    const response = await axios.post(`/api/orders/${orderId}/approve`, body, { headers: getHeaders() });
    return response.data;
};

export const startPrinting = async (orderId) => {
    const response = await axios.post(`/api/orders/${orderId}/start-printing`, {}, { headers: getHeaders() });
    return response.data;
};

export const markReady = async (orderId) => {
    const response = await axios.post(`/api/orders/${orderId}/mark-ready`, {}, { headers: getHeaders() });
    return response.data;
};

export const deliverOrder = async (orderId, payload = {}) => {
    const response = await axios.post(`/api/orders/${orderId}/deliver`, payload, { headers: getHeaders() });
    return response.data;
};

export const getOrderHistory = async (orderId) => {
    const response = await axios.get(`/api/orders/${orderId}/history`, { headers: getHeaders() });
    return response.data;
};

export const deleteOrder = async (orderId) => {
    const response = await axios.delete(`/api/orders/${orderId}`, { headers: getHeaders() });
    return response.data;
};

export const listPrinters = async (includeInactive = false) => {
    const response = await axios.get(`/api/printers?include_inactive=${includeInactive}`, { headers: getHeaders() });
    return response.data;
};

export const createPrinter = async (payload) => {
    const response = await axios.post('/api/printers', payload, { headers: getHeaders() });
    return response.data;
};

export const updatePrinter = async (printerId, payload) => {
    const response = await axios.put(`/api/printers/${printerId}`, payload, { headers: getHeaders() });
    return response.data;
};

export const getSettings = async () => {
    const response = await axios.get('/api/settings', { headers: getHeaders() });
    return response.data;
};

export const updateSettings = async (payload) => {
    const response = await axios.put('/api/settings', payload, { headers: getHeaders() });
    return response.data;
};
