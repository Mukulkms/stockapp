export interface BillingGroup {
  id: string
  name: string
  _count?: { products: number }
}

export interface Product {
  id: string
  name: string
  groupId: string
  group?: BillingGroup
  unit: string
  costPrice: number
  marginPercent: number | null
  marginFlat: number | null
  sellingPrice: number
  stockQty: number
}

export interface PurchaseInvoiceItem {
  id: string
  productId: string
  product: Product
  qty: number
  costPrice: number
}

export interface PurchaseInvoice {
  id: string
  invoiceNumber?: string
  vendorName?: string
  vendorGSTIN?: string
  vendorPhone?: string
  vendorAddress?: string
  billDate: string
  imageUrl?: string
  subTotal: number
  discountAmount: number
  taxAmount: number
  totalAmount: number
  items: PurchaseInvoiceItem[]
}
