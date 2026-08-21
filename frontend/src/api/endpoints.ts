import api, { TOKEN_KEY } from './client'

// ---- Auth ----
export const loginApi = (username: string, password: string) =>
  api.post('/auth/login', { username, password }).then(r => r.data)
export const logout = () => localStorage.removeItem(TOKEN_KEY)
export const isLoggedIn = () => !!localStorage.getItem(TOKEN_KEY)

// ---- Groups ----
export const getGroupsApi = () => api.get('/groups').then(r => r.data.data)
export const createGroupApi = (name: string) => api.post('/groups', { name }).then(r => r.data.data)
export const updateGroupApi = (id: string, name: string) => api.put(`/groups/${id}`, { name }).then(r => r.data.data)
export const deleteGroupApi = (id: string) => api.delete(`/groups/${id}`)

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

// ---- Reports ----
export const getProfitLossApi = (from?: string, to?: string) =>
  api.get('/reports/profit-loss', { params: { from, to } }).then(r => r.data.data)

// ---- Monthly Sales (manual entry, per company) ----
export const getMonthlyBreakdownApi = (groupId: string) =>
  api.get(`/monthly-sales/${groupId}`).then(r => r.data.data)
export const saveMonthlySalesApi = (data: { groupId: string; year: number; month: number; salesAmount: number; note?: string }) =>
  api.post('/monthly-sales', data).then(r => r.data.data)
