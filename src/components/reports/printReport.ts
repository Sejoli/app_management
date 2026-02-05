import { format } from "date-fns";
import { id } from "date-fns/locale";

export interface ReportRow {
    no: number;
    user: string;
    date: string;
    customer?: string; // For Sales
    vendor?: string;   // For Purchase
    item_name: string;
    qty: number;
    unit: string;
    price: number;
    total: number;
}

export const printReport = (
    title: string,
    data: ReportRow[],
    type: 'sales' | 'purchase'
) => {
    // Helper to format currency
    const formatCurrency = (amount: number) => {
        return "Rp " + amount.toLocaleString("id-ID");
    };

    const totalAmount = data.reduce((sum, item) => sum + item.total, 0);

    // Create a hidden iframe
    let iframe = document.getElementById('print-iframe-report') as HTMLIFrameElement;
    if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.id = 'print-iframe-report';
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

    const currentDate = format(new Date(), "dd MMMM yyyy", { locale: id });

    doc.open();
    doc.write(`
      <html>
        <head>
          <title>${title}</title>
          <style>
             @page { margin: 10mm; size: A4 landscape; }
            body { font-family: 'Segoe UI', Arial, sans-serif; color: #111827; line-height: 1.5; font-size: 12px; margin: 0; padding: 20px; }
            
            .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; }
            .header h1 { margin: 0; font-size: 24px; font-weight: bold; text-transform: uppercase; }
            .header p { margin: 5px 0 0; color: #6b7280; font-size: 11px; }

            .report-meta { display: flex; justify-content: space-between; margin-bottom: 15px; font-size: 12px; font-weight: 500; }

            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; vertical-align: top; }
            th { background-color: #f9fafb; font-weight: 600; text-transform: uppercase; font-size: 11px; }
            
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            
            .total-row td { border-top: 2px solid #000; font-weight: bold; background-color: #f3f4f6; }
            
            .footer { margin-top: 30px; text-align: right; font-size: 10px; color: #9ca3af; font-style: italic; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${title}</h1>
            <p>Dicetak pada: ${currentDate}</p>
          </div>

          <div class="report-meta">
            <span>Total Item: ${data.length}</span>
            <span>Total Nilai: ${formatCurrency(totalAmount)}</span>
          </div>

          <table>
            <thead>
              <tr>
                <th class="text-center" style="width: 40px;">No</th>
                <th style="width: 100px;">User</th>
                ${type === 'sales' ? '<th style="width: 100px;">Tanggal Jual</th>' : '<th style="width: 100px;">Tanggal Beli</th>'}
                ${type === 'sales' ? '<th>Customer</th>' : '<th>Vendor</th>'}
                <th>Item</th>
                <th class="text-center" style="width: 80px;">Qty</th>
                <th class="text-right" style="width: 120px;">Harga</th>
                <th class="text-right" style="width: 120px;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${data.map((item, index) => `
                <tr>
                  <td class="text-center">${index + 1}</td>
                  <td>${item.user}</td>
                  <td>${format(new Date(item.date), "dd/MM/yyyy", { locale: id })}</td>
                  <td>${type === 'sales' ? (item.customer || '-') : (item.vendor || '-')}</td>
                  <td>${item.item_name}</td>
                  <td class="text-center">${item.qty} ${item.unit}</td>
                  <td class="text-right">${formatCurrency(item.price)}</td>
                  <td class="text-right">${formatCurrency(item.total)}</td>
                </tr>
              `).join('')}
              <tr class="total-row">
                <td colspan="7" class="text-right">GRAND TOTAL</td>
                <td class="text-right">${formatCurrency(totalAmount)}</td>
              </tr>
            </tbody>
          </table>

          <div class="footer">
            Dicetak otomatis dari Sistem Client Vendor Hub
          </div>

          <script>
            setTimeout(() => {
                window.print();
            }, 500);
          </script>
        </body>
      </html>
    `);
    doc.close();
};
