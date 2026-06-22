import api, { unwrapData } from './client';

export const fetchCatalogs = () => api.get('/commerce/catalogs');
export const fetchProducts = (catalogId: string, params?: any) => api.get(`/commerce/catalogs/${catalogId}/products`, { params });
export const fetchOrders = (params?: any) => api.get('/commerce/orders', { params });
export const getOrderById = (id: string) => api.get(`/commerce/orders/${id}`);
export const updateOrderStatus = (id: string, status: string) => api.patch(`/commerce/orders/${id}/status`, { status });
export const getCommerceStats = () => api.get<any>('/commerce/stats').then(unwrapData);

export const fetchProductsList = (params?: any) =>
  api.get<any>('/commerce/products', { params });
export const createProduct = (data: any) => api.post('/commerce/products', data);
export const updateProduct = (id: string, data: any) => api.put(`/commerce/products/${id}`, data);
export const deleteProduct = (id: string) => api.delete(`/commerce/products/${id}`);
export const createOrder = (data: any) => api.post('/commerce/orders', data);
export const patchOrders = (data: any) => api.patch('/commerce/orders', data);
export const syncCommerceOrder = (orderId: string) => api.put('/commerce/orders', { orderId });
export const getCheckoutBotStats = () => api.get('/commerce/checkout-bot/stats');

export const getCommerceSettings = () => api.get('/commerce/settings');
export const updateCommerceSettings = (data: any) => api.patch('/commerce/settings', data);
export const saveCommerceSettings = (data: any) => api.post('/commerce/settings', data);
