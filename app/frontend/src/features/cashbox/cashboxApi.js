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

export const getCashSummary = async () => {
    const response = await axios.get('/api/cashbox/summary', { headers: getHeaders() });
    return response.data;
};

export const listCashMovements = async (params = {}) => {
    const response = await axios.get('/api/cashbox/movements', {
        headers: getHeaders(),
        params,
    });
    return response.data;
};

export const createCashMovement = async (payload) => {
    const response = await axios.post('/api/cashbox/movements', payload, { headers: getHeaders() });
    return response.data;
};

export const getOrderBalance = async (orderId) => {
    const response = await axios.get(`/api/cashbox/orders/${orderId}/balance`, { headers: getHeaders() });
    return response.data;
};

export const collectOrderBalance = async (orderId, payload = {}) => {
    const response = await axios.post(`/api/cashbox/orders/${orderId}/collect-balance`, payload, {
        headers: getHeaders(),
    });
    return response.data;
};

// ---------------------------------------------------------------------------
// Categories API (Income & Expense)
// ---------------------------------------------------------------------------

export const getCashIncomeCategories = async (all = false) => {
    const response = await axios.get('/api/cashbox/categories/income', {
        headers: getHeaders(),
        params: { all: all ? 'true' : 'false' },
    });
    return response.data;
};

export const createCashIncomeCategory = async (payload) => {
    const response = await axios.post('/api/cashbox/categories/income', payload, {
        headers: getHeaders(),
    });
    return response.data;
};

export const updateCashIncomeCategory = async (id, payload) => {
    const response = await axios.put(`/api/cashbox/categories/income/${id}`, payload, {
        headers: getHeaders(),
    });
    return response.data;
};

export const getCashExpenseCategories = async (all = false) => {
    const response = await axios.get('/api/cashbox/categories/expense', {
        headers: getHeaders(),
        params: { all: all ? 'true' : 'false' },
    });
    return response.data;
};

export const createCashExpenseCategory = async (payload) => {
    const response = await axios.post('/api/cashbox/categories/expense', payload, {
        headers: getHeaders(),
    });
    return response.data;
};

export const updateCashExpenseCategory = async (id, payload) => {
    const response = await axios.put(`/api/cashbox/categories/expense/${id}`, payload, {
        headers: getHeaders(),
    });
    return response.data;
};
