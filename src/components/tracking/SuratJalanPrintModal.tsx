
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Printer } from "lucide-react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import QRCode from "react-qr-code";

interface SuratJalanPrintModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    trackingItem: any; // The internal_letter object joined with po_in, quotation, etc.
}

export default function SuratJalanPrintModal({ open, onOpenChange, trackingItem }: SuratJalanPrintModalProps) {
    const [company, setCompany] = useState<any>(null);
    const [director, setDirector] = useState<any>(null);
    const [items, setItems] = useState<any[]>([]);
    const printRef = useRef<HTMLDivElement>(null);

    // Use persistent SJ Number if available, otherwise fallback (though migration should ensure it exists)
    const displaySjNumber = trackingItem?.sj_number || "SJ/PENDING";

    // Fetch data on open
    useEffect(() => {
        if (open && trackingItem) {
            fetchCompanyData();
            fetchItems();
        }
    }, [open, trackingItem]);

    const fetchCompanyData = async () => {
        const { data } = await supabase.from("company").select("*").maybeSingle();
        if (data) setCompany(data);

        const { data: members } = await supabase
            .from("team_members")
            .select("name, position")
            .or("position.ilike.%direktur%,position.ilike.%director%,position.ilike.%pimpinan%")
            .limit(1);

        if (members && members.length > 0) setDirector(members[0]);
    };

    const fetchItems = async () => {
        if (!trackingItem?.po_in?.quotation?.id) return;

        // Fetch balance items linked to this quotation
        // Similar logic to QuotationEditor
        const quotationId = trackingItem.po_in.quotation.id;

        // 1. Get Links
        const { data: qLinks } = await supabase
            .from("quotation_balances")
            .select("balance_id, entry_id")
            .eq("quotation_id", quotationId);

        let allItems: any[] = [];

        if (qLinks && qLinks.length > 0) {
            for (const link of qLinks) {
                const { data: bItems } = await supabase
                    .from("balance_items")
                    .select("*")
                    .eq("balance_id", link.balance_id)
                    .eq("balance_entry_id", link.entry_id);

                if (bItems) allItems = [...allItems, ...bItems];
            }
        }

        // Sort by ID (FIFO) to strictly match other views
        // Sort by Position then ID (FIFO)
        allItems.sort((a, b) => {
            const posA = a.position !== undefined ? a.position : 999999;
            const posB = b.position !== undefined ? b.position : 999999;
            if (posA !== posB) return posA - posB;
            return a.id.localeCompare(b.id);
        });

        setItems(allItems);
    };

    const getStorageUrl = (path: string) => {
        return `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/company-files/${path}`;
    };

    const handlePrint = () => {
        let iframe = document.getElementById('print-iframe-sj') as HTMLIFrameElement;
        if (!iframe) {
            iframe = document.createElement('iframe');
            iframe.id = 'print-iframe-sj';
            iframe.style.position = 'fixed';
            iframe.style.top = '-9999px';
            iframe.style.left = '-9999px';
            iframe.style.width = '0';
            iframe.style.height = '0';
            iframe.style.border = 'none';
            document.body.appendChild(iframe);
        }

        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!doc) return;

        const logoUrl = company?.logo_path ? getStorageUrl(company.logo_path) : "";

        // QR Code
        const qrData = `Surat Jalan: ${displaySjNumber}\nDate: ${format(new Date(), "dd/MM/yyyy")}\nRef PO: ${trackingItem?.po_in?.vendor_letter_number || '-'}`;
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(qrData)}`;

        const customerCode = trackingItem?.po_in?.quotation?.request?.customer?.customer_code || "CODE";
        const creatorName = trackingItem?.creator?.name || "User";
        // Format: CUSTOMER CODE_NO SJ_CREATE BY
        // Replace spaces with underscores for safer filename
        const safeCreatorName = creatorName.replace(/\s+/g, '_');
        const safeSjNumber = displaySjNumber.replace(/\//g, '-'); // Replace / with - for filename safety

        const filename = `${customerCode}_${displaySjNumber}_${safeCreatorName}`;

        // TEMPORARY: Change main document title to ensure PDF filename is correct
        const originalTitle = document.title;
        document.title = filename;

        // Restore title after 5 seconds (enough time for print dialog to pick it up)
        setTimeout(() => {
            document.title = originalTitle;
        }, 5000);

        doc.open();
        doc.write(`
            <html>
                <head>
                    <title>${filename}</title>
                    <style>
                        @page { margin: 15mm; size: A4; }
                        /* Body matching PO */
                        /* Body matching PO */
                        /* Body matching PO */
                        body { font-family: 'Segoe UI', Arial, sans-serif; color: #111827; line-height: 1.4; font-size: 12px; margin: 0; padding: 20px; }
                        
                        /* Header */
                        .header-container { display: flex; justify-content: space-between; align-items: start; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #e5e7eb; }
                        .company-branding { display: flex; align-items: center; gap: 16px; }
                        .logo-img { height: 50px; width: auto; object-fit: contain; }
                        .company-details h2 { margin: 0 0 2px 0; font-size: 11pt; font-weight: bold; color: #16a34a; }
                        .company-details p { margin: 0; color: #6b7280; font-size: 9pt; }
                        /* Title matching PO size */
                        .doc-title { font-size: 15pt; font-weight: bold; color: #1e40af; letter-spacing: -0.025em; text-transform: uppercase; }

                        /* Grid Info */
                        .info-section { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
                        .info-grid { display: grid; grid-template-columns: 80px 10px auto; gap: 2px; align-items: baseline; font-size: 11pt; }
                        .info-label { font-weight: 600; color: #374151; font-size: 11pt; }
                        .info-colon { text-align: center; color: #374151; font-size: 11pt; }
                        .info-value { color: #111827; font-size: 11pt; }

                        /* Table matching PO size */
                        .items-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 10pt; }
                        .items-table th { background-color: #1e40af; color: #ffffff; font-weight: 600; padding: 6px; text-align: left; border: 1px solid #e5e7eb; font-size: 11pt; }
                        .items-table td { padding: 6px; border: 1px solid #e5e7eb; vertical-align: middle; font-size: 10pt; color: #111827; }
                        .col-no { width: 40px; text-align: center; }
                        .col-center { text-align: center; }

                        /* Footer */
                        .footer { margin-top: 32px; display: flex; justify-content: space-between; align-items: flex-start; page-break-inside: avoid; font-size: 11pt; }
                        .sign-box { text-align: left; min-width: 200px; }
                        .sign-space { height: 60px; }
                        .sign-name { display: block; font-weight: 400; text-decoration: underline; color: #111827; }
                        .sign-role { font-weight: bold; font-size: 11pt; color: #111827; }
                        .qr-img { width: 80px; height: 80px; object-fit: contain; margin: 10px 0; display: block; }
                        .sign-gap { height: 5px; }

                        .disclaimer { margin-top: 16px; font-size: 9pt; color: #6b7280; font-style: italic; border-top: 1px dashed #e5e7eb; padding-top: 4px; text-align: left; }
                    </style>
                    <script>
                        function triggerPrint() {
                            setTimeout(function() { window.print(); }, 500);
                        }
                    </script>
                    </style>
                </head>
                <body>
                    <div class="header-container">
                        <div class="company-branding">
                             ${logoUrl ? `<img src="${logoUrl}" class="logo-img" />` : ''}
                             <div class="company-details">
                                <h2>${company?.name || 'PT. Morgan Powerindo Amerta'}</h2>
                                <p>${company?.address || '-'}</p>
                                <p>${company?.email || '-'}</p>
                             </div>
                        </div>
                        <div class="doc-title">SURAT JALAN</div>
                    </div>

                    <div class="info-section">
                        <div class="client-side">
                            <div class="info-grid">
                                <span class="info-label">Customer</span><span class="info-colon">:</span><span class="info-value">${trackingItem?.po_in?.quotation?.request?.customer?.company_name || '-'}</span>
                                <span class="info-label">Address</span><span class="info-colon">:</span><span class="info-value">${trackingItem?.po_in?.quotation?.request?.customer?.delivery_address || trackingItem?.po_in?.quotation?.request?.customer?.office_address || '-'}</span>
                            </div>
                        </div>
                        <div class="meta-side">
                             <div class="info-grid">
                                 <span class="info-label text-right" style="text-align: right;">No</span><span class="info-colon">:</span><span class="info-value">${displaySjNumber}</span>
                                <span class="info-label text-right" style="text-align: right;">Date</span><span class="info-colon">:</span><span class="info-value">${format(new Date(), "dd/MM/yyyy")}</span>
                                <span class="info-label text-right" style="text-align: right;">Ref</span><span class="info-colon">:</span><span class="info-value">${trackingItem?.po_in?.vendor_letter_number || '-'}</span>
                                <span class="info-label text-right" style="text-align: right;">Ref Date</span><span class="info-colon">:</span><span class="info-value">${trackingItem?.po_in?.vendor_letter_date ? format(new Date(trackingItem.po_in.vendor_letter_date), "dd/MM/yyyy") : '-'}</span>
                             </div>
                        </div>
                    </div>

                    <p style="margin-top: 32px; margin-bottom: 8px; font-size: 11pt; color: #374151;">Kami kirimkan barang-barang dibawah ini :</p>

                    <table class="items-table">
                        <thead>
                            <tr>
                                <th class="col-no">No</th>
                                <th>Spesifikasi</th>
                                <th class="col-center" style="width: 80px;">Qty</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${items.length > 0 ? items
                .map((item, i) => `
                                <tr>
                                    <td class="col-no">${i + 1}</td>
                                    <td>
                                        <div style="margin-bottom: 4px;">${item.customer_spec || '-'}</div>
                                        ${item.vendor_spec ? `<div style="color: #6b7280; margin-top: 4px;">Offer to: ${item.vendor_spec}</div>` : ''}
                                    </td>
                                    <td class="col-center">${item.qty} ${item.unit}</td>
                                </tr>
                            `).join('') : '<tr><td colspan="3" style="text-align:center; padding: 20px;">Tidak ada item</td></tr>'}
                        </tbody>
                    </table>

                    <div class="disclaimer">
                        Dokumen ini dikeluarkan oleh Sistem Integrasi Data ${company?.name || 'Perusahaan'} dan dinyatakan Sah dan Otentik bila disertai QR Code dan tidak memerlukan tanda tangan basah. Silahkan melakukan verifikasi dengan scan QR Code
                    </div>

                    <div class="footer">
                        <div class="sign-box" style="text-align: left; min-width: 200px;">
                            <p style="margin-bottom: 4px; color: #4b5563;">Diterima,</p>
                            <p style="margin-bottom: 4px; color: #4b5563;">Tanggal : ____________________.</p>
                            <span class="sign-name" style="text-align: center; font-weight: bold; text-decoration: none;">${trackingItem?.po_in?.quotation?.request?.customer?.company_name || 'Customer'}</span>
                            <div class="sign-gap" style="height: 60px;"></div>
                            <span style="display: block; text-align: center;">(______________________)</span>
                        </div>
                        <div class="sign-box">
                            <p style="margin-bottom: 8px; color: #4b5563;">Hormat kami,</p>
                            <p style="font-weight: bold; color: #111827;">${company?.name || 'Perusahaan'}</p>
                            <div class="sign-gap"></div>
                            <img src="${qrUrl}" class="qr-img" onload="triggerPrint()" onerror="triggerPrint()" />
                            <span class="sign-name">${director?.name || 'Pimpinan'}</span>
                            <span class="sign-role">${director?.position || 'Jabatan'}</span>
                        </div>
                    </div>
                </body>
            </html>
        `);
        doc.close();

        // setTimeout removed in favor of onload/onerror handlers
        // setTimeout(() => {
        //     if (iframe.contentWindow) {
        //         iframe.contentWindow.focus();
        //         iframe.contentWindow.print();
        //     }
        // }, 500);
    };

    // ... Inside return ...
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl max-h-[95vh] flex flex-col p-0 gap-0">
                <DialogHeader className="p-6 pb-2 shrink-0">
                    <DialogTitle>Cetak Surat Jalan</DialogTitle>
                </DialogHeader>

                <div className="flex flex-col flex-1 overflow-hidden p-6 pt-2 gap-4">
                    <div className="flex justify-end gap-2 shrink-0">
                        <Button onClick={handlePrint}>
                            <Printer className="w-4 h-4 mr-2" />
                            Cetak / Print
                        </Button>
                    </div>

                    <div className="flex-1 overflow-y-auto bg-gray-100 p-8 rounded-lg border shadow-inner">
                        <div className="bg-white p-8 border rounded-lg shadow-sm min-h-[297mm] mx-auto w-full max-w-none">
                            {/* PREVIEW ONLY - Simplified logic for preview matching Print Logic */}
                            <div className="flex justify-between items-start mb-8 border-b pb-6">
                                <div className="flex items-center gap-6">
                                    {company?.logo_path && <img src={getStorageUrl(company.logo_path)} className="h-[60px] w-auto object-contain" />}
                                    <div>
                                        <h2 className="font-bold text-[11pt] text-green-600">{company?.name || "Nama Perusahaan"}</h2>
                                        <p className="text-[9pt] text-gray-500">{company?.address}</p>
                                        <p className="text-[9pt] text-gray-500">{company?.email}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <h1 className="text-[15pt] font-bold text-blue-800 tracking-tight">SURAT JALAN</h1>
                                </div>
                            </div>

                            <div className="flex justify-between items-start mb-8 gap-12 text-[11pt]">
                                <div className="space-y-1">
                                    <div className="grid grid-cols-[100px_10px_1fr] items-baseline">
                                        <span className="font-semibold text-gray-700">Customer</span>
                                        <span className="text-gray-700 text-center">:</span>
                                        <span className="text-gray-900">{trackingItem?.po_in?.quotation?.request?.customer?.company_name}</span>
                                    </div>
                                    <div className="grid grid-cols-[100px_10px_1fr] items-baseline">
                                        <span className="font-semibold text-gray-700">Address</span>
                                        <span className="text-gray-700 text-center">:</span>
                                        <span className="text-gray-900">{trackingItem?.po_in?.quotation?.request?.customer?.delivery_address || trackingItem?.po_in?.quotation?.request?.customer?.office_address || '-'}</span>
                                    </div>
                                </div>
                                <div className="space-y-1 w-full max-w-[400px]">
                                    <div className="grid grid-cols-[100px_10px_1fr] gap-x-2 items-baseline">
                                        <span className="font-semibold text-gray-700 text-right">No</span>
                                        <span className="text-gray-700 text-center">:</span>
                                        <span className="font-mono text-gray-900">{displaySjNumber}</span>
                                    </div>
                                    <div className="grid grid-cols-[100px_10px_1fr] gap-x-2 items-baseline">
                                        <span className="font-semibold text-gray-700 text-right">Date</span>
                                        <span className="text-gray-700 text-center">:</span>
                                        <span className="text-gray-900">{format(new Date(), "dd/MM/yyyy")}</span>
                                    </div>
                                    <div className="grid grid-cols-[100px_10px_1fr] gap-x-2 items-baseline">
                                        <span className="font-semibold text-gray-700 text-right">Ref</span>
                                        <span className="text-gray-700 text-center">:</span>
                                        <span className="text-gray-900">{trackingItem?.po_in?.vendor_letter_number}</span>
                                    </div>
                                    <div className="grid grid-cols-[100px_10px_1fr] gap-x-2 items-baseline">
                                        <span className="font-semibold text-gray-700 text-right">Ref Date</span>
                                        <span className="text-gray-700 text-center">:</span>
                                        <span className="text-gray-900">{trackingItem?.po_in?.vendor_letter_date ? format(new Date(trackingItem.po_in.vendor_letter_date), "dd/MM/yyyy") : '-'}</span>
                                    </div>
                                </div>
                            </div>

                            <p className="mt-12 mb-4 text-gray-700 text-[11pt]">Kami kirimkan barang-barang dibawah ini :</p>

                            <table className="w-full border-collapse border border-gray-200 mb-8">
                                <thead>
                                    <tr className="bg-blue-800 text-white">
                                        <th className="border border-gray-200 p-3 text-left w-12 font-semibold text-[11pt]">No</th>
                                        <th className="border border-gray-200 p-3 text-left font-semibold text-[11pt]">Spesifikasi</th>
                                        <th className="border border-gray-200 p-3 text-center w-24 font-semibold text-[11pt]">Qty</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.length === 0 ? (
                                        <tr>
                                            <td colSpan={3} className="border border-gray-200 p-8 text-center text-gray-500">
                                                Tidak ada item.
                                            </td>
                                        </tr>
                                    ) : (
                                        items
                                            .map((item, index) => (
                                                <tr key={index}>
                                                    <td className="border border-gray-200 p-3 text-center text-[10pt]">{index + 1}</td>
                                                    <td className="border border-gray-200 p-3 text-[10pt]">
                                                        <div className="text-gray-900">{item.customer_spec || "-"}</div>
                                                        {item.vendor_spec && (
                                                            <div className="text-xs text-gray-500 mt-4">
                                                                Offer to: {item.vendor_spec}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="border border-gray-200 p-3 text-center text-[10pt]">{item.qty} {item.unit}</td>
                                                </tr>
                                            ))
                                    )}
                                </tbody>
                            </table>

                            <div className="mt-8 pt-4 text-[9pt] text-gray-500 italic text-left border-t border-dashed border-gray-200">
                                Dokumen ini dikeluarkan oleh Sistem Integrasi Data {company?.name || 'Perusahaan'} dan dinyatakan Sah dan Otentik bila disertai QR Code dan tidak memerlukan tanda tangan basah. Silahkan melakukan verifikasi dengan scan QR Code
                            </div>

                            <div className="flex justify-between mt-12 text-[11pt]">
                                <div className="text-left min-w-[200px] flex flex-col justify-between">
                                    <div>
                                        <p className="mb-1 text-gray-600">Diterima,</p>
                                        <p className="mb-1 text-gray-600">Tanggal : ____________________.</p>
                                        <span className="block font-bold text-left text-gray-900 w-full">
                                            {trackingItem?.po_in?.quotation?.request?.customer?.company_name || 'Customer'}
                                        </span>
                                    </div>
                                    <span className="block text-left text-gray-900">(______________________)</span>
                                </div>
                                <div className="text-left">
                                    <p className="mb-2 text-gray-600">Hormat kami,</p>
                                    <p className="font-bold text-gray-900">{company?.name || 'Perusahaan'}</p>
                                    <div className="h-6"></div>
                                    <div className="flex mb-2">
                                        <div className="w-20 h-20 flex items-center justify-center">
                                            <QRCode
                                                value={`Surat Jalan: ${displaySjNumber}\nDate: ${format(new Date(), "dd/MM/yyyy")}\nRef PO: ${trackingItem?.po_in?.vendor_letter_number || '-'}`}
                                                size={80}
                                                style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                                                viewBox={`0 0 256 256`}
                                            />
                                        </div>
                                    </div>
                                    <span className="block font-normal underline text-gray-900 text-base">{director?.name || 'Authorized Signature'}</span>
                                    <span className="text-[11pt] font-bold text-gray-900">{director?.position || ''}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog >
    );
}
