import api, { TOKEN_KEY } from './client'

// ---- Auth ----
export const loginApi = (username: string, password: string) =>
  api.post('/auth/login', { username, password }).then(r => r.data)
export const logout = () => localStorage.removeItem(TOKEN_KEY)
export const isLoggedIn = () => !!localStorage.getItem(TOKEN_KEY)

// ---- Groups ----
export const getGroupsApi = () => api.get('/groups').then(r => r.data.data)
export const createGroupApi = (name: string) => api.post('/groups', { name }).then(r => r.data.data)

// ---- Products ----
export const getProductsApi = (groupId?: string, search?: string) =>
  api.get('/products', { params: { groupId, search } }).then(r => r.data.data)
export const createProductApi = (data: any) => api.post('/products', data).then(r => r.data.data)
export const updateProductApi = (id: string, data: any) => api.put(`/products/${id}`, data).then(r => r.data.data)
export const deleteProductApi = (id: string) => api.delete(`/products/${id}`)

// ---- Purchase Invoices ----
export const scanPurchaseInvoiceApi = (base64: string, mimeType: string) =>
  api.post('/purchase-invoices/scan', { base64, mimeType }).then(r => r.data)
export const getPurchaseInvoicesApi = () => api.get('/purchase-invoices').then(r => r.data.data)
export const createPurchaseInvoiceApi = (data: any) => api.post('/purchase-invoices', data).then(r => r.data.data)
export const updatePurchaseInvoiceApi = (id: string, data: any) =>
  api.put(`/purchase-invoices/${id}`, data).then(r => r.data.data)
export const deletePurchaseInvoiceApi = (id: string, revertStock = false) =>
  api.delete(`/purchase-invoices/${id}`, { params: { revertStock } })
export const bulkDeletePurchaseInvoicesApi = (ids: string[], revertStock = false) =>
  api.delete('/purchase-invoices/bulk', { data: { ids, revertStock } })

// ---- Sales Invoices ----
export const getSalesInvoicesApi = () => api.get('/sales-invoices').then(r => r.data.data)
export const createSalesInvoiceApi = (data: any) => api.post('/sales-invoices', data).then(r => r.data.data)
export const deleteSalesInvoiceApi = (id: string, revertStock = false) =>
  api.delete(`/sales-invoices/${id}`, { params: { revertStock } })