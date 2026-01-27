import { format, isValid } from "date-fns";
import { id } from "date-fns/locale";

interface InvoiceData {
  invoice_number: string;
  invoice_date: string;
  quotation: {
    quotation_number: string;
    request: {
      title: string;
      letter_number: string;
      request_date: string;
      customer: {
        company_name: string;
        delivery_address: string;
        customer_code: string;
      };
      customer_pic: {
        name: string;
      };
    };
  };
  items: any[]; // Balance Items
  settings?: {
    discount_percentage?: number;
    ppn_percentage?: number;
    payment_terms?: string;
  };
}

interface CompanyData {
  name: string;
  address: string;
  phone: string;
  email?: string;
  logo_path: string | null;
}

interface SignerData {
  name: string;
  position: string;
}

export const printInvoice = (
  invoice: InvoiceData,
  company: CompanyData,
  signer: SignerData | null,
  getStorageUrl: (path: string) => string
) => {
  // Helper to format currency
  const formatCurrency = (amount: number) => {
    return "Rp " + amount.toLocaleString("id-ID");
  };

  // Calculate totals
  const totalAmount = invoice.items.reduce((sum, item) => sum + (item.total_selling_price || 0), 0);
  const discountPercentage = invoice.settings?.discount_percentage || 0;
  const discountAmount = totalAmount * (discountPercentage / 100);
  const afterDiscount = totalAmount - discountAmount;
  const ppnAmount = Math.round(afterDiscount * (invoice.settings?.ppn_percentage ? (invoice.settings.ppn_percentage / 100) : 0));
  const grandTotal = Math.round(afterDiscount + ppnAmount);

  const logoUrl = company?.logo_path ? getStorageUrl(company.logo_path) : "";

  // Generate QR Code URL
  const companyPhone = company?.phone?.replace(/\D/g, "") || "";
  const formattedCompanyPhone = companyPhone.startsWith("0") ? "62" + companyPhone.slice(1) : companyPhone;
  const whatsappMessage = `Hallo dari ${invoice.quotation.request.customer.company_name} mau nanya terkait ini\n\nNo Invoice: ${invoice.invoice_number}\nNo Penawaran: ${invoice.quotation.quotation_number}`;
  // Add status check (invoice object needs to have status, assume passed in 'invoice' arg)
  const isApproved = (invoice as any).status === 'approved';
  const qrCodeUrl = (isApproved && formattedCompanyPhone) ? `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(`https://wa.me/${formattedCompanyPhone}?text=${encodeURIComponent(whatsappMessage)}`)}` : "";

  // Create a hidden iframe
  let iframe = document.getElementById('print-iframe-invoice') as HTMLIFrameElement;
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = 'print-iframe-invoice';
    iframe.style.position = 'fixed';
    iframe.style.top = '-9999px';
    iframe.style.left = '-9999px';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);
  }

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    console.error("Could not get iframe document");
    return;
  }

  // Delivery Time Calculation
  const calculateMaxDeliveryTime = () => {
    if (invoice.items.length === 0) return "-";
    const parseDuration = (str: string) => {
      if (!str) return 0;
      const normalized = str.toLowerCase();
      const value = parseInt(normalized.replace(/\D/g, '')) || 0;
      if (normalized.includes("week") || normalized.includes("minggu")) return value * 7;
      if (normalized.includes("month") || normalized.includes("bulan")) return value * 30;
      return value;
    };
    let maxDuration = 0;
    let maxStr = "-";
    invoice.items.forEach(item => {
      const duration = parseDuration(item.delivery_time);
      if (duration > maxDuration) {
        maxDuration = duration;
        maxStr = item.delivery_time;
      }
    });
    return maxStr;
  };


  doc.open();
  doc.write(`
      <html>
        <head>
          <title>INV_${invoice.invoice_number.replace(/\//g, '-')}</title>
          <style>
             @page { margin: 15mm; size: A4; }
            body { font-family: 'Segoe UI', Arial, sans-serif; color: #111827; line-height: 1.5; font-size: 12px; margin: 0; padding: 20px; }
            
            /* Table Wrapper for Repeated Header */
            .main-layout-table { width: 100%; border-collapse: collapse; }
            .main-layout-table thead { display: table-header-group; }
            .main-layout-table tbody { display: table-row-group; }
            
            /* Header */
            .header-container { display: flex; justify-content: space-between; align-items: start; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px solid #e5e7eb; }
            .company-branding { display: flex; align-items: center; gap: 24px; }
            .logo-img { height: 60px; width: auto; object-fit: contain; }
            .company-details h2 { margin: 0 0 2px 0; font-size: 16px; font-weight: bold; color: #111827; }
            .company-details p { margin: 0; color: #6b7280; font-size: 14px; }
            .quotation-title { font-size: 24px; font-weight: bold; color: #111827; letter-spacing: -0.025em; }

            /* Grid Layout for Info Section */
            .info-section { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; margin-bottom: 32px; }
            
            .info-grid { display: grid; grid-template-columns: 100px 10px 1fr; gap: 4px; align-items: baseline; }
            .info-label { font-weight: 600; color: #374151; font-size: 14px; }
            .info-colon { text-align: center; color: #374151; font-size: 14px; }
            .info-value { color: #111827; font-size: 14px; }

            /* Client Side (Left) */
            .client-side .info-grid { grid-template-columns: 100px 10px 1fr; }

            /* Meta Side (Right) */
            .meta-side .info-grid { grid-template-columns: 1fr 10px 1fr; } 
            .meta-side { justify-self: end; width: 100%; max-width: 400px; }
            .meta-side .info-label { text-align: right; white-space: nowrap; }
            
            /* Table */
            .items-table { width: 100%; border-collapse: collapse; margin-bottom: 32px; font-family: 'Segoe UI', Arial, sans-serif; }
            .items-table th { background-color: #f9fafb; color: #111827; font-weight: 600; padding: 8px; text-align: left; border: 1px solid #e5e7eb; font-size: 11px; }
            .items-table td { padding: 8px; border: 1px solid #e5e7eb; vertical-align: top; font-size: 11px; color: #111827; }
            .items-table th.col-center, .items-table td.col-center { text-align: center; }
            .items-table th.col-right, .items-table td.col-right { text-align: right; }
            
            .col-no { width: 48px; text-align: center; }
            
            /* Totals */
            .total-section { display: flex; justify-content: flex-end; margin-bottom: 32px; }
            .total-table { width: auto; min-width: 250px; font-size: 12px; }
            .total-row { display: flex; justify-content: space-between; margin-bottom: 4px; color: #111827; }
            .total-label { text-align: right; padding-right: 16px; font-weight: 400; }
            .total-value { text-align: right; font-weight: 500; white-space: nowrap; }
            
            .grand-total { margin-top: 8px; padding-top: 8px; font-weight: bold; font-size: 14px; }
            .grand-total .total-label { font-weight: bold; }
            .grand-total .total-value { font-weight: bold; }
            
            /* Terms */
            .terms-section { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; }
            .term-title { font-weight: bold; margin-bottom: 8px; font-size: 12px; text-decoration: underline; text-transform: uppercase; color: #111827; }
            .terms-grid { display: grid; grid-template-columns: 120px 10px 1fr; gap: 4px; max-width: 600px; font-size: 12px; }
            .terms-grid .info-label, .terms-grid .info-value, .terms-grid .info-colon { font-size: 12px; color: #4b5563; }
            .terms-grid .info-label { font-weight: 600; }
            
            /* Footer */
            .footer { margin-top: 48px; display: flex; justify-content: space-between; align-items: flex-end; page-break-inside: avoid; }
            .signature { text-align: left; min-width: 200px; }
            .signature p { margin: 0; }
            .signature-space { height: 80px; }
            .signer-name { padding-bottom: 0; display: block; font-weight: 400; text-decoration: underline; color: #111827; }
            .signer-role { font-weight: bold; font-size: 14px; color: #111827; }

            .qr-block { text-align: center; } 
            .qr-img { width: 100px; height: 100px; object-fit: contain; }
          </style>
        </head>
        <body>
          <table class="main-layout-table">
            <thead>
              <tr>
                <td>
                  <div class="header-container">
                    <div class="company-branding">
                      ${logoUrl ? `<img src="${logoUrl}" class="logo-img" alt="Logo" />` : ''}
                      <div class="company-details">
                        <h2>${company?.name || 'PT. Morgan Powerindo Amerta'}</h2>
                        <p>${company?.address || 'Jl. Pendidikan'}</p>
                        <p>${company?.email || '-'}</p>
                      </div>
                    </div>
                    <div class="quotation-title">INVOICE</div>
                  </div>
                </td>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>

                  <div class="info-section">
                    <div class="client-side">
                      <div class="info-grid">
                        <span class="info-label">Customer</span><span class="info-colon">:</span><span class="info-value">${invoice.quotation.request.customer.company_name}</span>
                        <span class="info-label">Alamat</span><span class="info-colon">:</span><span class="info-value">${invoice.quotation.request.customer.delivery_address || '-'}</span>
                         <span class="info-label">PIC</span><span class="info-colon">:</span><span class="info-value">${invoice.quotation.request.customer_pic.name}</span>
                      </div>
                    </div>
                    <div class="meta-side">
                       <div class="info-grid">
                        <span class="info-label">No Invoice</span><span class="info-colon">:</span><span class="info-value" style="font-family: monospace; font-weight: bold;">${invoice.invoice_number || '-'}</span>
                        <span class="info-label">Tanggal</span><span class="info-colon">:</span><span class="info-value">${invoice.invoice_date && isValid(new Date(invoice.invoice_date)) ? format(new Date(invoice.invoice_date), "dd/MM/yyyy", { locale: id }) : "-"}</span>
                        <span class="info-label">No Penawaran</span><span class="info-colon">:</span><span class="info-value">${invoice.quotation.quotation_number}</span>
                        <span class="info-label">Subject</span><span class="info-colon">:</span><span class="info-value">${invoice.quotation.request.title}</span>
                         <span class="info-label">Ref</span><span class="info-colon">:</span><span class="info-value">${invoice.quotation.request.letter_number}</span>
                      </div>
                    </div>
                  </div>

                  <table class="items-table">
                    <thead>
                      <tr>
                        <th class="col-no">No</th>
                        <th class="">Spesifikasi</th>
                        <th class="col-center">Qty</th>
                        <th class="col-right">Harga Jual</th>
                        <th class="col-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${invoice.items
      .sort((a: any, b: any) => {
        const vendorA = a.vendor?.company_name || "";
        const vendorB = b.vendor?.company_name || "";
        return vendorA.localeCompare(vendorB);
      })
      .map((item, index) => `
                        <tr>
                          <td class="col-no">${index + 1}</td>
                          <td>
                            <div style="margin-bottom: 4px;">${item.customer_spec || '-'}</div>
                          </td>
                          <td class="col-center">${item.qty} ${item.unit}</td>
                          <td class="col-right">${formatCurrency(item.unit_selling_price || 0)}</td>
                          <td class="col-right">${formatCurrency(item.total_selling_price || 0)}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>

                  <div class="total-section">
                    <div class="total-table">
                      <div class="total-row">
                        <span class="total-label">Total:</span>
                        <span class="total-value">${formatCurrency(totalAmount)}</span>
                      </div>
                      ${discountPercentage > 0 ? `
                      <div class="total-row">
                         <div style="display: flex; justify-content: flex-end; padding-right: 16px;">
                            <span>Disc (${discountPercentage}%):</span>
                         </div>
                         <span class="total-value" style="color: #dc2626;">- ${formatCurrency(discountAmount)}</span>
                      </div>
                       ` : ''}
                      ${invoice.settings?.ppn_percentage ? `
                      <div class="total-row">
                        <span class="total-label">PPN (${invoice.settings.ppn_percentage}%):</span>
                        <span class="total-value">${formatCurrency(ppnAmount)}</span>
                      </div>
                      ` : ''}
                      <div class="total-row grand-total">
                        <span class="total-label">Grand Total:</span>
                        <span class="total-value">${formatCurrency(grandTotal)}</span>
                      </div>
                    </div>
                  </div>

                  <div class="terms-section">
                    <div class="term-title">Terms & Conditions</div>
                    <div class="terms-grid">
                       <span class="info-label">Payment Terms</span><span class="info-colon">:</span><span class="info-value">${invoice.settings?.payment_terms || '-'}</span>
                       <span class="info-label">Delivery Time</span><span class="info-colon">:</span><span class="info-value">${calculateMaxDeliveryTime()}</span>
                    </div>
                  </div>

                  <div style="margin-top: 24px; font-size: 10px; color: #6b7280; font-style: italic; border-top: 1px dashed #e5e7eb; padding-top: 8px;">
                    Dokumen ini dikeluarkan oleh Sistem Integrasi Data ${company?.name || 'PT. Morgan Powerindo Amerta'} dan dinyatakan Sah dan Otentik bila disertai QR Code dan tidak memerlukan tanda tangan basah. Silahkan melakukan verifikasi dengan scan QR Code
                  </div>

                  <div class="footer">
                    <div class="qr-block">
                      ${qrCodeUrl ? `<img src="${qrCodeUrl}" class="qr-img" alt="QR Code" />` : ''}
                    </div>
                    <div class="signature">
                      <p style="margin-bottom: 8px; color: #4b5563;">Regards,</p>
                      <p style="font-weight: bold; color: #111827; margin-bottom: 80px;">${company?.name || 'PT. Morgan Powerindo Amerta'}</p>
                      <span class="signer-name">${signer?.name || 'Authorized Signature'}</span>
                      <span class="signer-role">${signer?.position || ''}</span>
                    </div>
                  </div>

                </td>
              </tr>
            </tbody>
          </table>
          <script>
            setTimeout(() => {
                const originalTitle = window.parent.document.title;
                const filename = "INV_${invoice.invoice_number.replace(/\//g, '-')}";
                window.parent.document.title = filename;
                window.print();
                setTimeout(() => {
                  window.parent.document.title = originalTitle;
                }, 100);
            }, 1000);
          </script>
        </body>
      </html>
    `);
  doc.close();
};
