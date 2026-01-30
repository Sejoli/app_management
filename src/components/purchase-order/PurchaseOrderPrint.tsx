import { useRef, useEffect, useState } from "react";
import { format, isValid } from "date-fns";
import { id } from "date-fns/locale";
import QRCode from "react-qr-code";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Printer, Save } from "lucide-react";
import { toast } from "sonner";

interface PO {
    id: string;
    po_number: string;
    created_at: string;
    created_by?: string;
    vendor_id: string;
    vendor: {
        company_name: string;
        address?: string;
        office_address?: string;
        bank_name?: string;
        bank_account_number?: string;
        bank_account_holder?: string;
    };
    vendor_pic: { name: string };
    vendor_letter_number: string;
    vendor_letter_date: string;
    subject: string;
    discount?: number;
    ppn?: number;
    dp_amount?: number;
    dp_percentage?: number;
    payment_terms?: string;
    remaining_payment?: number;
    notes?: string;
    franco?: string;
    delivery_time?: string;
    payment_term?: string;
    status?: 'pending' | 'approved';
    transfer_proof_url?: string | null;
    snapshot_data?: any;
    quotations: Array<{
        id: string;
        quotation_number: string;
        request: {
            request_code: string;
            letter_number: string;
            customer: { company_name: string; address?: string; customer_code?: string };
            customer_pic: { name: string };
            request_date: string;
            attachments: Array<{ file_name: string; file_path: string }>;
        };
        franco?: string;
        po_ins?: Array<{
            vendor_letter_number: string;
            subject: string;
            internal_letters?: Array<{ created_at: string }>;
        }>;
        balance_link: any;
    }>;
}

interface Company {
    name: string;
    address: string;
    phone: string;
    email?: string;
    logo_path: string | null;
}

