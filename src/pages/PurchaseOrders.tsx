import { useState, useEffect, useMemo, useRef, Fragment } from "react";
import { useLocation, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { CompletedStamp } from "@/components/ui/CompletedStamp";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "../components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { DeleteConfirmationDialog } from "@/components/DeleteConfirmationDialog";
import { Label } from "@/components/ui/label";
import { format, isValid } from "date-fns";
import { id } from "date-fns/locale";
import { usePermission } from "@/hooks/usePermission";
import { Plus, Trash2, Edit, Printer, Link as LinkIcon, ShoppingBag, Check, Search, X, ChevronLeft, ChevronRight } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import PurchaseOrderPrint from "@/components/purchase-order/PurchaseOrderPrint";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { startOfDay, endOfDay, isWithinInterval } from "date-fns";
import { DateRange } from "react-day-picker";
import { DatePickerWithRange } from "@/components/ui/date-picker-with-range";
import { ChevronsUpDown, Check as CheckIcon } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// --- Types ---

interface PO {
    id: string;
    po_number: string;
    created_at: string;
    vendor: { company_name: string; address?: string; logo?: string; id?: string };
    vendor_id: string; // Required
    vendor_pic_id?: string;
    vendor_pic: { name: string };
    vendor_letter_number: string;
    vendor_letter_date: string;
    customer_id?: string;
    customer?: { company_name: string };
    type: 'IN' | 'OUT';
    subject: string;
    discount?: number;
    ppn?: number;
    dp_amount?: number;
    dp_percentage?: number;
    remaining_payment?: number;
    payment_terms?: string;
    transfer_proof_url?: string;
    transfer_proof_date?: string;
    quotations: Array<{
        id: string;
        quotation_number: string;
        created_at: string;
        request: {
            title: string;
            request_code: string;
            letter_number: string;
            customer: { id: string; company_name: string };
            customer_pic: { name: string };
            request_date: string;
            attachments: Array<any>;
        };
        balance_link: any; // Can be array or object
        completed?: boolean;
    }>;
    attachments: Array<{
        file_name: string;
        file_path: string;
    }>;
    created_by?: string;
    creator?: { name: string };
    status?: 'pending' | 'approved';
}

interface Quotation {
    id: string;
    quotation_number: string;
    request: {
        title: string;
        request_code: string;
        letter_number: string;
        customer: { id: string; company_name: string };
        customer_pic: { name: string };
    };
    balance_link: {
        balance: {
            balance_entries: Array<{ code: string }>;
        };
    };
}

// --- Components ---

function VendorPicSelect({ vendorId, currentPicId, poId, onUpdate, disabled }: { vendorId: string, currentPicId?: string, poId: string, onUpdate: (newPic: any) => void, disabled?: boolean }) {
    const [pics, setPics] = useState<any[]>([]);

    useEffect(() => {
        if (vendorId) {
            supabase.from("vendor_pics").select("*").eq("vendor_id", vendorId)
                .then(({ data }) => setPics(data || []));
        }
    }, [vendorId]);

    const handleChange = async (picId: string) => {
        const selectedPic = pics.find(p => p.id === picId);
        if (!selectedPic) return;

        const { error } = await supabase.from("purchase_orders").update({ vendor_pic_id: picId }).eq("id", poId);
        if (error) {
            toast.error("Gagal update PIC");
        } else {
            toast.success("PIC berhasil diupdate");
            onUpdate(selectedPic);
        }
    }

    return (
        <Select value={currentPicId || ""} onValueChange={handleChange} disabled={disabled}>
            <SelectTrigger className="h-6 text-xs mt-1 w-full min-w-[120px]">
                <SelectValue placeholder="Pilih PIC" />
            </SelectTrigger>
            <SelectContent>
                {pics.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name} {p.position ? `(${p.position})` : ''}</SelectItem>
                ))}
            </SelectContent>
        </Select>
    )
}

