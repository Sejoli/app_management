import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { useRef, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { formatTerbilang } from "@/utils/terbilang";

interface InvoicePrintModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    invoice: any;
    company: any;
}

export default function InvoicePrintModal({ open, onOpenChange, invoice, company }: InvoicePrintModalProps) {
    const printRef = useRef<HTMLDivElement>(null);
    const [items, setItems] = useState<any[]>([]);
    const [settings, setSettings] = useState<any>(null);
    const [selectedAttention, setSelectedAttention] = useState("General Manager");
    const [pics, setPics] = useState<any[]>([]);
    const [director, setDirector] = useState<{ name: string; position: string } | null>(null);

    useEffect(() => {
        if (open && invoice?.quotation?.id) {
            fetchInvoiceItems();
            fetchDirector();

            // Default to General Manager when opening, or potentially reset
            setSelectedAttention("General Manager");

            if (invoice?.quotation?.request?.customer?.id) {
                fetchPics(invoice.quotation.request.customer.id);
            }
        }
    }, [open, invoice]);

    const fetchPics = async (customerId: string) => {
        const { data } = await supabase
            .from("customer_pics")
            .select("name, position")
            .eq("customer_id", customerId);

        if (data) setPics(data);
    };

    const fetchDirector = async () => {
        const { data: members } = await supabase
            .from("team_members")
            .select("name, position")
            .or("position.ilike.%direktur%,position.ilike.%director%")
            .limit(1);

        if (members && members.length > 0) {
            setDirector(members[0]);
        }
    };

    const fetchInvoiceItems = async () => {
        if (!invoice?.quotation) return;

        // 1. Fetch links directly from DB or use nested data if available
        // InvoiceManagement fetches quotation_balances, so we can use that.
        const links = invoice.quotation.quotation_balances || [];

        if (links.length === 0) {
            setItems([]);
            return;
        }

        let allItems: any[] = [];
        let lastSettings: any = null;

        for (const link of links) {
            if (!link.balance_id || !link.entry_id) continue;

            const { data: bItems } = await supabase
                .from("balance_items")
                .select("*, vendor:vendors(company_name)")
                .eq("balance_id", link.balance_id)
                .eq("balance_entry_id", link.entry_id);

            if (bItems) {
                allItems = [...allItems, ...bItems];
            }

            // Fetch balance settings if not already fetched
            if (!lastSettings) {
                const { data: bSettings } = await supabase
                    .from("balance_settings")
                    .select("*")
                    .eq("balance_id", link.balance_id)
                    .eq("balance_entry_id", link.entry_id)
                    .maybeSingle();

                if (bSettings) lastSettings = bSettings;
            }
        }

        // Sort by Position then ID (FIFO)
        allItems.sort((a: any, b: any) => {
            const posA = a.position !== undefined ? a.position : 999999;
            const posB = b.position !== undefined ? b.position : 999999;
            if (posA !== posB) return posA - posB;
            return a.id.localeCompare(b.id);
        });

        setItems(allItems);
        setSettings(lastSettings);
    };

    const getStorageUrl = (path: string) => {
        return `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/company-files/${path}`;
    };

    // Helper to format currency
    const formatCurrency = (amount: number) => {
        return "Rp " + amount.toLocaleString("id-ID");
    };

    const companyPhone = company?.phone?.replace(/\D/g, "") || "";
    const formattedCompanyPhone = companyPhone.startsWith("0") ? "62" + companyPhone.slice(1) : companyPhone;
    // Invoice specific WA message if needed, or generic
    const whatsappMessage = `Hallo dari ${invoice?.quotation?.request?.customer?.company_name || ""} terkait Invoice ${invoice?.invoice_number}`;
    const isApproved = invoice?.status === 'approved';
    const qrCodeUrl = formattedCompanyPhone ? `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(`https://wa.me/${formattedCompanyPhone}?text=${encodeURIComponent(whatsappMessage)}`)}` : "";

    const handlePrint = () => {
        const logoUrl = company?.logo_path ? getStorageUrl(company.logo_path) : "";

        // Create a hidden iframe
        let iframe = document.getElementById('invoice-print-iframe') as HTMLIFrameElement;
        if (!iframe) {
            iframe = document.createElement('iframe');
            iframe.id = 'invoice-print-iframe';
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

        // Calculations for Print
        const totalAmount = items.reduce((sum: number, item: any) => sum + (item.total_selling_price || 0), 0) || 0;
        const discountPercentage = settings?.discount_percentage || 0;
        const discountAmount = totalAmount * (discountPercentage / 100);
        const afterDiscount = totalAmount - discountAmount;
        // PPN Default to 11 if undefined/null
        const ppnPercentage = settings?.ppn_percentage ?? 11;
        const ppnAmount = Math.round(afterDiscount * (ppnPercentage / 100));
        const grandTotal = Math.round(afterDiscount + ppnAmount);

        // Date Helpers
        const formatDate = (dateString: string | null) => {
            if (!dateString) return "-";
            const d = new Date(dateString);
            return d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
        };

        const signerName = director?.name || company?.signer_name || "Erick PM";
        const signerPosition = director?.position || company?.signer_position || "Direktur";

        const poLink = invoice.quotation?.request;
        // PO Data from PO IN Page (vendor_letter_number/date on po_ins table)
        const poDate = invoice.vendor_letter_date ? formatDate(invoice.vendor_letter_date) : "-";
        const poNumber = invoice.vendor_letter_number || "-";
        const terbilangAmount = formatTerbilang(grandTotal);

        const customerCode = invoice.quotation?.request?.customer?.customer_code || "CUST";
        const fileName = `${customerCode}_${invoice.invoice_number}`;

        doc.open();
        doc.write(`
            <html>
                <head>
                    <title>${fileName}</title>
                    <style>
                        @page { margin: 15mm; size: A4; }
                        /* Body matching PO */
                        body { font-family: 'Segoe UI', Arial, sans-serif; color: #111827; line-height: 1.4; font-size: 12px; margin: 0; padding: 20px; }
                        
                        /* Layout mirroring QuotationEditor */
                        .main-layout-table { width: 100%; border-collapse: collapse; }
                        .main-layout-table thead { display: table-header-group; }
                        .main-layout-table tbody { display: table-row-group; }
                        
                        /* Header */
                        .header-container { display: flex; justify-content: space-between; align-items: start; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #e5e7eb; }
                        .company-branding { display: flex; align-items: center; gap: 16px; }
                        .logo-img { height: 60px; width: auto; object-fit: contain; }
                        .company-details h2 { margin: 0 0 2px 0; font-size: 11pt; font-weight: bold; color: #16a34a; }
                        .company-details p { margin: 0; color: #6b7280; font-size: 9pt; }
                        /* Title matching PO size */
                        .quotation-title { font-size: 15pt; font-weight: bold; color: #1e40af; letter-spacing: -0.025em; }

                        /* Grid Info - Matched to SJ/PO */
                        .info-section { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 24px; }
                        .info-grid { display: grid; grid-template-columns: 80px 10px 1fr; gap: 2px; align-items: baseline; font-size: 11pt; }
                        .info-label { font-weight: 600; color: #374151; font-size: 11pt; }
                        .info-colon { text-align: center; color: #374151; font-size: 11pt; }
                        .info-value { color: #111827; font-size: 11pt; }

                        .client-side .info-grid { grid-template-columns: 80px 10px 1fr; }
                        .meta-side { justify-self: end; width: 100%; max-width: 400px; }
                        .meta-side .info-grid { grid-template-columns: 1fr 10px 1fr; } 
                        .meta-side .info-label { text-align: right; white-space: nowrap; }

                        /* Items Table - Matched font/padding */
                        .items-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 10pt; }
                        .items-table th { background-color: #1e40af; color: #ffffff; font-weight: 600; padding: 6px; text-align: left; border: 1px solid #e5e7eb; font-size: 11pt; }
                        .items-table td { padding: 6px; border: 1px solid #e5e7eb; vertical-align: middle; font-size: 10pt; color: #111827; }
                        .items-table th.col-center, .items-table td.col-center { text-align: center; }
                        .items-table th.col-right, .items-table td.col-right { text-align: right; }
                        .col-no, .col-center, .col-right { width: 1%; white-space: nowrap; }

                        .total-section { display: flex; justify-content: flex-end; margin-bottom: 24px; }
                        .total-table { width: auto; min-width: 200px; font-size: 10pt; }
                        .total-row { display: flex; justify-content: space-between; margin-bottom: 2px; color: #111827; }
                        .total-label { text-align: right; padding-right: 12px; font-weight: 400; }
                        .total-value { text-align: right; font-weight: 500; white-space: nowrap; }
                        .grand-total { margin-top: 4px; padding-top: 4px; font-weight: bold; font-size: 11pt; border-top: 1px solid #e5e7eb; }
                        .grand-total .total-label { font-weight: bold; }
                        .grand-total .total-value { font-weight: bold; }

                        .terms-section { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e5e7eb; }
                        .note-label { font-weight: bold; background-color: #f3f4f6; color: #374151; padding: 1px 4px; display: inline-block; margin-bottom: 4px; font-size: 11pt; }
                        
                        .payment-info { margin-top: 12px; font-size: 11pt; color: #111827; } 
                        .payment-line { display: grid; grid-template-columns: 80px 10px 1fr; margin-bottom: 2px; }

                        /* Footer - Matched spacing */
                        .footer { margin-top: 32px; display: flex; justify-content: space-between; align-items: flex-end; page-break-inside: avoid; }
                        .qr-section { text-align: left; }
                        .qr-img { width: 80px; height: 80px; object-fit: contain; }
                        .qr-text { font-family: monospace; font-size: 11pt; margin-top: 4px; color: #111827; }
                        .signature { text-align: left; min-width: 200px; font-size: 11pt; }
                        .signature p { margin: 0; }
                        .signer-name { padding-bottom: 0; display: block; font-weight: bold; text-decoration: underline; color: #111827; font-size: 11pt; }
                        .signer-role { font-weight: bold; font-size: 11pt; color: #111827; }
                        
                        /* Internal Letter Specifics */
                        .letter-page { page-break-before: always; margin-top: 40px; }
                        /* Title Font Size Matched to Invoice */
                        .letter-title { font-size: 24px; font-weight: bold; text-align: center; margin-bottom: 24px; text-transform: uppercase; }
                        .letter-body { text-align: justify; margin-bottom: 24px; font-size: 11pt; line-height: 1.5; }
                        .letter-details { margin-left: 0; margin-bottom: 24px; font-size: 11pt; }
                        .letter-page .signer-name { margin-top: 25px; }
                        .detail-row { display: grid; grid-template-columns: 120px 10px 1fr; margin-bottom: 4px; }
                        .detail-value { font-weight: bold; }

                        /* Receipt (Kwitansi) Specifics */
                        .receipt-page { page-break-before: always; margin-top: 20px; height: 100vh; display: flex; flex-direction: column; justify-content: space-between; }
                        .receipt-half { height: 48%; border-bottom: 2px dashed #9ca3af; padding-bottom: 20px; margin-bottom: 20px; box-sizing: border-box; }
                        .receipt-half:last-child { border-bottom: none; margin-bottom: 0; }
                        .receipt-title { font-size: 20px; font-weight: bold; text-align: center; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 2px; border-bottom: 2px double #1e40af; color: #1e40af; display: inline-block; padding-bottom: 2px; }
                        .receipt-title-container { text-align: center; margin-bottom: 12px; }
                        .receipt-grid { display: grid; grid-template-columns: 120px 10px 1fr; gap: 4px; margin-bottom: 6px; align-items: baseline; }
                        .receipt-label { font-size: 10pt; color: #374151; }
                        .receipt-value { font-size: 10pt; color: #111827; font-weight: bold; }
                        .amount-box { border-bottom: 1px dotted #9ca3af; padding: 2px 0; font-style: italic; font-size: 10pt; font-weight: bold; }
                        .terbilang-box { border-bottom: 1px dotted #9ca3af; padding: 2px 0; font-style: italic; font-weight: bold; font-size: 10pt; width: 100%; }
                        
                        .footer-receipt { margin-top: 30px; display: flex; justify-content: space-between; align-items: flex-start; }
                        .materai-box { width: 80px; height: 50px; border: 1px dashed #9ca3af; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #9ca3af; margin: 0 auto 10px auto; }
                    </style>
                </head>
                <body>
                    <!-- INVOICE PAGE -->
                    <div class="invoice-page">
                    <table class="main-layout-table">
                        <thead>
                            <tr>
                                <td>
                                    <div class="header-container">
                                        <div class="company-branding">
                                            ${logoUrl ? `<img src="${logoUrl}" class="logo-img" alt="Logo" />` : ''}
                                            <div class="company-details">
                                                <h2>${company?.name || 'Nama Perusahaan'}</h2>
                                                <p>${company?.address || '-'}</p>
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
                                                <span class="info-label">Customer</span><span class="info-colon">:</span><span class="info-value">${invoice.quotation?.request?.customer?.company_name || "-"}</span>
                                                <span class="info-label">Alamat</span><span class="info-colon">:</span><span class="info-value">${invoice.quotation?.request?.customer?.delivery_address || invoice.quotation?.request?.customer?.address || "-"}</span>
                                                <span class="info-label">Attention</span><span class="info-colon">:</span><span class="info-value">${selectedAttention}</span>
                                            </div>
                                        </div>
                                        <div class="meta-side">
                                        <div class="meta-side">
                                           <div style="text-align: right;">
                                                <div style="margin-bottom: 2px;"><span class="info-label">No Invoice</span> : <span class="info-value" style="font-family: monospace;">${invoice.invoice_number}</span></div>
                                                <div style="margin-bottom: 2px;"><span class="info-label">Date</span> : <span class="info-value">${formatDate(invoice.invoice_date)}</span></div>
                                                <div style="margin-bottom: 2px;"><span class="info-label">Ref (PO)</span> : <span class="info-value">${poNumber}</span></div>
                                          </div>
                                        </div>
                                        </div>
                                    </div>

                                    <table class="items-table">
                                        <thead>
                                            <tr>
                                                <th class="col-no">No</th>
                                                <th>Spesifikasi</th>
                                                <th class="col-center">Qty</th>
                                                <th class="col-right">Harga Jual</th>
                                                <th class="col-right">Total</th>

                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${items.length > 0 ? items.map((item: any, index: number) => `
                                                <tr>
                                                    <td class="col-no">${index + 1}</td>
                                                    <td>
                                                        <div style="font-weight: normal;">${item.customer_spec || item.description || item.name || "Item Name"}</div>
                                                        ${item.vendor_spec ? `<div style="color: #6b7280; font-size: 11px; margin-top: 2px;">Offer to: ${item.vendor_spec}</div>` : ''}
                                                    </td>
                                                    <td class="col-center">${item.qty || item.quantity} ${item.unit || "unit"}</td>
                                                    <td class="col-right">${(item.unit_selling_price || 0).toLocaleString('id-ID')}</td>
                                                    <td class="col-right">${(item.total_selling_price || 0).toLocaleString('id-ID')}</td>

                                                </tr>
                                            `).join('') : `
                                                <tr><td colspan="5" style="text-align: center; padding: 20px; color: #6b7280;">No items available</td></tr>
                                            `}
                                        </tbody>
                                    </table>

                                    <div class="total-section">
                                        <div class="total-table">
                                            <div class="total-row" style="font-size: 10pt;">
                                                <span class="total-label">Total:</span>
                                                <span class="total-value">${formatCurrency(totalAmount)}</span>
                                            </div>
                                            ${discountPercentage > 0 ? `
                                            <div class="total-row" style="font-size: 9pt;">
                                                <span class="total-label">Disc (${discountPercentage}%):</span>
                                                <span class="total-value" style="color: #dc2626;">- ${formatCurrency(discountAmount)}</span>
                                            </div>` : ''}
                                            ${ppnPercentage > 0 ? `
                                            <div class="total-row" style="font-size: 9pt;">
                                                <span class="total-label">PPN (${ppnPercentage}%):</span>
                                                <span class="total-value">${formatCurrency(ppnAmount)}</span>
                                            </div>` : ''}
                                            <div class="total-row grand-total">
                                                <span class="total-label">Grand Total:</span>
                                                <span class="total-value">${formatCurrency(grandTotal)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div class="terms-section">
                                        <div>
                                             <span class="note-label">Note:</span>
                                             <div style="margin-bottom: 16px;">${invoice.notes || invoice.quotation?.note || ""}</div>
                                        </div>
                                        
                                        <div class="payment-info">
                                            <div style="margin-bottom: 4px;">Pembayaran untuk Invoice ini mohon ditransfer ke rekening:</div>
                                            <div class="payment-line">
                                                <span>Nama Bank</span><span>:</span><span style="font-weight: bold;">${company?.bank_name || "-"}</span>
                                            </div>
                                            <div class="payment-line">
                                                <span>Nomor Rek.</span><span>:</span><span style="font-weight: bold;">${company?.account_number || "-"}</span>
                                            </div>
                                            <div class="payment-line">
                                                <span>Atas Nama</span><span>:</span><span>${company?.account_name || "-"}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div style="margin-top: 24px; font-size: 9pt; color: #6b7280; font-style: italic; padding-top: 8px; line-height: 1.2;">
                                        Dokumen ini dikeluarkan oleh Sistem Integrasi Data ${company?.name || "Nama Perusahaan"} dan dinyatakan Sah dan Otentik bila disertai QR Code dan tidak memerlukan tanda tangan basah. Silahkan melakukan verifikasi dengan scan QR Code
                                    </div>

                                    <div class="footer">
                                        <div class="qr-section">
                                            ${qrCodeUrl ? `<img src="${qrCodeUrl}" class="qr-img" alt="QR Code" />` : ''}
                                        </div>
                                        <div class="signature">
                                            <p style="margin-bottom: 4px;">Hormat kami,</p>
                                            <p style="margin-bottom: 120px; font-weight: bold;">${company?.name || "Nama Perusahaan"}</p>
                                            <span class="signer-name">${signerName}</span>
                                            <span class="signer-role">${signerPosition}</span>
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                    </div>

                    <!-- INTERNAL LETTER PAGE -->
                    <div class="letter-page">
                        <div class="header-container">
                             <div class="company-branding">
                                ${logoUrl ? `<img src="${logoUrl}" class="logo-img" alt="Logo" />` : ''}
                                <div class="company-details">
                                    <h2>${company?.name || 'Nama Perusahaan'}</h2>
                                    <p>${company?.address || '-'}</p>
                                    <p>${company?.email || '-'}</p>
                                </div>
                             </div>
                             <div class="quotation-title" style="text-align: right;">
                                <div style="font-size: 24px;">SPP</div>
                                <div style="font-size: 10px; font-weight: normal; margin-top: 0;">( Surat Permohonan Pembayaran )</div>
                             </div>
                        </div>

                         <div class="info-section">
                            <div class="client-side">
                                <div class="info-grid">
                                    <span class="info-label">Customer</span><span class="info-colon">:</span><span class="info-value">${invoice.quotation?.request?.customer?.company_name || "-"}</span>
                                    <span class="info-label">Alamat</span><span class="info-colon">:</span><span class="info-value">${invoice.quotation?.request?.customer?.delivery_address || invoice.quotation?.request?.customer?.address || "-"}</span>
                                    <span class="info-label">Attention</span><span class="info-colon">:</span><span class="info-value">${selectedAttention}</span>
                                </div>
                            </div>
                            <div class="meta-side">
                            <div class="meta-side">
                               <div style="text-align: right;">
                                    <div style="margin-bottom: 2px;"><span class="info-label">No</span> : <span class="info-value" style="font-family: monospace;">${invoice.invoice_number}</span></div>
                                    <div style="margin-bottom: 2px;"><span class="info-label">Date</span> : <span class="info-value">${formatDate(invoice.invoice_date)}</span></div>
                                    <div style="margin-bottom: 2px;"><span class="info-label">Ref (PO)</span> : <span class="info-value">${poNumber}</span></div>
                                    <div style="margin-bottom: 2px;"><span class="info-label">Ref Date</span> : <span class="info-value">${poDate}</span></div>
                              </div>
                            </div>
                            </div>
                        </div>

                        <div class="letter-body">
                            <p>Dengan hormat,</p>
                            <p>Bersama ini kami menyampaikan Surat Permohonan Pembayaran atas penyelesaian permintaan pengadaan barang sebagai berikut:</p>
                        </div>

                        <div class="letter-details">
                            <div class="detail-row">
                                <span>Nomor PO</span><span>:</span><span class="detail-value">${poNumber}</span>
                            </div>
                            <div class="detail-row">
                                <span>Tanggal PO</span><span>:</span><span class="detail-value">${poDate}</span>
                            </div>
                             <div class="detail-row">
                                <span>Nilai Pengadaan</span><span>:</span><span class="detail-value">${formatCurrency(grandTotal)},-</span>
                            </div>
                             <div class="detail-row">
                                <span>Terbilang</span><span>:</span><span class="detail-value" style="font-style: italic; text-transform: capitalize;">${terbilangAmount}</span>
                            </div>
                        </div>

                        <div class="letter-body">
                            <p>Adapun untuk pembayaran, mohon ditransfer ke:</p>
                        </div>

                        <div class="payment-info" style="margin-bottom: 24px;">
                            <div class="detail-row">
                                <span>Nama Bank</span><span>:</span><span style="font-weight: bold;">${company?.bank_name || "-"}</span>
                            </div>
                            <div class="detail-row">
                                <span>Nomor Rek.</span><span>:</span><span style="font-weight: bold;">${company?.account_number || "-"}</span>
                            </div>
                            <div class="detail-row">
                                <span>Atas Nama</span><span>:</span><span>${company?.account_name || "-"}</span>
                            </div>
                        </div>

                         <div class="letter-body">
                            <p>Demikian permohonan ini kami sampaikan, atas perhatian dan kerjasamanya kami ucapkan terima kasih.</p>
                        </div>

                        <div class="footer">
                             <div class="qr-section">
                                ${qrCodeUrl ? `<img src="${qrCodeUrl}" class="qr-img" alt="QR Code" />` : ''}
                             </div>
                             <div class="signature">
                                <p style="margin-bottom: 4px;">Hormat kami,</p>
                                <p style="margin-bottom: 120px; font-weight: bold;">${company?.name || "Nama Perusahaan"}</p>
                                <span class="signer-name">${signerName}</span>
                                <span class="signer-role">${signerPosition}</span>
                            </div>
                        </div>
                    </div>

                    <!-- RECEIPT PAGE (KWITANSI) -->
                    <div class="receipt-page">
                        ${[1, 2].map((_, index) => `
                        <div class="receipt-half">
                            <!-- Standard Header -->
                            <div class="header-container" style="margin-bottom: 24px;">
                                 <div class="company-branding">
                                    ${logoUrl ? `<img src="${logoUrl}" class="logo-img" alt="Logo" style="height: 45px;" />` : ''}
                                    <div class="company-details">
                                        <h2 style="font-size: 14px; margin-bottom: 2px;">${company?.name || 'Nama Perusahaan'}</h2>
                                        <p style="font-size: 11px;">${company?.address || '-'}</p>
                                        <p style="font-size: 11px;">${company?.email || '-'}</p>
                                    </div>
                                 </div>
                                 <div class="quotation-title" style="font-size: 20px;">KWITANSI</div>
                            </div>
    
                            <div class="receipt-body">
                                <div class="receipt-grid">
                                    <span class="receipt-label">Telah terima dari</span>
                                    <span class="receipt-label">:</span>
                                    <span class="receipt-value" style="font-size: 10pt;">${invoice.quotation?.request?.customer?.company_name || "-"}</span>
                                </div>
    
                                <div class="receipt-grid">
                                    <span class="receipt-label">Uang Sejumlah</span>
                                    <span class="receipt-label">:</span>
                                    <div class="amount-box">
                                       Rp ${formatCurrency(grandTotal)}
                                    </div>
                                </div>
                                
                                <div class="receipt-grid">
                                    <span class="receipt-label">Terbilang</span>
                                    <span class="receipt-label">:</span>
                                    <div class="terbilang-box">
                                       # ${terbilangAmount} #
                                    </div>
                                </div>
    
                                <div class="receipt-grid" style="margin-top: 8px;">
                                    <span class="receipt-label">Untuk Pembayaran</span>
                                    <span class="receipt-label">:</span>
                                    <span class="receipt-value" style="font-weight: normal; line-height: 1.4;">
                                        Pembayaran Invoice No: <b>${invoice.invoice_number}</b> Tanggal <b>${formatDate(invoice.invoice_date)}</b> terkait Kontrak No. <b>${poNumber}</b> tanggal <b>${poDate}</b>
                                    </span>
                                </div>
                            </div>
    
                             <div class="footer-receipt" style="margin-top: 20px;">
                                <!-- Left: Bank & QR -->
                                 <div style="font-size: 10pt;">
                                    <div class="detail-row" style="margin-bottom: 1px; grid-template-columns: 80px 10px 1fr;">
                                        <span>Nama Bank</span><span>:</span><span style="font-weight: bold;">${company?.bank_name || "-"}</span>
                                    </div>
                                    <div class="detail-row" style="margin-bottom: 1px; grid-template-columns: 80px 10px 1fr;">
                                        <span>Nomor Rek.</span><span>:</span><span style="font-weight: bold;">${company?.account_number || "-"}</span>
                                    </div>
                                    <div class="detail-row" style="margin-bottom: 8px; grid-template-columns: 80px 10px 1fr;">
                                        <span>Atas Nama</span><span>:</span><span>${company?.account_name || "-"}</span>
                                    </div>
                                    <div class="qr-section">
                                        ${qrCodeUrl ? `<img src="${qrCodeUrl}" class="qr-img" alt="QR Code" style="width: 70px; height: 70px;" />` : ''}
                                    </div>
                                 </div>
    
                                 <!-- Right: Signature -->
                                 <div class="signature" style="text-align: center; min-width: 180px;">
                                    <p style="margin-bottom: 4px; font-size: 10pt;">Tanggal : ${formatDate(invoice.invoice_date)}</p>
                                    <div style="height: 60px; display: flex; align-items: center; justify-content: center; color: #9ca3af; font-size: 10pt;">materai</div>
                                    <p style="margin-bottom: 0; font-weight: bold; text-decoration: underline; font-size: 10pt; margin-top: 25px;">${signerName}</p>
                                    <span class="signer-role" style="font-weight: bold; font-size: 10pt;">${signerPosition}</span>
                                </div>
                            </div>
                        </div>
                        `).join('')}
                    </div>
            </html>
        `);
        doc.close();

        setTimeout(() => {
            const originalTitle = document.title;
            document.title = fileName;

            if (iframe.contentWindow) {
                iframe.contentWindow.focus();
                iframe.contentWindow.print();
            }

            setTimeout(() => {
                document.title = originalTitle;
            }, 2000);
        }, 500);
    };

    if (!invoice) return null;

    // Helper calculations
    const totalAmount = items.reduce((sum: number, item: any) => sum + (item.total_selling_price || 0), 0) || 0;
    const discountPercentage = settings?.discount_percentage || 0;
    const discountAmount = totalAmount * (discountPercentage / 100);
    const afterDiscount = totalAmount - discountAmount;
    const ppnPercentage = settings?.ppn_percentage || 0;
    const ppnAmount = Math.round(afterDiscount * (ppnPercentage / 100));
    const grandTotal = Math.round(afterDiscount + ppnAmount);

    const formatDate = (dateString: string | null) => {
        if (!dateString) return "-";
        const d = new Date(dateString);
        return d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    const signerName = director?.name || company?.signer_name || "Erick PM";
    const signerPosition = director?.position || company?.signer_position || "Direktur";

    // Internal Letter Variables
    const poLink = invoice.quotation?.request;
    const poDate = invoice.vendor_letter_date ? formatDate(invoice.vendor_letter_date) : "-";
    const poNumber = invoice.vendor_letter_number || "-";
    const terbilangAmount = formatTerbilang(grandTotal);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Print Preview Invoice & Letter</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="flex justify-end mb-4">
                        <Button onClick={handlePrint}>
                            <Printer className="h-4 w-4 mr-2" />
                            Cetak
                        </Button>
                    </div>

                    <div className="bg-gray-100 p-4 rounded-lg overflow-y-auto max-h-[70vh]">
                        {/* INVOICE PAGE PREVIEW */}
                        <div ref={printRef} className="bg-white p-8 mb-8 shadow-sm min-h-[1123px] w-full max-w-none mx-auto text-[12px]">
                            {/* Header */}
                            <div className="flex justify-between items-start mb-8 pb-6 border-b border-gray-200">
                                <div className="flex items-center gap-6">
                                    {company?.logo_path && (
                                        <img
                                            src={getStorageUrl(company.logo_path)}
                                            alt="Logo"
                                            className="h-24 w-auto object-contain"
                                        />
                                    )}
                                    <div>
                                        <h2 className="text-[11pt] font-bold text-green-600 m-0 mb-0.5">{company?.name || "Nama Perusahaan"}</h2>
                                        <p className="text-[9pt] text-gray-500 m-0">{company?.address || "-"}</p>
                                        <p className="text-[9pt] text-gray-500 m-0">{company?.email || "-"}</p>
                                    </div>
                                </div>
                                <h1 className="text-[15pt] font-bold text-blue-800 tracking-tight">INVOICE</h1>
                            </div>

                            {/* Info Section */}
                            <div className="grid grid-cols-2 gap-12 mb-8 text-[11pt]">
                                <div className="space-y-1">
                                    <div className="grid grid-cols-[100px_10px_1fr] items-baseline">
                                        <span className="font-semibold text-gray-700">Customer</span>
                                        <span className="text-gray-700 text-center">:</span>
                                        <span className="text-gray-900">{invoice.quotation?.request?.customer?.company_name || "-"}</span>
                                    </div>
                                    <div className="grid grid-cols-[100px_10px_1fr] items-baseline">
                                        <span className="font-semibold text-gray-700">Alamat</span>
                                        <span className="text-gray-700 text-center">:</span>
                                        <span className="text-gray-900">{invoice.quotation?.request?.customer?.delivery_address || invoice.quotation?.request?.customer?.address || "-"}</span>
                                    </div>
                                    <div className="grid grid-cols-[100px_10px_1fr] items-center">
                                        <span className="font-semibold text-gray-700">Attention</span>
                                        <span className="text-gray-700 text-center">:</span>
                                        <Select value={selectedAttention} onValueChange={setSelectedAttention}>
                                            <SelectTrigger className="w-fit h-auto p-0 border-0 shadow-none text-gray-900 font-normal focus:ring-0">
                                                <SelectValue className="p-0" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="General Manager">General Manager</SelectItem>
                                                {pics.map((pic, idx) => (
                                                    <SelectItem key={idx} value={pic.name || `PIC ${idx + 1}`}>
                                                        {pic.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="space-y-1 w-full max-w-[400px] ml-auto text-right">
                                    <div className="mb-0.5">
                                        <span className="font-semibold text-gray-700">No Invoice</span> : <span className="font-mono text-gray-900">{invoice.invoice_number}</span>
                                    </div>
                                    <div className="mb-0.5">
                                        <span className="font-semibold text-gray-700">Date</span> : <span className="text-gray-900">{invoice.invoice_date ? new Date(invoice.invoice_date).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }) : "-"}</span>
                                    </div>
                                    <div className="mb-0.5">
                                        <span className="font-semibold text-gray-700">Ref (PO)</span> : <span className="text-gray-900">{poNumber}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Items Table */}
                            <table className="w-full border-collapse border border-gray-200 mb-8">
                                <thead>
                                    <tr className="bg-blue-800 text-white">
                                        <th className="border border-gray-200 p-3 text-left font-semibold text-[11pt] whitespace-nowrap w-[1%]">No</th>
                                        <th className="border border-gray-200 p-3 text-left font-semibold text-[11pt]">Spesifikasi</th>
                                        <th className="border border-gray-200 p-3 text-center font-semibold text-[11pt] whitespace-nowrap w-[1%]">Qty</th>
                                        <th className="border border-gray-200 p-3 text-right font-semibold text-[11pt] whitespace-nowrap w-[1%]">Harga Jual</th>
                                        <th className="border border-gray-200 p-3 text-right font-semibold text-[11pt] whitespace-nowrap w-[1%]">Total</th>

                                    </tr>
                                </thead>
                                <tbody>
                                    {items?.length > 0 ? (
                                        items.map((item: any, index: number) => (
                                            <tr key={index} className="border-b border-gray-100">
                                                <td className="py-3 px-4 text-center border-r border-gray-100 text-[10pt] whitespace-nowrap">{index + 1}</td>
                                                <td className="py-3 px-4 border-r border-gray-100 text-[10pt]">
                                                    <div className="text-gray-900">{item.customer_spec || item.description || item.name || "Item Name"}</div>
                                                    {item.vendor_spec && <div className="text-xs text-gray-500 mt-1">Offer to: {item.vendor_spec}</div>}
                                                </td>
                                                <td className="py-3 px-4 text-center border-r border-gray-100 text-[10pt] whitespace-nowrap">
                                                    {item.qty || item.quantity} {item.unit || "unit"}
                                                </td>
                                                <td className="py-3 px-4 text-right border-r border-gray-100 text-[10pt] whitespace-nowrap">
                                                    {(item.unit_selling_price || 0).toLocaleString('id-ID')}
                                                </td>
                                                <td className="py-3 px-4 text-right border-r border-gray-100 text-[10pt] whitespace-nowrap">
                                                    {(item.total_selling_price || 0).toLocaleString('id-ID')}
                                                </td>

                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={5} className="py-8 text-center text-gray-500 italic">No items available</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>

                            {/* Totals */}
                            <div className="flex justify-end mb-8">
                                <div className="w-auto min-w-[250px] space-y-1 font-sans">
                                    <div className="flex justify-between text-gray-900 text-[10pt]">
                                        <span className="text-right pr-4">Total:</span>
                                        <span className="font-medium text-right">Rp {totalAmount.toLocaleString("id-ID")}</span>
                                    </div>
                                    {discountPercentage > 0 && (
                                        <div className="flex justify-between text-gray-900 items-center text-[9pt]">
                                            <div className="flex items-center justify-end pr-4 text-right">
                                                <span>Disc ({discountPercentage}%):</span>
                                            </div>
                                            <span className="text-right text-red-600">- Rp {discountAmount.toLocaleString("id-ID")}</span>
                                        </div>
                                    )}
                                    {ppnPercentage > 0 && (
                                        <div className="flex justify-between text-gray-900 items-center text-[9pt]">
                                            <div className="flex items-center justify-end pr-4 text-right">
                                                <span>PPN ({ppnPercentage}%):</span>
                                            </div>
                                            <span className="text-right">Rp {ppnAmount.toLocaleString("id-ID")}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between text-gray-900 font-bold pt-2 text-[11pt]">
                                        <span className="text-right pr-4">Grand Total:</span>
                                        <span className="text-right">Rp {grandTotal.toLocaleString("id-ID")}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Payment Info & Notes */}
                            <div className="mt-8 pt-4">
                                <div className="mb-4">
                                    <span className="font-bold bg-gray-300 text-gray-700 px-1 py-0.5 text-[11pt] mb-1 inline-block">Note:</span>
                                    <div className="text-[11pt] text-gray-900 whitespace-pre-wrap mb-4">{invoice.notes || invoice.quotation?.note || ""}</div>
                                </div>

                                <div className="text-[11pt] text-gray-900 space-y-1">
                                    <div className="mb-1">Pembayaran untuk Invoice ini mohon ditransfer ke rekening:</div>
                                    <div className="grid grid-cols-[100px_10px_1fr]">
                                        <span>Nama Bank</span><span>:</span><span className="font-bold">{company?.bank_name || "-"}</span>
                                    </div>
                                    <div className="grid grid-cols-[100px_10px_1fr]">
                                        <span>Nomor Rek.</span><span>:</span><span className="font-bold">{company?.account_number || "-"}</span>
                                    </div>
                                    <div className="grid grid-cols-[100px_10px_1fr]">
                                        <span>Atas Nama</span><span>:</span><span>{company?.account_name || "-"}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6 text-[9pt] text-gray-500 italic pt-2 leading-tight">
                                Dokumen ini dikeluarkan oleh Sistem Integrasi Data {company?.name || "Nama Perusahaan"} dan dinyatakan Sah dan Otentik bila disertai QR Code dan tidak memerlukan tanda tangan basah. Silahkan melakukan verifikasi dengan scan QR Code
                            </div>

                            {/* Footer / Signature */}
                            <div className="flex mt-8 items-end justify-between">
                                {/* QR Code */}
                                <div className="text-left">
                                    {qrCodeUrl && <img src={qrCodeUrl} alt="QR Code" className="w-24 h-24 object-contain" />}
                                </div>

                                <div className="ml-auto text-left w-fit min-w-[200px] text-[11pt]">
                                    <p className="text-gray-900 mb-0 leading-tight">Hormat kami,</p>
                                    <p className="text-gray-900 mb-[120px] font-bold">{company?.name || "Nama Perusahaan"}</p>

                                    <div className="flex flex-col">
                                        <span className="underline text-gray-900 font-bold text-[11pt]">{signerName}</span>
                                        <span className="font-bold text-gray-900 text-[11pt]">{signerPosition}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* INTERNAL LETTER PAGE PREVIEW */}
                        <div className="bg-white p-8 mb-8 shadow-sm min-h-[1123px] w-full max-w-none mx-auto text-[12px]">
                            {/* Header (Same as Invoice) */}
                            <div className="flex justify-between items-start mb-8 pb-6 border-b border-gray-200">
                                <div className="flex items-center gap-6">
                                    {company?.logo_path && (
                                        <img
                                            src={getStorageUrl(company.logo_path)}
                                            alt="Logo"
                                            className="h-16 w-auto object-contain"
                                        />
                                    )}
                                    <div>
                                        <h2 className="text-[11pt] font-bold text-green-600 m-0 mb-0.5">{company?.name || "Nama Perusahaan"}</h2>
                                        <p className="text-[9pt] text-gray-500 m-0">{company?.address || "-"}</p>
                                        <p className="text-[9pt] text-gray-500 m-0">{company?.email || "-"}</p>
                                    </div>
                                </div>
                                {/* SPP Title Right Aligned with Subtitle */}
                                <div className="text-right">
                                    <h1 className="text-[24px] font-bold text-blue-800 tracking-tight uppercase">SPP</h1>
                                    <p className="text-[10px] text-gray-600 m-0 leading-none mt-[-2px]">( Surat Permohonan Pembayaran )</p>
                                </div>
                            </div>

                            {/* Info Section */}
                            <div className="grid grid-cols-2 gap-12 mb-8 text-[11pt]">
                                <div className="space-y-1">
                                    <div className="grid grid-cols-[100px_10px_1fr] items-baseline">
                                        <span className="font-semibold text-gray-700">Customer</span>
                                        <span className="text-gray-700 text-center">:</span>
                                        <span className="text-gray-900">{invoice.quotation?.request?.customer?.company_name || "-"}</span>
                                    </div>
                                    <div className="grid grid-cols-[100px_10px_1fr] items-baseline">
                                        <span className="font-semibold text-gray-700">Alamat</span>
                                        <span className="text-gray-700 text-center">:</span>
                                        <span className="text-gray-900">{invoice.quotation?.request?.customer?.delivery_address || invoice.quotation?.request?.customer?.address || "-"}</span>
                                    </div>
                                    <div className="grid grid-cols-[100px_10px_1fr] items-baseline">
                                        <span className="font-semibold text-gray-700">Attention</span>
                                        <span className="text-gray-700 text-center">:</span>
                                        <span className="text-gray-900">{selectedAttention}</span>
                                    </div>
                                </div>
                                <div className="space-y-1 w-full max-w-[400px] ml-auto text-right">
                                    <div className="mb-0.5">
                                        <span className="font-semibold text-gray-700">No</span> : <span className="font-mono text-gray-900">{invoice.invoice_number}</span>
                                    </div>
                                    <div className="mb-0.5">
                                        <span className="font-semibold text-gray-700">Date</span> : <span className="text-gray-900">{invoice.invoice_date ? new Date(invoice.invoice_date).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }) : "-"}</span>
                                    </div>
                                    <div className="mb-0.5">
                                        <span className="font-semibold text-gray-700">Ref (PO)</span> : <span className="text-gray-900">{poNumber}</span>
                                    </div>
                                    <div className="mb-0.5">
                                        <span className="font-semibold text-gray-700">Ref Date</span> : <span className="text-gray-900">{poDate}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="text-justify mb-6 text-[11pt] leading-relaxed">
                                <p className="mb-2">Dengan hormat,</p>
                                <p>Bersama ini kami menyampaikan Surat Permohonan Pembayaran atas penyelesaian permintaan pengadaan barang sebagai berikut:</p>
                            </div>

                            <div className="mb-6 ml-0 text-[11pt]">
                                <div className="grid grid-cols-[140px_10px_1fr] mb-1.5">
                                    <span>Nomor PO</span><span>:</span><span className="font-bold">{poNumber}</span>
                                </div>
                                <div className="grid grid-cols-[140px_10px_1fr] mb-1.5">
                                    <span>Tanggal PO</span><span>:</span><span className="font-bold">{poDate}</span>
                                </div>
                                <div className="grid grid-cols-[140px_10px_1fr] mb-1.5">
                                    <span>Nilai Pengadaan</span><span>:</span><span className="font-bold">Rp {grandTotal.toLocaleString("id-ID")},-</span>
                                </div>
                                <div className="grid grid-cols-[140px_10px_1fr] mb-1.5">
                                    <span>Terbilang</span><span>:</span><span className="font-bold italic capitalize">{terbilangAmount}</span>
                                </div>
                            </div>

                            <div className="text-justify mb-4 text-[11pt]">
                                <p>Adapun untuk pembayaran, mohon ditransfer ke:</p>
                            </div>

                            <div className="mb-6 text-[11pt]">
                                <div className="grid grid-cols-[140px_10px_1fr] mb-1.5">
                                    <span>Nama Bank</span><span>:</span><span className="font-bold">{company?.bank_name || "-"}</span>
                                </div>
                                <div className="grid grid-cols-[140px_10px_1fr] mb-1.5">
                                    <span>Nomor Rek.</span><span>:</span><span className="font-bold">{company?.account_number || "-"}</span>
                                </div>
                                <div className="grid grid-cols-[140px_10px_1fr] mb-1.5">
                                    <span>Atas Nama</span><span>:</span><span>{company?.account_name || "-"}</span>
                                </div>
                            </div>

                            <div className="text-justify mb-12 text-[11pt]">
                                <p>Demikian permohonan ini kami sampaikan, atas perhatian dan kerjasamanya kami ucapkan terima kasih.</p>
                            </div>

                            {/* Footer / Signature (Same as Invoice but less margin) */}
                            <div className="flex mt-8 items-end justify-between">
                                <div className="text-left w-24">
                                    {qrCodeUrl && <img src={qrCodeUrl} alt="QR Code" className="w-24 h-24 object-contain" />}
                                </div>

                                <div className="ml-auto text-left w-fit min-w-[200px] text-[11pt]">
                                    <p className="text-gray-900 mb-0 leading-tight">Hormat kami,</p>
                                    <p className="text-gray-900 mb-[120px] font-bold">{company?.name || "Nama Perusahaan"}</p>

                                    <div className="flex flex-col">
                                        <span className="underline text-gray-900 font-bold text-[11pt] mt-6">{signerName}</span>
                                        <span className="font-bold text-gray-900 text-[11pt]">{signerPosition}</span>
                                    </div>
                                </div>
                            </div>
                        </div>


                        {/* RECEIPT PAGE PREVIEW (2 COPIES) */}
                        <div className="bg-white p-8 mb-8 shadow-sm min-h-[1123px] w-full max-w-none mx-auto text-[12px] flex flex-col">
                            {[1, 2].map((_, idx) => (
                                <div key={idx} className={`flex-1 flex flex-col justify-start gap-4 ${idx === 0 ? 'border-b-2 border-dashed border-gray-400 pb-8 mb-8' : ''}`}>
                                    <div>
                                        {/* Header */}
                                        <div className="flex justify-between items-start mb-4 pb-2 border-b border-gray-200">
                                            <div className="flex items-center gap-4">
                                                {company?.logo_path && (
                                                    <img
                                                        src={getStorageUrl(company.logo_path)}
                                                        alt="Logo"
                                                        className="h-[45px] w-auto object-contain"
                                                    />
                                                )}
                                                <div>
                                                    <h2 className="text-[11pt] font-bold text-green-600 m-0 mb-0.5">{company?.name || "Nama Perusahaan"}</h2>
                                                    <p className="text-[11px] text-gray-500 m-0">{company?.address || "-"}</p>
                                                    <p className="text-[11px] text-gray-500 m-0">{company?.phone || "-"}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <h1 className="text-[20px] font-bold text-blue-800 tracking-tight uppercase">KWITANSI</h1>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="grid grid-cols-[140px_10px_1fr] items-baseline">
                                                <span className="text-gray-700 text-[10pt]">Telah terima dari</span>
                                                <span className="text-gray-700 text-center">:</span>
                                                <span className="font-bold text-[10pt] text-gray-900">{invoice.quotation?.request?.customer?.company_name || "-"}</span>
                                            </div>

                                            <div className="grid grid-cols-[140px_10px_1fr] items-baseline">
                                                <span className="text-gray-700 text-[10pt]">Uang Sejumlah</span>
                                                <span className="text-gray-700 text-center">:</span>
                                                <div className="border-b border-gray-400 border-dotted w-full italic font-bold text-[10pt] pb-0.5">
                                                    Rp {grandTotal.toLocaleString("id-ID")}
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-[140px_10px_1fr] items-baseline">
                                                <span className="text-gray-700 text-[10pt]">Terbilang</span>
                                                <span className="text-gray-700 text-center">:</span>
                                                <div className="border-b border-gray-400 border-dotted w-full italic font-bold text-[10pt] pb-0.5">
                                                    # {terbilangAmount} #
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-[140px_10px_1fr] items-baseline mt-2">
                                                <span className="text-gray-700 text-[10pt]">Untuk Pembayaran</span>
                                                <span className="text-gray-700 text-center">:</span>
                                                <span className="text-gray-900 leading-normal text-[10pt]">
                                                    Pembayaran Invoice No: <b>{invoice.invoice_number}</b> Tanggal <b>{invoice.invoice_date ? new Date(invoice.invoice_date).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }) : "-"}</b> terkait Kontrak No. <b>{poNumber}</b> tanggal <b>{poDate}</b>
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-start mt-4">
                                        {/* Left Side: Bank & QR */}
                                        <div>
                                            <div className="text-[10pt] text-gray-900 space-y-0.5 mb-2">
                                                <div className="grid grid-cols-[80px_10px_1fr]">
                                                    <span>Nama Bank</span><span>:</span><span className="font-bold">{company?.bank_name || "-"}</span>
                                                </div>
                                                <div className="grid grid-cols-[80px_10px_1fr]">
                                                    <span>Nomor Rek.</span><span>:</span><span className="font-bold">{company?.account_number || "-"}</span>
                                                </div>
                                                <div className="grid grid-cols-[80px_10px_1fr]">
                                                    <span>Atas Nama</span><span>:</span><span>{company?.account_name || "-"}</span>
                                                </div>
                                            </div>
                                            {qrCodeUrl && <img src={qrCodeUrl} alt="QR Code" className="w-16 h-16 object-contain" />}
                                        </div>

                                        {/* Right Side: Signature */}
                                        <div className="text-center min-w-[180px]">
                                            <p className="mb-1 text-[10pt]">Tanggal : {invoice.invoice_date ? new Date(invoice.invoice_date).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }) : "-"}</p>
                                            <div className="h-[60px] flex items-center justify-center text-gray-400 text-[10pt] italic">
                                                materai
                                            </div>
                                            <p className="font-bold underline text-gray-900 text-[10pt] mt-6">{signerName}</p>
                                            <p className="font-bold text-gray-900 text-[10pt]">{signerPosition}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>
            </DialogContent>
        </Dialog>
    );
}
