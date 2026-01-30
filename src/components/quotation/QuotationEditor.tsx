import { useState, useEffect, useRef } from "react";
import { usePermission } from "@/hooks/usePermission";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Printer, Mail } from "lucide-react";
import { toast } from "sonner";
import { format, isValid } from "date-fns";
import { id } from "date-fns/locale";
import QRCode from "react-qr-code";

interface QuotationEditorProps {
  quotation: any;
  onClose: () => void;
  onUpdate?: () => void;
}

interface BalanceItem {
  id: string;
  balance_entry_id: number;
  customer_spec: string;
  vendor_spec: string;
  qty: number;
  unit: string;
  unit_selling_price: number;
  total_selling_price: number;
  delivery_time: string;
  document_path?: string;
  position?: number;
}

interface Company {
  name: string;
  abbreviation: string;
  address: string;
  phone: string;
  email?: string;
  logo_path: string | null;
}

export default function QuotationEditor({ quotation, onClose, onUpdate }: QuotationEditorProps) {
  const { canManage, userId, userRole } = usePermission("quotations");

  const isOwner = quotation.created_by === userId;
  const isSuperAdmin = userRole === 'super_admin';
  // Allow edit if canManage AND (isOwner OR isSuperAdmin). 
  // Note: quotation prop might not have created_by populated if types are loose, but fetchQuotations has *.
  const canEdit = canManage && (isOwner || isSuperAdmin);

  const [company, setCompany] = useState<Company | null>(null);
  const [director, setDirector] = useState<{ name: string; position: string } | null>(null);
  const [balanceItems, setBalanceItems] = useState<BalanceItem[]>([]);
  const [balanceSettings, setBalanceSettings] = useState<any>(null);
  const [formData, setFormData] = useState({
    note: quotation.note || "partial order need re quotation",
    franco: quotation.franco || quotation.request.customer.delivery_address,
    term_of_payment: quotation.term_of_payment || "",
    price_validity: quotation.price_validity || "7 days",
  });
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchCompany();
    fetchBalanceItems();
  }, []);

  const fetchCompany = async () => {
    const { data } = await supabase.from("company").select("*").maybeSingle();
    if (data) setCompany(data);

    // Fetch Director
    const { data: members } = await supabase
      .from("team_members")
      .select("name, position")
      .or("position.ilike.%direktur%,position.ilike.%director%")
      .limit(1);

    if (members && members.length > 0) {
      setDirector(members[0]);
    }
  };

  /* Updated fetchBalanceItems with direct DB fetch */
  const fetchBalanceItems = async () => {
    // 1. Fetch links directly from DB to ensure data integrity
    const { data: qLinks } = await supabase
      .from("quotation_balances")
      .select("balance_id, entry_id")
      .eq("quotation_id", quotation.id);

    const links = (qLinks && qLinks.length > 0)
      ? qLinks
      : (quotation.balance_link ? [quotation.balance_link] : []);

    if (links.length === 0) return;

    // Collect all items from all linked balance entries
    let allItems: BalanceItem[] = [];
    let lastSettings: any = null;

    for (const link of links) {
      if (!link.balance_id || !link.entry_id) continue;

      const { data: items } = await supabase
        .from("balance_items")
        .select("*, vendor:vendors(company_name)")
        .eq("balance_id", link.balance_id)
        .eq("balance_entry_id", link.entry_id)
        .order("position", { ascending: true })
        .order("id", { ascending: true });

      if (items) {
        allItems = [...allItems, ...items];
      }

      // Fetch balance settings
      if (!lastSettings) {
        const { data: settings } = await supabase
          .from("balance_settings")
          .select("*")
          .eq("balance_id", link.balance_id)
          .eq("balance_entry_id", link.entry_id)
          .maybeSingle();

        if (settings) lastSettings = settings;
      }
    }

    setBalanceItems(allItems);

    if (lastSettings) {
      setBalanceSettings(lastSettings);
      if (!quotation.term_of_payment && lastSettings.payment_terms) {
        setFormData(prev => ({ ...prev, term_of_payment: lastSettings.payment_terms }));
      }
    }
  };

  const getStorageUrl = (path: string) => {
    return `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/company-files/${path}`;
  };

  // Create a sorted copy strictly by Position then ID
  // This ensures consistency between the Screen Preview and the PDF Print
  const sortedBalanceItems = [...balanceItems].sort((a, b) => {
    // Primary Sort: Position
    const posA = a.position !== undefined ? a.position : 999999;
    const posB = b.position !== undefined ? b.position : 999999;

    if (posA !== posB) {
      return posA - posB;
    }

    // Secondary Sort: ID (FIFO)
    const idA = typeof a.id === 'string' ? a.id : String(a.id);
    const idB = typeof b.id === 'string' ? b.id : String(b.id);
    return idA.localeCompare(idB);
  });

  const handlePrint = () => {
    // Helper to format currency
    const formatCurrency = (amount: number) => {
      return "Rp " + amount.toLocaleString("id-ID");
    };

    // Calculate totals
    const totalAmount = balanceItems.reduce((sum, item) => sum + (item.total_selling_price || 0), 0);
    const discountPercentage = balanceSettings?.discount_percentage || 0;
    const discountAmount = totalAmount * (discountPercentage / 100);
    const afterDiscount = totalAmount - discountAmount;
    const ppnAmount = Math.round(afterDiscount * (balanceSettings?.ppn_percentage ? (balanceSettings.ppn_percentage / 100) : 0));
    const grandTotal = Math.round(afterDiscount + ppnAmount);

    const logoUrl = company?.logo_path ? getStorageUrl(company.logo_path) : "";

    // Generate QR Code URL
    const companyPhone = company?.phone?.replace(/\D/g, "") || "";
    const formattedCompanyPhone = companyPhone.startsWith("0") ? "62" + companyPhone.slice(1) : companyPhone;
    const whatsappMessage = `Hallo dari ${quotation.request.customer.company_name} mau nanya terkait ini\n\nNo Penawaran: ${quotation.quotation_number}\nTanggal Penawaran: ${isValid(new Date(quotation.quotation_date)) ? format(new Date(quotation.quotation_date), "dd/MM/yyyy", { locale: id }) : "-"}`;
    const qrCodeUrl = formattedCompanyPhone ? `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(`https://wa.me/${formattedCompanyPhone}?text=${encodeURIComponent(whatsappMessage)}`)}` : "";

    // Create a hidden iframe
    let iframe = document.getElementById('print-iframe') as HTMLIFrameElement;
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'print-iframe';
      iframe.style.position = 'fixed';
      // Move off-screen instead of visibility:hidden to ensure print works in all browsers
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

    // Use the component-level sortedBalanceItems for consistent ordering
    // (No separate sorting logic needed here as we want to match the screen preview)

    doc.open();

    doc.open();
    doc.write(`
      <html>
        <head>
          <title>${quotation.request.customer.customer_code || 'CUST'}_${quotation.quotation_number}</title>
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
            .company-details h2 { margin: 0 0 2px 0; font-size: 11pt; font-weight: bold; color: #16a34a; }
            .company-details p { margin: 0; color: #6b7280; font-size: 9pt; }
            .quotation-title { font-size: 15pt; font-weight: bold; color: #1e40af; letter-spacing: -0.025em; }

            /* Grid Layout for Info Section */
            .info-section { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; margin-bottom: 32px; }
            
            .info-grid { display: grid; grid-template-columns: 100px 10px 1fr; gap: 4px; align-items: baseline; }
            .info-label { font-weight: 600; color: #374151; font-size: 11pt; }
            .info-colon { text-align: center; color: #374151; font-size: 11pt; }
            .info-value { color: #111827; font-size: 11pt; }

            /* Client Side (Left) */
            .client-side .info-grid { grid-template-columns: 100px 10px 1fr; }

            /* Meta Side (Right) */
            /* Adjusted to match screen: grid-cols-[1fr_10px_1fr] */
            .meta-side .info-grid { grid-template-columns: 1fr 10px 1fr; } 
            .meta-side { justify-self: end; width: 100%; max-width: 400px; }
            .meta-side .info-label { text-align: right; white-space: nowrap; }
            
            /* Table */
            .items-table { width: 100%; border-collapse: collapse; margin-bottom: 32px; font-family: 'Segoe UI', Arial, sans-serif; }
            .items-table th { background-color: #1e40af; color: #ffffff; font-weight: bold; padding: 8px; text-align: left; border: 1px solid #e5e7eb; font-size: 11pt; }
            .items-table td { padding: 8px; border: 1px solid #e5e7eb; vertical-align: top; font-size: 10pt; color: #111827; }
            .items-table th.col-center, .items-table td.col-center { text-align: center; }
            .items-table th.col-right, .items-table td.col-right { text-align: right; }
            
            .col-no { width: 48px; text-align: center; }
            
            /* Totals */
            .total-section { display: flex; justify-content: flex-end; margin-bottom: 32px; }
            .total-table { width: auto; min-width: 250px; font-size: 10pt; }
            .total-row { display: flex; justify-content: space-between; margin-bottom: 4px; color: #111827; }
            .total-label { text-align: right; padding-right: 16px; font-weight: 400; }
            .total-value { text-align: right; font-weight: 500; white-space: nowrap; }
            
            .grand-total { margin-top: 8px; padding-top: 8px; font-weight: bold; font-size: 11pt; } /* text-sm font-bold */
            .grand-total .total-label { font-weight: bold; }
            .grand-total .total-value { font-weight: bold; }
            
            /* Terms */
            .terms-section { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; }
            .term-title { font-weight: bold; margin-bottom: 8px; font-size: 11pt; text-decoration: underline; text-transform: uppercase; color: #111827; }
            .terms-grid { display: grid; grid-template-columns: 120px 10px 1fr; gap: 4px; max-width: 600px; font-size: 11pt; }
            .terms-grid .info-label, .terms-grid .info-value, .terms-grid .info-colon { font-size: 11pt; color: #4b5563; } /* text-gray-600 */
            .terms-grid .info-label { font-weight: 600; }
            
            /* Footer */
            .footer { margin-top: 48px; display: flex; justify-content: space-between; align-items: flex-end; page-break-inside: avoid; }
            .signature { text-align: left; min-width: 200px; }
            .signature p { margin: 0; }
            .signature-space { height: 80px; } /* matches mb-20 */
            .signer-name { padding-bottom: 0; display: block; font-weight: 400; text-decoration: underline; color: #111827; }
            .signer-role { font-weight: bold; font-size: 14px; color: #111827; }

            .qr-block { text-align: center; } 
            .qr-img { width: 100px; height: 100px; object-fit: contain; }

            /* Attachments */
            .attachment-page { page-break-before: always; margin-top: 30px; }
            .attachment-title { font-size: 14px; font-weight: bold; margin-bottom: 20px; text-decoration: underline; text-align: center; }
            .attachment-table { width: 100%; border-collapse: collapse; }
            .attachment-table th { background-color: #1e40af; color: #ffffff; font-weight: bold; padding: 10px; text-align: center; border: 1px solid #e5e7eb; font-size: 11pt; }
            .attachment-table td { padding: 10px; border: 1px solid #e5e7eb; vertical-align: top; font-size: 12px; }
            .att-col-no { width: 40px; text-align: center; }
            .att-grid { display: flex; flex-wrap: wrap; gap: 15px; justify-content: center; }
            .att-item-container { text-align: center; margin: 5px; page-break-inside: avoid; }
            .attachment-img { max-width: 250px; max-height: 250px; object-fit: contain; border: 1px solid #eee; display: block; margin: 0 auto 5px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
            .pdf-link { display: inline-block; padding: 6px 12px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 4px; color: #0f172a; text-decoration: none; font-weight: 500; font-size: 11px; }
          </style>
        </head>
        <body>
          <table class="main-layout-table">
            <thead>
              <tr>
                <td>
                  <div class="header-container" style="display: flex; justify-content: space-between; align-items: start; border-bottom: 1px solid #e5e7eb; padding-bottom: 24px; margin-bottom: 24px;">
                    <div class="company-branding" style="display: flex; align-items: center; gap: 16px;">
                      ${logoUrl ? `<img src="${logoUrl}" class="logo-img" alt="Logo" style="height: 60px; width: auto; object-fit: contain;" />` : ''}
                      <div class="company-details">
                        <h2 style="color: #16a34a; font-size: 11pt; font-weight: bold; margin: 0 0 4px 0;">${company?.name || 'PT. Morgan Powerindo Amerta'}</h2>
                        <p style="color: #6b7280; font-size: 9pt; margin: 0;">${company?.address || 'Jl. Pendidikan'}</p>
                        <p style="color: #6b7280; font-size: 9pt; margin: 0;">${company?.email || '-'}</p>
                      </div>
                    </div>
                    <div class="quotation-title" style="font-size: 15pt; font-weight: bold; color: #1e40af; letter-spacing: -0.025em;">QUOTATION</div>
                  </div>
                </td>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>

                  <div class="info-section" style="display: flex; justify-content: space-between; margin-bottom: 32px; font-size: 11pt;">
                    <div class="client-side">
                      <div class="info-grid" style="display: grid; grid-template-columns: 80px 10px 1fr; gap: 4px; align-items: baseline;">
                        <span class="info-label" style="font-weight: 600; color: #374151;">Customer</span><span class="info-colon">:</span><span class="info-value" style="color: #111827;">${quotation.request.customer.company_name}</span>
                        <span class="info-label" style="font-weight: 600; color: #374151;">Alamat</span><span class="info-colon">:</span><span class="info-value" style="color: #111827;">${quotation.request.customer.delivery_address || '-'}</span>
                        <span class="info-label" style="font-weight: 600; color: #374151;">PIC</span><span class="info-colon">:</span><span class="info-value" style="color: #111827;">${quotation.request.customer_pic.name}</span>
                      </div>
                    </div>
                    <div class="meta-side" style="text-align: right;">
                       <div class="info-grid" style="display: flex; flex-direction: column; align-items: flex-end; gap: 2px;">
                        <div><span class="info-label" style="font-weight: 600; color: #374151;">No Penawaran</span> : <span class="info-value" style="font-family: monospace; color: #111827;">${quotation.quotation_number}</span></div>
                        <div><span class="info-label" style="font-weight: 600; color: #374151;">Tanggal</span> : <span class="info-value" style="color: #111827;">${isValid(new Date(quotation.quotation_date)) ? format(new Date(quotation.quotation_date), "dd/MM/yyyy", { locale: id }) : "-"}</span></div>
                        <div><span class="info-label" style="font-weight: 600; color: #374151;">Subject</span> : <span class="info-value" style="color: #111827;">${quotation.request.title}</span></div>
                        <div><span class="info-label" style="font-weight: 600; color: #374151;">Ref</span> : <span class="info-value" style="color: #111827;">${quotation.request.letter_number}</span></div>
                        <div><span class="info-label" style="font-weight: 600; color: #374151;">Ref Date</span> : <span class="info-value" style="color: #111827;">${isValid(new Date(quotation.request.request_date)) ? format(new Date(quotation.request.request_date), "dd/MM/yyyy", { locale: id }) : "-"}</span></div>
                      </div>
                    </div>
                  </div>

                  <table class="items-table" style="width: 100%; border-collapse: collapse; margin-bottom: 32px; font-size: 10pt;">
                    <thead>
                      <tr style="background-color: #1e40af; color: #ffffff;">
                        <th class="col-no" style="padding: 8px; border: 1px solid #e5e7eb; text-align: center; width: 1%; font-size: 11pt; white-space: nowrap;">No</th>
                        <th class="" style="padding: 8px; border: 1px solid #e5e7eb; text-align: left; font-size: 11pt;">Spesifikasi</th>
                        <th class="col-center" style="padding: 8px; border: 1px solid #e5e7eb; text-align: center; font-size: 11pt; width: 1%; white-space: nowrap;">Qty</th>
                        <th class="col-right" style="padding: 8px; border: 1px solid #e5e7eb; text-align: right; font-size: 11pt; width: 1%; white-space: nowrap;">Harga Jual</th>
                        <th class="col-right" style="padding: 8px; border: 1px solid #e5e7eb; text-align: right; font-size: 11pt; width: 1%; white-space: nowrap;">Total</th>
                        <th class="col-center" style="padding: 8px; border: 1px solid #e5e7eb; text-align: center; width: 1%; font-size: 11pt; white-space: nowrap;">Waktu Tiba</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${sortedBalanceItems.map((item, index) => `
                        <tr>
                          <td class="col-no" style="padding: 8px; border: 1px solid #e5e7eb; vertical-align: middle; text-align: center; white-space: nowrap;">${index + 1}</td>
                          <td style="padding: 8px; border: 1px solid #e5e7eb; vertical-align: middle;">
                            <div style="margin-bottom: 4px;">${item.customer_spec || '-'}</div>
                            ${item.vendor_spec ? `<div style="color: #6b7280; margin-top: 8px;">Offer to: ${item.vendor_spec}</div>` : ''}
                          </td>
                          <td class="col-center" style="padding: 8px; border: 1px solid #e5e7eb; vertical-align: middle; text-align: center; white-space: nowrap;">${item.qty} ${item.unit}</td>
                          <td class="col-right" style="padding: 8px; border: 1px solid #e5e7eb; vertical-align: middle; text-align: right; white-space: nowrap;">${formatCurrency(item.unit_selling_price || 0).replace("Rp ", "")}</td>
                          <td class="col-right" style="padding: 8px; border: 1px solid #e5e7eb; vertical-align: middle; text-align: right; white-space: nowrap;">${formatCurrency(item.total_selling_price || 0).replace("Rp ", "")}</td>
                          <td class="col-center" style="padding: 8px; border: 1px solid #e5e7eb; vertical-align: middle; text-align: center; white-space: nowrap;">${item.delivery_time || '-'}</td>
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
                      ${balanceSettings?.ppn_percentage > 0 ? `
                      <div class="total-row">
                        <span class="total-label">PPN (${balanceSettings.ppn_percentage}%):</span>
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
                       <span class="info-label">Note</span><span class="info-colon">:</span><span class="info-value">${formData.note || '-'}</span>
                       <span class="info-label">Franco</span><span class="info-colon">:</span><span class="info-value">${formData.franco || '-'}</span>
                       <span class="info-label">Delivery Time</span><span class="info-colon">:</span><span class="info-value">${calculateMaxDeliveryTime()}</span>
                       <span class="info-label">Validity</span><span class="info-colon">:</span><span class="info-value">${formData.price_validity || '-'}</span>
                    </div>
                  </div>

                  <div style="margin-top: 24px; font-size: 9pt; color: #6b7280; font-style: italic; border-top: 1px dashed #e5e7eb; padding-top: 8px;">
                    Dokumen ini dikeluarkan oleh Sistem Integrasi Data ${company?.name || 'PT. Morgan Powerindo Amerta'} dan dinyatakan Sah dan Otentik bila disertai QR Code dan tidak memerlukan tanda tangan basah. Silahkan melakukan verifikasi dengan scan QR Code
                  </div>

                  <div class="footer" style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 32px; font-size: 11pt;">
                    <div class="qr-block">
                      ${qrCodeUrl ? `<img src="${qrCodeUrl}" class="qr-img" alt="QR Code" style="width: 100px; height: 100px;" />` : ''}
                    </div>
                    <div class="signature" style="text-align: left; min-width: 200px;">
                      <p style="margin-bottom: 8px; color: #4b5563;">Regards,</p>
                      <p style="font-weight: bold; color: #111827; margin-bottom: 80px;">${company?.name || 'PT. Morgan Powerindo Amerta'}</p>
                      <span class="signer-name" style="display: inline-block; text-decoration: underline; font-weight: bold;">${director?.name || 'Authorized Signature'}</span>
                      <span class="signer-role" style="display: block; font-weight: bold;">${director?.position || ''}</span>
                    </div>
                  </div>

                </td>
              </tr>
            </tbody>
          </table>

          ${sortedBalanceItems.length > 0 ? `
             <div style="page-break-before: always;"></div>
             <table class="main-layout-table">
               <thead>
                <tr>
                   <td>
                      <div class="header-container" style="display: flex; justify-content: space-between; align-items: start; border-bottom: 1px solid #e5e7eb; padding-bottom: 24px; margin-bottom: 24px;">
                        <div class="company-branding" style="display: flex; align-items: center; gap: 16px;">
                          ${logoUrl ? `<img src="${logoUrl}" class="logo-img" alt="Logo" style="height: 60px; width: auto; object-fit: contain;" />` : ''}
                          <div class="company-details">
                            <h2 style="color: #16a34a; font-size: 11pt; font-weight: bold; margin: 0 0 4px 0;">${company?.name || 'PT. Morgan Powerindo Amerta'}</h2>
                            <p style="color: #6b7280; font-size: 9pt; margin: 0;">${company?.address || 'Jl. Pendidikan'}</p>
                            <p style="color: #6b7280; font-size: 9pt; margin: 0;">${company?.email || '-'}</p>
                          </div>
                        </div>
                        <div class="quotation-title" style="font-size: 15pt; font-weight: bold; color: #1e40af; letter-spacing: -0.025em;">LAMPIRAN</div>
                      </div>
                   </td>
                </tr>
               </thead>
               <tbody>
                 <tr>
                   <td>
                    <div class="attachment-page" style="margin-top: 0;">
                      <table class="attachment-table">
                        <thead>
                          <tr>
                            <th class="att-col-no" style="width: 40px;">No</th>
                            <th>Lampiran</th>
                          </tr>
                        </thead>
                        <tbody>
                          ${sortedBalanceItems.map((item, index) => {
      const paths = item.document_path ? item.document_path.split(',') : [];
      const itemIndex = index + 1;

      return `
                            <tr>
                              <td class="att-col-no">${itemIndex}</td>
                              <td>

                                <div class="att-grid">
                                  ${paths.length > 0 ? paths.map(path => {
        const isPdf = path.toLowerCase().endsWith('.pdf');
        const url = getItemStorageUrl(path);

        return `
                                      <div class="att-item-container">
                                        ${isPdf
            ? `<a href="${url}" target="_blank" class="pdf-link">View PDF (${path.split('_').pop()})</a>`
            : `<img src="${url}" class="attachment-img" alt="Attachment" />`
          }
                                      </div>
                                    `;
      }).join('') : '<div style="text-align: center; color: #6b7280;">-</div>'}
                                </div>
                              </td>
                            </tr>
                            `;
    }).join('')}



                        </tbody>
                      </table>
                    </div>
                   </td>
                 </tr>
               </tbody>
             </table>
          ` : ''}
      </html>
    `);
    doc.close();

    // Swap Title for PDF Filename
    const myCompanyName = company?.name || "COMPANY";
    const safeMyCompanyName = myCompanyName.replace(/[\/\\:*?"<>|]/g, "_");
    const safeQuotationNumber = quotation.quotation_number.replace(/[\/\\:*?"<>|]/g, "-");
    const fileName = `${safeMyCompanyName}_${safeQuotationNumber}`;

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
    }, 1000);

  };

  const handleSave = async () => {
    const { error } = await supabase
      .from("quotations")
      .update({
        note: formData.note,
        franco: formData.franco,
        term_of_payment: formData.term_of_payment,
        price_validity: formData.price_validity,
      })
      .eq("id", quotation.id);

    if (error) {
      toast.error("Gagal menyimpan perubahan");
    } else {
      toast.success("Perubahan disimpan");
      if (onUpdate) onUpdate();
    }
  };

  const getItemStorageUrl = (path: string) => {
    return `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/request-attachments/${path}`;
  };

  const calculateMaxDeliveryTime = () => {
    if (balanceItems.length === 0) return "-";

    // Simple parser for "X Weeks", "Y Days"
    const parseDuration = (str: string) => {
      if (!str) return 0;
      const normalized = str.toLowerCase();
      const value = parseInt(normalized.replace(/\D/g, '')) || 0;
      if (normalized.includes("week") || normalized.includes("minggu")) return value * 7;
      if (normalized.includes("month") || normalized.includes("bulan")) return value * 30;
      return value; // default days
    };

    let maxDuration = 0;
    let maxStr = "-";

    balanceItems.forEach(item => {
      const duration = parseDuration(item.delivery_time);
      if (duration > maxDuration) {
        maxDuration = duration;
        maxStr = item.delivery_time;
      }
    });

    return maxStr;
  };



  const handleSendEmail = () => {
    const subject = encodeURIComponent(quotation.request.title);
    const body = encodeURIComponent(
      `Berikut dilampirkan penawaran dengan no penawaran ${quotation.quotation_number}.\n\nTerimakasih`
    );

    window.open(`mailto:? subject = ${subject}& body=${body} `, "_blank");
  };



  const totalAmount = balanceItems.reduce((sum, item) => sum + (item.total_selling_price || 0), 0);
  const discountPercentage = balanceSettings?.discount_percentage || 0;
  const discountAmount = totalAmount * (discountPercentage / 100);
  const afterDiscount = totalAmount - discountAmount;
  const ppnAmount = Math.round(afterDiscount * (balanceSettings?.ppn_percentage ? (balanceSettings.ppn_percentage / 100) : 0));
  const grandTotal = Math.round(afterDiscount + ppnAmount);

  const companyPhone = company?.phone?.replace(/\D/g, "") || "";
  const formattedCompanyPhone = companyPhone.startsWith("0") ? "62" + companyPhone.slice(1) : companyPhone;
  const whatsappMessage = `Hallo dari ${quotation.request.customer.company_name} mau nanya terkait ini\n\nNo Penawaran: ${quotation.quotation_number} \nTanggal Penawaran: ${isValid(new Date(quotation.quotation_date)) ? format(new Date(quotation.quotation_date), "dd/MM/yyyy", { locale: id }) : "-"} `;
  const whatsappUrl = formattedCompanyPhone ? `https://wa.me/${formattedCompanyPhone}?text=${encodeURIComponent(whatsappMessage)}` : "";



  return (
    <div className="flex flex-col h-full gap-4 overflow-hidden">
      <div className="flex justify-end gap-2 shrink-0">
        {canEdit && <Button onClick={handleSave}>Simpan</Button>}
        <Button variant="outline" onClick={handlePrint}>
          <Printer className="h-4 w-4 mr-2" />
          Cetak PDF
        </Button>

      </div>

      <div className="flex-1 overflow-y-auto bg-gray-50 p-4 rounded-lg border shadow-inner">
        <div ref={printRef} className="bg-white p-8 border rounded-lg shadow-sm">
          {/* Header */}
          <div className="flex justify-between items-start mb-8 border-b pb-6">
            <div className="flex items-center gap-6">
              {company?.logo_path && (
                <img
                  src={getStorageUrl(company.logo_path)}
                  alt="Logo"
                  className="h-16 w-auto object-contain"
                />
              )}
              <div>
                <h2 className="font-bold text-[11pt] text-green-600">{company?.name || "Nama Perusahaan"}</h2>
                <p className="text-[9pt] text-gray-500">{company?.address}</p>
                <p className="text-[9pt] text-gray-500">{company?.email}</p>
              </div>
            </div>
            <div className="text-right">
              <h1 className="text-[15pt] font-bold text-blue-800 tracking-tight">QUOTATION</h1>
            </div>
          </div>

          {/* Info Section */}
          <div className="grid grid-cols-2 gap-12 mb-8">
            <div className="space-y-1">
              <div className="grid grid-cols-[100px_10px_1fr] items-baseline gap-1 text-[11pt]">
                <span className="font-semibold text-gray-700">Customer</span>
                <span className="text-center">:</span>
                <span className="text-gray-900 font-bold">{quotation.request.customer.company_name}</span>

                <span className="font-semibold text-gray-700">Alamat</span>
                <span className="text-center">:</span>
                <span className="text-gray-900">{quotation.request.customer.delivery_address}</span>

                <span className="font-semibold text-gray-700">PIC</span>
                <span className="text-center">:</span>
                <span className="text-gray-900">{quotation.request.customer_pic.name}</span>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex flex-col items-end gap-1 text-[11pt] text-right">
                <div><span className="font-semibold text-gray-700">No Penawaran</span> : <span className="text-gray-900 font-mono font-bold">{quotation.quotation_number}</span></div>
                <div><span className="font-semibold text-gray-700">Tanggal</span> : <span className="text-gray-900">{isValid(new Date(quotation.quotation_date)) ? format(new Date(quotation.quotation_date), "dd/MM/yyyy", { locale: id }) : "-"}</span></div>
                <div><span className="font-semibold text-gray-700">Subject</span> : <span className="text-gray-900">{quotation.request.title}</span></div>
                <div><span className="font-semibold text-gray-700">Ref</span> : <span className="text-gray-900">{quotation.request.letter_number}</span></div>
                <div><span className="font-semibold text-gray-700">Ref Date</span> : <span className="text-gray-900">{isValid(new Date(quotation.request.request_date)) ? format(new Date(quotation.request.request_date), "dd/MM/yyyy", { locale: id }) : "-"}</span></div>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <table className="w-full border-collapse border border-gray-200 mb-8">
            <thead>
              <tr className="bg-blue-800 text-white">
                <th className="border border-gray-200 p-3 text-left w-[1%] whitespace-nowrap font-semibold text-[11pt]">No</th>
                <th className="border border-gray-200 p-3 text-left font-semibold text-[11pt]">Spesifikasi</th>
                <th className="border border-gray-200 p-3 text-center w-[1%] whitespace-nowrap font-semibold text-[11pt]">Qty</th>
                <th className="border border-gray-200 p-3 text-right w-[1%] whitespace-nowrap font-semibold text-[11pt]">Harga Jual</th>
                <th className="border border-gray-200 p-3 text-right w-[1%] whitespace-nowrap font-semibold text-[11pt]">Total</th>
                <th className="border border-gray-200 p-3 text-center w-[1%] whitespace-nowrap font-semibold text-[11pt]">Waktu Tiba</th>
              </tr>
            </thead>
            <tbody>
              {sortedBalanceItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="border border-gray-200 p-8 text-center text-gray-500">
                    Tidak ada item. Tambahkan item pada halaman detail neraca.
                  </td>
                </tr>
              ) : (
                sortedBalanceItems.map((item, index) => (
                  <tr key={item.id}>
                    <td className="border border-gray-200 p-3 text-center text-[10pt] align-middle whitespace-nowrap">{index + 1}</td>
                    <td className="border border-gray-200 p-3 text-[10pt] align-middle">
                      <div className="text-gray-900 mb-1">{item.customer_spec || "-"}</div>
                      {item.vendor_spec && (
                        <div className="text-gray-500 mt-2">
                          Offer to: {item.vendor_spec}
                        </div>
                      )}
                    </td>
                    <td className="border border-gray-200 p-3 text-center text-[10pt] align-middle whitespace-nowrap">{item.qty} {item.unit}</td>
                    <td className="border border-gray-200 p-3 text-right text-[10pt] align-middle whitespace-nowrap">
                      {(item.unit_selling_price || 0).toLocaleString("id-ID")}
                    </td>
                    <td className="border border-gray-200 p-3 text-right text-[10pt] align-middle whitespace-nowrap">
                      {(item.total_selling_price || 0).toLocaleString("id-ID")}
                    </td>
                    <td className="border border-gray-200 p-3 text-center text-[10pt] align-middle whitespace-nowrap">{item.delivery_time}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Totals */}
          {/* Totals */}
          <div className="flex justify-end mb-8">
            <div className="w-auto min-w-[250px] space-y-1 text-[10pt] font-sans">
              <div className="flex justify-between text-gray-900">
                <span className="text-right pr-4">Total:</span>
                <span className="font-medium text-right">Rp {totalAmount.toLocaleString("id-ID")}</span>
              </div>

              {discountPercentage > 0 && (
                <div className="flex justify-between text-gray-900 items-center">
                  <div className="flex items-center justify-end pr-4 text-right">
                    <span>Disc ({discountPercentage}%):</span>
                  </div>
                  <span className="text-right text-red-600">- {discountAmount.toLocaleString("id-ID")}</span>
                </div>
              )}

              {balanceSettings?.ppn_percentage > 0 && (
                <div className="flex justify-between text-gray-900 items-center">
                  <div className="flex items-center justify-end pr-4 text-right">
                    <span>PPN ({balanceSettings.ppn_percentage}%):</span>
                  </div>
                  <span className="text-right">{ppnAmount.toLocaleString("id-ID")}</span>
                </div>
              )}

              <div className="flex justify-between text-gray-900 font-bold text-[11pt] pt-2">
                <span className="text-right pr-4">Grand Total:</span>
                <span className="text-right">{grandTotal.toLocaleString("id-ID")}</span>
              </div>
            </div>
          </div>

          {/* Terms */}
          <div className="mt-8 pt-4 border-t">
            <h3 className="font-bold text-gray-900 underline mb-2 text-[11pt] uppercase">Terms & Conditions</h3>
            <div className="space-y-1 text-[11pt] grid grid-cols-[120px_10px_1fr] gap-y-1 items-center">
              <span className="font-semibold text-gray-600">Note</span>
              <span className="text-center">:</span>
              <Textarea
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                placeholder="-"
                className="w-full p-0 border-none bg-transparent min-h-[1.5em] resize-none text-[11pt] focus-visible:ring-0"
                disabled={!canEdit}
              />

              <span className="font-semibold text-gray-600">Franco</span>
              <span className="text-center">:</span>
              <Input
                value={formData.franco}
                onChange={(e) => setFormData({ ...formData, franco: e.target.value })}
                className="w-full p-0 h-auto border-none bg-transparent text-[11pt] focus-visible:ring-0"
                disabled={!canEdit}
              />

              <span className="font-semibold text-gray-600">Delivery Time</span>
              <span className="text-center">:</span>
              <div className="text-[11pt] py-1 px-2 bg-gray-50 rounded border border-gray-100 w-fit">
                {calculateMaxDeliveryTime()} (Auto-calculated)
              </div>

              <span className="w-32 font-semibold text-gray-600 flex-shrink-0">Validity</span>
              <span className="text-center">:</span>
              <Input
                value={formData.price_validity}
                onChange={(e) => setFormData({ ...formData, price_validity: e.target.value })}
                className="w-full p-0 h-auto border-none bg-transparent text-[11pt] focus-visible:ring-0"
                disabled={!canEdit}
              />
            </div>
          </div>

          <div className="mt-6 text-[9pt] text-gray-500 italic border-t border-dashed border-gray-200 pt-2">
            Dokumen ini dikeluarkan oleh Sistem Integrasi Data {company?.name || 'PT. Morgan Powerindo Amerta'} dan dinyatakan Sah dan Otentik bila disertai QR Code dan tidak memerlukan tanda tangan basah. Silahkan melakukan verifikasi dengan scan QR Code
          </div>

          <div className="flex mt-8 items-end justify-between text-[11pt]">
            {whatsappUrl ? (
              <div className="" id="printable-qr-code">
                <QRCode value={whatsappUrl} size={100} />
              </div>
            ) : <div></div>}
            <div className="ml-auto text-left w-fit flex flex-col justify-between">
              <div>
                <p className="text-gray-600 mb-2">Regards,</p>
                <p className="font-bold text-gray-900 inline-block min-w-[200px] mb-20">
                  {company?.name || "Nama Perusahaan"}
                </p>
              </div>
              <div className="flex flex-col">
                <span className="font-bold underline text-[11pt] w-fit">{director?.name || 'Authorized Signature'}</span>
                <span className="font-bold text-[11pt]">{director?.position || ''}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Attachment "Page" in Modal */}
        {(sortedBalanceItems.length > 0) && (
          <div className="bg-white p-8 border rounded-lg shadow-sm mt-8">
            {/* Header for Attachment Page */}
            <div className="flex justify-between items-start mb-8 border-b pb-6">
              <div className="flex items-center gap-6">
                {company?.logo_path && (
                  <img
                    src={getStorageUrl(company.logo_path)}
                    alt="Logo"
                    className="h-16 w-auto object-contain"
                  />
                )}
                <div>
                  <h2 className="font-bold text-[11pt] text-green-600">{company?.name || "Nama Perusahaan"}</h2>
                  <p className="text-[9pt] text-gray-500">{company?.address}</p>
                  <p className="text-[9pt] text-gray-500">{company?.phone}</p>
                </div>
              </div>
              <div className="text-right">
                <h1 className="font-bold text-[15pt] text-blue-800 tracking-tight">LAMPIRAN</h1>
              </div>
            </div>

            <div className="">
              <table className="w-full border-collapse border border-gray-200">
                <thead>
                  <tr className="bg-blue-800 text-white">
                    <th className="border border-gray-200 p-2 text-center w-10 font-semibold text-[11pt]">No</th>
                    <th className="border border-gray-200 p-2 text-center font-semibold text-[11pt]">Lampiran</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedBalanceItems.map((item, index) => {
                    const paths = item.document_path ? item.document_path.split(',') : [];
                    const itemIndex = index + 1;
                    return (
                      <tr key={item.id}>
                        <td className="border border-gray-200 p-2 text-center text-xs align-top">{itemIndex}</td>
                        <td className="border border-gray-200 p-2 align-top">

                          {paths.length > 0 ? (
                            <div className="flex flex-wrap gap-4 justify-center">
                              {paths.map((path, idx) => {
                                const isPdf = path.toLowerCase().endsWith('.pdf');
                                const url = getItemStorageUrl(path);
                                return (
                                  <div key={idx} className="text-center">
                                    {isPdf ? (
                                      <a href={url} target="_blank" rel="noopener noreferrer" className="inline-block px-3 py-1 bg-gray-100 border rounded text-xs text-blue-800 hover:bg-gray-200">
                                        View PDF ({path.split('_').pop()})
                                      </a>
                                    ) : (
                                      <img src={url} alt="Attachment" className="max-w-[200px] max-h-[200px] object-contain border shadow-sm mx-auto mb-1" />
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="text-center text-gray-500">-</div>
                          )}
                        </td>
                      </tr>
                    );
                  })}


                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