function GeneratorModal({
    open,
    onOpenChange,
    onSuccess
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}) {
    const [quotationSearch, setQuotationSearch] = useState("");
    const [allQuotations, setAllQuotations] = useState<Quotation[]>([]);
    const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);

    useEffect(() => {
        if (open) {
            loadQuotations();
            setSelectedQuotation(null);
            setQuotationSearch("");
        }
    }, [open]);

    const loadQuotations = async () => {
        const { data } = await supabase
            .from("quotations")
            .select(`
id,
    quotation_number,
    request: requests(
        title,
        request_code,
        letter_number,
        customer: customers(company_name),
        customer_pic: customer_pics(name)
    ),
        balance_link: quotation_balances(
            balance: balances(
                balance_entries
            )
        )
            `)
            .order("created_at", { ascending: false });

        setAllQuotations(data as any || []);
    };

    const generatePONumber = async () => {
        // PO-XXXXXX
        let isUnique = false;
        let newCode = "";
        while (!isUnique) {
            const random = Math.floor(100000 + Math.random() * 900000);
            newCode = `PO - ${random} `;
            const { data } = await (supabase as any).from("purchase_orders").select("id").eq("po_number", newCode).maybeSingle();
            if (!data) isUnique = true;
        }
        return newCode;
    };

    const handleGenerate = async () => {
        if (!selectedQuotation) return;

        const toastId = toast.loading("Sedang membuat PO...");
        try {
            // 1. Fetch balance items for linked balance
            // Need balance_id from quote
            const links = Array.isArray(selectedQuotation.balance_link)
                ? selectedQuotation.balance_link
                : (selectedQuotation.balance_link ? [selectedQuotation.balance_link] : []);

            const balanceIds = links.map((l: any) => l.balance_id || l.balance?.id).filter(Boolean); // structure varies

            // We need to fetch quotation_balances table properly if not populated fully above
            // Actually, let's just fetch balances by quotation_id
            const { data: qbData } = await supabase.from("quotation_balances").select("balance_id").eq("quotation_id", selectedQuotation.id);
            const finalBalanceIds = qbData?.map(b => b.balance_id) || [];

            if (finalBalanceIds.length === 0) {
                toast.error("Penawaran tidak memiliki Neraca terkait", { id: toastId });
                return;
            }

            // 2. Fetch items
            const { data: items } = await supabase
                .from("balance_items")
                .select(`
    *,
    vendor: vendors(*)
                `)
                .in("balance_id", finalBalanceIds);

            if (!items || items.length === 0) {
                toast.error("Neraca tidak memiliki item", { id: toastId });
                return;
            }

            // 3. Group by Vendor
            const vendorGroups: Record<string, any[]> = {};
            items.forEach((item: any) => {
                if (item.vendor_id) {
                    if (!vendorGroups[item.vendor_id]) vendorGroups[item.vendor_id] = [];
                    vendorGroups[item.vendor_id].push(item);
                }
            });

            const vendorIds = Object.keys(vendorGroups);
            if (vendorIds.length === 0) {
                toast.error("Tidak ada vendor ditemukan dalam item", { id: toastId });
                return;
            }

            // 4. Create PO for each vendor
            // Fetch Vendor Settings
            const { data: vendorSettings } = await supabase
                .from("balance_vendor_settings")
                .select("*")
                .in("balance_id", finalBalanceIds);

            let createdCount = 0;
            for (const vendorId of vendorIds) {
                const groupItems = vendorGroups[vendorId];
                // Use the first item's offering details (assuming they are consistent per vendor in a balance, or we pick one)
                const firstItem = groupItems[0];
                const offeringLetter = firstItem.offering_letter_number || "-";
                const offeringDate = firstItem.offering_date || new Date().toISOString();

                // Get Settings
                const setting = vendorSettings?.find((s: any) => s.vendor_id === vendorId);

                // attachments from all items?
                // unique files
                const allPaths = groupItems
                    .map((i: any) => i.document_path)
                    .filter(Boolean)
                    .flatMap((p: string) => p.split(','));
                const uniquePaths = Array.from(new Set(allPaths));

                // Generate PO Number
                const poNumber = await generatePONumber();

                // Vendor PIC? The balance item doesn't store PIC ID directly usually, only name maybe? 
                // schema says balance_items has vendor_id, but maybe not vendor_pic_id. 
                // We need a PIC. We can pick the first one for the vendor, or we have to ask user?
                // Prompt: "vendornya jangan dibuat duplicate... kolom vendor isinya : nama vendor, pic..."
                // If we automate, we might guess default PIC or leave null if allowed. 
                // Fetch Full Vendor & PIC Details for Snapshot
                const { data: fullVendor } = await supabase.from("vendors").select("*").eq("id", vendorId).single();

                // Let's fetch the first PIC for this vendor.
                const { data: pics } = await supabase.from("vendor_pics").select("*").eq("vendor_id", vendorId).limit(1);
                const firstPic = pics?.[0];
                const picId = firstPic?.id;

                if (!picId) {
                    console.warn(`No PIC found for vendor ${vendorId}, skipping or creating without PIC(will fail constraint ?)`);
                }

                const snapshotData = {
                    vendor: fullVendor,
                    pic: firstPic
                };

                // Create PO
                const { data: po, error } = await (supabase as any).from("purchase_orders").insert({
                    type: 'OUT',
                    po_number: poNumber,
                    vendor_id: vendorId,
                    vendor_pic_id: picId, // Hope it exists
                    vendor_letter_number: offeringLetter,
                    vendor_letter_date: format(new Date(offeringDate), 'yyyy-MM-dd'),
                    subject: `PO untuk ${selectedQuotation.request.request_code} - ${selectedQuotation.request.title}`,
                    status: 'CREATED',
                    discount: setting?.discount || 0,
                    dp_amount: setting?.dp_amount || null,
                    dp_percentage: setting?.dp_percentage || null,
                    payment_terms: setting?.payment_terms || null,
                    vendor_snapshot: snapshotData
                }).select().single();

                if (error) {
                    toast.error("Gagal membuat PO");
                    console.error(error);
                    continue;
                }

                createdCount++;

                // Link Quotation
                await (supabase as any).from("purchase_order_quotations").insert({
                    purchase_order_id: po.id,
                    quotation_id: selectedQuotation.id
                });

                // Attachments
                // We just store the reference link in purchase_order_attachments
                // We need to parse path to name 
                for (const path of uniquePaths) {
                    const fileName = (path as string).split('/').pop() || "attachment";
                    await (supabase as any).from("purchase_order_attachments").insert({
                        purchase_order_id: po.id,
                        file_name: fileName,
                        file_path: path, // reusing path
                        file_size: 0
                    });
                }
            }

            toast.success(`Berhasil membuat ${createdCount} Purchase Order!`, { id: toastId });
            onSuccess();
            onOpenChange(false);

        } catch (e) {
            console.error(e);
            toast.error("Gagal membuat PO", { id: toastId });
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Buat PO dari Penawaran</DialogTitle>
                    <DialogDescription>
                        Pilih quotation untuk membuat Purchase Order.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Pilih Penawaran</Label>
                        <div className="max-h-[300px] overflow-y-auto border rounded p-2 space-y-2">
                            <Input
                                placeholder="Cari penawaran..."
                                value={quotationSearch}
                                onChange={e => setQuotationSearch(e.target.value)}
                                className="mb-2"
                            />
                            {allQuotations
                                .filter(q =>
                                    q.quotation_number.toLowerCase().includes(quotationSearch.toLowerCase()) ||
                                    q.request.customer.company_name.toLowerCase().includes(quotationSearch.toLowerCase())
                                )
                                .map(q => (
                                    <div
                                        key={q.id}
                                        className={cn(
                                            "p-2 border rounded cursor-pointer hover:bg-muted text-sm",
                                            selectedQuotation?.id === q.id ? "bg-primary/10 border-primary" : ""
                                        )}
                                        onClick={() => setSelectedQuotation(q)}
                                    >
                                        <div className="font-bold flex justify-between">
                                            {q.quotation_number}
                                            {selectedQuotation?.id === q.id && <Check className="h-4 w-4 text-primary" />}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {q.request.request_code} - {q.request.customer.company_name}
                                        </div>
                                    </div>
                                ))}
                        </div>
                    </div>
                </div>
                <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
                    <Button onClick={handleGenerate} disabled={!selectedQuotation}>Buat</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}



export default function PurchaseOrders() {
    const navigate = useNavigate();
    const location = useLocation();
    const { userId, userRole, canManage, loading: permLoading } = usePermission("purchase_orders");
    const [activeTab, setActiveTab] = useState("po-out");
    const [searchQuery, setSearchQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [groupedPOs, setGroupedPOs] = useState<any[]>([]);

    const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isError, setIsError] = useState(false);
    const [isPOInError, setIsPOInError] = useState(false);

    // Detail View State
    const [selectedGroup, setSelectedGroup] = useState<any | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);

    // Print State
    const [isPrintOpen, setIsPrintOpen] = useState(false);
    const [printPO, setPrintPO] = useState<PO | null>(null);

    // PO In State
    const [viewPOIn, setViewPOIn] = useState<any | null>(null);
    const [isEditPOInOpen, setIsEditPOInOpen] = useState(false);
    const [poInList, setPOInList] = useState<any[]>([]); // New State for PO In List

    // Filter State (from navigation)
    const [activeFilterIds, setActiveFilterIds] = useState<string[] | null>(null);

    // Transactional Attachment State
    const [pendingUploads, setPendingUploads] = useState<File[]>([]);
    const [pendingDeletes, setPendingDeletes] = useState<string[]>([]);

    // PO In Selection State
    const [selectedPOInIds, setSelectedPOInIds] = useState<string[]>([]);

    // Filters
    const [dateRange, setDateRange] = useState<DateRange | undefined>();
    const [vendors, setVendors] = useState<any[]>([]);
    const [customers, setCustomers] = useState<any[]>([]);
    const [selectedVendorFilter, setSelectedVendorFilter] = useState<string>("all");
    const [selectedCustomerFilter, setSelectedCustomerFilter] = useState<string>("all");
    const [openVendorCombobox, setOpenVendorCombobox] = useState(false);
    const [openCustomerCombobox, setOpenCustomerCombobox] = useState(false);

    // UI State for Detail View Expansion
    const [expandedVendorIds, setExpandedVendorIds] = useState<Set<string>>(new Set());
    const toggleVendorExpand = (poId: string) => {
        const newSet = new Set(expandedVendorIds);
        if (newSet.has(poId)) newSet.delete(poId);
        else newSet.add(poId);
        setExpandedVendorIds(newSet);
    };

    // Reset selection when tab changes or data reloads
    // Creator Mapping State (Manual Join Strategy)
    const [creatorMap, setCreatorMap] = useState<Record<string, string>>({});

    useEffect(() => {
        fetchCreators();
        fetchVendors();
        fetchCustomers();
    }, []);

    const fetchVendors = async () => {
        const { data } = await supabase.from("vendors").select("id, company_name").order("company_name");
        if (data) setVendors(data);
    };

    const fetchCustomers = async () => {
        const { data } = await supabase.from("customers").select("id, company_name").order("company_name");
        if (data) setCustomers(data);
    };

    const fetchCreators = async () => {
        const { data } = await supabase.from('team_members').select('user_id, name');
        if (data) {
            const map: Record<string, string> = {};
            data.forEach((m: any) => {
                if (m.user_id && m.name) {
                    map[m.user_id] = m.name;
                }
            });
            setCreatorMap(map);
        }
    };


    const toggleSelectPOIn = (id: string) => {
        setSelectedPOInIds(prev =>
            prev.includes(id) ? [] : [id]
        );
    };

    const handleStatusToggle = async (poIds: string[], currentStatus: string) => {
        const newStatus = currentStatus === 'approved' ? 'pending' : 'approved';
        const toastId = toast.loading("Memperbarui status...");

        try {
            const { error } = await supabase
                .from("purchase_orders")
                .update({ status: newStatus })
                .in("id", poIds);

            if (error) throw error;



            toast.success(`Status diperbarui menjadi ${newStatus}`, { id: toastId });
            fetchPOs();
        } catch (e) {
            console.error(e);
            toast.error("Gagal memperbarui status", { id: toastId });
        }
    };

    useEffect(() => {
        if (permLoading) return; // Wait for permissions

        // If we are navigating with IDs to generate, let handleBulkGenerate handle the fetching
        if (location.state?.selectedQuotationIds) {
            const ids = location.state.selectedQuotationIds;
            // Removed: setActiveFilterIds(ids); so we don't hide other data
            // Pass silent: true optionally if we want to show our own loading state, 
            // but here we want to see the loading.
            handleBulkGenerate(ids);
            window.history.replaceState({}, document.title);
        } else {
            // Otherwise fetch normally
            fetchPOs();
        }
    }, [location.state, userId, userRole, permLoading]);

    // --- AUTO-SYNC: Validated Realtime + Polling Fallback ---
    useEffect(() => {
        // 1. Realtime Listener (Primary)
        const channel = supabase
            .channel('po-auto-sync-v4-robust')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public' },
                async (payload) => {
                    // Filter: Only care about balance_items
                    if (payload.table !== 'balance_items') return;

                    console.log('[AutoSync] Realtime Event:', payload);
                    // toast.info("Realtime: Sinyal Diterima", { duration: 1500, id: 'rt-signal' });

                    // Trigger update via function
                    handleRealtimeUpdate((payload.new as any)?.balance_id || (payload.old as any)?.balance_id, (payload.new as any)?.id);
                }
            )
            .subscribe((status) => {
                if (status === 'CHANNEL_ERROR') {
                    console.error('[AutoSync] Channel Error');
                    // toast.error("Realtime Disconnected. Polling active."); 
                }
            });

        // 2. Polling Fallback (Secondary)
        // Checks every 10 seconds for NEW items created since last check
        const lastCheckedRef = { current: new Date().toISOString() };

        const pollingInterval = setInterval(async () => {
            // Only look for items created strictly AFTER our last check
            // This prevents reprocessing the same "recent" items repeatedly for 5 minutes
            const lastCheck = lastCheckedRef.current;
            const currentTime = new Date().toISOString();

            const { data: recentItems } = await (supabase as any)
                .from('balance_items')
                .select('id, balance_id, created_at')
                .gt('created_at', lastCheck)
                .order('created_at', { ascending: false })
                .limit(5);

            // Update last check time immediately to avoid race conditions/double processing
            lastCheckedRef.current = currentTime;

            if (recentItems && recentItems.length > 0) {
                // console.log(`[AutoSync] Found ${recentItems.length} new items since ${lastCheck}`);
                for (const item of recentItems) {
                    handleRealtimeUpdate(item.balance_id, item.id, true);
                }
            }
        }, 10000); // Relaxed interval to 10s

        return () => {
            supabase.removeChannel(channel);
            clearInterval(pollingInterval);
        };
    }, []);

    // Helper to process updates (deduplicated)
    const processingRef = useRef<Set<string>>(new Set());
    const handleRealtimeUpdate = async (balanceId: string, itemId: string, isPolling = false) => {
        // Basic deduplication
        const key = `${balanceId}-${itemId}-${Math.floor(Date.now() / 5000)}`; // 5s wide dedupe window
        if (processingRef.current.has(key)) return;
        processingRef.current.add(key);

        if (!balanceId && itemId) {
            const { data: item } = await supabase.from('balance_items').select('balance_id').eq('id', itemId).single();
            if (item) balanceId = item.balance_id;
        }

        if (!balanceId) return;

        if (isPolling) {
            // console.log("[AutoSync] Polling Triggered Update");
        }

        const { data: links } = await supabase.from('quotation_balances').select('quotation_id').eq('balance_id', balanceId);
        if (links && links.length > 0) {
            const targetQuotationIds = links.map(l => l.quotation_id);
            await handleBulkGenerate(targetQuotationIds, { silent: true });
        } else {
            // console.warn(`[AutoSync] No quotations linked to balance ${balanceId}`);
        }
    };

    // Update selectedGroup when groupedPOs changes (e.g. after refresh)
    useEffect(() => {
        if (selectedGroup && groupedPOs.length > 0) {
            const updatedGroup = groupedPOs.find(g => g.id === selectedGroup.id);
            if (updatedGroup) {
                // Preserve the "Enriched" data (DP, Discount) from the currently selected group
                // because groupedPOs comes from raw DB fetch and doesn't have the merged settings.
                const mergedPOs = updatedGroup.pos.map((newPO: any) => {
                    const existingPO = selectedGroup.pos.find((p: any) => p.id === newPO.id);
                    if (existingPO) {
                        return {
                            ...newPO,
                            discount: existingPO.discount,
                            dp_percentage: existingPO.dp_percentage,
                            dp_amount: existingPO.dp_amount,
                            payment_terms: existingPO.payment_terms
                        };
                    }
                    return newPO;
                });

                setSelectedGroup({ ...updatedGroup, pos: mergedPOs });
            }
        }
    }, [groupedPOs]);

    useEffect(() => {
        if (permLoading) return;

        // Always reset selection when tab changes to avoid state leakage
        setSelectedPOInIds([]);

        if (activeTab === "po-in") {
            fetchPOInList();
        } else {
            // For PO Out (default)
            fetchPOs();
        }
    }, [activeTab, permLoading]);


    // Fetch PO In List (Deep Fetch)
    // Fetch PO In List (Deep Fetch) from po_ins
    const fetchPOInList = async () => {
        setIsLoading(true);
        setIsPOInError(false);
        try {
            let query = (supabase as any).from("po_ins")
                .select(`
    *,
    attachments: po_in_attachments(id, file_name, file_path),
        internal_letter: internal_letters(id, internal_letter_number, created_by),
            quotations: quotations(
                id,
                quotation_number,
                created_at,
                balance_link: quotation_balances(
                    entry_id,
                    balance: balances(
                        created_at,
                        balance_entries
                    )
                ),
                request: requests(
                    id,
                    request_code,
                    letter_number,
                    customer: customers(id, company_name),
                    customer_pic: customer_pics(name),
                    title,
                    created_at,
                    customer_attachments: request_attachments(file_name, file_path)
                ),
                po_links: purchase_order_quotations(
                    purchase_order: purchase_orders(
                        status
                    )
                )
            )
            creator:team_members(name)
        `);

            if (userRole !== "super_admin" && userRole !== "pimpinan" && userId) {
                query = query.eq("created_by", userId);
            }

            const { data, error } = await query
                .order('created_at', { ascending: false });

            if (error || (data as any)?.error) {
                toast.error("gagal mengambil pesanan masuk");
                setIsPOInError(true);
            } else {
                setPOInList(data || []);
            }
        } catch (err) {
            console.error(err);
            setIsPOInError(true);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddInternalLetter = async () => {
        if (selectedPOInIds.length === 0) return;

        let createdCount = 0;
        try {
            for (const poId of selectedPOInIds) {
                // Check if already exists to prevent duplicates
                const { count } = await (supabase as any).from("internal_letters").select("id", { count: 'exact', head: true }).eq("po_in_id", poId);
                if (count && count > 0) {
                    console.log(`Skipping PO ${poId}, already has letter`);
                    continue;
                }

                // Check uniqueness loop
                let isUnique = false;
                let newCode = "";
                while (!isUnique) {
                    const random = Math.floor(100000 + Math.random() * 900000);
                    newCode = `In - ${random} `;
                    const { data } = await (supabase as any).from("internal_letters").select("id").eq("internal_letter_number", newCode).maybeSingle();
                    if (!data) isUnique = true;
                }

                const { error } = await (supabase as any).from("internal_letters").insert({
                    po_in_id: poId,
                    internal_letter_number: newCode
                });

                if (error) {
                    console.error("Error creating letter", error);
                    toast.error(`Error creating letter: ${error.message} `);
                } else {
                    createdCount++;
                }
            }

            if (createdCount > 0) {
                toast.success(`Berhasil membuat ${createdCount} Surat Internal baru`);
                setSelectedPOInIds([]); // Reset selection
                navigate("/internal-letters");
            }
        } catch (error: any) {
            console.error("Error adding internal letter:", error);
            toast.error("Gagal membuat surat internal");
        }
    };

    useEffect(() => {
        if (activeTab === "po-in") {
            fetchPOInList();
        }
    }, [activeTab]);

    const generatePONumber = async () => {
        // Fetch company abbreviation
        const { data: company } = await supabase.from("company").select("abbreviation").maybeSingle();
        const abbreviation = company?.abbreviation || "XXX";

        // Get current month.year
        const now = new Date();
        const monthYear = `${String(now.getMonth() + 1).padStart(2, "0")}.${now.getFullYear()} `;

        let isUnique = false;
        let newCode = "";
        while (!isUnique) {
            // Generate 6-char alphanumeric string
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            let randomStr = '';
            for (let i = 0; i < 6; i++) {
                randomStr += chars.charAt(Math.floor(Math.random() * chars.length));
            }

            newCode = `PO / ${randomStr} /${abbreviation}/${monthYear} `;

            const { data } = await (supabase as any).from("purchase_orders").select("id").eq("po_number", newCode).maybeSingle();
            if (!data) isUnique = true;
        }
        return newCode;
    };

    // Fetch POs
    const fetchPOs = async (silent: boolean = false) => {
        if (!silent) setIsLoading(true);
        setIsError(false);
        try {
            let query = (supabase as any).from("purchase_orders")
                .select(`
    *,
    payment_term,
    notes,
    franco,
    delivery_time,
    notes,
    franco,
    delivery_time,
    status,
    transfer_proof_url,
    transfer_proof_date,
    vendor: vendors(company_name, office_address, id),
        vendor_pic: vendor_pics(name),
            attachments: purchase_order_attachments(file_name, file_path),
                quotations: purchase_order_quotations(
                    quotation: quotations(
                        id,
                        quotation_number,
                        created_at,
                        po_in: po_ins(
                            id,
                            status,
                            is_completed,
                            internal_letters(id)
                        ),
                        balance_link: quotation_balances(
                            balance_id,
                            entry_id,
                            balance: balances(
                                id,
                                created_at,
                                balance_entries
                            )
                        ),
                        request: requests(
                            request_code,
                            letter_number,
                            created_at,
                            customer: customers(id, company_name),
                            customer_pic: customer_pics(name),
                            customer_attachments: request_attachments(file_name, file_path),
                            title
                        )
                    )
                )
                )
                ),
                creator:team_members(name)
                ` as any);

            // Apply Granular RBAC: If not super_admin or pimpinan, filter by own POs
            if (userRole !== "super_admin" && userRole !== "pimpinan" && userId) {
                query = query.eq("created_by", userId);
            }

            const { data, error } = await query
                // .neq('type', 'IN') // REMOVED: Table should be clean now, and strict filtering might be risky if type is null
                .order('created_at', { ascending: false });

            if (error || !data) {
                console.error("Fetch Error:", error || "No data returned");
                toast.error("gagal mengambil data pesanan keluar");
                setIsError(true);
            } else {
                console.log("Fetch Success. PO Out Rows:", data?.length);
                if (silent) {
                    // toast.success("List Updated", { id: 'list-updated', duration: 1000 }); // Too noisy
                }
            }


            // Transform data
            let mappedPOs: PO[] = [];
            let groups: Record<string, any> = {}; // Defined here to be accessible throughout
            try {
                mappedPOs = (data || []).map((po: any) => {
                    const snapshot = po.vendor_snapshot;
                    const vendorData = snapshot?.vendor || po.vendor || {};
                    const picData = snapshot?.pic || po.vendor_pic || { name: "-" };

                    return {
                        id: po.id,
                        creator: po.creator,
                        po_number: po.po_number,
                        created_at: po.created_at,
                        created_by: po.created_by,
                        vendor: {
                            ...vendorData,
                            address: vendorData.office_address || vendorData.address
                        },
                        vendor_id: po.vendor_id!,
                        vendor_pic_id: po.vendor_pic_id,
                        vendor_logo: vendorData.logo || po.vendor?.logo,
                        vendor_address: vendorData.office_address || vendorData.address,
                        vendor_pic: picData,
                        vendor_letter_number: po.vendor_letter_number,
                        vendor_letter_date: po.vendor_letter_date,
                        subject: po.subject,
                        discount: po.discount,
                        ppn: po.ppn,
                        notes: po.notes,
                        franco: po.franco,
                        delivery_time: po.delivery_time,
                        payment_term: po.payment_term,
                        status: po.status || 'pending',
                        transfer_proof_url: po.transfer_proof_url,
                        transfer_proof_date: po.transfer_proof_date,
                        quotations: (po.quotations || []).map((pq: any) => {
                            // Check if any PO In related to this quotation has an Internal Letter
                            const hasInternalLetter = pq.quotation?.po_in?.some((pi: any) => pi.internal_letters && pi.internal_letters.length > 0);

                            // Check completion status
                            const isCompleted = pq.quotation?.po_in?.some((pi: any) => pi.is_completed);

                            return {
                                id: pq.quotation?.id,
                                quotation_number: pq.quotation?.quotation_number,
                                created_at: pq.quotation?.created_at,
                                po_in_link: hasInternalLetter, // Renaming variable conceptually in logic, but keeping name 'po_in_link' to avoid breaking UI strictly, or better rename it.
                                // Let's keep 'po_in_link' name but change semantics to "has processed letter".
                                completed: isCompleted,
                                request: {
                                    ...(pq.quotation?.request || {}),
                                    request_date: pq.quotation?.request?.created_at,
                                    attachments: pq.quotation?.request?.customer_attachments || []
                                },
                                balance_link: pq.quotation?.balance_link
                            };
                        }),
                        attachments: po.attachments || []
                    };
                });


                // Extract IDs for lookup
                const allVendorIds = Array.from(new Set(mappedPOs.map(p => p.vendor_id))).filter((id: any) => typeof id === 'string' && id.length > 0);
                const allBalanceIds = Array.from(new Set(mappedPOs.flatMap(p =>
                    p.quotations.flatMap(q => {
                        const links = Array.isArray(q.balance_link) ? q.balance_link : (q.balance_link ? [q.balance_link] : []);
                        return links.map((l: any) => l.balance_id || l.balance?.id);
                    })
                ).filter((id: any) => typeof id === 'string' && id.length > 0)));

                // Fetch mapping: Which vendor belongs to which balance?
                let vendorBalanceMap: Record<string, any[]> = {}; // vendorId -> detailedItem[]

                if (allBalanceIds.length > 0 && allVendorIds.length > 0) {
                    const { data: bItems } = await supabase
                        .from("balance_items")
                        .select("vendor_id, balance_id, offering_letter_number, offering_date")
                        .in("balance_id", allBalanceIds)
                        .in("vendor_id", allVendorIds);

                    if (bItems) {
                        bItems.forEach((item: any) => {
                            if (!vendorBalanceMap[item.vendor_id]) vendorBalanceMap[item.vendor_id] = [];
                            // Store detailed item info for matching
                            vendorBalanceMap[item.vendor_id].push({
                                balance_id: item.balance_id,
                                offering_letter_number: item.offering_letter_number,
                                offering_date: item.offering_date
                            });
                        });

                        // OVERLAY LIVE DATA: Mutate mappedPOs with live data from Balance Items (Ref No, Date)
                        mappedPOs.forEach((po: PO) => {
                            const details = vendorBalanceMap[po.vendor_id] || [];
                            const linkedBalanceIds = po.quotations.flatMap(q => {
                                const links = Array.isArray(q.balance_link) ? q.balance_link : (q.balance_link ? [q.balance_link] : []);
                                return links.map((l: any) => l.balance_id || l.balance?.id);
                            });

                            // We try to find a match.
                            const match = details.find(d => linkedBalanceIds.includes(d.balance_id));

                            if (match) {
                                po.vendor_letter_number = match.offering_letter_number;
                                po.vendor_letter_date = match.offering_date;
                            }
                        });
                    }
                }

                // Helper to resolve specific code for a PO
                const resolvePOBalanceCode = (po: PO, quotation: any) => {
                    if (!quotation) return ["-"];
                    const linkedBalances = Array.isArray(quotation.balance_link) ? quotation.balance_link : (quotation.balance_link ? [quotation.balance_link] : []);

                    // Get potential balance IDs for this vendor
                    const potentialItems = vendorBalanceMap[po.vendor_id] || [];

                    // Filter by strictly matching offering details if available
                    let matchedBalanceIds: string[] = [];

                    const normalize = (val: any) => val || "-";
                    const poLetter = normalize(po.vendor_letter_number);
                    const poDate = normalize(po.vendor_letter_date); // yyyy-MM-dd

                    // 0. Priority: Check Subject line for explicit Balance Code
                    if (po.subject) {
                        const subjectMatch = linkedBalances.filter((l: any) => {
                            const codes = l.balance?.balance_entries?.map((e: any) => e.code) || [];
                            return codes.some((c: string) => po.subject.includes(c));
                        }).map((l: any) => l.balance_id || l.balance?.id);

                        if (subjectMatch.length > 0) {
                            matchedBalanceIds = subjectMatch;
                        }
                    }

                    // 1. Check Letter Number
                    if (matchedBalanceIds.length === 0 && poLetter !== "-") {
                        const letterMatches = potentialItems.filter((i: any) => normalize(i.offering_letter_number) === poLetter);
                        if (letterMatches.length > 0) {
                            matchedBalanceIds = letterMatches.map((i: any) => i.balance_id);
                        }
                    }

                    // If letter matching didn't yield result (or failed), try Date
                    if (matchedBalanceIds.length === 0 && poDate !== "-") {
                        // formatting might differ. Item is ISO? PO is yyyy-MM-dd?
                        // Let's assume item.offering_date is a TS string, format it.
                        const dateMatches = potentialItems.filter((i: any) => {
                            const itemDate = i.offering_date ? format(new Date(i.offering_date), 'yyyy-MM-dd') : "-";
                            return itemDate === poDate;
                        });
                        if (dateMatches.length > 0) {
                            matchedBalanceIds = dateMatches.map((i: any) => i.balance_id);
                        }
                    }

                    // Fallback: if no exact match, try to intersect with the quotation's linked balances based on Vendor ONLY.
                    // If Vendor exists in only ONE of the linked balances, we are golden.
                    if (matchedBalanceIds.length === 0) {
                        // Check which linked balances imply this vendor
                        const balancesWithActor = new Set(potentialItems.map((i: any) => i.balance_id));
                        const intersection = linkedBalances
                            .map((l: any) => l.balance_id || l.balance?.id)
                            .filter((id: string) => balancesWithActor.has(id));

                        if (intersection.length === 1) {
                            matchedBalanceIds = [intersection[0]];
                        } else {
                            matchedBalanceIds = intersection;
                        }
                    }

                    // Intersect with quotation's linked balances to be safe
                    const finalResults = new Set<string>();
                    const qLinkedIds = linkedBalances.map((l: any) => l.balance_id || l.balance?.id);

                    (matchedBalanceIds.length > 0 ? matchedBalanceIds : qLinkedIds).forEach(id => {
                        if (qLinkedIds.includes(id)) finalResults.add(id);
                    });

                    // Map to codes
                    const codes = Array.from(finalResults).flatMap(bId => {
                        // Need to look up code for this balance ID.
                        // We don't have direct map here efficiently, but we can browse existing `linkedBalances` 
                        // because `linkedBalances` has the deep structure.
                        const link = linkedBalances.find((l: any) => (l.balance_id || l.balance?.id) === bId);
                        return link?.balance?.balance_entries?.map((e: any) => e.code) || [];
                    });

                    const uniqueCodes = Array.from(new Set(codes));

                    // FINAL STRICT FILTER: If the Subject contains a specific code, restrict 
                    // the result strictly to that code, ignoring siblings in the same Balance ID.
                    if (po.subject) {
                        const strictMatches = uniqueCodes.filter((c: any) => po.subject.includes(c));
                        if (strictMatches.length > 0) return strictMatches;
                    }

                    return uniqueCodes.length > 0 ? uniqueCodes : ["-"];
                };

                // Group by Quotation AND Balance Code
                // groups variable is now initialized in outer scope (see below)
                mappedPOs.forEach(po => {
                    const primaryQuotation = po.quotations[0];

                    // Filter out orphaned POs (POs with no linked quotation)
                    // This happens when a quotation is deleted but the PO record remains.
                    if (!primaryQuotation) {
                        console.warn(`[Grouping] PO ${po.po_number || po.id} skipped. Quotations array:`, po.quotations);
                        return;
                    }

                    const balanceCodesArray = resolvePOBalanceCode(po, primaryQuotation);

                    const bestCode = balanceCodesArray[0] || "-";

                    // Find balance date for the best code
                    let balanceDate = null;
                    if (bestCode !== "-") {
                        const links = Array.isArray(primaryQuotation.balance_link) ? primaryQuotation.balance_link : (primaryQuotation.balance_link ? [primaryQuotation.balance_link] : []);
                        const matchingLink = links.find((l: any) =>
                            l.balance?.balance_entries?.some((e: any) => e.code === bestCode)
                        );
                        if (matchingLink?.balance?.created_at) {
                            balanceDate = matchingLink.balance.created_at;
                        }
                    }

                    const groupKey = `${primaryQuotation.id}|${bestCode}`;

                    if (!groups[groupKey]) {
                        groups[groupKey] = {
                            id: groupKey,
                            quotation_number: primaryQuotation.quotation_number,
                            quotation_date: primaryQuotation.created_at,
                            request_code: primaryQuotation.request.request_code,
                            customer_info: {
                                id: primaryQuotation.request.customer?.id,
                                company_name: primaryQuotation.request.customer?.company_name,
                                pic_name: primaryQuotation.request.customer_pic?.name,
                                letter_number: primaryQuotation.request.letter_number,
                                title: primaryQuotation.request.title,
                                date: primaryQuotation.request.request_date,
                                attachments: primaryQuotation.request.attachments
                            },
                            balance_codes: bestCode,
                            balance_date: balanceDate,
                            pos: []
                        };
                    }
                    groups[groupKey].pos.push(po);
                });
                console.log("Groups created:", Object.keys(groups).length);
            } catch (err) {
                console.error("Error grouping POs:", err);
                setIsError(true);
            }

            const sortedGroups = Object.values(groups).sort((a: any, b: any) => {
                return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
            });

            setGroupedPOs(sortedGroups);
        } catch (err) {
            console.error("Error fetching POs:", err);
            toast.error("Failed to fetch POs");
            setIsError(true);
        } finally {
            setIsLoading(false);
        }
    };

    const handleBulkGenerate = async (quotationIds: string[], options: { silent?: boolean } = {}) => {
        const toastId = options.silent ? undefined : toast.loading(`Generating POs for ${quotationIds.length} quotations...`);
        let totalCreated = 0;

        try {
            for (const idStr of quotationIds) {
                const [qId, targetCode] = idStr.includes('|') ? idStr.split('|') : [idStr, null];

                // Fetch quotation details
                const { data: quotation } = await supabase
                    .from("quotations")
                    .select(`
id,
    quotation_number,
    request: requests(
        title,
        request_code,
        letter_number,
        customer: customers(id, company_name),
        customer_pic: customer_pics(name)
    ),
        balance_link: quotation_balances(
            balance_id,
            entry_id,
            balance: balances(
                id,
                balance_entries
            )
        )
            `)
                    .eq("id", qId)
                    .single();

                if (!quotation) continue;



                // 1. Fetch balance items logic
                const links = Array.isArray(quotation.balance_link)
                    ? quotation.balance_link
                    : (quotation.balance_link ? [quotation.balance_link] : []);

                const balanceIds = links.map((l: any) => l.balance_id || l.balance?.id).filter(Boolean);

                // Fetch Vendor Settings for this Quotation (Discount, DP, etc.)
                const { data: vendorSettings } = await (supabase as any)
                    .from("balance_vendor_settings")
                    .select("*")
                    .in("balance_id", balanceIds);

                // --- GLOBAL CLEANUP PHASE ---
                // We perform cleanup here based on ALL linked balances for the quotation.
                // This ensures we don't accidentally delete POs when viewing a specific subset (targetCode).
                // And it ensures cleanup runs even if no *new* items need creating.
                if (balanceIds.length > 0) {
                    const activeVendorIds = new Set<string>();

                    // Group links by balance_id to minimize queries
                    const uniqueBalanceIds = Array.from(new Set(balanceIds));

                    for (const bId of uniqueBalanceIds) {
                        const relevantLinks = links.filter((l: any) => (l.balance_id || l.balance?.id) === bId);
                        const entryIds = relevantLinks.map((l: any) => l.entry_id).filter(Boolean);

                        let query = supabase
                            .from("balance_items")
                            .select("vendor_id")
                            .eq("balance_id", bId);

                        if (entryIds.length > 0) {
                            query = query.in("balance_entry_id", entryIds);
                        }

                        const { data: items } = await query;
                        items?.forEach((i: any) => {
                            if (i.vendor_id) activeVendorIds.add(i.vendor_id);
                        });
                    }

                    // 2. Fetch existing POs for this Quotation
                    const { data: currentPOs } = await (supabase as any)
                        .from("purchase_order_quotations")
                        .select(`
purchase_order_id,
    purchase_orders(
        id,
        vendor_id
    )
        `)
                        .eq("quotation_id", quotation.id);

                    // 3. Identify and Delete Orphans
                    const posToDelete: string[] = [];
                    if (currentPOs) {
                        for (const link of currentPOs) {
                            const poVendorId = link.purchase_orders?.vendor_id;
                            // Only delete if vendor is COMPLETELY missing from valid balances
                            if (poVendorId && !activeVendorIds.has(poVendorId)) {
                                posToDelete.push(link.purchase_order_id);
                            }
                        }
                    }

                    if (posToDelete.length > 0) {
                        // Sequential delete to ensure constraints
                        await (supabase as any).from("purchase_order_quotations").delete().in("purchase_order_id", posToDelete);
                        await (supabase as any).from("purchase_order_attachments").delete().in("purchase_order_id", posToDelete);
                        await (supabase as any).from("purchase_orders").delete().in("id", posToDelete);

                        if (!options.silent) {
                            toast.success(`Cleaned up ${posToDelete.length} obsolete Purchase Order(s)`);
                        } else {
                            // In silent mode (View Detail), we might want to know, but let's keep it subtle or silent.
                            // Maybe just silent is fine as the list will update.
                        }
                    }
                }
                // --- END GLOBAL CLEANUP PHASE ---

                // Fallback fetch if needed
                if (balanceIds.length === 0) {
                    const { data: qbData } = await supabase.from("quotation_balances").select("balance_id").eq("quotation_id", quotation.id);
                    if (qbData) qbData.forEach(b => balanceIds.push(b.balance_id));
                }

                if (balanceIds.length === 0) continue;

                // Filter Balance IDs AND Entry IDs based on targetCode
                let filteredLinks: any[] = links; // Default to all links

                if (targetCode && targetCode !== "-") {
                    filteredLinks = links.filter((l: any) => {
                        const entries = l.balance?.balance_entries || [];
                        return entries.some((e: any) => e.code?.trim() === targetCode.trim());
                    });
                }

                if (filteredLinks.length === 0) continue;

                // Extract unique Balance IDs to iterate
                const filteredBalanceIds = Array.from(new Set(filteredLinks.map((l: any) => l.balance_id || l.balance?.id)));

                // 2. Fetch items
                // 3. Loop per Balance to ensure strict separation
                // We fetch codes for balanceIds to use in Subject
                const { data: bData } = await (supabase as any).from("balances").select("id, balance_entries").in("id", filteredBalanceIds);
                const balanceCodeMap: Record<string, string> = {};
                bData?.forEach((b: any) => {
                    const codes = b.balance_entries?.map((e: any) => e.code).join(", ");
                    balanceCodeMap[b.id] = codes;
                });

                const validVendorIdsForCleanup = new Set<string>();

                for (const balanceId of filteredBalanceIds) {
                    // Use targetCode if specific selection was made, otherwise fallback to all codes for the balance
                    const balanceCode = (targetCode && targetCode !== "-")
                        ? targetCode
                        : (balanceCodeMap[balanceId] || "-");

                    // IDENTIFY TARGET ENTRY IDs for this Balance + Target Code
                    // This is crucial: N-1 and N-2 might be in the same Balance ID, but have different Entry IDs.
                    // We must only fetch items belonging to the selected Entry IDs.
                    const relevantLinks = filteredLinks.filter((l: any) => (l.balance_id || l.balance?.id) === balanceId);
                    const targetEntryIds = relevantLinks.map((l: any) => l.entry_id).filter(Boolean);

                    // Fetch items strictly for this balance AND entry IDs
                    let query = supabase
                        .from("balance_items")
                        .select(`*, vendor: vendors(*)`)
                        .eq("balance_id", balanceId);

                    if (targetEntryIds.length > 0) {
                        query = query.in("balance_entry_id", targetEntryIds);
                    } else {
                        // FIX: If no specific entries linked, assume "Whole Balance".
                        // Previously forced empty, which caused "Add Item" to fail if link used null entry_id.
                        // console.log(`[AutoSync] Balance ${balanceId}: No specific Entry IDs - Fetching ALL items`);
                    }
                    const { data: items, error: itemsError } = await query;

                    if (itemsError) console.error(`[AutoSync] Error fetching items for Balance ${balanceId}:`, itemsError);
                    if (!items) console.warn(`[AutoSync] No data returned for Balance ${balanceId}`);

                    if (!items || items.length === 0) {
                        toast.error("Item belum terisi (Purchase Order batal dibuat)");
                        continue;
                    }



                    // Group by Vendor
                    const vendorGroups: Record<string, any[]> = {};
                    items.forEach((item: any) => {
                        const vId = item.vendor_id || "null"; // Handle missing vendor
                        if (!vendorGroups[vId]) vendorGroups[vId] = [];
                        vendorGroups[vId].push(item);
                    });

                    // DEBUG: Log found vendors
                    const vendorIds = Object.keys(vendorGroups);
                    console.log(`[AutoSync] Balance ${balanceId} - Found Vendors:`, vendorIds, "Items:", items.length);

                    // Add valid vendor IDs to cleanup list, INCLUDING "null" placeholder to preserve Draft POs
                    vendorIds.forEach(v => {
                        validVendorIdsForCleanup.add(v); // v matches key format (string or "null")
                    });



                    // CHECK FOR EXISTING POs for this Quotation + Vendor
                    const { data: existingPOs } = await (supabase as any)
                        .from("purchase_order_quotations")
                        .select(`
purchase_orders(
    id,
    vendor_id
)
    `)
                        .eq("quotation_id", quotation.id);

                    const existingVendorIds = new Set(
                        existingPOs?.map((p: any) => p.purchase_orders?.vendor_id).filter(Boolean) || []
                    );

                    // Create POs
                    for (const vIdKey of vendorIds) {
                        const realVendorId = vIdKey === "null" ? null : vIdKey;


                        // Find Vendor Settings
                        const settings = vendorSettings?.find((s: any) => s.vendor_id === realVendorId);

                        const discount = settings?.discount || 0;
                        const dpPercentage = settings?.dp_percentage || 0;
                        const dpAmount = settings?.dp_amount || 0;
                        const paymentTerms = settings?.payment_terms || null;

                        if (realVendorId && existingVendorIds.has(realVendorId)) {
                            // console.log(`[AutoSync] Vendor ${realVendorId} exists, updating settings...`);
                            // Update existing PO with latest settings
                            const existingPO = existingPOs?.find((p: any) => p.purchase_orders?.vendor_id === realVendorId);


                            if (existingPO?.purchase_orders?.id) {
                                await (supabase as any).from("purchase_orders").update({
                                    discount,
                                    dp_percentage: dpPercentage,
                                    dp_amount: dpAmount,
                                    payment_terms: paymentTerms
                                }).eq("id", existingPO.purchase_orders.id);
                            }
                            continue;
                        }

                        // Check if "Null Vendor" PO exists?
                        if (!realVendorId) {
                            const nullVendorPOs = existingPOs?.filter((p: any) => !p.purchase_orders?.vendor_id);
                            if (nullVendorPOs && nullVendorPOs.length > 0) continue; // Skip if draft PO already exists
                        }

                        const groupItems = vendorGroups[vIdKey];
                        const firstItem = groupItems[0];
                        const offeringLetter = firstItem.offering_letter_number || "-";
                        const offeringDate = firstItem.offering_date || new Date().toISOString();

                        const allPaths = groupItems
                            .map((i: any) => i.document_path)
                            .filter(Boolean)
                            .flatMap((p: string) => p.split(','));
                        const uniquePaths = Array.from(new Set(allPaths));

                        const poNumber = await generatePONumber();

                        let picId = null;
                        if (realVendorId) {
                            const { data: pics } = await supabase.from("vendor_pics").select("id").eq("vendor_id", realVendorId).limit(1);
                            picId = pics?.[0]?.id;
                        }

                        const { data: po, error } = await (supabase as any).from("purchase_orders").insert({
                            type: 'OUT',
                            po_number: poNumber,
                            vendor_id: realVendorId, // Can be null
                            vendor_pic_id: picId || null,
                            vendor_letter_number: offeringLetter,
                            vendor_letter_date: format(new Date(offeringDate), 'yyyy-MM-dd'),
                            subject: `PO for ${quotation.request.request_code} - ${balanceCode}`,
                            status: 'pending',
                            discount,
                            dp_percentage: dpPercentage,
                            dp_amount: dpAmount,
                            payment_terms: paymentTerms
                        }).select().single();

                        if (error) {
                            console.error("Error creating PO", error);
                            continue;
                        }

                        totalCreated++;

                        await (supabase as any).from("purchase_order_quotations").insert({
                            purchase_order_id: po.id,
                            quotation_id: quotation.id
                        });

                        for (const path of uniquePaths) {
                            const fileName = (path as string).split('/').pop() || "attachment";
                            await (supabase as any).from("purchase_order_attachments").insert({
                                purchase_order_id: po.id,
                                file_name: fileName,
                                file_path: path,
                                file_size: 0
                            });
                        }
                    }
                }

                // --- CLEANUP PHASE (Moved After Loop) ---
                // Delete POs that are no longer valid (e.g. vendor removed from balance)
                // We scope this to the current view (targetCode) to avoid modifying other parts of the quotation
                if (validVendorIdsForCleanup && validVendorIdsForCleanup.size >= 0) { // Always run, even if empty (means delete all)
                    const { data: currentPOs } = await (supabase as any)
                        .from("purchase_order_quotations")
                        .select(`
                            purchase_orders(
        id,
        vendor_id,
        subject,
        type
    )
                        `)
                        .eq("quotation_id", quotation.id);

                    const candidates = currentPOs
                        ?.map((p: any) => p.purchase_orders)
                        .filter((po: any) => po && po.type === 'OUT') // Only clean up OUT POs
                        .filter((po: any) => {
                            // Scoped Check: Only consider POs that match our targetCode (if set)
                            if (targetCode && targetCode !== "-") {
                                return po.subject?.includes(targetCode);
                            }
                            return true;
                        }) || [];

                    const orphans = candidates.filter((po: any) => {
                        const checkId = po.vendor_id || "null"; // Normalize DB null to "null" string to match Set
                        return !validVendorIdsForCleanup.has(checkId);
                    });

                    if (orphans.length > 0) {
                        const orphanIds = orphans.map((po: any) => po.id);
                        await (supabase as any).from("purchase_order_quotations").delete().in("purchase_order_id", orphanIds);
                        await (supabase as any).from("purchase_order_attachments").delete().in("purchase_order_id", orphanIds);
                        await (supabase as any).from("purchase_orders").delete().in("id", orphanIds);

                        // if (!options.silent) toast.success(`Cleaned up ${ orphans.length } obsolete POs.`);
                    }
                }

                // --- PO IN GENERATION ---
                // Create ONE PO In for the Customer if it doesn't exist
                const customerId = quotation.request?.customer?.id;
                if (customerId && validVendorIdsForCleanup.size > 0) {
                    try {
                        const { data: existingPOIn } = await (supabase as any)
                            .from("po_ins")
                            .select("id")
                            .eq("quotation_id", quotation.id);

                        const hasPOIn = existingPOIn && existingPOIn.length > 0;

                        if (!hasPOIn) {
                            // Decoupling: Always create standard PO In (No Auto-DP)
                            const invoiceType = 'FULL';
                            const subject = "-";

                            // Create in po_ins table with Draft Status (No Invoice Number yet)
                            const { data: poIn, error: poInError } = await (supabase as any).from("po_ins").insert({
                                quotation_id: quotation.id,
                                subject: subject,
                                invoice_type: invoiceType,
                                vendor_letter_number: null,
                                vendor_letter_date: null,
                                invoice_number: null, // Draft Mode
                                invoice_date: null,
                                sequence_number: 0
                            }).select().single();

                            if (!poInError && poIn) {
                                // No need to link purchase_order_quotations since po_ins has quotation_id DIRECTLY
                                totalCreated++; // Count this as a created PO (conceptually)
                                if (!options.silent) toast.success("Generated PO In Draft for Customer");
                            } else {
                                console.error("Failed to create PO In", poInError);
                                // Don't throw here, just log. This allows PO OUT to remain valid.
                                if (!options.silent) toast.error("Gagal membuat PO In (Draft Tagihan)", { description: poInError?.message });
                            }
                        }
                    } catch (poInErr) {
                        console.error("Critical Error creating PO In:", poInErr);
                        if (!options.silent) toast.error("Gagal membuat PO In (Draft Tagihan)", { description: "Server Error / Validation Error" });
                    }
                }
                // --- END PO IN GENERATION ---
            }

            if (!options.silent) {
                toast.success(`Selesai memproses ${quotationIds.length} Quotation(s)!`, { id: toastId });
            }

            // Clear the state so we don't re-run this logic on refresh
            navigate(location.pathname, { replace: true, state: {} });

        } catch (e) {
            console.error("Bulk Generate Error:", e);
            if (!options.silent) toast.error("Gagal memproses Purchase Order", { id: toastId });
        } finally {
            // ALWAYS refresh UI, even if generation had partial errors
            fetchPOs(options.silent);
        }
    };


    const getBalanceCodes = (quotation: any) => {
        const links = Array.isArray(quotation.balance_link) ? quotation.balance_link : (quotation.balance_link ? [quotation.balance_link] : []);
        const codes = links.flatMap((l: any) =>
            l.balance?.balance_entries?.map((e: any) => e.code) || []
        ).join(", ");
        return codes || "-";
    };

    const getStorageUrl = (path: string, bucket: string) => {
        return `${import.meta.env.VITE_SUPABASE_URL} /storage/v1 / object / public / ${bucket}/${path}`;
    };

    const handleView = async (group: any) => {
        // Reset expand state
        setExpandedVendorIds(new Set());

        let updatedPOs = [...group.pos];

        // We need to fetch settings to display DP/Full labels correctly
        // 1. Collect Balance IDs linked to these POs
        const balanceIds = new Set<string>();
        group.pos.forEach((po: any) => {
            po.quotations?.forEach((q: any) => {
                const links = Array.isArray(q.balance_link) ? q.balance_link : (q.balance_link ? [q.balance_link] : []);
                links.forEach((l: any) => {
                    const bId = l.balance_id || l.balance?.id;
                    if (bId) balanceIds.add(bId);
                });
            });
        });

        // 2. Fetch Settings if we have balance IDs
        if (balanceIds.size > 0) {
            const { data } = await supabase
                .from("balance_vendor_settings")
                .select("*")
                .in("balance_id", Array.from(balanceIds));

            const vendorSettings = data || [];

            // 3. Merge Settings into POs for display
            updatedPOs = group.pos.map((po: any) => {
                // Find applicable setting
                const settings = vendorSettings.find((s: any) => s.vendor_id === po.vendor_id);

                if (settings) {
                    return {
                        ...po,
                        discount: settings.discount ?? po.discount,
                        dp_percentage: settings.dp_percentage ?? po.dp_percentage,
                        dp_amount: settings.dp_amount ?? po.dp_amount,
                        payment_terms: settings.payment_terms ?? po.payment_terms
                    };
                }
                return po;
            });
        }

        setSelectedGroup({ ...group, pos: updatedPOs });
        setIsDetailOpen(true);

        // Auto-sync on View: Check if any new vendors need POs
        if (group.id && group.id !== 'manual') {
            handleBulkGenerate([group.id], { silent: true });
        }
    };

    const [invoiceType, setInvoiceType] = useState<string>("");

    const handlePrint = (po: PO, type: string = "") => {
        setPrintPO(po);
        setInvoiceType(type);
        setIsPrintOpen(true);
    };

    const handleDeleteGroup = async (group: any) => {
        const poIds = group.pos.map((p: any) => p.id);
        if (poIds.length === 0) return;

        // Extract Quotation ID to delete linked PO In
        const quotationId = group.pos[0]?.quotations?.[0]?.id;

        try {
            // 1. Delete PO Out related data
            // Delete purchase_order_quotations
            await (supabase as any).from("purchase_order_quotations").delete().in("purchase_order_id", poIds);
            // Delete purchase_order_attachments
            await (supabase as any).from("purchase_order_attachments").delete().in("purchase_order_id", poIds);

            // Delete POs
            const { error } = await (supabase as any).from("purchase_orders").delete().in("id", poIds);
            if (error) throw error;

            // 2. Cascading Delete for PO In (if linked to same Quotation)
            if (quotationId) {
                // Find PO In linked to this quotation
                const { data: poIns } = await (supabase as any).from("po_ins").select("id").eq("quotation_id", quotationId);

                if (poIns && poIns.length > 0) {
                    const poInIds = poIns.map((p: any) => p.id);

                    // Delete Internal Letters linked to these PO Ins
                    await (supabase as any).from("internal_letters").delete().in("po_in_id", poInIds);

                    // Delete PO In Attachments
                    await (supabase as any).from("po_in_attachments").delete().in("po_in_id", poInIds);

                    // Delete PO Ins
                    const { error: poInError } = await (supabase as any).from("po_ins").delete().in("id", poInIds);

                    if (poInError) {
                        console.error("Error deleting PO In cascade:", poInError);
                    } else {
                        console.log("Cascaded delete to PO In:", poInIds);
                    }
                }
            }

            toast.success("Purchase Orders Deleted");
            fetchPOs();
        } catch (error) {
            console.error(error);
            toast.error("Failed to delete POs");
        }
    };

    // Filter Logic Extracted for Debugging
    const filteredGroups = groupedPOs
        .filter(group => {
            // 1. Navigation Filter
            let matchesFilter = true;
            if (activeFilterIds) {
                matchesFilter = activeFilterIds.some(id => {
                    const cleanId = id.split('|')[0];
                    const cleanGroupId = group.id.split('|')[0];
                    const match = cleanGroupId === cleanId;
                    if (!match) {
                        // console.log(`[FilterMismatch] Filter: ${cleanId} vs Group: ${cleanGroupId} (${group.id})`);
                    }
                    return match;
                });
            }

            // 2. Search Query Filter
            let matchesSearch = true;
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                const qNumber = group.quotation_number?.toLowerCase() || "";
                const rCode = group.request_code?.toLowerCase() || "";
                const bCode = group.balance_codes?.toLowerCase() || "";
                const cName = group.customer_info?.company_name?.toLowerCase() || "";
                const cPic = group.customer_info?.pic_name?.toLowerCase() || "";
                const cTitle = group.customer_info?.title?.toLowerCase() || "";

                matchesSearch = (
                    qNumber.includes(query) ||
                    rCode.includes(query) ||
                    bCode.includes(query) ||
                    cName.includes(query) ||
                    cPic.includes(query) ||
                    cTitle.includes(query)
                );
            }


            // Date Filter
            if (dateRange?.from) {
                const groupDate = group.created_at ? new Date(group.created_at) : (group.pos[0]?.created_at ? new Date(group.pos[0].created_at) : null);
                if (groupDate) {
                    if (dateRange.to) {
                        if (!isWithinInterval(groupDate, { start: startOfDay(dateRange.from), end: endOfDay(dateRange.to) })) matchesFilter = false;
                    } else {
                        if (format(groupDate, 'yyyy-MM-dd') !== format(dateRange.from, 'yyyy-MM-dd')) matchesFilter = false;
                    }
                }
            }

            // Customer Filter (formerly Vendor Filter)
            if (selectedCustomerFilter !== "all") {
                const custId = group.customer_info?.id;
                if (custId !== selectedCustomerFilter) matchesFilter = false;
            }

            return matchesFilter && matchesSearch;
        })
    const totalPages = Math.ceil(filteredGroups.length / itemsPerPage);
    const displayGroups = filteredGroups.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // Filter PO In List
    const filteredPOInList = poInList
        .filter(po => {
            if (!searchQuery) return true;
            const query = searchQuery.toLowerCase();
            const subject = po.subject?.toLowerCase() || "";
            const vendorLetter = po.vendor_letter_number?.toLowerCase() || "";
            const customer = po.quotations?.request?.customer?.company_name?.toLowerCase() || "";
            const requestCode = po.quotations?.request?.request_code?.toLowerCase() || "";
            return (
                subject.includes(query) ||
                vendorLetter.includes(query) ||
                customer.includes(query) ||
                requestCode.includes(query)
            );

        });

    // PO In Date & Customer Filter applied to filteredPOInList
    const finalFilteredPOInList = filteredPOInList.filter(po => {
        // Date Filter (using created_at)
        if (dateRange?.from) {
            const poDate = new Date(po.created_at);
            if (dateRange.to) {
                if (!isWithinInterval(poDate, { start: startOfDay(dateRange.from), end: endOfDay(dateRange.to) })) return false;
            } else {
                if (format(poDate, 'yyyy-MM-dd') !== format(dateRange.from, 'yyyy-MM-dd')) return false;
            }
        }

        // Customer Filter
        if (selectedCustomerFilter !== "all") {
            const custId = po.quotations?.request?.customer?.id;
            if (custId !== selectedCustomerFilter) return false;
        }

        return true;
    });

    const totalPagesPOIn = Math.ceil(finalFilteredPOInList.length / itemsPerPage);
    const paginatedPOIn = finalFilteredPOInList.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    return (
        <div className="space-y-6">
            <Tabs defaultValue="po-out" value={activeTab} onValueChange={(val) => {
                setIsLoading(true);
                setActiveTab(val);
                setSearchQuery(""); // Auto-clear search on tab switch for cleaner UX
                setCurrentPage(1);
            }} className="w-full">
                <TabsList className="mb-4">
                    <TabsTrigger value="po-out">PO Out</TabsTrigger>
                    <TabsTrigger value="po-in">PO In</TabsTrigger>
                </TabsList>

                {activeFilterIds && filteredGroups.length > 0 && (
                    <div className="bg-blue-50 text-blue-800 px-4 py-2 rounded mb-4 flex justify-between items-center">
                        <span className="text-sm">Ditemukan {filteredGroups.length} grup untuk penawaran terpilih.</span>
                        <Button variant="ghost" size="sm" onClick={() => setActiveFilterIds(null)}>Hapus Filter</Button>
                    </div>
                )}

                <TabsContent value="po-out" className="space-y-4">
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
                                    Total Data: <span className="text-foreground">{filteredGroups.length}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-muted-foreground whitespace-nowrap">Rows per page:</span>
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
                    </div>

                    <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[50px] whitespace-nowrap">No</TableHead>
                                    <TableHead className="whitespace-nowrap">Info Permintaan</TableHead>
                                    <TableHead className="whitespace-nowrap">No Neraca</TableHead>
                                    <TableHead className="whitespace-nowrap">No Penawaran</TableHead>
                                    {userRole && userRole !== 'staff' && <TableHead className="w-[150px] whitespace-nowrap">Dibuat Oleh</TableHead>}
                                    <TableHead className="text-center whitespace-nowrap">Jumlah PO</TableHead>
                                    <TableHead className="text-center w-[150px] whitespace-nowrap">Aksi</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    Array.from({ length: 5 }).map((_, index) => (
                                        <TableRow key={index}>
                                            <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                                            <TableCell>
                                                <div className="space-y-2">
                                                    <Skeleton className="h-4 w-24 mb-2" />
                                                    <div className="flex flex-col gap-1">
                                                        <Skeleton className="h-5 w-32" />
                                                        <Skeleton className="h-4 w-24" />
                                                        <div className="space-y-1 mt-1">
                                                            <Skeleton className="h-3 w-40" />
                                                            <Skeleton className="h-3 w-32" />
                                                        </div>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                                            <TableCell><Skeleton className="h-6 w-32" /></TableCell>
                                            {userRole && userRole !== 'staff' && <TableCell className="text-center"><Skeleton className="h-6 w-8 mx-auto" /></TableCell>}
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Skeleton className="h-8 w-20" />
                                                    <Skeleton className="h-8 w-8" />
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : isError ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center text-destructive p-8">
                                            Pastikan koneksi internet anda baik
                                        </TableCell>
                                    </TableRow>
                                ) : displayGroups.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center text-muted-foreground p-8">
                                            {searchQuery ? "Pencarian tidak ditemukan" : "Belum ada data Purchase Order"}
                                        </TableCell>
                                    </TableRow>
                                ) : (

                                    Object.values(displayGroups.reduce((acc: any, group: any) => {
                                        const reqCode = group.request_code || "Unknown";
                                        if (!acc[reqCode]) acc[reqCode] = [];
                                        acc[reqCode].push(group);
                                        return acc;
                                    }, {})).map((reqGroup: any, groupIdx: number) => {
                                        // Calculate global index based on pagination
                                        const globalIndex = (currentPage - 1) * itemsPerPage + groupIdx + 1;

                                        return reqGroup.map((group: any, rowIdx: number) => (
                                            <TableRow key={group.id}>
                                                {rowIdx === 0 && (
                                                    <>
                                                        <TableCell rowSpan={reqGroup.length} className="align-middle bg-white/50 border-r relative overflow-hidden p-0 whitespace-nowrap">
                                                            <div className="flex h-full items-center justify-center p-4">
                                                                {globalIndex}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell rowSpan={reqGroup.length} className="align-middle bg-white/50 border-r whitespace-nowrap">
                                                            <span className="font-medium bg-green-100 text-green-800 px-2 py-1 rounded inline-block mb-2">
                                                                {group.request_code}
                                                            </span>
                                                            {group.customer_info ? (
                                                                <div className="flex flex-col gap-1">
                                                                    <span className="font-bold text-base">{group.customer_info.company_name || "-"}</span>
                                                                    <span className="font-medium">{group.customer_info.title || "-"}</span>
                                                                    <div className="text-sm text-muted-foreground flex flex-col gap-1">
                                                                        <div>
                                                                            <span className="font-semibold">No Surat:</span> {group.customer_info.letter_number || "-"}
                                                                        </div>
                                                                        <div>
                                                                            <span className="font-semibold">PIC:</span> {group.customer_info.pic_name || "-"}
                                                                        </div>
                                                                        <div>
                                                                            <span className="font-semibold">Tanggal:</span> {group.customer_info.date && isValid(new Date(group.customer_info.date)) ? format(new Date(group.customer_info.date), "dd/MM/yyyy", { locale: id }) : "-"}
                                                                        </div>
                                                                        {group.customer_info.attachments && group.customer_info.attachments.length > 0 && (
                                                                            <div className="flex flex-wrap gap-2 mt-1">
                                                                                {group.customer_info.attachments.map((attachment: any, i: number) => (
                                                                                    <a
                                                                                        key={i}
                                                                                        href={getStorageUrl(attachment.file_path, "request-attachments")}
                                                                                        target="_blank"
                                                                                        rel="noopener noreferrer"
                                                                                        className="flex items-center gap-1 text-blue-600 hover:underline text-xs"
                                                                                    >
                                                                                        <LinkIcon className="h-3 w-3" />
                                                                                        data {i + 1}
                                                                                    </a>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                "-"
                                                            )}
                                                        </TableCell>
                                                    </>
                                                )}
                                                <TableCell className="relative h-16 align-middle whitespace-nowrap">
                                                    <Link to="/balances" className="block w-fit pl-2 relative z-10">
                                                        <div className="flex flex-col gap-1">
                                                            <div className="text-sm font-mono bg-amber-50 text-amber-900 border border-amber-200 px-1 rounded w-fit hover:bg-amber-100 transition-colors">
                                                                {group.balance_codes}
                                                            </div>
                                                            <div className="text-xs text-muted-foreground">
                                                                {group.balance_date && isValid(new Date(group.balance_date)) ? format(new Date(group.balance_date), "dd/MM/yyyy", { locale: id }) : "-"}
                                                            </div>
                                                        </div>
                                                    </Link>
                                                    {/* Corner Ribbon - Per Row/Group */}
                                                    {(() => {
                                                        const total = group.pos.length;
                                                        const approved = group.pos.filter((p: PO) => p.status === 'approved').length;
                                                        const isGroupApproved = approved === total && total > 0;
                                                        return (
                                                            <div className="absolute top-0 left-0 w-[75px] h-[75px] overflow-hidden pointer-events-none">
                                                                <div className={`absolute top-[10px] left-[-30px] w-[100px] text-center -rotate-45 ${isGroupApproved ? 'bg-emerald-600' : 'bg-amber-600'} text-white text-[9px] font-bold py-1 shadow-sm`}>
                                                                    {isGroupApproved ? 'OK' : 'PEND'}
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}
                                                </TableCell>
                                                <TableCell className="whitespace-nowrap">
                                                    <Link to="/quotations" className="block w-fit">
                                                        <div className="flex flex-col gap-1">
                                                            <div className="font-mono text-sm bg-muted px-2 py-1 rounded inline-block">
                                                                {group.quotation_number}
                                                            </div>
                                                            <div className="text-xs text-muted-foreground">
                                                                {group.quotation_date && isValid(new Date(group.quotation_date)) ? format(new Date(group.quotation_date), "dd/MM/yyyy", { locale: id }) : "-"}
                                                            </div>
                                                        </div>
                                                    </Link>
                                                </TableCell>

                                                {/* Old Status Column Removed */}

                                                {userRole && userRole !== 'staff' && (
                                                    <TableCell className="whitespace-nowrap">
                                                        <div className="flex flex-col gap-1 items-center justify-center h-full mt-2">
                                                            {(() => {
                                                                const rawId = (group.pos[0] as any)?.created_by;
                                                                let name = "-";

                                                                if (rawId && creatorMap[rawId]) {
                                                                    name = creatorMap[rawId];
                                                                } else {
                                                                    const creator = group.pos[0]?.creator;
                                                                    if (Array.isArray(creator) && creator.length > 0) name = creator[0]?.name;
                                                                    else if (creator && typeof creator === 'object' && 'name' in creator) name = (creator as any).name;
                                                                    else name = rawId || "-";
                                                                }

                                                                return <span className="text-sm font-medium">{name}</span>;
                                                            })()}
                                                        </div>
                                                    </TableCell>
                                                )}
                                                <TableCell className="text-center font-semibold text-gray-700 whitespace-nowrap">
                                                    {group.pos.length}
                                                </TableCell>
                                                <TableCell className="text-right relative overflow-hidden whitespace-nowrap">
                                                    {/* Corner Badge */}
                                                    {group.pos.some((p: any) => p.quotations.some((q: any) => q.completed)) && (
                                                        <div className="absolute top-0 right-0 w-[75px] h-[75px] overflow-hidden pointer-events-none z-20">
                                                            <div className="absolute top-[10px] right-[-30px] w-[100px] text-center rotate-45 bg-green-600 text-white text-[9px] font-bold py-1 shadow-sm">
                                                                SELESAI
                                                            </div>
                                                        </div>
                                                    )}
                                                    <div className="flex flex-col gap-2 items-center justify-center relative z-10">
                                                        <div className="flex justify-end gap-2">
                                                            <Button variant="ghost" size="sm" onClick={() => handleView(group)}>
                                                                <ShoppingBag className="h-4 w-4 mr-2" />
                                                                View
                                                            </Button>
                                                            {/* Hide delete if linked to PO In */}
                                                            {!group.pos.some((p: any) => p.quotations.some((q: any) => q.po_in_link)) && canManage && ((group.pos[0] as any)?.created_by === userId || userRole === 'super_admin') && (
                                                                <DeleteConfirmationDialog
                                                                    onDelete={() => handleDeleteGroup(group)}
                                                                    trigger={
                                                                        <Button variant="ghost" size="sm" className="text-destructive">
                                                                            <Trash2 className="h-4 w-4" />
                                                                        </Button>
                                                                    }
                                                                />
                                                            )}
                                                        </div>

                                                        {/* Status Label & Toggle for Vendor Group */}
                                                        {(() => {
                                                            const total = group.pos.length;
                                                            const approved = group.pos.filter((p: PO) => p.status === 'approved').length;
                                                            const isGroupApproved = approved === total && total > 0;
                                                            const poIds = group.pos.map((p: any) => p.id);

                                                            return (
                                                                <div className="flex items-center gap-2 bg-gray-50 p-1 rounded border mt-1">
                                                                    <div className="flex flex-col items-end">
                                                                        <span className={`text-[10px] font-bold ${isGroupApproved ? 'text-emerald-600' : 'text-amber-600'}`}>
                                                                            {isGroupApproved ? 'Approved' : 'Pending'}
                                                                        </span>
                                                                        {!isGroupApproved && (
                                                                            <span className="text-[9px] text-muted-foreground">({approved}/{total})</span>
                                                                        )}
                                                                    </div>
                                                                    {userRole === 'pimpinan' && (
                                                                        <Switch
                                                                            checked={isGroupApproved}
                                                                            onCheckedChange={() => handleStatusToggle(poIds, isGroupApproved ? 'approved' : 'pending')}
                                                                            className="scale-75"
                                                                        />
                                                                    )}
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ));
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>


                    {/* Pagination Controls */}
                    {displayGroups.length > 0 && (
                        <div className="flex items-center justify-between">
                            <div className="text-sm text-muted-foreground">
                                Menampilkan {(currentPage - 1) * itemsPerPage + 1} sampai {Math.min(currentPage * itemsPerPage, displayGroups.length)} dari {displayGroups.length} entri
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
                    )}
                </TabsContent>

                <TabsContent value="po-in" className="space-y-4">
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
                                    Total Data: <span className="text-foreground">{finalFilteredPOInList.length}</span>
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

                            {selectedPOInIds.length > 0 && canManage && (
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    className="bg-blue-100 text-blue-700 hover:bg-blue-200 border border-blue-200"
                                    onClick={handleAddInternalLetter}
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Tambah Surat Internal
                                </Button>
                            )}
                        </div>
                    </div>

                    <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[50px] whitespace-nowrap">No</TableHead>
                                    <TableHead className="whitespace-nowrap">Info Permintaan</TableHead>
                                    <TableHead className="w-[50px] whitespace-nowrap">
                                        {/* Checkbox moved here */}
                                    </TableHead>
                                    <TableHead className="whitespace-nowrap">No Neraca</TableHead>
                                    <TableHead className="whitespace-nowrap">No Penawaran</TableHead>
                                    {userRole && userRole !== 'staff' && <TableHead className="w-[150px] whitespace-nowrap">Dibuat Oleh</TableHead>}
                                    <TableHead className="whitespace-nowrap">Info PO In</TableHead>
                                    <TableHead className="whitespace-nowrap">Aksi</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    Array.from({ length: 5 }).map((_, index) => (
                                        <TableRow key={index}>
                                            <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                                            <TableCell>
                                                <div className="space-y-2">
                                                    <Skeleton className="h-4 w-24 mb-2" />
                                                    <Skeleton className="h-5 w-32" />
                                                    <Skeleton className="h-4 w-24" />
                                                    <div className="space-y-1 mt-1">
                                                        <Skeleton className="h-3 w-40" />
                                                        <Skeleton className="h-3 w-32" />
                                                        <Skeleton className="h-3 w-20" />
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                                            <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                                            <TableCell><Skeleton className="h-6 w-32" /></TableCell>
                                            {userRole && userRole !== 'staff' && (
                                                <TableCell>
                                                    <div className="space-y-2">
                                                        <Skeleton className="h-5 w-40" />
                                                        <Skeleton className="h-3 w-32" />
                                                    </div>
                                                </TableCell>
                                            )}
                                            <TableCell>
                                                <div className="space-y-2">
                                                    <Skeleton className="h-5 w-40" />
                                                    <Skeleton className="h-3 w-32" />
                                                    <Skeleton className="h-3 w-28" />
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Skeleton className="h-8 w-8" />
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : isPOInError ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center text-destructive p-8">
                                            Pastikan koneksi internet anda baik
                                        </TableCell>
                                    </TableRow>
                                ) : filteredPOInList.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center text-muted-foreground p-8">
                                            {searchQuery ? "Pencarian tidak ditemukan" : "Belum ada data Purchase Order In"}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    Object.values(paginatedPOIn.reduce((acc: any, po: any) => {
                                        // Group by Request ID safely
                                        const reqId = po.quotations?.request?.id || "unknown";
                                        if (!acc[reqId]) acc[reqId] = [];
                                        acc[reqId].push(po);
                                        return acc;
                                    }, {})).map((reqGroup: any, groupIdx: number) => {
                                        const globalIndex = (currentPage - 1) * itemsPerPage + groupIdx + 1;

                                        return reqGroup.map((po: any, rowIdx: number) => {
                                            const primaryQ = po.quotations;
                                            const request = primaryQ?.request;
                                            const customer = request?.customer;

                                            // Resolve Balance Code logic
                                            const balanceCodes = primaryQ?.balance_link?.map((l: any) => {
                                                if (l.entry_id && l.balance?.balance_entries) {
                                                    const entry = l.balance.balance_entries.find((e: any) => e.id === l.entry_id);
                                                    return entry ? entry.code : null;
                                                }
                                                return l.balance?.balance_entries?.map((e: any) => e.code);
                                            }).flat().filter(Boolean) || [];
                                            const uniqueCodes = Array.from(new Set(balanceCodes));

                                            return (
                                                <TableRow key={po.id}>
                                                    {rowIdx === 0 && (
                                                        <>
                                                            <TableCell rowSpan={reqGroup.length} className="align-middle bg-white/50 border-r whitespace-nowrap">{globalIndex}</TableCell>
                                                            <TableCell rowSpan={reqGroup.length} className="align-middle bg-white/50 border-r whitespace-nowrap">
                                                                <span className="font-medium bg-green-100 text-green-800 px-2 py-1 rounded text-xs inline-block mb-2">
                                                                    {request?.request_code || "-"}
                                                                </span>
                                                                <div className="flex flex-col gap-1">
                                                                    <span className="font-bold text-base">{customer?.company_name || "-"}</span>
                                                                    <span className="font-medium">{request?.title || "-"}</span>
                                                                    <div className="text-sm text-muted-foreground flex flex-col gap-1">
                                                                        <div>
                                                                            <span className="font-semibold">No Surat:</span> {request?.letter_number || "-"}
                                                                        </div>
                                                                        <div>
                                                                            <span className="font-semibold">PIC:</span> {request?.customer_pic?.name || "-"}
                                                                        </div>
                                                                        <div>
                                                                            <span className="font-semibold">Tanggal:</span> {request?.created_at ? format(new Date(request.created_at), "dd/MM/yyyy") : "-"}
                                                                        </div>
                                                                        {request?.customer_attachments && request.customer_attachments.length > 0 && (
                                                                            <div className="flex flex-wrap gap-2 mt-1">
                                                                                {request.customer_attachments.map((att: any, idx: number) => (
                                                                                    <a
                                                                                        key={idx}
                                                                                        href={getStorageUrl(att.file_path, "request-attachments")}
                                                                                        target="_blank"
                                                                                        className="flex items-center text-xs text-blue-600 hover:underline"
                                                                                    >
                                                                                        <LinkIcon className="h-3 w-3 mr-1" />
                                                                                        {att.file_name || `data ${idx + 1}`}
                                                                                    </a>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </TableCell>
                                                        </>
                                                    )}
                                                    <TableCell className="whitespace-nowrap">
                                                        {/* Checkbox Visibility Logic:
                                                            - Always show for Owner / SuperAdmin
                                                            - For Pimpinan (viewing others' data): ONLY show if it's already linked (internal_letter exists). If not, hide it.
                                                        */}
                                                        {(userRole === 'pimpinan' && po.created_by !== userId && (!po.internal_letter || po.internal_letter.length === 0)) ? (
                                                            <div className="w-4 h-4 mx-auto" />
                                                        ) : (
                                                            <Checkbox
                                                                checked={selectedPOInIds.includes(po.id) || (po.internal_letter && po.internal_letter.length > 0)}
                                                                disabled={!canManage || (po.internal_letter && po.internal_letter.length > 0) || (userRole === 'pimpinan' && po.created_by !== userId)}
                                                                onCheckedChange={() => {
                                                                    // Check Linked PO Out Status
                                                                    // Logic: If ANY linked PO Out is NOT approved, we block.
                                                                    // This ensures we don't process Incoming POs (Invoices) before Outgoing POs are finalized.
                                                                    const poOutLinks = po.quotations?.po_links || [];
                                                                    const hasPendingPOOut = poOutLinks.some((link: any) => link.purchase_order?.status !== 'approved');

                                                                    if (poOutLinks.length > 0 && hasPendingPOOut) {
                                                                        toast.error("PO Out belum di-approve, tidak bisa diproses");
                                                                        return;
                                                                    }

                                                                    toggleSelectPOIn(po.id);
                                                                }}
                                                            />
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="whitespace-nowrap">
                                                        <div className="flex flex-col gap-1">
                                                            <div className="text-sm font-mono bg-amber-50 text-amber-900 border border-amber-200 px-1 rounded w-fit">
                                                                {uniqueCodes.length > 0 ? uniqueCodes.join(", ") : "-"}
                                                            </div>
                                                            <div className="text-xs text-muted-foreground">
                                                                {primaryQ?.balance_link?.[0]?.balance?.created_at
                                                                    ? format(new Date(primaryQ.balance_link[0].balance.created_at), "dd/MM/yyyy", { locale: id })
                                                                    : "-"}
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="whitespace-nowrap">
                                                        <div className="flex flex-col gap-1">
                                                            <div className="font-mono text-sm bg-muted px-2 py-1 rounded inline-block">
                                                                {primaryQ?.quotation_number || "-"}
                                                            </div>
                                                            <div className="text-xs text-muted-foreground">
                                                                {primaryQ?.created_at ? format(new Date(primaryQ.created_at), "dd/MM/yyyy", { locale: id }) : "-"}
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    {userRole && userRole !== 'staff' && (
                                                        <TableCell className="whitespace-nowrap">
                                                            <div className="flex flex-col gap-1 items-center justify-center h-full mt-2">
                                                                {(() => {
                                                                    const rawId = (po as any).created_by;
                                                                    let name = "-";

                                                                    if (rawId && creatorMap[rawId]) {
                                                                        name = creatorMap[rawId];
                                                                    } else {
                                                                        const creator = po.creator;
                                                                        if (Array.isArray(creator) && creator.length > 0) name = creator[0]?.name;
                                                                        else if (creator && typeof creator === 'object' && 'name' in creator) name = (creator as any).name;
                                                                        else name = rawId || "-";
                                                                    }

                                                                    return <span className="text-sm font-medium">{name}</span>;
                                                                })()}
                                                            </div>
                                                        </TableCell>
                                                    )}
                                                    <TableCell className="relative whitespace-nowrap">
                                                        <div className="flex flex-col space-y-1 relative z-10">
                                                            <span className="font-medium">{po.subject || "-"}</span>
                                                            <span className="text-xs text-muted-foreground">
                                                                No Surat: <span className="text-foreground/80">{po.vendor_letter_number || "-"}</span>
                                                            </span>
                                                            <span className="text-xs text-muted-foreground">
                                                                Tanggal: <span className="text-foreground/80">{po.vendor_letter_date ? format(new Date(po.vendor_letter_date), "dd/MM/yyyy") : "-"}</span>
                                                            </span>
                                                            {po.attachments?.length > 0 && (
                                                                <div className="flex flex-wrap gap-1 pt-1">
                                                                    {po.attachments.map((att: any, ai: number) => (
                                                                        <a key={ai} href={getStorageUrl(att.file_path, 'purchase-order-attachments')} target="_blank" className="text-blue-600 hover:underline flex items-center text-xs">
                                                                            <LinkIcon className="h-3 w-3 mr-1" /> File
                                                                        </a>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="relative overflow-hidden whitespace-nowrap">
                                                        {/* Corner Badge */}
                                                        {po.status === 'completed' && (
                                                            <div className="absolute top-0 right-0 w-[75px] h-[75px] overflow-hidden pointer-events-none z-20">
                                                                <div className="absolute top-[10px] right-[-30px] w-[100px] text-center rotate-45 bg-green-600 text-white text-[9px] font-bold py-1 shadow-sm">
                                                                    SELESAI
                                                                </div>
                                                            </div>
                                                        )}
                                                        <div className="flex gap-2 justify-end items-center relative z-10">
                                                            {canManage && (po.created_by === userId || userRole === 'super_admin') && (
                                                                <Button variant="outline" size="sm" onClick={() => {
                                                                    setViewPOIn(po);
                                                                    setIsEditPOInOpen(true);
                                                                }}>
                                                                    <Edit className="h-4 w-4" />
                                                                </Button>
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

                    {/* Pagination for PO In */}
                    {finalFilteredPOInList.length > 0 && (
                        <div className="flex items-center justify-between p-4 border-t">
                            <div className="text-sm text-muted-foreground">
                                Menampilkan {(currentPage - 1) * itemsPerPage + 1} sampai {Math.min(currentPage * itemsPerPage, finalFilteredPOInList.length)} dari {finalFilteredPOInList.length} entri
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
                                    Hal {currentPage} dari {totalPagesPOIn}
                                </div>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPagesPOIn))}
                                    disabled={currentPage === totalPagesPOIn}
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )
                    }

                    {/* --- Pimpinan Toggle Logic --- */}
                    {
                        userRole === 'pimpinan' && (
                            <div className="flex-1 flex justify-end">

                            </div>
                        )
                    }
                </TabsContent >
            </Tabs >

            <GeneratorModal
                open={isGeneratorOpen}
                onOpenChange={setIsGeneratorOpen}
                onSuccess={fetchPOs}
            />

            {/* Detail View Modal */}
            <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Detail Purchase Order</DialogTitle>
                        <DialogDescription className="hidden">
                            Detail informasi purchase order termasuk vendor, status DP, dan opsi cetak.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="mt-4">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-12 whitespace-nowrap">No</TableHead>
                                    <TableHead className="whitespace-nowrap">No PO</TableHead>
                                    <TableHead className="whitespace-nowrap">Vendor</TableHead>
                                    <TableHead className="whitespace-nowrap">Bukti Pembayaran</TableHead>
                                    <TableHead className="text-right whitespace-nowrap">Aksi</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {selectedGroup?.pos?.map((po: PO, idx: number) => {
                                    const hasDP = (po.dp_percentage || 0) > 0 || (po.dp_amount || 0) > 0;
                                    const isExpanded = expandedVendorIds.has(po.id);

                                    // Labels
                                    const label = hasDP ? "Tagihan DP" : "Tagihan Full";

                                    return (
                                        <Fragment key={po.id}>
                                            <TableRow>
                                                <TableCell className="whitespace-nowrap">{idx + 1}</TableCell>
                                                <TableCell className="whitespace-nowrap">
                                                    <span className="font-mono text-black">
                                                        {po.po_number.replace(/\s/g, "")}
                                                    </span>
                                                    <div className="text-[10px] text-blue-600 font-bold mt-1 uppercase tracking-wider">
                                                        {label}
                                                    </div>
                                                    {/* Ribbon Badge */}
                                                    <div className={cn(
                                                        "text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mt-1",
                                                        po.status === 'approved' ? "bg-green-100 text-green-700 border border-green-200" : "bg-yellow-100 text-yellow-700 border border-yellow-200"
                                                    )}>
                                                        {po.status === 'approved' ? "APPROVED" : "PENDING"}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="whitespace-nowrap">
                                                    <div className="flex flex-col space-y-1">
                                                        <span className="font-semibold">{po.vendor?.company_name}</span>
                                                        <div className="flex items-center gap-1">
                                                            <span className="text-xs text-muted-foreground whitespace-nowrap">PIC:</span>
                                                            <VendorPicSelect
                                                                vendorId={po.vendor_id}
                                                                currentPicId={po.vendor_pic_id}
                                                                poId={po.id}
                                                                disabled={userRole === 'pimpinan' && po.created_by !== userId}
                                                                onUpdate={(newPic: any) => {
                                                                    setSelectedGroup((prev: any) => {
                                                                        if (!prev) return prev;
                                                                        const updatedPos = [...prev.pos];
                                                                        updatedPos[idx] = { ...updatedPos[idx], vendor_pic: newPic, vendor_pic_id: newPic.id };
                                                                        return { ...prev, pos: updatedPos };
                                                                    });
                                                                }}
                                                            />
                                                        </div>

                                                        <div className="text-xs bg-muted/50 p-1 rounded mt-1 border">
                                                            <div><span className="font-semibold">Ref:</span> {po.vendor_letter_number || "-"}</div>
                                                            <div><span className="font-semibold">Tgl:</span> {po.vendor_letter_date ? format(new Date(po.vendor_letter_date), "dd/MM/yyyy") : "-"}</div>
                                                        </div>

                                                        {po.attachments?.length > 0 && (
                                                            <div className="flex flex-wrap gap-1 mt-1">
                                                                {po.attachments.map((att, ai) => (
                                                                    <a key={ai} href={getStorageUrl(att.file_path, 'request-attachments')} target="_blank" className="text-blue-600 hover:underline flex items-center text-xs">
                                                                        <LinkIcon className="h-3 w-3 mr-1" /> View File
                                                                    </a>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="whitespace-nowrap">
                                                    {po.transfer_proof_url ? (
                                                        <div className="flex flex-col gap-1">
                                                            <a href={po.transfer_proof_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-xs flex items-center gap-1 font-medium bg-blue-50 px-2 py-1 rounded w-fit">
                                                                <LinkIcon className="h-3 w-3" /> Bukti Pembayaran
                                                            </a>
                                                            {po.transfer_proof_date && (
                                                                <span className="text-[10px] text-muted-foreground">
                                                                    {isValid(new Date(po.transfer_proof_date)) ? format(new Date(po.transfer_proof_date), "dd/MM/yyyy HH:mm", { locale: id }) : "-"}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground">-</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right whitespace-nowrap">
                                                    <div className="flex justify-end gap-2 items-center">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            disabled={(po.status || '').toLowerCase().trim() !== 'approved'}
                                                            onClick={() => {
                                                                handlePrint(po, hasDP ? 'DP' : '');
                                                            }}
                                                        >
                                                            <Printer className="h-4 w-4 mr-2" />
                                                            Cetak
                                                        </Button>
                                                        {hasDP && (
                                                            <Button
                                                                size="sm"
                                                                variant={isExpanded ? "secondary" : "ghost"}
                                                                className="h-8 w-8 p-0 rounded-full border border-dashed hover:bg-blue-50"
                                                                title="Tambah Tagihan Pelunasan"
                                                                disabled={(po.status || '').toLowerCase().trim() !== 'approved'}
                                                                onClick={() => {
                                                                    toggleVendorExpand(po.id);
                                                                }}
                                                            >
                                                                <Plus className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? "rotate-45 text-red-500" : "text-blue-600"}`} />
                                                            </Button>
                                                        )}
                                                        {/* Pimpinan Toggle Button */}
                                                        {userRole === 'pimpinan' && (
                                                            <div className="flex items-center space-x-2 ml-2">
                                                                <label htmlFor={`toggle-${po.id}`} className="text-xs font-semibold cursor-pointer select-none">
                                                                    {po.status === 'approved' ? "Approved" : "Pending"}
                                                                </label>
                                                                <input
                                                                    id={`toggle-${po.id}`}
                                                                    type="checkbox"
                                                                    className="toggle-checkbox w-8 h-4 rounded-full bg-gray-300 appearance-none checked:bg-green-500 relative transition-colors duration-200 cursor-pointer after:content-[''] after:absolute after:w-4 after:h-4 after:bg-white after:rounded-full after:shadow-sm after:transition-transform after:duration-200 checked:after:translate-x-4"
                                                                    checked={po.status === 'approved'}
                                                                    onChange={async (e) => {
                                                                        const newStatus = e.target.checked ? 'approved' : 'pending';

                                                                        // Optimistic Update
                                                                        const updatedGroup = { ...selectedGroup };
                                                                        const poIndex = updatedGroup.pos.findIndex((p: PO) => p.id === po.id);
                                                                        if (poIndex >= 0) {
                                                                            updatedGroup.pos[poIndex].status = newStatus;
                                                                            setSelectedGroup(updatedGroup);

                                                                            // Also update main list (groupedPOs) to reflect changes (re-fetch or optimistic)
                                                                            // For now, simple state update in modal is good, but fetchPOs needed to update table.
                                                                        }

                                                                        try {
                                                                            const { error } = await supabase
                                                                                .from('purchase_orders')
                                                                                .update({ status: newStatus })
                                                                                .eq('id', po.id);

                                                                            if (error) throw error;
                                                                            toast.success(`Status updated to ${newStatus}`);

                                                                            // Refresh data
                                                                            fetchPOs();

                                                                        } catch (err) {
                                                                            console.error(err);
                                                                            toast.error("Failed to update status");
                                                                            // Revert optimistic update if needed (omitted for brevity)
                                                                        }
                                                                    }}
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>

                                            {/* Settlement Row */}
                                            {
                                                hasDP && isExpanded && (
                                                    <TableRow className="bg-blue-50/50">
                                                        <TableCell></TableCell>
                                                        <TableCell className="font-mono text-xs text-right align-middle text-muted-foreground">
                                                            ↳
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex items-center gap-2 pl-4">
                                                                <span className="font-bold text-sm text-blue-700">Tagihan Pelunasan</span>
                                                                <span className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full uppercase tracking-wider font-bold">Settlement</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <Button size="sm" variant="outline" onClick={() => handlePrint(po, 'PELUNASAN')}>
                                                                <Printer className="h-4 w-4 mr-2" />
                                                                Cetak
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                )
                                            }
                                        </Fragment>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Print Modal */}
            <Dialog open={isPrintOpen} onOpenChange={setIsPrintOpen}>
                <DialogContent className="max-w-5xl max-h-[95vh] flex flex-col overflow-hidden print:static print:transform-none print:overflow-visible print:h-auto print:max-w-none print:w-full print:p-0 print:border-none">
                    <DialogHeader>
                        <DialogTitle className="sr-only">Cetak Purchase Order</DialogTitle>
                        <DialogDescription className="sr-only">Preview cetak PO</DialogDescription>
                    </DialogHeader>
                    {printPO && (
                        <PurchaseOrderPrint
                            po={printPO}
                            invoiceType={invoiceType}
                            onUpdate={() => {
                                fetchPOs().then(() => {
                                    // Update the local printPO state with fresh data from DB
                                    // We need to fetch the single PO again or find it in the refreshed list
                                    // But since fetchPOs is async and updates state, we might not have access to the *new* state immediately in this closure easily without logic
                                    // Simpler: Just re-fetch this specific PO ID and update printPO
                                    (supabase as any).from("purchase_orders").select("*").eq("id", printPO.id).single()
                                        .then(({ data }: any) => {
                                            if (data) {
                                                setPrintPO(prev => prev ? ({
                                                    ...prev,
                                                    discount: data.discount,
                                                    ppn: data.ppn,
                                                    dp_percentage: data.dp_percentage,
                                                    dp_amount: data.dp_amount,
                                                    notes: data.notes,
                                                    franco: data.franco,
                                                    delivery_time: data.delivery_time,
                                                    payment_term: data.payment_term
                                                }) : null)
                                            }
                                        })
                                });
                            }}
                        />
                    )}
                </DialogContent>
            </Dialog>
            {/* Edit PO In Modal */}
            <Dialog open={isEditPOInOpen} onOpenChange={(open) => {
                if (!open) {
                    // Reset pending state on close
                    setPendingUploads([]);
                    setPendingDeletes([]);
                }
                setIsEditPOInOpen(open);
            }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Edit Info PO In</DialogTitle>
                        <DialogDescription>Ubah detail surat jalan tagihan.</DialogDescription>
                    </DialogHeader>
                    {viewPOIn && (
                        <div className="space-y-4">
                            <div>
                                <Label>Subject</Label>
                                <Input
                                    value={viewPOIn.subject}
                                    onChange={(e) => setViewPOIn({ ...viewPOIn, subject: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label>No Surat PO In</Label>
                                <Input
                                    value={viewPOIn.vendor_letter_number}
                                    onChange={(e) => setViewPOIn({ ...viewPOIn, vendor_letter_number: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label>Tanggal</Label>
                                <Input
                                    type="date"
                                    value={viewPOIn.vendor_letter_date ? format(new Date(viewPOIn.vendor_letter_date), 'yyyy-MM-dd') : ''}
                                    onChange={(e) => setViewPOIn({ ...viewPOIn, vendor_letter_date: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label className="font-semibold mb-2 block">Attachments</Label>
                                <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 bg-gray-50/50">
                                    <div className="mb-4">
                                        <Input
                                            type="file"
                                            multiple
                                            className="cursor-pointer bg-white"
                                            onChange={(e) => {
                                                if (e.target.files && e.target.files.length > 0) {
                                                    const files = Array.from(e.target.files);
                                                    setPendingUploads(prev => [...prev, ...files]);
                                                }
                                            }}
                                        />
                                    </div>

                                    {/* Existing Attachments (that are not pending delete) */}
                                    {viewPOIn.attachments?.filter((att: any) => !pendingDeletes.includes(att.id)).map((att: any, idx: number) => (
                                        <div key={att.id} className="flex justify-between items-center text-sm p-3 bg-white border rounded-md shadow-sm mb-2">
                                            <a href={getStorageUrl(att.file_path, 'purchase-order-attachments')} target="_blank" className="text-gray-700 hover:text-blue-600 truncate max-w-[300px] flex items-center gap-2">
                                                <LinkIcon className="h-3 w-3" />
                                                {att.file_name}
                                            </a>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 text-gray-400 hover:text-red-500 hover:bg-transparent"
                                                onClick={() => setPendingDeletes(prev => [...prev, att.id])}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}

                                    {/* Pending Uploads */}
                                    {pendingUploads.map((file, idx) => (
                                        <div key={`pending-${idx}`} className="flex justify-between items-center text-sm p-3 bg-blue-50 border border-blue-100 rounded-md shadow-sm mb-2">
                                            <span className="text-gray-700 truncate max-w-[300px] flex items-center gap-2">
                                                <LinkIcon className="h-3 w-3" />
                                                {file.name} (New)
                                            </span>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 text-gray-400 hover:text-red-500 hover:bg-transparent"
                                                onClick={() => setPendingUploads(prev => prev.filter((_, i) => i !== idx))}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <Button onClick={async () => {
                                const toastId = toast.loading("Saving changes...");
                                try {
                                    // 1. Process Pending Uploads
                                    if (pendingUploads.length > 0) {
                                        await Promise.all(pendingUploads.map(async (file) => {
                                            const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}_${file.name}`;
                                            const { error } = await supabase.storage.from('purchase-order-attachments').upload(fileName, file);

                                            if (!error) {
                                                await (supabase as any).from('po_in_attachments').insert({
                                                    po_in_id: viewPOIn.id,
                                                    file_name: file.name,
                                                    file_path: fileName
                                                });
                                            }
                                        }));
                                    }

                                    // 2. Process Pending Deletes
                                    if (pendingDeletes.length > 0) {
                                        // Fetch paths to delete from storage (optional, if we want to clean up storage)
                                        const { data: attachmentsToDelete } = await (supabase as any).from("po_in_attachments").select("file_path").in("id", pendingDeletes);

                                        // Delete from DB
                                        await (supabase as any).from("po_in_attachments").delete().in("id", pendingDeletes);

                                        // Delete from Storage
                                        if (attachmentsToDelete && attachmentsToDelete.length > 0) {
                                            const paths = attachmentsToDelete.map((a: any) => a.file_path).filter(Boolean);
                                            if (paths.length > 0) {
                                                await supabase.storage.from('purchase-order-attachments').remove(paths);
                                            }
                                        }
                                    }

                                    // 3. Update PO Info
                                    const { error } = await (supabase as any).from("po_ins").update({
                                        subject: viewPOIn.subject,
                                        vendor_letter_number: viewPOIn.vendor_letter_number,
                                        vendor_letter_date: viewPOIn.vendor_letter_date
                                    }).eq("id", viewPOIn.id);

                                    if (!error) {
                                        toast.success("Saved successfully", { id: toastId });
                                        setIsEditPOInOpen(false);
                                        setPendingUploads([]);
                                        setPendingDeletes([]);
                                        fetchPOInList();
                                    } else {
                                        toast.error("Failed to update info", { id: toastId });
                                    }
                                } catch (err) {
                                    console.error(err);
                                    toast.error("An error occurred", { id: toastId });
                                }
                            }}>
                                Simpan
                            </Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

        </div >
    );
}
