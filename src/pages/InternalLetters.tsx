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

import { Truck, ChevronLeft, ChevronRight, Search, ChevronsUpDown, Check as CheckIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { startOfDay, endOfDay, isWithinInterval } from "date-fns";
import { DateRange } from "react-day-picker";
import { DatePickerWithRange } from "@/components/ui/date-picker-with-range";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

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
                customer: { id: string; company_name: string };
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
    created_at?: string;
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

    // Filters
    const [dateRange, setDateRange] = useState<DateRange | undefined>();
    const [customers, setCustomers] = useState<any[]>([]);
    const [selectedCustomerFilter, setSelectedCustomerFilter] = useState<string>("all");
    const [openCustomerCombobox, setOpenCustomerCombobox] = useState(false);


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

    // Delete State
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [itemsToDelete, setItemsToDelete] = useState<string[]>([]);

    const handleDeleteClick = (letterIds: string[]) => {
        setItemsToDelete(letterIds);
        setIsDeleteDialogOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (itemsToDelete.length === 0) return;
        const toastId = toast.loading("Menghapus data...");

        try {
            const { error } = await supabase
                .from("internal_letters")
                .delete()
                .in("id", itemsToDelete);

            if (error) throw error;

            toast.success("Berhasil menghapus data", { id: toastId });
            fetchLetters();
            setIsDeleteDialogOpen(false);
            setItemsToDelete([]);
        } catch (error) {
            console.error(error);
            toast.error("Gagal menghapus data", { id: toastId });
        }
    };

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

    const handleBulkStatusToggle = async (groupLetters: InternalLetter[]) => {
        if (!canManage) return;

        // Logic: If ANY is not approved, Approve ALL. Else (all approved), Unapprove ALL.
        const isAllApproved = groupLetters.every(l => l.status === 'approved');
        const newStatus = isAllApproved ? 'pending' : 'approved';

        const idsToUpdate = groupLetters.map(l => l.id);
        const toastId = toast.loading(`Memperbarui ${idsToUpdate.length} item...`);

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
                .in("id", idsToUpdate);

            if (error) throw error;

            toast.success(`Berhasil mengubah status ${idsToUpdate.length} surat menjadi ${newStatus === 'approved' ? 'Disetujui' : 'Pending'}`, { id: toastId });
            fetchLetters();
        } catch (e) {
            console.error(e);
            toast.error("Gagal memperbarui status bulk", { id: toastId });
        }
    };


    const [currentLetterStatus, setCurrentLetterStatus] = useState<string>('pending');

    const handleViewDetail = async (quotationId: string, subject?: string, invoiceType?: string, status: string = 'pending') => {
        setCurrentInvoiceSubject(subject || "");
        setCurrentInvoiceType(invoiceType || "");
        setCurrentQuotationId(quotationId);
        setCurrentLetterStatus(status);
        setExpandedVendorIds(new Set()); // Reset toggle state
        const { data, error } = await (supabase as any)
            .from("purchase_order_quotations")
            .select(`
                purchase_orders(
                id,
                po_number,
                status,
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
                        po_ins(
                            id,
                            vendor_letter_number, 
                            subject, 
                            invoice_type, 
                            internal_letters(id, status, created_at)
                        ),
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
            .select("balance_id, entry_id") // Fetch entry_id too
            .eq("quotation_id", quotationId);

        const balanceIds = qLinks?.map((l: any) => l.balance_id) || [];
        // Map balance ID to entry ID for precise setting lookup
        const balanceEntryMap = new Map();
        qLinks?.forEach((l: any) => {
            if (l.balance_id && l.entry_id) {
                balanceEntryMap.set(l.balance_id, l.entry_id);
            }
        });

        // Fetch Live PPN Settings from Balance (General Settings)
        const { data: balanceSettings } = await (supabase as any)
            .from("balance_settings")
            .select("balance_id, ppn_percentage")
            .in("balance_id", balanceIds);

        // Fetch Live Vendor Settings using Balance IDs
        const { data: vendorSettings } = await (supabase as any)
            .from("balance_vendor_settings")
            .select("*")
            .in("balance_id", balanceIds);

        // Flatten logic similar to PurchaseOrders group
        const pos = data?.map((d: any) => {
            // SAFE CLONE to ensure we can Mutate properties
            const po = { ...d.purchase_orders };

            // Find valid PPN setting
            // Priorities:
            // 1. Balance Settings (if exists)
            // 2. Existing PO PPN
            // 3. Default 11
            const pSettings = balanceSettings?.find((s: any) => balanceIds.includes(s.balance_id));

            // Set PPN from Balance Settings logic
            if (pSettings && pSettings.ppn_percentage !== undefined) {
                po.ppn = pSettings.ppn_percentage;
            }

            // Apply Live Vendor Settings if available
            // Note: If multiple balances have settings for same vendor, take the first one found
            const settings = vendorSettings?.find((s: any) => s.vendor_id === po.vendor_id);

            console.log(`[LetterDebug] Processing PO ${po.po_number}(${po.vendor?.company_name})`, {
                vendorId: po.vendor_id,
                foundSettings: settings,
                foundPPN: pSettings,
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
                },
                // Pass balance link for deeper logic if needed by component
                balance_link: pq.quotation.balance_link
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
                handleViewDetail(currentQuotationId, currentInvoiceSubject, currentInvoiceType, currentLetterStatus);
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
                             customer:customers (id, company_name, customer_code),
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

    const fetchCustomers = async () => {
        const { data } = await supabase.from("customers").select("id, company_name").order("company_name");
        if (data) setCustomers(data);
    };

    useEffect(() => {
        if (permLoading) return;
        fetchLetters();
        fetchCustomers();
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
        const customerName = l.po_in?.quotation?.request?.customer?.company_name?.toLowerCase() || "";
        const subject = l.po_in?.subject?.toLowerCase() || "";
        const custId = l.po_in?.quotation?.request?.customer?.id;

        const matchesSearch = (
            letterNumber.includes(query) ||
            customerName.includes(query) ||
            subject.includes(query)
        );

        if (!matchesSearch) return false;

        // Date Filter (using created_at of Internal Letter or Request Date?)
        // Ideally Internal Letter Created At.
        if (dateRange?.from) {
            const lDate = l.created_at ? new Date(l.created_at) : null;
            if (lDate) {
                if (dateRange.to) {
                    if (!isWithinInterval(lDate, { start: startOfDay(dateRange.from), end: endOfDay(dateRange.to) })) return false;
                } else {
                    if (format(lDate, 'yyyy-MM-dd') !== format(dateRange.from, 'yyyy-MM-dd')) return false;
                }
            }
        }

        // Customer Filter
        if (selectedCustomerFilter !== "all") {
            if (custId !== selectedCustomerFilter) return false;
        }

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
            <div className="flex flex-col gap-4 bg-card p-4 rounded-lg border shadow-sm">
                <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                    <div className="relative w-full md:max-w-xs">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Cari data..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-8 w-full"
                        />
                    </div>
                    <div className="flex flex-col sm:flex-row gap-6 w-full md:w-auto">
                        <DatePickerWithRange date={dateRange} setDate={setDateRange} className="w-full sm:w-[240px]" />
                        <Popover open={openCustomerCombobox} onOpenChange={setOpenCustomerCombobox}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={openCustomerCombobox}
                                    className="w-full sm:w-[250px] justify-between"
                                >
                                    {selectedCustomerFilter && selectedCustomerFilter !== "all"
                                        ? customers.find((c) => c.id === selectedCustomerFilter)?.company_name
                                        : "Semua Customer"}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[250px] p-0">
                                <Command>
                                    <CommandInput placeholder="Cari customer..." />
                                    <CommandList>
                                        <CommandEmpty>No customer found.</CommandEmpty>
                                        <CommandGroup>
                                            <CommandItem
                                                value="Semua Customer"
                                                onSelect={() => {
                                                    setSelectedCustomerFilter("all");
                                                    setOpenCustomerCombobox(false);
                                                }}
                                            >
                                                <CheckIcon
                                                    className={cn(
                                                        "mr-2 h-4 w-4",
                                                        selectedCustomerFilter === "all" ? "opacity-100" : "opacity-0"
                                                    )}
                                                />
                                                Semua Customer
                                            </CommandItem>
                                            {customers.map((c) => (
                                                <CommandItem
                                                    key={c.id}
                                                    value={c.company_name}
                                                    onSelect={() => {
                                                        setSelectedCustomerFilter(c.id);
                                                        setOpenCustomerCombobox(false);
                                                    }}
                                                >
                                                    <CheckIcon
                                                        className={cn(
                                                            "mr-2 h-4 w-4",
                                                            selectedCustomerFilter === c.id ? "opacity-100" : "opacity-0"
                                                        )}
                                                    />
                                                    {c.company_name}
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>

                <div className="flex flex-wrap justify-between items-center gap-4 pt-2 border-t">
                    <div className="flex items-center gap-4">
                        <div className="text-sm font-medium text-muted-foreground bg-muted/50 px-3 py-1 rounded-md">
                            Total Data: <span className="text-foreground">{filteredLetters.length}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground whitespace-nowrap">Baris per halaman:</span>
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

                    {selectedTrackingId && canManage && (
                        <Button
                            onClick={handleAddToTracking}
                            className="bg-blue-600 hover:bg-blue-700 animate-in fade-in slide-in-from-right-4"
                        >
                            <Truck className="w-4 h-4 mr-2" />
                            Update Tracking
                        </Button>
                    )}
                </div>
            </div>

            <div className="border rounded-lg">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-12 text-center align-middle whitespace-nowrap border-r border-gray-100">No</TableHead>
                            <TableHead className="w-12 text-center align-middle whitespace-nowrap"></TableHead>

                            <TableHead className="text-center align-middle whitespace-nowrap">Info Permintaan</TableHead>
                            <TableHead className="text-center align-middle whitespace-nowrap">No Neraca</TableHead>
                            <TableHead className="text-center align-middle whitespace-nowrap">No Penawaran</TableHead>
                            {userRole && userRole !== 'staff' && <TableHead className="text-center align-middle whitespace-nowrap">Dibuat Oleh</TableHead>}
                            <TableHead className="text-center align-middle whitespace-nowrap">Info PO In</TableHead>
                            <TableHead className="text-center align-middle whitespace-nowrap">Aksi</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                                    <TableCell>
                                        <div className="space-y-2">
                                            <Skeleton className="h-4 w-32" />
                                            <Skeleton className="h-3 w-24" />
                                        </div>
                                    </TableCell>
                                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                    {userRole && userRole !== 'staff' && (
                                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                    )}
                                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
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
                                // Use the first letter as representative for the group info
                                const l = group[0];
                                const po = l.po_in || {} as any;
                                const q = po.quotation || {} as any;
                                const req = q.request || {} as any;
                                const cust = req.customer || {} as any;
                                const attachments = po.attachments || [];

                                // Calculate Global Index
                                const currentGlobalIndex = (currentPage - 1) * itemsPerPage + groupIndex + 1;

                                return (
                                    <TableRow key={l.id} className="relative group">
                                        <TableCell className="text-center align-middle relative overflow-hidden p-0 h-16 border-r border-gray-100">
                                            <span className="relative z-10">{currentGlobalIndex}</span>
                                            {/* Status Badge (Group Level) */}
                                            {(() => {
                                                const allApproved = group.every(x => x.status === 'approved');
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
                                        </TableCell>

                                        <TableCell className="text-center align-middle">
                                            {(userRole === 'pimpinan' && l.creator?.user_id !== userId && !trackedIds.has(l.id)) ? (
                                                <div className="w-4 h-4 mx-auto" />
                                            ) : (
                                                <Checkbox
                                                    disabled={trackedIds.has(l.id) || (userRole !== 'super_admin' && l.created_by !== userId)}
                                                    checked={selectedTrackingId === l.id || trackedIds.has(l.id)}
                                                    onCheckedChange={(checked) => {
                                                        const isApproved = l.status === 'approved'; // Check logic
                                                        if (!isApproved) {
                                                            toast.error("Belum bisa lanjut, tunggu di approve");
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

                                        <TableCell className="align-middle bg-white/50 relative whitespace-nowrap">
                                            <div className="flex flex-col gap-1 relative z-10">
                                                <span className="font-medium bg-green-100 text-green-800 px-2 py-1 rounded text-xs inline-block mb-2 w-fit">
                                                    {req.request_code || "-"}
                                                </span>
                                                <span className="font-bold text-base">{cust?.company_name || "-"}</span>
                                                <span className="font-medium">{req.title || "-"}</span>
                                                <div className="text-sm text-muted-foreground flex flex-col gap-1 mt-1">
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

                                        <TableCell className="align-middle whitespace-nowrap text-center">
                                            <div className="text-sm font-mono bg-amber-50 text-amber-900 border border-amber-200 px-1 rounded w-fit mx-auto">
                                                {getBalanceCode(po)}
                                            </div>
                                            <div className="text-xs text-muted-foreground mt-1">
                                                {po.quotation?.balance_link?.[0]?.balance?.created_at && isValid(new Date(po.quotation.balance_link[0].balance.created_at))
                                                    ? format(new Date(po.quotation.balance_link[0].balance.created_at), "dd/MM/yyyy", { locale: id })
                                                    : "-"}
                                            </div>
                                        </TableCell>

                                        <TableCell className="align-middle whitespace-nowrap text-center">
                                            <div className="font-mono text-sm bg-muted px-2 py-1 rounded inline-block">
                                                {q.quotation_number}
                                            </div>
                                            <div className="text-xs text-muted-foreground mt-1">
                                                {q.created_at && isValid(new Date(q.created_at)) ? format(new Date(q.created_at), "dd/MM/yyyy", { locale: id }) : "-"}
                                            </div>
                                        </TableCell>

                                        {userRole && userRole !== 'staff' && (
                                            <TableCell className="align-middle whitespace-nowrap text-center">
                                                <div className="flex flex-col gap-1 items-center justify-center h-full">
                                                    <span className="text-sm font-medium">{l.creator?.name || (l as any).created_by || "-"}</span>
                                                </div>
                                            </TableCell>
                                        )}

                                        <TableCell className="align-middle whitespace-nowrap">
                                            <div className="flex flex-col space-y-1">
                                                <span className="font-medium">{po.subject || "-"}</span>
                                                <span className="text-xs text-muted-foreground">
                                                    Ref: <span className="text-foreground/80">{po.vendor_letter_number || "-"}</span>
                                                </span>
                                                {attachments.length > 0 && (
                                                    <div className="flex flex-wrap gap-1 pt-1">
                                                        {attachments.map((att: any, ai: number) => (
                                                            <a key={ai} href={getStorageUrl(att.file_path, 'purchase-order-attachments')} target="_blank" className="text-blue-600 hover:underline flex items-center text-xs">
                                                                <LinkIcon className="h-3 w-3 mr-1" /> File
                                                            </a>
                                                        ))}
                                                    </div>
                                                )}
                                                {/* Optional: Show Letter Count if meaningful */}

                                            </div>
                                        </TableCell>

                                        <TableCell className="relative overflow-hidden whitespace-nowrap text-center align-middle">
                                            <div className="flex flex-col gap-2 items-center relative z-10">
                                                <Button variant="outline" className="gap-2" onClick={() => handleViewDetail(q.id, po.subject, po.invoice_type, l.status || 'pending')}>
                                                    <Eye className="h-4 w-4" />
                                                    View
                                                </Button>

                                                {(userRole === 'staff' || userRole === 'super_admin' || (userRole === 'pimpinan' && l.created_by === userId)) && !trackedIds.has(l.id) && selectedTrackingId !== l.id && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                                        onClick={() => handleDeleteClick(group.map(g => g.id))}
                                                        title="Hapus Surat Jalan"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                )}

                                                {(userRole === 'pimpinan' || userRole === 'super_admin') && (
                                                    <div className="flex items-center gap-2 bg-gray-50 p-1 rounded border">
                                                        <span className={`text-[10px] font-bold ${group.every(g => g.status === 'approved') ? 'text-emerald-600' : 'text-amber-600'}`}>
                                                            {group.every(g => g.status === 'approved') ? 'Aprv' : 'Pend'}
                                                        </span>
                                                        <Switch
                                                            checked={group.every(g => g.status === 'approved')}
                                                            onCheckedChange={() => handleBulkStatusToggle(group)}
                                                            className="scale-75"
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>


            {/* Pagination Controls */}

            {
                groupedLetters.length > 0 && (
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

                                        // Find specific Internal Letter for this PO/Invoice Type
                                        // We look into the quotations -> po_ins to find a match
                                        // Assuming 1 Quotation per PO usually in this context?
                                        const linkedQuotation = po.quotations?.[0]; // Take first linked quotation
                                        const linkedPoIns = linkedQuotation?.po_ins || [];

                                        // Match PO In based on Type?
                                        // Note: mainType is 'DP' or 'FULL'. PO In has 'invoice_type'.
                                        // 'invoice_type' relies on localized or fixed strings? (Usually 'DP', 'PELUNASAN', 'TAGIHAN FULL'?)
                                        // Logic:
                                        // If mainType is 'DP', find PO In with invoice_type like 'DP'
                                        // If mainType is 'FULL', find PO In with invoice_type like 'TAGIHAN FULL'?
                                        // Let's try to match loosely or default to the *first* internal letter if simple 1-to-1?

                                        // Better heuristic: match by similarity or if only 1 exists.
                                        // Let's try to finding one that has an internal letter.
                                        const specificPoIn = linkedPoIns.find((pi: any) => {
                                            if (mainType === 'DP') return (pi.invoice_type || '').includes('DP');
                                            if (mainType === 'FULL') return (pi.invoice_type || '').includes('FULL') || (pi.invoice_type || '').includes('Tagihan');
                                            return true;
                                        }) || linkedPoIns[0];

                                        const specificLetter = specificPoIn?.internal_letters?.[0] || specificPoIn?.internal_letters; // it is singular or array? Query was internal_letters(id...) implies relation. usually 1-1.

                                        // If we found a specific letter, use its status. Otherwise fallback to global 'currentLetterStatus'
                                        const rowStatus = specificLetter?.status || currentLetterStatus;
                                        const rowLetterId = specificLetter?.id;

                                        return (
                                            <Fragment key={po.id}>
                                                <TableRow>
                                                    <TableCell>{idx + 1}</TableCell>
                                                    <TableCell>
                                                        <span className="font-mono text-black">
                                                            {internalNo}
                                                        </span>
                                                        <div className="text-[10px] text-blue-600 font-bold mt-1 uppercase tracking-wider">{mainLabel}</div>
                                                        <div className={`text-[10px] font-bold mt-1 uppercase tracking-wider px-1.5 py-0.5 rounded w-fit ${rowStatus === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                                            {rowStatus === 'approved' ? 'APPROVED' : 'PENDING'}
                                                        </div>
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
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="w-full justify-center"
                                                                onClick={() => handlePrint(po, internalNo, mainType)}
                                                            >
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
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => handlePrint(po, internalNo, 'PELUNASAN')}
                                                            >
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
                                    handleViewDetail(currentQuotationId, currentInvoiceSubject, currentInvoiceType, currentLetterStatus);
                                }
                            }}
                        />
                    )}
                </DialogContent>
            </Dialog>


            <DeleteConfirmationDialog
                open={isDeleteDialogOpen}
                onOpenChange={setIsDeleteDialogOpen}
                onDelete={handleConfirmDelete}
                trigger={<span className="hidden" />}
                title="Hapus Surat Jalan"
                description="Apakah anda yakin ingin menghapus surat jalan ini? Data yang dihapus tidak dapat dikembalikan."
            />
        </div >
    );
};

export default InternalLetters;
