import api from './client';

export const fetchCatalogs = () => api.get('/commerce/catalogs');
export const fetchProducts = (catalogId: string, params?: any) => api.get(`/commerce/catalogs/${catalogId}/products`, { params });
export const fetchOrders = (params?: any) => api.get('/commerce/orders', { params });
export const getOrderById = (id: string) => api.get(`/commerce/orders/${id}`);
export const updateOrderStatus = (id: string, status: string) => api.patch(`/commerce/orders/${id}/status`, { status });

export const getCommerceSettings = () => api.get('/commerce/settings');
export const updateCommerceSettings = (data: any) => api.patch('/commerce/settings', data);