export default function PurchaseOrderPrint({ po, onUpdate, internalNumberOverride, invoiceSubject, invoiceType }: { po: PO; onUpdate?: () => void; internalNumberOverride?: string; invoiceSubject?: string; invoiceType?: string }) {
    const [company, setCompany] = useState<Company | null>(null);
    const [items, setItems] = useState<any[]>([]);

    // Snapshot Logic for Internal Letter (Customer)
    const customerSnapshot = po.snapshot_data?.customer;
    // Fallback chain: Snapshot -> Quotations Array (PO Out) -> Quotation Object (PO In/Invoice)
    const legacyCustomer = po.quotations?.[0]?.request?.customer || (po as any).quotation?.request?.customer;
    const customer = customerSnapshot || legacyCustomer;

    // ... (rest of component) ...

    // Update rendering to use `customer` variable instead of deep path
    // We will do this by replacing the specific block in the rendering section


    // Local state - Init from DB fields if available
    const [notes, setNotes] = useState(po.notes || "-");
    const [franco, setFranco] = useState(po.franco || "-");
    const [paymentTerm, setPaymentTerm] = useState(po.payment_term || "-");
    const [deliveryTime, setDeliveryTime] = useState(po.delivery_time || "-");

    const [isLoading, setIsLoading] = useState(false);
    const [debugMsg, setDebugMsg] = useState("");

    const [signer, setSigner] = useState<any>(null);

    useEffect(() => {
        const fetchCompanyAndSigner = async () => {
            const { data } = await supabase.from("company").select("*").maybeSingle();
            setCompany(data);

            // Conditional Signature Logic
            if (internalNumberOverride && po.created_by) {
                // For Internal Letters, fetch the Creator
                const { data: creator } = await supabase
                    .from("team_members")
                    .select("name, position")
                    .eq("user_id", po.created_by)
                    .maybeSingle();

                if (creator) {
                    setSigner(creator);
                } else {
                    // Fallback if creator not found in team_members
                    setSigner({ name: "Admin", position: "Staff" });
                }
            } else {
                // Default Behavior (PO): Fetch Director
                const { data: members } = await supabase
                    .from("team_members")
                    .select("name, position")
                    .or("position.ilike.%direktur%,position.ilike.%director%,position.ilike.%pimpinan%")
                    .limit(1);

                if (members && members.length > 0) {
                    setSigner(members[0]);
                }
            }
        };
        fetchCompanyAndSigner();
    }, [po.vendor_id]);

    // SYNC Local State when PO prop updates (Important for persistence on re-open)
    useEffect(() => {
        if (po) {
            setNotes(po.notes || "-");
            setFranco(po.franco || (company?.address || "-"));
            setPaymentTerm(po.payment_term || "-");
            setDeliveryTime(po.delivery_time || "-");
        }
    }, [po, company?.address]);

    useEffect(() => {
        const fetchItems = async () => {
            setIsLoading(true);
            let allItems: any[] = [];

            if (po.quotations) {
                for (const q of po.quotations) {
                    // Ensure links is an array
                    let links: any[] = [];
                    if (Array.isArray(q.balance_link)) {
                        links = q.balance_link;
                    } else if (q.balance_link) {
                        links = [q.balance_link];
                    }

                    for (const link of links) {
                        // STRICT FILTER: Check if this link matches the PO Subject tag
                        if (po.subject) {
                            const linkCodes = link.balance?.balance_entries?.map((e: any) => e.code) || [];
                            // If the link has associated codes, check if any appear in the PO subject.
                            // If NOT, then this link belongs to a different balance (e.g. N-2 vs N-1), so we skip it.
                            if (linkCodes.length > 0) {
                                const isMatch = linkCodes.some((code: string) => po.subject.includes(code));
                                if (!isMatch) continue;
                            }
                        }

                        // Try multiple possible paths for balance_id
                        const balanceId = (typeof link === 'object' && link !== null)
                            ? (link.balance_id || link.balance?.id || link.id)
                            : link;

                        const entryId = (typeof link === 'object' && link !== null)
                            ? (link.entry_id || link.balance_entry_id)
                            : null;

                        if (!balanceId) {
                            continue;
                        }

                        // Query setup
                        let query = supabase.from("balance_items").select("*").eq("balance_id", balanceId);

                        if (entryId) query = query.eq("balance_entry_id", entryId);
                        if (po.vendor_id) query = query.eq("vendor_id", po.vendor_id);

                        const { data } = await query;

                        if (data) {
                            allItems = [...allItems, ...data];
                        }
                    }
                }
            }

            // Remove duplicates based on ID
            const uniqueItems = Array.from(new Map(allItems.map(item => [item.id, item])).values());
            // Sort by Position then ID (FIFO)
            uniqueItems.sort((a: any, b: any) => {
                const posA = a.position !== undefined ? a.position : 999999;
                const posB = b.position !== undefined ? b.position : 999999;
                if (posA !== posB) return posA - posB;
                return a.id.localeCompare(b.id);
            });
            setItems(uniqueItems);

            setIsLoading(false);
        };

        if (po) fetchItems();
    }, [po]);

    // FETCH LIVE SETTINGS FROM BALANCE
    useEffect(() => {
        const fetchLiveSettings = async () => {
            if (!po.quotations || po.quotations.length === 0) return;

            // Find first valid balance ID
            let balanceId = null;
            const q = po.quotations[0];
            if (Array.isArray(q.balance_link) && q.balance_link.length > 0) {
                balanceId = q.balance_link[0].balance_id || q.balance_link[0].balance?.id;
            } else if (q.balance_link) {
                balanceId = q.balance_link.balance_id || q.balance_link.balance?.id;
            }

            if (balanceId && po.vendor_id) {
                const { data: settings } = await supabase
                    .from("balance_vendor_settings")
                    .select("*")
                    .eq("balance_id", balanceId)
                    .eq("vendor_id", po.vendor_id)
                    .maybeSingle();

                if (settings) {
                    // Apply live settings
                    if (settings.discount !== undefined) setDiscount(settings.discount);
                }
            }
        };
        fetchLiveSettings();
    }, [po.quotations, po.vendor_id]);

    const getStorageUrl = (path: string) => {
        return `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/company-files/${path}`;
    };

    const getAttachmentUrl = (path: string) => {
        return `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/request-attachments/${path}`;
    };

    const [discount, setDiscount] = useState(po.discount || 0);
    const [ppn, setPpn] = useState(po.ppn ?? 11);
    const [dpPercentage, setDpPercentage] = useState(po.dp_percentage || 0);
    const [dpAmount, setDpAmount] = useState(po.dp_amount || 0);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        setDiscount(po.discount || 0);
        setPpn(po.ppn ?? 11);
        setDpPercentage(po.dp_percentage || 0);
        setDpAmount(po.dp_amount || 0);
    }, [po.discount, po.ppn, po.dp_percentage, po.dp_amount]);

    const totalPurchase = items.reduce((sum, item) => sum + ((item.purchase_price || 0) * (item.qty || 0)), 0);
    const discountAmount = totalPurchase * (discount / 100);
    const afterDisc = totalPurchase - discountAmount;
    const ppnAmount = afterDisc * (ppn / 100);
    const grandTotal = afterDisc + ppnAmount;

    // DP Logic
    const dpVal = dpAmount || (dpPercentage ? (grandTotal * (dpPercentage / 100)) : 0);
    const isDP = invoiceType === 'DP' || (!invoiceType && invoiceSubject?.toLowerCase().includes("tagihan dp"));
    const isSettlement = invoiceType === 'PELUNASAN' || (!invoiceType && invoiceSubject?.toLowerCase().includes("pelunasan"));

    const handlePrint = () => {
        // Create a hidden iframe
        let iframe = document.getElementById('print-iframe') as HTMLIFrameElement;
        if (!iframe) {
            iframe = document.createElement('iframe');
            iframe.id = 'print-iframe';
            iframe.style.position = 'fixed';
            iframe.style.left = '-9999px';
            iframe.style.top = '0px';
            iframe.style.width = '0px';
            iframe.style.height = '0px';
            iframe.style.border = 'none';
            document.body.appendChild(iframe);
        }

        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!doc) {
            console.error("Could not get iframe document");
            return;
        }

        // Helper for currency
        const formatCurrency = (val: number) => "Rp " + val.toLocaleString("id-ID");

        // Helper for dates
        const formatDate = (dateStr: string) => isValid(new Date(dateStr)) ? format(new Date(dateStr), "dd/MM/yyyy", { locale: id }) : "-";

        // Generate HTML
        const vendorName = po.vendor?.company_name || "VENDOR";
        const safeVendorName = vendorName.replace(/[\/\\:*?"<>|]/g, "_");

        const myCompanyName = company?.name || "COMPANY";
        const safeMyCompanyName = myCompanyName.replace(/[\/\\:*?"<>|]/g, "_");

        // Clean up internal number for filename (remove slashes)
        const safeInternalNo = internalNumberOverride ? internalNumberOverride.replace(/[\/\\:*?"<>|]/g, "-") : "";
        const safePoNumber = po.po_number.replace(/[\/\\:*?"<>|]/g, "-");

        const fileName = internalNumberOverride
            ? `${safeVendorName}_${safeInternalNo}`
            : `${safeMyCompanyName}_${safePoNumber}`;

        doc.open();
        doc.write(`
            <html>
                <head>
                    <title>${fileName}</title>
                    <style>
                        @page { margin: 15mm; size: A4; }
                        body { font-family: 'Segoe UI', Arial, sans-serif; color: #111827; line-height: 1.4; font-size: 11pt; margin: 0; padding: 20px; }
                        
                        /* Table Wrapper for Repeated Header */
                        .main-layout-table { width: 100%; border-collapse: collapse; }
                        .main-layout-table thead { display: table-header-group; }
                        .main-layout-table tbody { display: table-row-group; }

                        /* Header */
                        .header-container { display: flex; justify-content: space-between; align-items: start; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #e5e7eb; }
                        .company-branding { display: flex; align-items: center; gap: 16px; }
                        .logo-img { height: 50px; width: auto; object-fit: contain; }
                        .company-details h2 { margin: 0 0 2px 0; font-size: 11pt; font-weight: bold; color: #16a34a; }
                        .company-details p { margin: 0; color: #6b7280; font-size: 9pt; }
                        .po-title { font-size: 15pt; font-weight: bold; color: #1e40af; letter-spacing: -0.025em; text-align: right; }
                        
                        /* Internal Header */
                        .internal-title { text-align: center; margin-bottom: 24px; }
                        .internal-title h1 { font-size: 16px; font-weight: bold; text-decoration: underline; text-transform: uppercase; margin: 0; }
                        .internal-title p { font-size: 11pt; font-weight: 600; margin: 4px 0 0 0; }

                        /* Info Grids */
                        .info-section { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 24px; }
                        .info-grid { display: grid; grid-template-columns: 80px 10px 1fr; gap: 2px; align-items: baseline; font-size: 11pt; }
                        .info-label { font-weight: 600; color: #374151; font-size: 11pt; }
                        .info-colon { text-align: center; color: #374151; font-size: 11pt; }
                        .info-value { color: #111827; font-weight: 500; font-size: 11pt; }
                        
                        .right-aligned .info-grid { display: block; text-align: right; }
                        .right-aligned .info-row { margin-bottom: 2px; }
                        .right-aligned .info-label { display: inline-block; font-weight: 600; color: #374151; }
                        .right-aligned .info-value { display: inline-block; color: #111827; font-weight: 500; margin-left: 4px; }

                        /* Items Table */
                        .items-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 10pt; }
                        .items-table th { background-color: #1e40af; color: #ffffff; font-weight: 600; padding: 6px; text-align: left; border: 1px solid #e5e7eb; font-size: 11pt; }
                        .items-table td { padding: 6px; border: 1px solid #e5e7eb; vertical-align: middle; color: #111827; }
                        .items-table th.col-center, .items-table td.col-center { text-align: center; }
                        .items-table th.col-right, .items-table td.col-right { text-align: right; }
                        
                        /* Totals */
                        .total-section { display: flex; justify-content: flex-end; margin-bottom: 24px; page-break-inside: avoid; }
                        .total-table { width: auto; min-width: 200px; font-size: 10pt; }
                        .total-row { display: flex; justify-content: space-between; margin-bottom: 2px; color: #111827; }
                        .total-label { text-align: right; padding-right: 12px; font-weight: 400; }
                        .total-value { text-align: right; font-weight: 500; white-space: nowrap; }
                        .grand-total { margin-top: 4px; padding-top: 4px; font-weight: bold; border-top: 1px solid #e5e7eb; }

                        /* Terms */
                        .terms-section { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e5e7eb; page-break-inside: avoid; }
                        .term-title { font-weight: bold; margin-bottom: 6px; font-size: 11pt; text-decoration: underline; text-transform: uppercase; color: #111827; }
                        .terms-grid { display: grid; grid-template-columns: 100px 10px 1fr; gap: 2px; max-width: 500px; font-size: 11pt; }

                        /* Footer & Signature */
                        .footer-disclaimer { margin-top: 16px; font-size: 9pt; color: #6b7280; font-style: italic; border-top: 1px dashed #e5e7eb; padding-top: 4px; page-break-inside: avoid; }
                        .signature-section { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 24px; page-break-inside: avoid; font-size: 11pt; }
                        .qr-code { width: 80px; height: 80px; }
                        .signature-block { min-width: 180px; }
                        .signature-spacer { height: 60px; }
                    </style>
                </head>
                <body>
                    <table class="main-layout-table">
                        <thead>
                            <tr>
                                <td>
                                    <div class="header-container">
                                        <div class="company-branding">
                                            ${company?.logo_path ? `<img src="${getStorageUrl(company.logo_path)}" class="logo-img" />` : ''}
                                            <div class="company-details">
                                                <h2>${company?.name || "Nama Perusahaan"}</h2>
                                                <p>${company?.address || ""}</p>
                                                <p>${company?.email || ""}</p>
                                            </div>
                                        </div>
                                        <div class="po-title">
                                            ${!internalNumberOverride ? "PURCHASE ORDER" : "INTERNAL LETTER"}
                                        </div>
                                    </div>
                                    ${internalNumberOverride ? `
                                        <div class="internal-title">
                                            <h1>PENGAJUAN RENCANA ANGGARAN BIAYA PROJEK</h1>
                                            <p>No Internal: ${internalNumberOverride}</p>
                                        </div>
                                    ` : ''}
                                </td>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>
                                    <div class="info-section">
                                        <div class="info-grid">
                                            ${internalNumberOverride ? `
                                                <span class="info-label">Customer</span><span class="info-colon">:</span><span class="info-value">${customer?.company_name || "-"}</span>
                                                <span class="info-label">Alamat</span><span class="info-colon">:</span><span class="info-value">${customer?.address || "-"}</span>
                                                <span class="info-label">PIC</span><span class="info-colon">:</span><span class="info-value">${po.quotations?.[0]?.request?.customer_pic?.name || "-"}</span>
                                            ` : `
                                                <span class="info-label">Vendor</span><span class="info-colon">:</span><span class="info-value">${po.vendor.company_name}</span>
                                                <span class="info-label">Alamat</span><span class="info-colon">:</span><span class="info-value">${po.vendor.office_address || po.vendor.address || "-"}</span>
                                                <span class="info-label">PIC</span><span class="info-colon">:</span><span class="info-value">${po.vendor_pic.name}</span>
                                            `}
                                        </div>
                                        <div class="right-aligned">
                                            <div class="info-grid">
                                                ${internalNumberOverride ? `
                                                    <div class="info-row"><span class="info-label">Tanggal</span> : <span class="info-value">
                                                        ${(() => {
                    const internalDate = po.quotations?.[0]?.po_ins?.[0]?.internal_letters?.[0]?.created_at;
                    return internalDate && isValid(new Date(internalDate)) ? formatDate(internalDate) : formatDate(po.created_at);
                })()}
                                                    </span></div>
                                                    <div class="info-row"><span class="info-label">Perihal</span> : <span class="info-value">${po.quotations?.[0]?.po_ins?.[0]?.subject || "-"}</span></div>
                                                ` : `
                                                    <div class="info-row"><span class="info-label">No PO</span> : <span class="info-value" style="font-family: monospace; font-weight: bold;">${po.po_number}</span></div>
                                                    <div class="info-row"><span class="info-label">Tanggal</span> : <span class="info-value">${formatDate(po.created_at)}</span></div>
                                                    <div class="info-row"><span class="info-label">Ref (Offer)</span> : <span class="info-value">${items.length > 0 && items[0].offering_letter_number ? items[0].offering_letter_number : (po.vendor_letter_number || "-")}</span></div>
                                                    <div class="info-row"><span class="info-label">Ref Date</span> : <span class="info-value">${items.length > 0 && items[0].offering_date ? formatDate(items[0].offering_date) : (po.vendor_letter_date ? formatDate(po.vendor_letter_date) : "-")}</span></div>
                                                `}
                                            </div>
                                        </div>
                                    </div>

                                    <table class="items-table">
                                        <thead>
                                            <tr>
                                                <th class="col-center" style="width: 1%; white-space: nowrap;">No</th>
                                                <th>Spesifikasi</th>
                                                <th class="col-center" style="width: 1%; white-space: nowrap;">Qty</th>
                                                <th class="col-right" style="width: 1%; white-space: nowrap;">Harga Beli</th>
                                                <th class="col-right" style="width: 1%; white-space: nowrap;">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${items.map((item, index) => `
                                                <tr>
                                                    <td class="col-center">${index + 1}</td>
                                                    <td style="vertical-align: middle;">
                                                        <div style="margin-bottom: 4px;">${item.customer_spec || "-"}</div>
                                                        ${item.vendor_spec ? `<div style="color: #6b7280; margin-top: 8px;">Offer to: ${item.vendor_spec}</div>` : ''}
                                                    </td>
                                                    <td class="col-center" style="white-space: nowrap;">${item.qty} ${item.unit}</td>
                                                    <td class="col-right" style="white-space: nowrap;">${formatCurrency(item.purchase_price || 0).replace("Rp ", "")}</td>
                                                    <td class="col-right" style="white-space: nowrap;">${formatCurrency((item.purchase_price || 0) * (item.qty || 0)).replace("Rp ", "")}</td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>

                                    <div class="total-section">
                                        <div class="total-table">
                                            <div class="total-row">
                                                <span class="total-label">Total:</span>
                                                <span class="total-value">${formatCurrency(totalPurchase).replace("Rp ", "")}</span>
                                            </div>
                                            <div class="total-row">
                                                <span class="total-label">Disc (${discount}%):</span>
                                                <span class="total-value" style="color: #dc2626;">- ${formatCurrency(discountAmount).replace("Rp ", "")}</span>
                                            </div>
                                            <div class="total-row">
                                                <span class="total-label">PPN (${ppn}%):</span>
                                                <span class="total-value">${formatCurrency(ppnAmount).replace("Rp ", "")}</span>
                                            </div>
                                            ${(isDP || isSettlement) && dpVal > 0 ? `
                                                 <div class="total-row" style="margin-top: 4px;">
                                                    <span class="total-label">Total Amount:</span>
                                                    <span class="total-value">${formatCurrency(grandTotal)}</span>
                                                </div>
                                            ` : ''}
                                             ${isSettlement && dpVal > 0 ? `
                                                 <div class="total-row">
                                                    <span class="total-label">Less DP:</span>
                                                    <span class="total-value" style="color: #dc2626;">- ${formatCurrency(dpVal).replace("Rp ", "")}</span>
                                                </div>
                                            ` : ''}
                                            <div class="total-row grand-total">
                                                <span class="total-label">${isDP ? "Total Payment (DP)" : (isSettlement ? "Total Due" : "Grand Total")}:</span>
                                                <span class="total-value">${formatCurrency(isDP ? dpVal : (isSettlement ? grandTotal - dpVal : grandTotal)).replace("Rp ", "")}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div class="terms-section">
                                        <div class="term-title">Terms & Conditions</div>
                                        <div class="terms-grid">
                                            ${internalNumberOverride ? `
                                                <span class="info-label">No PO In</span><span class="info-colon">:</span><span class="info-value">${po.quotations?.[0]?.po_ins?.[0]?.vendor_letter_number || "-"}</span>
                                                <span class="info-label">No PO Out</span><span class="info-colon">:</span><span class="info-value">${po.po_number || "-"}</span>
                                                <span class="info-label">Vendor</span><span class="info-colon">:</span><span class="info-value">${po.vendor?.company_name || "-"}</span>
                                                <span class="info-label">Bank</span><span class="info-colon">:</span><span class="info-value">${po.vendor?.bank_name || "-"}</span>
                                                <span class="info-label">No Rekening</span><span class="info-colon">:</span><span class="info-value">${po.vendor?.bank_account_number || "-"}</span>
                                                <span class="info-label">A/N</span><span class="info-colon">:</span><span class="info-value">${po.vendor?.bank_account_holder || "-"}</span>
                                                <span class="info-label">Franco</span><span class="info-colon">:</span><span class="info-value">${po.vendor?.office_address || po.vendor?.address || "-"}</span>
                                            ` : `
                                                <span class="info-label">Due Date</span><span class="info-colon">:</span><span class="info-value">${paymentTerm || "-"}</span>
                                                <span class="info-label">Shipping Address</span><span class="info-colon">:</span><span class="info-value">${deliveryTime || "-"}</span>
                                                <span class="info-label">Notes</span><span class="info-colon">:</span><span class="info-value" style="white-space: pre-wrap;">${notes || "-"}</span>
                                                <span class="info-label">Franco</span><span class="info-colon">:</span><span class="info-value">${franco || "-"}</span>
                                            `}
                                        </div>
                                    </div>

                                    <div class="footer-disclaimer">
                                        Dokumen ini dikeluarkan oleh Sistem Integrasi Data ${company?.name || 'PT. Morgan Powerindo Amerta'} dan dinyatakan Sah dan Otentik bila disertai QR Code dan tidak memerlukan tanda tangan basah. Silahkan melakukan verifikasi dengan scan QR Code
                                    </div>

                                    <div class="signature-section">
                                        <div class="qr-code">
                                            ${qrCodeUrl ? `<img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(qrCodeUrl)}" style="width: 100%; height: 100%; object-fit: contain;" />` : ''}
                                        </div>
                                        <div class="signature-block">
                                            <p style="color: #4b5563; margin-bottom: 4px;">Regards,</p>
                                            <p style="font-weight: bold; margin-bottom: 60px;">${company?.name || "Nama Perusahaan"}</p>
                                            <div style="border-bottom: 1px solid #000; display: inline-block; margin-bottom: 2px; font-weight: bold;">
                                                ${signer?.name || 'Authorized Signature'}
                                            </div>
                                            <div style="font-weight: bold; font-size: 11pt;">${signer?.position || ''}</div>
                                        </div>
                                    </div>

                                </td>
                            </tr>
                        </tbody>
                    </table>

                    ${(() => {
                // Combine and normalize attachments
                const attachmentList: any[] = [];

                // 1. From Balance Items
                items.forEach(item => {
                    if (item.document_path) {
                        const paths = item.document_path.split(',').filter(Boolean);
                        attachmentList.push({
                            type: 'ITEM',
                            name: item.customer_spec || item.vendor_spec || "Item",
                            paths: paths
                        });
                    }
                });

                // 2. From Request (DISABLED)
                // const reqAttachments = po.quotations?.[0]?.request?.attachments || [];
                // if (reqAttachments.length > 0) {
                //     reqAttachments.forEach((att: any) => {
                //         attachmentList.push({
                //             type: 'REQUEST',
                //             name: "Ref: Request Attachment",
                //             fileName: att.file_name,
                //             path: att.file_path
                //         });
                //     });
                // }

                if (attachmentList.length === 0) return '';

                return `
                            <div style="page-break-before: always;"></div>
                             <table class="main-layout-table">
                                <thead>
                                    <tr>
                                        <td>
                                            <div class="header-container">
                                                <div class="company-branding">
                                                    ${company?.logo_path ? `<img src="${getStorageUrl(company.logo_path)}" class="logo-img" />` : ''}
                                                    <div class="company-details">
                                                        <h2>${company?.name || "Nama Perusahaan"}</h2>
                                                        <p>${company?.address || ""}</p>
                                                        <p>${company?.email || ""}</p>
                                                    </div>
                                                </div>
                                                <div class="po-title">LAMPIRAN</div>
                                            </div>
                                        </td>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>
                                            <table class="items-table">
                                                <thead>
                                                    <tr>
                                                        <th class="col-center" style="width: 40px;">No</th>
                                                        <th>Lampiran</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    ${attachmentList.map((item, index) => {
                    return `
                                                            <tr>
                                                                <td class="col-center" style="vertical-align: top;">${index + 1}</td>
                                                                <td style="vertical-align: top;">
                                                                     ${item.type === 'ITEM' ?
                            `<div style="display: flex; gap: 8px; flex-wrap: wrap;">
                                                                            ${item.paths.map((path: string) => {
                                const url = getAttachmentUrl(path);
                                const isPdf = path.toLowerCase().endsWith('.pdf');
                                return `
                                                                                     <div style="border: 1px solid #e5e7eb; padding: 4px; border-radius: 4px; text-align: center;">
                                                                                         ${isPdf
                                        ? `<a href="${url}" target="_blank" style="color: #2563eb; text-decoration: underline; font-size: 10px;">View PDF</a>`
                                        : `<img src="${url}" style="max-width: 150px; max-height: 100px; object-fit: contain;" />`
                                    }
                                                                                     </div>
                                                                                `;
                            }).join('')}
                                                                        </div>`
                            :
                            `<div style="display: inline-block; border: 1px solid #e5e7eb; padding: 4px; border-radius: 4px;">
                                                                            ${item.path.toLowerCase().endsWith('.pdf')
                                ? `<a href="${getAttachmentUrl(item.path)}" target="_blank" style="color: #2563eb; text-decoration: underline; font-size: 10px;">View PDF (${item.fileName})</a>`
                                : `<img src="${getAttachmentUrl(item.path)}" style="max-width: 150px; max-height: 100px; object-fit: contain;" />`
                            }
                                                                        </div>`
                        }
                                                                </td>
                                                            </tr>
                                                        `;
                }).join('')}
                                                </tbody>
                                            </table>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        `;
            })()}
            ${(() => {
                if (!po.transfer_proof_url) return '';

                return `
                    <div style="page-break-before: always;"></div>
                    <table class="main-layout-table">
                        <thead>
                            <tr>
                                <td>
                                    <div class="header-container">
                                        <div class="company-branding">
                                            ${company?.logo_path ? `<img src="${getStorageUrl(company.logo_path)}" class="logo-img" />` : ''}
                                            <div class="company-details">
                                                <h2>${company?.name || "Nama Perusahaan"}</h2>
                                                <p>${company?.address || "Jl. Pendidikan No 8"}</p>
                                                <p>${company?.email || ""}</p>
                                            </div>
                                        </div>
                                        <div class="po-title">BUKTI TRANSFER</div>
                                    </div>
                                </td>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>
                                    <div style="margin-top: 20px; text-align: center; border: 1px solid #e5e7eb; padding: 20px; border-radius: 8px;">
                                        <img src="${po.transfer_proof_url}" style="max-width: 100%; height: auto; max-height: 800px; object-fit: contain;" />
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                `;
            })()}
                </body>
            </html>
        `);
        doc.close();

        // Swap Title for PDF Filename
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

    const handleSave = async () => {
        setIsSaving(true);
        const { error } = await (supabase as any)
            .from("purchase_orders")
            .update({
                discount,
                ppn,
                dp_percentage: dpPercentage,
                dp_amount: dpAmount,
                notes,
                franco,
                delivery_time: deliveryTime,
                payment_term: paymentTerm
            })
            .eq("id", po.id);

        if (error) {
            console.error("Error saving settings:", error);
            toast.error("Gagal menyimpan setting");
        } else {
            toast.success("Setting berhasil disimpan");
            if (onUpdate) onUpdate();
        }
        setIsSaving(false);
    };

    // QR Code generation
    const companyPhone = company?.phone?.replace(/\D/g, "") || "";
    const formattedCompanyPhone = companyPhone.startsWith("0") ? "62" + companyPhone.slice(1) : companyPhone;
    const whatsappMessage = `Hallo dari ${po.vendor.company_name} confirm PO: ${po.po_number}`;
    // Only generate QR Code if status is Approved
    const isApproved = po.status === 'approved';
    const qrCodeUrl = (isApproved && formattedCompanyPhone) ? `https://wa.me/${formattedCompanyPhone}?text=${encodeURIComponent(whatsappMessage)}` : "";

    return (
        <div className="flex flex-col h-full gap-4 overflow-hidden bg-white text-black font-sans leading-tight relative">

            {/* Print Action Bar */}
            <div className="flex justify-end gap-2 px-1 no-print shrink-0">
                <Button onClick={handlePrint} variant="outline" className="flex items-center gap-2">
                    <Printer className="h-4 w-4" />
                    Cetak PDF
                </Button>
                <Button onClick={handleSave} disabled={isSaving} className="flex items-center gap-2">
                    <Save className="h-4 w-4" />
                    {isSaving ? "Menyimpan..." : "Simpan"}
                </Button>
            </div>

            <div className="flex-1 overflow-y-auto bg-gray-50 p-4 rounded-lg border shadow-inner">
                <div className="print-content bg-white p-8 border rounded-lg shadow-sm w-full flex flex-col print:p-0 print:max-w-none print:border-none print:shadow-none print:rounded-none">
                    <table className="w-full">
                        <thead className="table-header-group">
                            <tr>
                                <td>
                                    {/* Header - Repeating */}
                                    <div className="flex justify-between items-start mb-8 border-b pb-6 pt-4">
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
                                            <h1 className="text-[15pt] font-bold text-blue-800 tracking-tight">
                                                {internalNumberOverride ? "INTERNAL LETTER" : "PURCHASE ORDER"}
                                            </h1>
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>
                                    {/* Main Content */}
                                    <div className="pb-8">


                                        {/* Info Section - CSS Grid for proper alignment */}
                                        <div className="grid grid-cols-2 gap-12 mb-8">
                                            <div className="space-y-1">
                                                {internalNumberOverride ? (
                                                    /* Internal Letter: Show CUSTOMER Info */
                                                    <div className="grid grid-cols-[100px_10px_1fr] items-baseline gap-1 text-sm">
                                                        <span className="font-semibold text-gray-700">Customer</span>
                                                        <span className="text-center">:</span>
                                                        <span className="text-gray-900 font-bold">{po.quotations?.[0]?.request?.customer?.company_name || "-"}</span>

                                                        <span className="font-semibold text-gray-700">Alamat</span>
                                                        <span className="text-center">:</span>
                                                        <span className="text-gray-900">{po.quotations?.[0]?.request?.customer?.address || "-"}</span>

                                                        <span className="font-semibold text-gray-700">PIC</span>
                                                        <span className="text-center">:</span>
                                                        <span className="text-gray-900">{po.quotations?.[0]?.request?.customer_pic?.name || "-"}</span>
                                                    </div>
                                                ) : (
                                                    /* Standard PO: Show VENDOR Info */
                                                    <div className="grid grid-cols-[100px_10px_1fr] items-baseline gap-1 text-[11pt]">
                                                        <span className="font-semibold text-gray-700">Vendor</span>
                                                        <span className="text-center">:</span>
                                                        <span className="text-gray-900 font-bold">{po.vendor.company_name}</span>

                                                        <span className="font-semibold text-gray-700">Alamat</span>
                                                        <span className="text-center">:</span>
                                                        <span className="text-gray-900">{po.vendor.office_address || po.vendor.address || "-"}</span>

                                                        <span className="font-semibold text-gray-700">PIC</span>
                                                        <span className="text-center">:</span>
                                                        <span className="text-gray-900">{po.vendor_pic.name}</span>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="space-y-1">
                                                {internalNumberOverride ? (
                                                    /* Internal Letter Right Info */
                                                    <div className="grid grid-cols-[1fr_10px_1fr] items-baseline gap-1 text-sm text-right">
                                                        <div className="col-span-3 grid grid-cols-[1fr_10px_1fr] items-baseline">
                                                            <span className="font-semibold text-gray-700 text-right">Tanggal</span>
                                                            <span className="text-center">:</span>
                                                            <span className="text-left text-gray-900">
                                                                {(() => {
                                                                    const internalDate = po.quotations?.[0]?.po_ins?.[0]?.internal_letters?.[0]?.created_at;
                                                                    return internalDate && isValid(new Date(internalDate))
                                                                        ? format(new Date(internalDate), "dd/MM/yyyy", { locale: id })
                                                                        : (isValid(new Date(po.created_at)) ? format(new Date(po.created_at), "dd/MM/yyyy", { locale: id }) : "-");
                                                                })()}
                                                            </span>

                                                            <span className="font-semibold text-gray-700 text-right">Perihal</span>
                                                            <span className="text-center">:</span>
                                                            <span className="text-left text-gray-900">{po.quotations?.[0]?.po_ins?.[0]?.subject || "-"}</span>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    /* Standard PO Right Info */
                                                    <div className="flex flex-col items-end gap-1 text-[11pt] text-right">
                                                        <div><span className="font-semibold text-gray-700">No PO</span> : <span className="text-gray-900 font-mono font-bold">{po.po_number}</span></div>
                                                        <div><span className="font-semibold text-gray-700">Tanggal</span> : <span className="text-gray-900">{isValid(new Date(po.created_at)) ? format(new Date(po.created_at), "dd/MM/yyyy", { locale: id }) : "-"}</span></div>
                                                        <div><span className="font-semibold text-gray-700">Ref (Offer)</span> : <span className="text-gray-900">{items.length > 0 && items[0].offering_letter_number ? items[0].offering_letter_number : (po.vendor_letter_number || "-")}</span></div>
                                                        <div><span className="font-semibold text-gray-700">Ref Date</span> : <span className="text-gray-900">{items.length > 0 && items[0].offering_date ? (isValid(new Date(items[0].offering_date)) ? format(new Date(items[0].offering_date), "dd/MM/yyyy", { locale: id }) : "-") : (po.vendor_letter_date && isValid(new Date(po.vendor_letter_date)) ? format(new Date(po.vendor_letter_date), "dd/MM/yyyy", { locale: id }) : "-")}</span></div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Items Table */}
                                        <table className="w-full border-collapse border border-gray-200 mb-8">
                                            <thead>
                                                <tr className="bg-blue-800 text-white">
                                                    <th className="border border-gray-200 p-3 text-center font-semibold text-[11pt] whitespace-nowrap w-[1%]">No</th>
                                                    <th className="border border-gray-200 p-3 text-left font-semibold text-[11pt]">Spesifikasi</th>
                                                    <th className="border border-gray-200 p-3 text-center font-semibold text-[11pt] whitespace-nowrap w-[1%]">Qty</th>
                                                    <th className="border border-gray-200 p-3 text-right font-semibold text-[11pt] whitespace-nowrap w-[1%]">Harga Beli</th>
                                                    <th className="border border-gray-200 p-3 text-right font-semibold text-[11pt] whitespace-nowrap w-[1%]">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {isLoading ? (
                                                    <tr>
                                                        <td colSpan={5} className="border border-gray-200 p-8 text-center text-gray-500">
                                                            Memuat item...
                                                        </td>
                                                    </tr>
                                                ) : items.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={5} className="border border-gray-200 p-8 text-center text-gray-500">
                                                            Tidak ada item ditemukan.
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    items.map((item, index) => (
                                                        <tr key={item.id}>
                                                            <td className="border border-gray-200 p-3 text-center text-sm">{index + 1}</td>
                                                            <td className="border border-gray-200 p-3 text-sm align-middle">
                                                                <div className="text-gray-900 mb-1">{item.customer_spec || "-"}</div>
                                                                {item.vendor_spec && (
                                                                    <div className="text-gray-500 mt-2">
                                                                        Offer to: {item.vendor_spec}
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="border border-gray-200 p-3 text-center text-sm whitespace-nowrap">{item.qty} {item.unit}</td>
                                                            <td className="border border-gray-200 p-3 text-right text-sm whitespace-nowrap">
                                                                {(item.purchase_price || 0).toLocaleString("id-ID")}
                                                            </td>
                                                            <td className="border border-gray-200 p-3 text-right text-sm font-medium whitespace-nowrap">
                                                                {((item.purchase_price || 0) * (item.qty || 0)).toLocaleString("id-ID")}
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                        <div className="flex justify-end mb-8">
                                            <div className="w-auto min-w-[250px] space-y-1 text-xs font-sans">
                                                <div className="flex justify-between text-gray-900">
                                                    <span className="text-right pr-4">Total:</span>
                                                    <span className="font-medium text-right">{totalPurchase.toLocaleString("id-ID")}</span>
                                                </div>

                                                <div className="flex justify-between text-gray-900 items-center">
                                                    <div className="flex items-center justify-end pr-4 text-right">
                                                        <span>Disc (</span>
                                                        <input
                                                            type="number"
                                                            value={discount}
                                                            onChange={e => setDiscount(Math.max(0, Number(e.target.value)))}
                                                            className="w-8 text-center bg-transparent border-none p-0 h-auto focus:ring-0 appearance-none no-arrows"
                                                        />
                                                        <span>%):</span>
                                                    </div>
                                                    <span className="text-right text-red-600">- {discountAmount.toLocaleString("id-ID")}</span>
                                                </div>

                                                <div className="flex justify-between text-gray-900 items-center">
                                                    <div className="flex items-center justify-end pr-4 text-right">
                                                        <span>PPN (</span>
                                                        <input
                                                            type="number"
                                                            value={ppn}
                                                            onChange={e => setPpn(Math.max(0, Number(e.target.value)))}
                                                            className="w-8 text-center bg-transparent border-none p-0 h-auto focus:ring-0 appearance-none"
                                                        />
                                                        <span>%):</span>
                                                    </div>
                                                    <span className="text-right">{ppnAmount.toLocaleString("id-ID")}</span>
                                                </div>

                                                {(isDP || isSettlement) && dpVal > 0 && (
                                                    <div className="flex justify-between text-gray-900 items-center pt-2">
                                                        <span className="text-right pr-4">Total Amount:</span>
                                                        <span className="text-right text-gray-500">{grandTotal.toLocaleString("id-ID")}</span>
                                                    </div>
                                                )}

                                                {(isSettlement) && dpVal > 0 && (
                                                    <div className="flex justify-between text-gray-900 items-center pb-2 border-b">
                                                        <span className="text-right pr-4 text-sm">Less DP:</span>
                                                        <span className="text-right text-sm text-red-600">- {dpVal.toLocaleString("id-ID")}</span>
                                                    </div>
                                                )}

                                                <div className="flex justify-between text-gray-900 font-bold text-sm pt-2">
                                                    <span className="text-right pr-4">{isDP ? "Total Payment (DP)" : (isSettlement ? "Total Due" : "Grand Total")}:</span>
                                                    <span className="text-right">{(isDP ? dpVal : (isSettlement ? grandTotal - dpVal : grandTotal)).toLocaleString("id-ID")}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {internalNumberOverride ? (
                                            /* Internal Letter Footer - Vertical Layout */
                                            <div className="mt-8 text-[11pt] font-sans text-gray-900">
                                                <h3 className="font-bold uppercase tracking-wider mb-4 border-b pb-2 inline-block">Terms & Conditions</h3>
                                                <div className="grid grid-cols-[150px_10px_1fr] gap-y-3 items-baseline">

                                                    <span className="font-semibold text-gray-700">No PO In</span>
                                                    <span className="text-center">:</span>
                                                    <span className="font-mono font-bold">
                                                        {po.quotations?.[0]?.po_ins?.[0]?.vendor_letter_number || "-"}
                                                    </span>

                                                    <span className="font-semibold text-gray-700">No PO Out</span>
                                                    <span className="text-center">:</span>
                                                    <span className="font-mono">{po.po_number || "-"}</span>

                                                    <span className="font-semibold text-gray-700">Vendor</span>
                                                    <span className="text-center">:</span>
                                                    <span className="font-bold">{po.vendor?.company_name || "-"}</span>

                                                    <span className="font-semibold text-gray-700">Bank</span>
                                                    <span className="text-center">:</span>
                                                    <span>{po.vendor?.bank_name || "-"}</span>

                                                    <span className="font-semibold text-gray-700">No Rekening</span>
                                                    <span className="text-center">:</span>
                                                    <span className="font-mono">{po.vendor?.bank_account_number || "-"}</span>

                                                    <span className="font-semibold text-gray-700">A/N</span>
                                                    <span className="text-center">:</span>
                                                    <span className="uppercase">{po.vendor?.bank_account_holder || "-"}</span>

                                                    <span className="font-semibold text-gray-700">Franco</span>
                                                    <span className="text-center">:</span>
                                                    <span>{po.vendor?.office_address || po.vendor?.address || "-"}</span>
                                                </div>
                                            </div>
                                        ) : (
                                            /* Standard PO Footer */
                                            <div className="mt-8 pt-4 border-t">
                                                <h3 className="font-bold text-gray-900 underline mb-2 text-xs uppercase">Term and Condition</h3>
                                                <div className="space-y-1 text-xs grid grid-cols-[120px_10px_1fr] gap-y-1 items-center">

                                                    <span className="font-semibold text-gray-600">Due date</span>
                                                    <span className="text-center">:</span>
                                                    <Input
                                                        value={paymentTerm}
                                                        onChange={(e) => setPaymentTerm(e.target.value)}
                                                        placeholder="-"
                                                        className="w-full p-0 border-none bg-transparent h-auto text-xs focus-visible:ring-0"
                                                    />

                                                    <span className="font-semibold text-gray-600">Shipping Address</span>
                                                    <span className="text-center">:</span>
                                                    <Input
                                                        value={deliveryTime}
                                                        onChange={(e) => setDeliveryTime(e.target.value)}
                                                        placeholder="-"
                                                        className="w-full p-0 border-none bg-transparent h-auto text-xs focus-visible:ring-0"
                                                    />

                                                    <span className="font-semibold text-gray-600 flex-shrink-0">Notes</span>
                                                    <span className="text-center">:</span>
                                                    <Textarea
                                                        value={notes}
                                                        onChange={(e) => setNotes(e.target.value)}
                                                        placeholder="-"
                                                        className="w-full p-0 border-none bg-transparent min-h-[1.5em] resize-none text-xs focus-visible:ring-0"
                                                    />

                                                    <span className="font-semibold text-gray-600">Franco</span>
                                                    <span className="text-center">:</span>
                                                    <Input
                                                        value={franco}
                                                        onChange={(e) => setFranco(e.target.value)}
                                                        className="w-full p-0 h-auto border-none bg-transparent text-xs focus-visible:ring-0"
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        <div className="mt-6 text-[9pt] text-gray-500 italic border-t border-dashed border-gray-200 pt-2">
                                            Dokumen ini dikeluarkan oleh Sistem Integrasi Data {company?.name || 'PT. Morgan Powerindo Amerta'} dan dinyatakan Sah dan Otentik bila disertai QR Code dan tidak memerlukan tanda tangan basah. Silahkan melakukan verifikasi dengan scan QR Code
                                        </div>

                                        <div className="flex justify-between mt-12 mb-8 text-[11pt]">
                                            <div className="qr-block flex items-end">
                                                {qrCodeUrl && <QRCode value={qrCodeUrl} size={100} />}
                                            </div>

                                            <div className="ml-auto text-left w-fit min-w-[200px] flex flex-col justify-end">
                                                <p className="text-gray-600 mb-2">Regards,</p>
                                                <p className="font-bold text-gray-900 inline-block pb-1 mb-20">
                                                    {company?.name || "Nama Perusahaan"}
                                                </p>
                                                <div className="flex flex-col">
                                                    <span className="font-bold underline text-[11pt] w-fit">{signer?.name || 'Authorized Signature'}</span>
                                                    <span className="font-bold text-[11pt]">{signer?.position || ''}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* ATTACHMENT SECTION (Visual Only - Print handled by handlePrint) */}
                {(items.some(i => i.document_path) || (po.quotations?.[0]?.request?.attachments?.length > 0)) && (
                    <div className="print-content bg-white p-8 border rounded-lg shadow-sm w-full flex flex-col print:hidden mt-4">
                        <div className="flex justify-between items-start mb-8 border-b pb-6 pt-4">
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
                                <h1 className="text-[15pt] font-bold text-blue-800 tracking-tight">LAMPIRAN</h1>
                            </div>
                        </div>

                        <table className="w-full border-collapse border border-gray-200 mb-8">
                            <thead>
                                <tr className="bg-blue-800 text-white">
                                    <th className="border border-gray-200 p-3 text-center w-12 font-semibold text-[11pt]">No</th>
                                    <th className="border border-gray-200 p-3 text-left font-semibold text-[11pt]">Lampiran</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(() => {
                                    // Combine and normalize for Display
                                    const attachmentList: any[] = [];
                                    items.forEach(item => {
                                        if (item.document_path) {
                                            const paths = item.document_path.split(',').filter(Boolean);
                                            attachmentList.push({
                                                type: 'ITEM',
                                                name: item.customer_spec || item.vendor_spec || "Item",
                                                paths: paths
                                            });
                                        }
                                    });

                                    // 2. Request Attachments (DISABLED)
                                    // const reqAttachments = po.quotations?.[0]?.request?.attachments || [];
                                    // reqAttachments.forEach((att: any) => {
                                    //     attachmentList.push({
                                    //         type: 'REQUEST',
                                    //         name: "Ref: Request Attachment",
                                    //         fileName: att.file_name,
                                    //         path: att.file_path
                                    //     });
                                    // });

                                    return attachmentList.map((item, index) => (
                                        <tr key={index}>
                                            <td className="border border-gray-200 p-3 text-center text-sm align-top">{index + 1}</td>
                                            <td className="border border-gray-200 p-3 align-top">
                                                {item.type === 'ITEM' ? (
                                                    <div className="flex flex-wrap gap-4">
                                                        {item.paths.map((path: string, i: number) => {
                                                            const url = getAttachmentUrl(path);
                                                            const isPdf = path.toLowerCase().endsWith('.pdf');
                                                            return (
                                                                <div key={i} className="border p-2 rounded flex flex-col items-center">
                                                                    {isPdf ? (
                                                                        <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline text-xs">
                                                                            View PDF
                                                                        </a>
                                                                    ) : (
                                                                        <img src={url} alt="Attachment" className="max-w-[150px] h-auto max-h-[100px] object-contain" />
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col items-center border p-2 rounded w-fit">
                                                        {item.path.toLowerCase().endsWith('.pdf') ? (
                                                            <a href={getAttachmentUrl(item.path)} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline text-xs">
                                                                View PDF ({item.fileName})
                                                            </a>
                                                        ) : (
                                                            <img src={getAttachmentUrl(item.path)} alt={item.name} className="max-w-[150px] h-auto max-h-[100px] object-contain" />
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ));
                                })()}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
