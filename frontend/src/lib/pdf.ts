import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { SalesInvoice } from '../types'
import { formatINR } from './helpers'

// Sales invoice ka clean printable PDF banata hai aur browser me download karta hai.
// Agar invoice.imageUrl (original hand-written bill photo) hai to woh dusre page pe attach hoti hai.
export async function generateSalesInvoicePDF(invoice: SalesInvoice, companyName = 'Deep Trading Co.') {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 40

  // ---- Header ----
  doc.setFillColor(27, 37, 64)
  doc.rect(0, 0, pageWidth, 90, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.text(companyName, margin, 40)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(230, 230, 235)
  doc.text('Sales Invoice', margin, 58)

  doc.setFontSize(11)
  doc.setTextColor(255, 255, 255)
  doc.text(`Invoice #: ${invoice.invoiceNumber}`, pageWidth - margin, 38, { align: 'right' })
  doc.setFontSize(9)
  doc.setTextColor(200, 205, 220)
  doc.text(`Date: ${new Date(invoice.billDate).toLocaleDateString('en-IN')}`, pageWidth - margin, 54, { align: 'right' })

  // ---- Customer block ----
  let y = 120
  doc.setTextColor(27, 37, 64)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Bill To', margin, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(60, 65, 85)
  y += 16
  if (invoice.customerName) { doc.text(invoice.customerName, margin, y); y += 14 }
  if (invoice.customerPhone) { doc.text(`Phone: ${invoice.customerPhone}`, margin, y); y += 14 }
  if (invoice.customerGSTIN) { doc.text(`GSTIN: ${invoice.customerGSTIN}`, margin, y); y += 14 }
  if (invoice.customerAddress) { doc.text(invoice.customerAddress, margin, y, { maxWidth: 260 }); y += 14 }

  // ---- Items table ----
  const rows = invoice.items.map((it, idx) => [
    String(idx + 1),
    it.product?.name || '-',
    `${it.qty} ${it.product?.unit || ''}`.trim(),
    `Rs. ${formatINR(it.rate)}`,
    `Rs. ${formatINR(it.qty * it.rate)}`
  ])

  autoTable(doc, {
    startY: Math.max(y + 12, 175),
    head: [['#', 'Item', 'Qty', 'Rate', 'Amount']],
    body: rows,
    theme: 'grid',
    headStyles: { fillColor: [27, 37, 64], textColor: 255, fontSize: 9.5 },
    bodyStyles: { fontSize: 9.5, textColor: [40, 45, 65] },
    alternateRowStyles: { fillColor: [246, 247, 251] },
    margin: { left: margin, right: margin },
    columnStyles: { 0: { cellWidth: 24 }, 2: { cellWidth: 70 }, 3: { cellWidth: 80 }, 4: { cellWidth: 90 } }
  })

  // ---- Totals ----
  // @ts-ignore - lastAutoTable added by plugin at runtime
  let finalY = (doc as any).lastAutoTable.finalY + 20
  const totalsX = pageWidth - margin - 180
  const valueX = pageWidth - margin

  doc.setFontSize(10)
  doc.setTextColor(60, 65, 85)
  doc.text('Subtotal', totalsX, finalY)
  doc.text(`Rs. ${formatINR(invoice.subTotal)}`, valueX, finalY, { align: 'right' })
  finalY += 16

  if (invoice.discountAmount > 0) {
    doc.text('Discount', totalsX, finalY)
    doc.text(`- Rs. ${formatINR(invoice.discountAmount)}`, valueX, finalY, { align: 'right' })
    finalY += 16
  }
  if (invoice.taxAmount > 0) {
    doc.text('Tax / GST', totalsX, finalY)
    doc.text(`+ Rs. ${formatINR(invoice.taxAmount)}`, valueX, finalY, { align: 'right' })
    finalY += 16
  }

  doc.setDrawColor(220, 222, 232)
  doc.line(totalsX, finalY, valueX, finalY)
  finalY += 18

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(27, 37, 64)
  doc.text('Total', totalsX, finalY)
  doc.text(`Rs. ${formatINR(invoice.totalAmount)}`, valueX, finalY, { align: 'right' })

  // ---- Footer ----
  const pageHeight = doc.internal.pageSize.getHeight()
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(150, 155, 170)
  doc.text('Thank you for your business.', margin, pageHeight - 30)

  // ---- Original bill photo, agar attach ki gayi ho ----
  if (invoice.imageUrl) {
    try {
      doc.addPage()
      doc.setFontSize(11)
      doc.setTextColor(27, 37, 64)
      doc.setFont('helvetica', 'bold')
      doc.text('Original Bill Photo', margin, 40)
      const img = await loadImageDimensions(invoice.imageUrl)
      const maxW = pageWidth - margin * 2
      const maxH = pageHeight - 90
      const ratio = Math.min(maxW / img.width, maxH / img.height)
      const w = img.width * ratio
      const h = img.height * ratio
      doc.addImage(invoice.imageUrl, 'JPEG', margin, 60, w, h)
    } catch {
      // image load fail ho to bhi PDF invoice ke bina rukna nahi chahiye
    }
  }

  doc.save(`${invoice.invoiceNumber}.pdf`)
}

function loadImageDimensions(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}
