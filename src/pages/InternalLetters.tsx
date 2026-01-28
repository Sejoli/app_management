import { useState, useEffect, Fragment } from "react";
import { useNavigate } from "react-router-dom";
import { usePermission } from "@/hooks/usePermission";
import { supabase } from "@/integrations/supabase/client";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "../components/ui/table";
import { Button } from "@/components/ui/button";
import { format, isValid } from "date-fns";
import { id } from "date-fns/locale";
import { Trash2, Link as LinkIcon, Edit, Printer, Eye, Plus, Check } from "lucide-react";
import { DeleteConfirmationDialog } from "@/components/DeleteConfirmationDialog";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import PurchaseOrderPrint from "@/components/purchase-order/PurchaseOrderPrint";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { CompletedStamp } from "@/components/ui/CompletedStamp";

import { Truck, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

// --- Types ---
// --- Updated Interface ---
interface InternalLetter {
    id: string;
    internal_letter_number: string;
    status: 'pending' | 'approved'; // Added
    approved_at?: string; // Added
    approved_by?: string; // Added
    po_in: {
        id: string;
        subject: string | null;
        invoice_type: string | null;
        vendor_letter_number: string | null;
        vendor_letter_date: string | null;
        attachments: any[];
        quotation: {
            id: string;
            quotation_number: string;
            created_at: string;
            request: {
                request_code: string;
                title: string;
                letter_number: string;
                created_at: string;
                customer: { company_name: string };
                customer_pic: { name: string };
                customer_attachments: any[];
            };
            balance_link: {
                balance: {
                    created_at: string;
                    balance_entries: any[];
                }
            }[];
        };
    };
    creator?: { name: string; user_id?: string };
    created_by?: string;
}

const InternalLetters = () => {
    const { canManage, userId, userRole, loading: permLoading } = usePermission("purchase_orders"); // Reuse permission
    const [letters, setLetters] = useState<InternalLetter[]>([]);
    // ... (rest of state items are same, no change needed)
    const [trackedIds, setTrackedIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [isError, setIsError] = useState(false);


    // Pagination & Search State
    const [searchQuery, setSearchQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);


    // Detail Modal State
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [selectedLetterPos, setSelectedLetterPos] = useState<any[]>([]);

    // Tracking State
    const [selectedTrackingId, setSelectedTrackingId] = useState<string | null>(null);
    const [selectedTrackingLetter, setSelectedTrackingLetter] = useState<any | null>(null);
    const navigate = useNavigate();

    // Print State
    const [isPrintOpen, setIsPrintOpen] = useState(false);
    const [printPO, setPrintPO] = useState<any>(null);
    const [tempInternalNumber, setTempInternalNumber] = useState("");
    const [currentInvoiceSubject, setCurrentInvoiceSubject] = useState("");
    const [currentInvoiceType, setCurrentInvoiceType] = useState("");
    const [currentQuotationId, setCurrentQuotationId] = useState("");
    const [expandedVendorIds, setExpandedVendorIds] = useState<Set<string>>(new Set());

    const toggleVendorExpand = (poId: string) => {
        const newSet = new Set(expandedVendorIds);
        if (newSet.has(poId)) newSet.delete(poId);
        else newSet.add(poId);
        setExpandedVendorIds(newSet);
    };

    const handleStatusToggle = async (letterId: string, currentStatus: string) => {
        if (!canManage) return;

        const newStatus = currentStatus === 'approved' ? 'pending' : 'approved';
        const toastId = toast.loading("Memperbarui status...");

        try {
            const updatePayload: any = {
                status: newStatus
            };

            if (newStatus === 'approved') {
                updatePayload.approved_at = new Date().toISOString();
                updatePayload.approved_by = userId;
            } else {
                updatePayload.approved_at = null;
                updatePayload.approved_by = null;
            }

            const { error } = await supabase
                .from("internal_letters")
                .update(updatePayload)
                .eq("id", letterId);

            if (error) throw error;

            toast.success(`Status surat diperbarui menjadi ${newStatus === 'approved' ? 'Disetujui' : 'Pending'}`, { id: toastId });
            fetchLetters();
        } catch (e) {
            console.error(e);
            toast.error("Gagal memperbarui status", { id: toastId });
        }
    };


    const handleViewDetail = async (quotationId: string, subject?: string, invoiceType?: string) => {
        setCurrentInvoiceSubject(subject || "");
        setCurrentInvoiceType(invoiceType || "");
        setCurrentQuotationId(quotationId);
        setExpandedVendorIds(new Set()); // Reset toggle state
        const { data, error } = await (supabase as any)
            .from("purchase_order_quotations")
            .select(`
                purchase_orders(
                id,
                po_number,
                vendor_id,
                created_by,
                created_at,
                subject,
                vendor_letter_number,
                vendor_letter_date,
                discount,
                ppn,
                dp_amount,
                dp_percentage,
                payment_terms,
                remaining_payment,
                notes,
                franco,
                delivery_time,
                payment_term,
                transfer_proof_url,
                transfer_proof_date,
                vendor: vendors(company_name, office_address, bank_name, bank_account_number, bank_account_holder),
                vendor_pic: vendor_pics(name),
                attachments: purchase_order_attachments(file_name, file_path),
                quotations: purchase_order_quotations(
                    quotation: quotations(
                        id,
                        quotation_number,
                        created_at,
                        franco,
                        po_ins(vendor_letter_number, subject, invoice_type, internal_letters(created_at)),
                        balance_link: quotation_balances(
                            id,
                            balance_id,
                            entry_id,
                            balance: balances(
                                id,
                                balance_entries
                            )
                        ),
                        request: requests(
                            request_code,
                            letter_number,
                            customer: customers(company_name, address: office_address),
                            customer_pic: customer_pics(name),
                            request_date: created_at
                        )
                    )
                )
            )
                    `)
            .eq("quotation_id", quotationId);

        if (error) {
            console.error(error);
            toast.error("Gagal memuat detail PO");
            return;
        }

        // Fetch Linked Balances to get Settings
        const { data: qLinks } = await (supabase as any)
            .from("quotation_balances")
            .select("balance_id")
            .eq("quotation_id", quotationId);

        const balanceIds = qLinks?.map((l: any) => l.balance_id) || [];

        // Fetch Live Vendor Settings using Balance IDs
        const { data: vendorSettings } = await (supabase as any)
            .from("balance_vendor_settings")
            .select("*")
            .in("balance_id", balanceIds);

        // Flatten logic similar to PurchaseOrders group
        const pos = data?.map((d: any) => {
            // SAFE CLONE to ensure we can mutate properties
            const po = { ...d.purchase_orders };

            // Apply Live Settings if available
            // Note: If multiple balances have settings for same vendor, take the first one found
            const settings = vendorSettings?.find((s: any) => s.vendor_id === po.vendor_id);

            console.log(`[LetterDebug] Processing PO ${po.po_number}(${po.vendor?.company_name})`, {
                vendorId: po.vendor_id,
                foundSettings: settings,
                originalDP: po.dp_percentage
            });

            if (settings) {
                // Override PO values with latest settings
                po.discount = settings.discount ?? po.discount;
                po.dp_percentage = settings.dp_percentage ?? po.dp_percentage;
                po.dp_amount = settings.dp_amount ?? po.dp_amount;
                po.payment_terms = settings.payment_terms ?? po.payment_terms;
            } else {
                // Should we reset if NOT found? 
                // YES, to fix "Ghost DP" issue if the PO has stale data but the vendor has no settings.
                console.log(`[LetterDebug] No settings for ${po.vendor?.company_name} - CLEANING UP`);
                po.discount = 0;
                po.dp_percentage = 0;
                po.dp_amount = 0;
                // po.payment_terms = null; // Keep payment terms as they might be manually set? Safest to reset DP/Discount only.
            }

            // Map nested quotations structure for Print Component
            const mappedQuotations = po.quotations?.map((pq: any) => ({
                ...pq.quotation,
                // Ensure request date maps correctly
                request: {
                    ...pq.quotation.request,
                    request_date: pq.quotation.request.created_at
                }
            }));

            return {
                ...po,
                quotations: mappedQuotations
            };
        }) || [];

        // Filter only OUT POs if needed? Usually PO linked to Quotation IS OUT.

        setSelectedLetterPos(pos);
        setIsDetailOpen(true);
    };



    const handleUploadProof = async (poId: string, event: React.ChangeEvent<HTMLInputElement>) => {
        try {
            const file = event.target.files?.[0];
            if (!file) return;

            const fileExt = file.name.split('.').pop();
            const fileName = `transfer - proof - ${poId} -${Math.random()}.${fileExt} `;
            const filePath = `${fileName} `;
            const toastId = toast.loading("Sedang mengupload bukti...");

            const { error: uploadError } = await supabase.storage
                .from('purchase-order-attachments')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: publicUrlData } = supabase.storage
                .from('purchase-order-attachments')
                .getPublicUrl(filePath);

            const { error: updateError } = await supabase
                .from("purchase_orders")
                .update({
                    transfer_proof_url: publicUrlData.publicUrl,
                    transfer_proof_date: new Date().toISOString()
                })
                .eq("id", poId);

            if (updateError) throw updateError;

            toast.success("Bukti transfer berhasil diupload", { id: toastId });

            // Refresh the detail view
            if (currentQuotationId) {
                handleViewDetail(currentQuotationId, currentInvoiceSubject, currentInvoiceType);
            }

        } catch (error: any) {
            console.error(error);
            toast.error("Gagal upload bukti: " + error.message);
        }
    };

    const handlePrint = (po: any, internalNo: string, invoiceType: string) => {
        setTempInternalNumber(internalNo);
        setCurrentInvoiceType(invoiceType);
        setPrintPO(po);
        setIsPrintOpen(true);
    };

    const getStorageUrl = (path: string, bucket: string) => {
        return `${import.meta.env.VITE_SUPABASE_URL} /storage/v1 / object / public / ${bucket}/${path}`;
    };

    const fetchLetters = async () => {
        setLoading(true);
        setIsError(false);

        let query = supabase
            .from("internal_letters")
            .select(`
                *,
                po_in:po_ins (
                    id,
                    status,
                    is_completed,
                    subject,
                    invoice_type,
                    vendor_letter_number,
                    vendor_letter_date,
                    attachments:po_in_attachments(file_name, file_path),
                    quotation:quotations (
                         id,
                         quotation_number,
                         created_at,
                         request:requests (
                             request_code,
                             title,
                             letter_number,
                             created_at,
                             customer:customers (company_name, customer_code),
                             customer_pic:customer_pics (name),
                             customer_attachments:request_attachments(file_name, file_path)
                         ),
                         balance_link:quotation_balances(
                            entry_id,
                            balance:balances(
                                created_at,
                                balance_entries
                            )
                         )
                    )
                ),
                creator:team_members!fk_created_by_team_member(name, user_id)
            `);

        // Apply RBAC: If not super_admin or pimpinan, filter by own letters
        if (userRole !== "super_admin" && userRole !== "pimpinan" && userId) {
            query = query.eq("created_by", userId);
        }

        try {
            const [lettersResponse, trackingResponse] = await Promise.all([
                query.order("internal_letter_number", { ascending: false }),
                supabase.from("tracking_activities").select("internal_letter_id")
            ]);

            if (lettersResponse.error) throw lettersResponse.error;

            setLetters(lettersResponse.data as any || []);

            if (trackingResponse.data) {
                const ids = new Set(trackingResponse.data.map((item: any) => item.internal_letter_id));
                setTrackedIds(ids);
            }
        } catch (error) {
            console.error(error);
            toast.error("Gagal mengambil data surat internal");
            setIsError(true);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (permLoading) return;
        fetchLetters();
    }, [userId, userRole, permLoading]);

    const handleDelete = async (id: string) => {
        const { error } = await supabase.from("internal_letters").delete().eq("id", id);
        if (error) {
            toast.error("Gagal menghapus");
        } else {
            toast.success("Berhasil dihapus");
            fetchLetters();
        }
    };



    // Helper for Balance Code
    const getBalanceCode = (poIn: any) => {
        const quotation = poIn.quotation;
        const balanceLink = quotation?.balance_link || [];

        // Use same logic as PO In table: show specific entry if entry_id exists
        // Since we are fetching deep, let's just collect all codes for simplicity or refine if needed.
        // For PO In table we had specific filtering. Here we might just show all connected codes?
        // Or re-implement the specific entry logic if we knew WHICH entry was "selected" (but Internal Letter is 1-to-1 with PO In, so it inherits same context).
        // Since PO In row doesn't store 'entry_id' directly (it's derived logically), we might just show consolidated codes.

        const codes = balanceLink.map((l: any) => {
            if (l.entry_id && l.balance?.balance_entries) {
                // Parse if string? types says Json.
                const entries = Array.isArray(l.balance.balance_entries) ? l.balance.balance_entries : [];
                const entry = entries.find((e: any) => e.id === l.entry_id);
                return entry ? entry.code : null;
            }
            // If balance_entries is not array, handle gracefully
            const entries = Array.isArray(l.balance?.balance_entries) ? l.balance.balance_entries : [];
            return entries.map((e: any) => e.code);
        }).flat().filter(Boolean);

        const unique = Array.from(new Set(codes));
        return unique.length > 0 ? unique.join(", ") : "-";
    };

    const groupLetters = (letters: InternalLetter[]) => {
        const groups: { [key: string]: InternalLetter[] } = {};
        letters.forEach((l) => {
            // Group by Request ID (accessed deeply)
            const reqId = l.po_in?.quotation?.request?.request_code || "unknown";
            // Using request_code as key effectively groups by Request/Customer
            if (!groups[reqId]) {
                groups[reqId] = [];
            }
            groups[reqId].push(l);
        });
        return Object.values(groups);
    };

    // Enhance search logic
    const filteredLetters = letters.filter((l) => {
        const query = searchQuery.toLowerCase();
        const letterNumber = l.internal_letter_number?.toLowerCase() || "";
        const customer = l.po_in?.quotation?.request?.customer?.company_name?.toLowerCase() || "";
        const subject = l.po_in?.subject?.toLowerCase() || "";

        const matchesSearch = (
            letterNumber.includes(query) ||
            customer.includes(query) ||
            subject.includes(query)
        );

        if (!matchesSearch) return false;

        // Pimpinan Visibility Check: Removed to show all data
        // Logic changed to only hide interaction checkboxes instead (handled in render)

        return true;
    });

    const groupedLetters = groupLetters(filteredLetters);
    const totalPages = Math.ceil(groupedLetters.length / itemsPerPage);
    const paginatedLetters = groupedLetters.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, itemsPerPage]);

    // Calculate global index for "No" column
    // let globalIndex = 0; // Removed, calculated dynamically in loop

    const handleAddManualInvoice = async (quotationId: string) => {
        const toastId = toast.loading("Sedang membuat invoice baru...");
        try {
            // Check for existing invoice for this quotation to prevent duplication
            const { count } = await supabase
                .from("po_ins")
                .select("id", { count: 'exact', head: true })
                .eq("quotation_id", quotationId)
                .eq("invoice_type", "PELUNASAN");

            if (count && count > 0) {
                toast.error("Faktur pelunasan sudah ada", { id: toastId });
                return;
            }

            // Fetch Quotation with Customer for Snapshot
            const { data: quoteData } = await supabase
                .from("quotations")
                .select(`
                    *,
                    request:requests (
                        customer:customers(*)
                    )
                `)
                .eq("id", quotationId)
                .single();

            let snapshotData = null;
            if (quoteData?.request?.customer) {
                snapshotData = {
                    customer: quoteData.request.customer
                }
            }

            const { error } = await (supabase as any).from("po_ins").insert({
                quotation_id: quotationId,
                subject: "-",
                invoice_type: "PELUNASAN",
                vendor_letter_number: null,
                vendor_letter_date: null,
                snapshot_data: snapshotData
            });

            if (error) throw error;

            toast.success("Faktur pelunasan berhasil dibuat", { id: toastId });
            fetchLetters();
            setIsDetailOpen(false);
        } catch (e) {
            console.error(e);
            toast.error("Gagal membuat faktur", { id: toastId });
        }
    }

    const handleAddToTracking = async () => {
        if (!selectedTrackingId) return;

        // Check if already tracked (just in case)
        if (trackedIds.has(selectedTrackingId)) {
            navigate("/tracking");
            return;
        }

        // Create initial tracking activity
        const toastId = toast.loading("Menambahkan ke tracking...");
        try {
            const { error } = await supabase
                .from("tracking_activities")
                .insert({
                    internal_letter_id: selectedTrackingId,
                    status: "Inisiasi",
                    title: "Inisiasi Tracking",
                    description: "Item ditambahkan ke daftar tracking"
                });

            if (error) throw error;

            toast.success("Berhasil ditambahkan ke tracking", { id: toastId });
            navigate("/tracking");
        } catch (e: any) {
            console.error(e);
            toast.error("Gagal menambahkan tracking: " + e.message, { id: toastId });
        }
    };

    return (
        <div className="p-8 space-y-6">


            {/* Controls */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-card p-4 rounded-lg border shadow-sm">
                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="cari data...."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8"
                    />
                </div>
                <div className="flex items-center gap-4">
                    {selectedTrackingId && canManage && (
                        <Button
                            onClick={handleAddToTracking}
                            className="bg-blue-600 hover:bg-blue-700 animate-in fade-in slide-in-from-right-4"
                        >
                            <Truck className="w-4 h-4 mr-2" />
                            Update Tracking
                        </Button>
                    )}
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Baris per halaman:</span>
                        <Select
                            value={itemsPerPage.toString()}
                            onValueChange={(v) => setItemsPerPage(Number(v))}
                        >
                            <SelectTrigger className="w-[70px]">
                                <SelectValue placeholder="10" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="5">5</SelectItem>
                                <SelectItem value="10">10</SelectItem>
                                <SelectItem value="20">20</SelectItem>
                                <SelectItem value="50">50</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            <div className="border rounded-lg">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-12 whitespace-nowrap">No</TableHead>
                            <TableHead className="whitespace-nowrap">Info Permintaan</TableHead>
                            <TableHead className="w-[50px] whitespace-nowrap"></TableHead>
                            <TableHead className="w-32 whitespace-nowrap">No Neraca</TableHead>
                            <TableHead className="whitespace-nowrap">No Penawaran</TableHead>
                            {userRole && userRole !== 'staff' && <TableHead className="w-[150px] whitespace-nowrap">Dibuat Oleh</TableHead>}
                            <TableHead className="whitespace-nowrap">Info PO In</TableHead>

                            <TableHead className="w-32 whitespace-nowrap text-right">Aksi</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                                    <TableCell>
                                        <div className="space-y-2">
                                            <Skeleton className="h-4 w-32" />
                                            <Skeleton className="h-3 w-24" />
                                        </div>
                                    </TableCell>
                                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                    {userRole && userRole !== 'staff' && (
                                        <TableCell>
                                            <div className="space-y-2">
                                                <Skeleton className="h-4 w-40" />
                                                <Skeleton className="h-3 w-32" />
                                            </div>
                                        </TableCell>
                                    )}
                                    <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                                </TableRow>
                            ))
                        ) : isError ? (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center text-destructive p-8">
                                    Pastikan koneksi internet anda baik
                                </TableCell>
                            </TableRow>

                        ) : groupedLetters.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center h-24 text-muted-foreground">
                                    {searchQuery ? "Pencarian tidak ditemukan" : "Tidak ada surat jalan"}
                                </TableCell>
                            </TableRow>
                        ) : (
                            paginatedLetters.map((group, groupIndex) => {
                                let isFirstInGroup = true;
                                // Calculate Global Index based on Group Index (Pagination aware)
                                const currentGlobalIndex = (currentPage - 1) * itemsPerPage + groupIndex + 1;

                                return group.map((l, lIndex) => {
                                    const po = l.po_in || {} as any;
                                    const q = po.quotation || {} as any;
                                    const req = q.request || {} as any;
                                    const cust = req.customer || {} as any;

                                    const isFirst = isFirstInGroup;
                                    isFirstInGroup = false;

                                    // if (isFirst) globalIndex++; // Removed

                                    return (
                                        <TableRow key={l.id} className={l.status === 'approved' ? "bg-green-50/30" : ""}>
                                            {isFirst && (
                                                <>
                                                    <TableCell rowSpan={group.length} className="align-middle border-r whitespace-nowrap">
                                                        {currentGlobalIndex}
                                                    </TableCell>
                                                    <TableCell rowSpan={group.length} className="align-middle border-r relative whitespace-nowrap overflow-hidden">
                                                        {/* Status Corner Badge */}
                                                        {(() => {
                                                            // Check if ANY letter in this group is approved? Or just this specific one?
                                                            // Logic: Internal Letter is per-item here. But this cell rows spans the group.
                                                            // The group is by Request. Usually 1 Request = 1 Internal Letter in this view? 
                                                            // No, l is iterated. But this cell has rowSpan={group.length}.
                                                            // So this cell represents the whole GROUP (Request).
                                                            // If the group has multiple letters, do we show status of ALL?
                                                            // Let's check if all letters in group are approved.
                                                            const allApproved = group.every(x => x.status === 'approved');
                                                            const anyApproved = group.some(x => x.status === 'approved');
                                                            const statusColor = allApproved ? 'bg-emerald-600' : 'bg-amber-600';
                                                            const statusText = allApproved ? 'OK' : 'PEND';

                                                            return (
                                                                <div className="absolute top-0 left-0 w-[75px] h-[75px] overflow-hidden pointer-events-none z-20">
                                                                    <div className={`absolute top-[10px] left-[-30px] w-[100px] text-center -rotate-45 ${statusColor} text-white text-[9px] font-bold py-1 shadow-sm`}>
                                                                        {statusText}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })()}

                                                        <span className="font-medium bg-green-100 text-green-800 px-2 py-1 rounded text-xs inline-block mb-2 ml-10 relative z-10">
                                                            {req.request_code}
                                                        </span>
                                                        <div className="flex flex-col gap-1 relative z-10 ml-2">
                                                            <span className="font-bold text-base">{cust?.company_name || "-"}</span>
                                                            <span className="font-medium">{req.title || "-"}</span>
                                                            <div className="text-sm text-muted-foreground flex flex-col gap-1">
                                                                <div>
                                                                    <span className="font-semibold">No Surat:</span> {req.letter_number || "-"}
                                                                </div>
                                                                <div>
                                                                    <span className="font-semibold">PIC:</span> {req.customer_pic?.name || "-"}
                                                                </div>
                                                                <div>
                                                                    <span className="font-semibold">Tanggal:</span> {req.created_at ? format(new Date(req.created_at), "dd/MM/yyyy") : "-"}
                                                                </div>
                                                                {req.customer_attachments?.length > 0 && (
                                                                    <div className="flex flex-wrap gap-2 mt-1">
                                                                        {req.customer_attachments.map((att: any, i: number) => (
                                                                            <a key={i} href={getStorageUrl(att.file_path, "request-attachments")} target="_blank" className="text-blue-600 flex items-center text-xs hover:underline">
                                                                                <LinkIcon className="h-3 w-3 mr-1" /> {att.file_name || "File"}
                                                                            </a>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                </>
                                            )}

                                            <TableCell className="align-middle text-center whitespace-nowrap">
                                                {/* Checkbox Visibility:
                                                    - Always show for Owner / SuperAdmin
                                                    - For Pimpinan (viewing others' data): ONLY show if it's already tracked (trackedIds.has(l.id)). If not tracked, hide it.
                                                 */}
                                                {(userRole === 'pimpinan' && l.creator?.user_id !== userId && !trackedIds.has(l.id)) ? (
                                                    <div className="w-4 h-4 mx-auto" />
                                                ) : (
                                                    <Checkbox
                                                        disabled={trackedIds.has(l.id) || (userRole !== 'super_admin' && l.created_by !== userId)}
                                                        checked={selectedTrackingId === l.id || trackedIds.has(l.id)}
                                                        onCheckedChange={(checked) => {
                                                            if (l.status !== 'approved') {
                                                                toast.error("Belum bisa lanjut, tunggu di approve", {
                                                                    description: "Item harus disetujui pimpinan sebelum bisa dilanjutkan ke tracking."
                                                                });
                                                                return;
                                                            }

                                                            if (checked) {
                                                                setSelectedTrackingId(l.id);
                                                                setSelectedTrackingLetter(l.po_in);
                                                            } else {
                                                                setSelectedTrackingId(null);
                                                                setSelectedTrackingLetter(null);
                                                            }
                                                        }}
                                                    />
                                                )}
                                            </TableCell>

                                            <TableCell className="whitespace-nowrap">
                                                <div className="text-sm font-mono bg-amber-50 text-amber-900 border border-amber-200 px-1 rounded w-fit">
                                                    {getBalanceCode(po)}
                                                </div>
                                                <div className="text-xs text-muted-foreground mt-1">
                                                    {po.quotation?.balance_link?.[0]?.balance?.created_at && isValid(new Date(po.quotation.balance_link[0].balance.created_at))
                                                        ? format(new Date(po.quotation.balance_link[0].balance.created_at), "dd/MM/yyyy", { locale: id })
                                                        : "-"}
                                                </div>
                                            </TableCell>
                                            <TableCell className="whitespace-nowrap">
                                                <div className="font-mono text-sm bg-muted px-2 py-1 rounded inline-block">
                                                    {q.quotation_number}
                                                </div>
                                                <div className="text-xs text-muted-foreground mt-1">
                                                    {q.created_at && isValid(new Date(q.created_at)) ? format(new Date(q.created_at), "dd/MM/yyyy", { locale: id }) : "-"}
                                                </div>
                                            </TableCell>
                                            {userRole && userRole !== 'staff' && (
                                                <TableCell className="align-middle border-r whitespace-nowrap">
                                                    <div className="flex flex-col gap-1 items-center justify-center h-full mt-2">
                                                        <span className="text-sm font-medium">{l.creator?.name || (l as any).created_by || "-"}</span>
                                                    </div>
                                                </TableCell>
                                            )}
                                            <TableCell className="align-middle whitespace-nowrap">
                                                <div className="flex flex-col gap-1 min-w-[200px]">
                                                    <span className="font-medium">{po.subject || "-"}</span>
                                                    <span className="text-xs text-muted-foreground">
                                                        No Surat: <span className="text-foreground/80">{po.vendor_letter_number || "-"}</span>
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">
                                                        Tanggal: <span className="text-foreground/80">{po.vendor_letter_date ? format(new Date(po.vendor_letter_date), "dd/MM/yyyy") : "-"}</span>
                                                    </span>
                                                    {po.attachments?.length > 0 && (
                                                        <div className="flex flex-wrap gap-1 pt-1">
                                                            {po.attachments.map((att: any, i: number) => (
                                                                <a key={i} href={getStorageUrl(att.file_path, 'purchase-order-attachments')} target="_blank" className="text-blue-600 flex items-center text-xs hover:underline">
                                                                    <LinkIcon className="h-3 w-3 mr-1" /> File
                                                                </a>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </TableCell>



                                            <TableCell className="relative overflow-hidden whitespace-nowrap text-right">
                                                {/* Corner Badge */}
                                                {po.is_completed && (
                                                    <div className="absolute top-0 right-0 w-[75px] h-[75px] overflow-hidden pointer-events-none z-20">
                                                        <div className="absolute top-[10px] right-[-30px] w-[100px] text-center rotate-45 bg-green-600 text-white text-[9px] font-bold py-1 shadow-sm">
                                                            SELESAI
                                                        </div>
                                                    </div>
                                                )}
                                                <div className="flex justify-end gap-2 relative z-10">
                                                    {/* Approval Toggle for Pimpinan / Super Admin */}
                                                    {(userRole === 'pimpinan' || userRole === 'super_admin') && (
                                                        <div className="flex items-center gap-2 bg-gray-50 p-1 rounded border mr-2">
                                                            <div className="flex flex-col items-end">
                                                                <span className={`text-[10px] font-bold ${l.status === 'approved' ? 'text-emerald-600' : 'text-amber-600'}`}>
                                                                    {l.status === 'approved' ? 'Approved' : 'Pending'}
                                                                </span>
                                                            </div>
                                                            <Switch
                                                                checked={l.status === 'approved'}
                                                                onCheckedChange={() => handleStatusToggle(l.id, l.status || 'pending')}
                                                                className="scale-75"
                                                            />
                                                        </div>
                                                    )}

                                                    <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => handleViewDetail(q.id, l.po_in?.subject, l.po_in?.invoice_type)}>
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                    {!trackedIds.has(l.id) && canManage && ((l as any).created_by === userId || userRole === 'super_admin') && (
                                                        <DeleteConfirmationDialog
                                                            onDelete={() => handleDelete(l.id)}
                                                            trigger={
                                                                <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10 border-destructive/20">
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            }
                                                        />
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                });
                            })
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination Controls */}

            {groupedLetters.length > 0 && (
                <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                        Menampilkan {(currentPage - 1) * itemsPerPage + 1} sampai {Math.min(currentPage * itemsPerPage, groupedLetters.length)} dari {groupedLetters.length} entri
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <div className="text-sm font-medium">
                            Hal {currentPage} dari {totalPages}
                        </div>
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={currentPage === totalPages}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )
            }
            {/* Detail Modal */}
            <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                <DialogContent className="max-w-5xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Detail Surat Internal</DialogTitle>
                    </DialogHeader>

                    <div className="mt-4">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-12">No</TableHead>
                                    <TableHead>No Internal</TableHead>
                                    <TableHead>No PO</TableHead>
                                    <TableHead>Vendor</TableHead>
                                    <TableHead>Informasi Bank</TableHead>
                                    <TableHead>Bukti Pembayaran</TableHead>
                                    <TableHead className="text-right">Aksi</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {selectedLetterPos.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">
                                            Tidak ada PO ditemukan untuk Quotation ini.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    selectedLetterPos.map((po: any, idx: number) => {
                                        const hash = po.id.substring(0, 6).toUpperCase();
                                        const dateObj = po.created_at ? new Date(po.created_at) : new Date();
                                        const month = dateObj.getMonth() + 1;
                                        const year = dateObj.getFullYear();
                                        const acronym = "MPA";
                                        const internalNo = `In/${hash}/${acronym}/${month}.${year}`;

                                        const hasDP = (po.dp_amount > 0 || po.dp_percentage > 0);
                                        const isExpanded = expandedVendorIds.has(po.id);

                                        // Labels
                                        const mainLabel = hasDP ? "Tagihan DP" : "Tagihan Full";
                                        const mainType = hasDP ? 'DP' : 'FULL';

                                        return (
                                            <Fragment key={po.id}>
                                                <TableRow>
                                                    <TableCell>{idx + 1}</TableCell>
                                                    <TableCell>
                                                        <span className="font-mono text-black">
                                                            {internalNo}
                                                        </span>
                                                        <div className="text-[10px] text-blue-600 font-bold mt-1 uppercase tracking-wider">{mainLabel}</div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="font-mono text-black">
                                                            {po.po_number.replace(/\s/g, "")}
                                                        </span>
                                                        {po.discount > 0 && <div className="text-xs text-green-600 font-normal mt-1">Disc: {po.discount}%</div>}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col space-y-1">
                                                            <span className="font-semibold">{po.vendor?.company_name}</span>
                                                            <span className="text-xs text-muted-foreground">PIC: {po.vendor_pic?.name || "-"}</span>

                                                            <div className="text-xs bg-muted/50 p-1 rounded mt-1 border">
                                                                <div><span className="font-semibold">Ref:</span> {po.vendor_letter_number || "-"}</div>
                                                            </div>

                                                            {po.attachments?.length > 0 && (
                                                                <div className="flex flex-wrap gap-1 mt-1">
                                                                    {po.attachments.map((att: any, ai: number) => (
                                                                        <a key={ai} href={getStorageUrl(att.file_path, 'purchase-order-attachments')} target="_blank" className="text-blue-600 hover:underline flex items-center text-xs">
                                                                            <LinkIcon className="h-3 w-3 mr-1" /> View File
                                                                        </a>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col text-sm space-y-1">
                                                            <span className="font-semibold">{po.vendor?.bank_name || "-"}</span>
                                                            <span className="font-mono">{po.vendor?.bank_account_number || "-"}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        {po.transfer_proof_url ? (
                                                            <div className="flex flex-col gap-1">
                                                                <a href={po.transfer_proof_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-xs flex items-center gap-1 font-medium bg-blue-50 px-2 py-1 rounded w-fit">
                                                                    <LinkIcon className="h-3 w-3" /> Bukti Pembayaran
                                                                </a>
                                                                {po.transfer_proof_date && (
                                                                    <span className="text-[10px] text-muted-foreground">
                                                                        {format(new Date(po.transfer_proof_date), "dd/MM/yyyy HH:mm", { locale: id })}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground">-</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex flex-col gap-2 items-end">
                                                            <Button size="sm" variant="outline" className="w-full justify-center" onClick={() => handlePrint(po, internalNo, mainType)}>
                                                                <Printer className="h-4 w-4 mr-2" />
                                                                Cetak
                                                            </Button>
                                                            {userRole === 'pimpinan' && (
                                                                <div className="relative w-full">
                                                                    <Input
                                                                        type="file"
                                                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                                        onChange={(e) => handleUploadProof(po.id, e)}
                                                                        title="Upload Bukti Transfer"
                                                                    />
                                                                    <Button size="sm" variant="outline" className="gap-2 w-full justify-center">
                                                                        <Plus className="h-3 w-3" /> Upload Bukti
                                                                    </Button>
                                                                </div>
                                                            )}
                                                            {hasDP && (
                                                                <Button
                                                                    size="sm"
                                                                    variant={isExpanded ? "secondary" : "ghost"}
                                                                    className="h-8 w-8 p-0 rounded-full border border-dashed hover:bg-blue-50"
                                                                    title="Tambah Tagihan Pelunasan"
                                                                    onClick={() => toggleVendorExpand(po.id)}
                                                                >
                                                                    <Plus className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? "rotate-45 text-red-500" : "text-blue-600"}`} />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>

                                                {/* Settlement Row */}
                                                {hasDP && isExpanded && (
                                                    <TableRow className="bg-blue-50/50 hover:bg-blue-50">
                                                        <TableCell></TableCell>
                                                        <TableCell className="font-mono text-xs text-right align-middle text-muted-foreground">
                                                            ↳
                                                        </TableCell>
                                                        <TableCell colSpan={3}>
                                                            <div className="flex items-center gap-2 pl-4">
                                                                <span className="font-bold text-sm text-blue-700">Tagihan Pelunasan</span>
                                                                <span className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full uppercase tracking-wider font-bold">Settlement</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <Button size="sm" variant="outline" onClick={() => handlePrint(po, internalNo, 'PELUNASAN')}>
                                                                <Printer className="h-4 w-4 mr-2" />
                                                                Cetak
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </Fragment>
                                        );
                                    }))}
                            </TableBody>
                        </Table>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Print Modal */}
            <Dialog open={isPrintOpen} onOpenChange={setIsPrintOpen}>
                <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto print:static print:transform-none print:overflow-visible print:h-auto print:max-w-none print:w-full print:p-0 print:border-none">
                    <DialogHeader>
                        <DialogTitle className="sr-only">Cetak Purchase Order</DialogTitle>
                    </DialogHeader>
                    {printPO && (
                        <PurchaseOrderPrint
                            po={printPO}
                            internalNumberOverride={tempInternalNumber}
                            invoiceSubject={currentInvoiceSubject}
                            invoiceType={currentInvoiceType}
                            onUpdate={() => {
                                // 1. Update single PO for Print Modal state
                                (supabase as any).from("purchase_orders").select("*").eq("id", printPO.id).single()
                                    .then(({ data }: any) => {
                                        if (data) {
                                            setPrintPO((prev: any) => prev ? ({
                                                ...prev,
                                                discount: data.discount,
                                                ppn: data.ppn,
                                                dp_percentage: data.dp_percentage,
                                                dp_amount: data.dp_amount,
                                                notes: data.notes,
                                                franco: data.franco,
                                                delivery_time: data.delivery_time,
                                                payment_term: data.payment_term
                                            }) : null);
                                        }
                                    });

                                // 2. Refresh the Detail List in background
                                if (currentQuotationId) {
                                    handleViewDetail(currentQuotationId, currentInvoiceSubject, currentInvoiceType);
                                }
                            }}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div >
    );
};

export default InternalLetters;
