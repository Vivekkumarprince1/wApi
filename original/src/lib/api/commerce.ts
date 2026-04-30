import api from '@/lib/axios';

export interface Product {
    _id: string;
    name: string;
    description?: string;
    price: number;
    currency: string;
    stock: number;
    category?: string;
    images: { url: string; alt?: string; isPrimary: boolean }[];
    isActive: boolean;
}

export interface Order {
    _id: string;
    orderNumber: string;
    items: any[];
    total: number;
    status: string;
    createdAt: string;
    address: any;
}

export const fetchProducts = async () => {
    const response: any = await api.get('/commerce/products');
    return response.products;
};

export const createProduct = async (data: Partial<Product>) => {
    return await api.post('/commerce/products', data);
};

export const fetchOrders = async () => {
    const response: any = await api.get('/commerce/orders');
    return response.orders;
};
