export interface BillingGroup {
  id: string
  name: string
  _count?: { products: number }
}

export interface ProfitCalculation {
  id: string
  groupId: string
  group?: BillingGroup
  periodType: string
  fromMonth: string
  toMonth: string
  totalSales: number
  totalCheques: number
  stockValue: number
  netProfit: number
  createdAt: string
  updatedAt: string
}

export interface Cheque {
  id: string
  groupId: string
  group?: BillingGroup
  chequeNumber: string
  bankName: string | null
  amount: number
  chequeDate: string
  status: 'pending' | 'cleared' | 'bounced' | string
  note: string | null
  createdAt: string
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

export interface SalesInvoiceItem {
  id: string
  productId: string
  product: Product
  qty: number
  rate: number
  costPrice: number
}

export interface SalesInvoice {
  id: string
  invoiceNumber: string
  customerName?: string
  customerPhone?: string
  customerGSTIN?: string
  customerAddress?: string
  billDate: string
  imageUrl?: string
  subTotal: number
  discountAmount: number
  taxAmount: number
  totalAmount: number
  items: SalesInvoiceItem[]
}

export interface Expense {
  id: string
  title: string
  category: string
  amount: number
  groupId?: string | null
  group?: BillingGroup | null
  note?: string
  expenseDate: string
}

export interface CompanyProfitLoss {
  groupId: string | null
  groupName: string
  totalPurchase: number
  totalSales: number
  costOfGoodsSold: number
  expenses: number
  grossProfit: number
  netProfit: number
  simpleProfit: number
  simpleNetProfit: number
}

export interface MonthlyBreakdownRow {
  year: number
  month: number
  purchaseTotal: number
  expensesTotal: number
  salesAmount: number
  hasSalesEntry: boolean
  netProfit: number
  entryId?: string
}

export interface ProfitLossReport {
  from: string | null
  to: string | null
  companies: CompanyProfitLoss[]
  hasUnassignedProducts: boolean
  summary: {
    totalPurchase: number
    totalSales: number
    costOfGoodsSold: number
    expenses: number
    grossProfit: number
    netProfit: number
    generalExpenses: number
    simpleProfit: number
    simpleNetProfit: number
  }
}
