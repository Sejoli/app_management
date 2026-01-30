import { useState, useEffect } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { usePermission } from "@/hooks/usePermission";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { startOfDay, endOfDay, isWithinInterval, format } from "date-fns";
import { DateRange } from "react-day-picker";
import { DatePickerWithRange } from "@/components/ui/date-picker-with-range";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { ArrowLeft, Truck, Link as LinkIcon, MapPin, Search, ChevronLeft, ChevronRight, ChevronsUpDown, Check as CheckIcon, Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DeleteConfirmationDialog } from "@/components/DeleteConfirmationDialog";
import TrackingModal from "@/components/tracking/TrackingModal";
import SuratJalanPrintModal from "@/components/tracking/SuratJalanPrintModal";

export default function TrackingPage() {
    const { canManage, userId, userRole, loading: permLoading } = usePermission("purchase_orders");
    const location = useLocation();
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(true);
    const [isError, setIsError] = useState(false);
    const [items, setItems] = useState<any[]>([]);

    // Modal State
    const [isTrackingModalOpen, setIsTrackingModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<any>(null);
    const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);

    // Print Modal State
    const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
    const [selectedPrintItem, setSelectedPrintItem] = useState<any>(null);

    // Pagination & Search State
    const [searchQuery, setSearchQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    // Filters
    const [dateRange, setDateRange] = useState<DateRange | undefined>();
    const [customers, setCustomers] = useState<any[]>([]);
    const [selectedCustomerFilter, setSelectedCustomerFilter] = useState<string>("all");
    const [openCustomerCombobox, setOpenCustomerCombobox] = useState(false);

    // Get ID from navigation state
    const internalLetterId = location.state?.internalLetterId;

    useEffect(() => {
        if (permLoading) return;
        fetchItems();
        fetchCustomers();
    }, [internalLetterId, userId, userRole, permLoading]);

    const fetchCustomers = async () => {
        const { data } = await supabase.from("customers").select("id, company_name").order("company_name");
        if (data) setCustomers(data);
    };

    const handleGenerateInvoice = async () => {
        if (!selectedInvoiceId) return;
        const toastId = toast.loading("Membuat invoice...");
        try {
            // 1. Fetch Company Abbreviation (Once)
            const { data: companyData } = await (supabase as any)
                .from('company')
                .select('abbreviation')
                .limit(1)
                .single();
            const companyAbbr = companyData?.abbreviation || 'CORP';
            const datePart = format(new Date(), 'MM.yyyy');

            const item = items.find(i => i.id === selectedInvoiceId);
            if (!item || !item.po_in?.id) {
                toast.error("Data tidak valid", { id: toastId });
                return;
            }

            // Generate Number
            const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
            const invoiceNumber = `Inv/${randomStr}/${companyAbbr}/${datePart}`;

            const { error } = await supabase
                .from("po_ins")
                .update({
                    invoice_number: invoiceNumber,
                    invoice_date: new Date().toISOString(),
                    status: 'pending'
                })
                .eq("id", item.po_in.id);

            if (error) throw error;

            toast.success(`Invoice berhasil dibuat`, { id: toastId });
            navigate("/invoices");
        } catch (e) {
            console.error(e);
            toast.error("Gagal membuat invoice", { id: toastId });
        }
    };

    const handleDelete = async (id: string) => {
        // Only delete tracking activities (reset tracking), do not delete the Internal Letter itself
        const { error } = await supabase.from("tracking_activities").delete().eq("internal_letter_id", id);

        if (error) {
            toast.error("Gagal menghapus data tracking");
            return;
        }

        // Also delete attachments logic if needed, but typically cascade handles it
        // Or if we want to be thorough we could delete them first, but RLS usually blocks if not careful.
        // Assuming previous migration setup cascade delete on foreign key.

        toast.success("Data tracking berhasil di-reset");

        // If we are in "single item view" (navigated from InternalLetters), 
        // we might want to navigate back or just refresh?
        // User said: "hanya data dihalaman tracking aja yang terhapus"
        // If I delete tracking activities, the item might still appear in this list if the list is based on "internal_letters".
        // The current fetchItems queries "internal_letters". So the item remains but has no tracking history.
        // If the intention of "Tracking Page" is to show ONLY tracked items, then this item should disappear from the list?
        // Current implementation: `fetchItems` selects `internal_letters`. It does NOT filter by whether they have tracking activities.
        // So the item will remain in the list, but with no history.
        // This seems correct for "Resetting" tracking.

        fetchItems();
    };

    const fetchItems = async () => {
        setIsLoading(true);
        setIsError(false);

        let query = supabase
            .from("internal_letters")
            .select(`
                id,
                internal_letter_number,
                sj_number,
                created_by,
                created_at,
                tracking_activities!inner(id),
                creator:team_members!fk_created_by_team_member(name, user_id),
                po_in: po_ins (
                    id,
                    invoice_number,
                    status,
                    is_completed,
                    subject,
                    vendor_letter_number,
                    vendor_letter_date,
                    attachments:po_in_attachments(file_name, file_path),
                    quotation: quotations (
                        id,
                        quotation_number,
                        created_at,
                        request: requests (
                            title,
                            request_code,
                            letter_number,
                            created_at,
                            customer: customers (
                                id,
                                customer_code,
                                company_name,
                                delivery_address,
                                office_address
                            ),
                            customer_pic: customer_pics (
                                name
                            ),
                            customer_attachments: request_attachments(file_name, file_path)
                        ),
                        quotation_balances(
                            balance_id,
                            balance:balances(
                                 created_at,
                                 balance_entries
                            ),
                            entry_id
                        )
                    )
                )
            `);

        if (internalLetterId) {
            query = query.eq("id", internalLetterId);
        } else {
            // RBAC Filter
            if (userRole !== "super_admin" && userRole !== "pimpinan" && userId) {
                query = query.eq("created_by", userId);
            }
            query = query.order('created_at', { ascending: false });
        }

        const { data, error } = await query;

        if (error) {
            console.error("Error fetching tracking items:", error);
            toast.error("Gagal mengambil data tracking");
            setIsError(true);
        } else {
            // Process to resolve balance codes
            const processedItems = (data || []).map((item: any) => {
                let balanceCode = "-";
                let balanceDate = null;
                const q = item.po_in?.quotation;

                if (q?.quotation_balances?.length > 0) {
                    const pb = q.quotation_balances[0];
                    const entry = pb.balance?.balance_entries?.find((e: any) => e.id === pb.entry_id);
                    if (entry) balanceCode = entry.code;
                    if (pb.balance?.created_at) balanceDate = pb.balance.created_at;
                }

                return {
                    ...item,
                    balance_code: balanceCode,
                    balance_date: balanceDate
                };
            });
            setItems(processedItems);
        }
        setIsLoading(false);
    };

    const getStorageUrl = (path: string, bucket: string = "purchase-order-attachments") => {
        return `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
    };

    const handleOpenModal = (item: any) => {
        setSelectedItem(item);
        setIsTrackingModalOpen(true);
    };

    // Filter and Pagination Logic
    const filteredItems = items.filter(item => {
        const searchLower = searchQuery.toLowerCase();
        const customer = item.po_in?.quotation?.request?.customer?.company_name?.toLowerCase() || "";
        const requestCode = item.po_in?.quotation?.request?.request_code?.toLowerCase() || "";
        const title = item.po_in?.quotation?.request?.title?.toLowerCase() || "";
        const quotationNumber = item.po_in?.quotation?.quotation_number?.toLowerCase() || "";
        const subject = item.po_in?.subject?.toLowerCase() || "";
        const vendorLetterNumber = item.po_in?.vendor_letter_number?.toLowerCase() || "";
        const balanceCode = item.balance_code?.toLowerCase() || "";

        const matchesSearch = customer.includes(searchLower) ||
            requestCode.includes(searchLower) ||
            title.includes(searchLower) ||
            quotationNumber.includes(searchLower) ||
            subject.includes(searchLower) ||
            vendorLetterNumber.includes(searchLower) ||
            balanceCode.includes(searchLower);

        if (!matchesSearch) return false;

        // Date Filter (using created_at)
        if (dateRange?.from) {
            const trackDate = item.created_at ? new Date(item.created_at) : null;
            if (trackDate) {
                if (dateRange.to) {
                    if (!isWithinInterval(trackDate, { start: startOfDay(dateRange.from), end: endOfDay(dateRange.to) })) return false;
                } else {
                    if (format(trackDate, 'yyyy-MM-dd') !== format(dateRange.from, 'yyyy-MM-dd')) return false;
                }
            }
        }

        // Customer Filter
        if (selectedCustomerFilter !== "all") {
            const custId = item.po_in?.quotation?.request?.customer?.id;
            if (custId !== selectedCustomerFilter) return false;
        }

        return true;
    });

    const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
    const paginatedItems = filteredItems.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, itemsPerPage]);

    return (
        <div className="p-8 space-y-6 animate-in fade-in">
            {/* Header */}
            <div className="flex items-center gap-4">
                {internalLetterId && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate("/tracking", { replace: true, state: {} })}
                        className="flex items-center gap-2"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Kembali ke Semua Tracking
                    </Button>
                )}



            </div>

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
                            Total Data: <span className="text-foreground">{filteredItems.length}</span>
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

                    <div className="flex items-center gap-4">
                        {selectedInvoiceId && canManage && (items.find(i => i.id === selectedInvoiceId)?.created_by === userId || userRole === 'super_admin') && (
                            <div className="ml-auto">
                                <Button onClick={handleGenerateInvoice} disabled={isLoading} className="bg-green-600 hover:bg-green-700 text-white">
                                    Tambah Invoice
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="border rounded-lg bg-card text-card-foreground shadow-sm">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-12 text-center whitespace-nowrap">No</TableHead>
                            <TableHead className="w-12 text-center whitespace-nowrap"></TableHead>
                            <TableHead className="whitespace-nowrap">No SJ</TableHead>
                            <TableHead className="whitespace-nowrap">Info Permintaan</TableHead>
                            <TableHead className="whitespace-nowrap">No Neraca</TableHead>
                            <TableHead className="whitespace-nowrap">No Penawaran</TableHead>
                            {userRole && userRole !== 'staff' && <TableHead className="whitespace-nowrap">Dibuat Oleh</TableHead>}
                            <TableHead className="whitespace-nowrap">Info PO In</TableHead>
                            <TableHead className="w-48 text-right whitespace-nowrap">Aksi</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            Array.from({ length: itemsPerPage }).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell><Skeleton className="h-4 w-8 mx-auto" /></TableCell>
                                    <TableCell><Skeleton className="h-16 w-full" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                    <TableCell><Skeleton className="h-16 w-full" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                                    <TableCell><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                                </TableRow>
                            ))
                        ) : isError ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center p-8 text-destructive">
                                    Pastikan koneksi internet anda baik
                                </TableCell>
                            </TableRow>
                        ) : filteredItems.length > 0 ? (
                            paginatedItems.map((item, index) => {
                                const po = item.po_in;
                                const q = po?.quotation;
                                const req = q?.request;
                                const cust = req?.customer;
                                const globalIndex = (currentPage - 1) * itemsPerPage + index + 1;

                                return (
                                    <TableRow key={item.id}>
                                        <TableCell className="text-center align-middle whitespace-nowrap border-r border-gray-100">{globalIndex}</TableCell>
                                        <TableCell className="text-center align-middle pt-4 whitespace-nowrap">
                                            {/* Checkbox Visibility Logic:
                                                - Always show for Owner / Super Admin
                                                - For Pimpinan (viewing others' data): ONLY show if it's already invoiced/checked (po.invoice_number exists). If not, hide it.
                                             */}
                                            {(userRole === 'pimpinan' && item.creator?.user_id !== userId && !po?.invoice_number) ? (
                                                <div className="w-4 h-4 mx-auto" />
                                            ) : (
                                                <Checkbox
                                                    checked={!!po?.invoice_number || selectedInvoiceId === item.id}
                                                    disabled={!!po?.invoice_number || (userRole === 'pimpinan' && item.creator?.user_id !== userId)}
                                                    onCheckedChange={(checked) => {
                                                        if (checked) setSelectedInvoiceId(item.id);
                                                        else setSelectedInvoiceId(null);
                                                    }}
                                                />
                                            )}
                                        </TableCell>

                                        {/* SJ Number */}
                                        <TableCell className="text-left border-r border-gray-100 whitespace-nowrap align-middle">
                                            <div className="flex flex-col gap-1 items-start">
                                                <div className="font-mono text-sm bg-blue-50 text-blue-800 border border-blue-100 px-2 py-1 rounded inline-block w-fit">
                                                    {item.sj_number || '-'}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {item.created_at ? format(new Date(item.created_at), "dd/MM/yyyy") : "-"}
                                                </div>
                                            </div>
                                        </TableCell>

                                        {/* Customer Info */}
                                        <TableCell className="align-middle whitespace-nowrap">
                                            <div className="flex flex-col gap-1">
                                                <span className="font-medium bg-green-100 text-green-800 px-2 py-1 rounded text-sm inline-block mb-2 w-fit">
                                                    {req?.request_code || "-"}
                                                </span>
                                                <span className="font-bold text-base">{cust?.company_name || "-"}</span>
                                                <span className="font-medium">{req?.title || "-"}</span>

                                                <div className="text-sm text-muted-foreground flex flex-col gap-1 mt-1">
                                                    <div><span className="font-semibold">No Surat:</span> {req?.letter_number || "-"}</div>
                                                    <div><span className="font-semibold">PIC:</span> {req?.customer_pic?.name || "-"}</div>
                                                    <div><span className="font-semibold">Tanggal:</span> {req?.created_at ? format(new Date(req.created_at), "dd/MM/yyyy") : "-"}</div>

                                                    {req?.customer_attachments && req.customer_attachments.length > 0 && (
                                                        <div className="flex flex-wrap gap-2 mt-1">
                                                            {req.customer_attachments.map((att: any, i: number) => (
                                                                <a
                                                                    key={i}
                                                                    href={getStorageUrl(att.file_path, "request-attachments")}
                                                                    target="_blank"
                                                                    className="flex items-center gap-1 text-blue-600 hover:underline text-xs"
                                                                >
                                                                    <LinkIcon className="h-3 w-3" />
                                                                    {att.file_name || `data ${i + 1}`}
                                                                </a>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </TableCell>

                                        {/* Neraca */}
                                        <TableCell className="align-middle whitespace-nowrap">
                                            <div className="flex flex-col gap-1">
                                                <div className="text-sm font-mono bg-amber-50 text-amber-900 border border-amber-200 px-1 rounded w-fit">
                                                    {item.balance_code || "-"}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {item.balance_date ? format(new Date(item.balance_date), "dd/MM/yyyy") : "-"}
                                                </div>
                                            </div>
                                        </TableCell>

                                        {/* Quotation */}
                                        <TableCell className="align-middle whitespace-nowrap">
                                            <div className="flex flex-col gap-1">
                                                <div className="font-mono text-sm bg-muted px-2 py-1 rounded inline-block w-fit">
                                                    {q?.quotation_number || "-"}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {q?.created_at ? format(new Date(q.created_at), "dd/MM/yyyy") : "-"}
                                                </div>
                                            </div>
                                        </TableCell>

                                        {userRole && userRole !== 'staff' && (
                                            <TableCell className="align-middle whitespace-nowrap">
                                                <div className="flex flex-col gap-1 items-center justify-center h-full mt-2">
                                                    <span className="text-sm font-medium">{item.creator?.name || "-"}</span>
                                                </div>
                                            </TableCell>
                                        )}

                                        {/* PO In */}

                                        {/* PO In */}
                                        <TableCell className="align-middle whitespace-nowrap">
                                            <div className="flex flex-col space-y-1">
                                                <span className="font-medium">{po?.subject || "-"}</span>
                                                <span className="text-xs text-muted-foreground">
                                                    No Surat: <span className="text-foreground/80">{po?.vendor_letter_number || "-"}</span>
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    Tanggal: <span className="text-foreground/80">{po?.vendor_letter_date ? format(new Date(po.vendor_letter_date), "dd/MM/yyyy") : "-"}</span>
                                                </span>
                                                {po?.attachments?.length > 0 && (
                                                    <div className="flex flex-wrap gap-1 pt-1">
                                                        {po.attachments.map((att: any, i: number) => (
                                                            <a key={i} href={getStorageUrl(att.file_path, "purchase-order-attachments")} target="_blank" className="text-blue-600 flex items-center text-xs hover:underline">
                                                                <LinkIcon className="h-3 w-3 mr-1" /> File
                                                            </a>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </TableCell>



                                        {/* Actions */}
                                        <TableCell className="text-right align-middle pt-4 relative overflow-hidden whitespace-nowrap">
                                            {po?.is_completed && (
                                                <div className="absolute top-0 right-0 w-[80px] h-[80px] overflow-hidden pointer-events-none">
                                                    <div className="absolute top-[12px] right-[-28px] w-[100px] text-center rotate-45 bg-green-500 text-white text-[10px] font-bold py-1 shadow-sm select-none">
                                                        SELESAI
                                                    </div>
                                                </div>
                                            )}
                                            <div className="flex flex-col gap-2 items-end">
                                                <Button
                                                    onClick={() => handleOpenModal(item)}
                                                    className="bg-blue-600 hover:bg-blue-700 w-full"
                                                >
                                                    <Truck className="w-4 h-4 mr-2" />
                                                    {canManage && (item.created_by === userId || userRole === 'super_admin') ? "Update Tracking" : "Lihat Tracking"}
                                                </Button>

                                                <Button
                                                    variant="outline"
                                                    className="w-full"
                                                    onClick={() => {
                                                        setSelectedPrintItem(item);
                                                        setIsPrintModalOpen(true);
                                                    }}
                                                >
                                                    <Printer className="w-4 h-4 mr-2" />
                                                    Cetak Surat Jalan
                                                </Button>

                                                {!po?.invoice_number && canManage && (item.created_by === userId || userRole === 'super_admin') && (
                                                    <DeleteConfirmationDialog
                                                        onDelete={() => handleDelete(item.id)}
                                                        trigger={
                                                            <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10 border-destructive/20 w-full">
                                                                <Trash2 className="h-4 w-4 mr-2" />
                                                                Hapus Tracking
                                                            </Button>
                                                        }
                                                    />
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })

                        ) : (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center p-8 text-muted-foreground">
                                    {searchQuery ? "Pencarian tidak ditemukan" : "Belum ada pengiriman"}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination Controls */}
            {filteredItems.length > 0 && (
                <div className="flex items-center justify-between p-4 border rounded-lg bg-card text-card-foreground shadow-sm">
                    <div className="text-sm text-muted-foreground">
                        Menampilkan {(currentPage - 1) * itemsPerPage + 1} sampai {Math.min(currentPage * itemsPerPage, filteredItems.length)} dari {filteredItems.length} entri
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

            {
                selectedItem && (
                    <TrackingModal
                        open={isTrackingModalOpen}
                        onOpenChange={setIsTrackingModalOpen}
                        internalLetterId={selectedItem.id}
                        letterDetails={selectedItem.po_in}
                        isOwner={selectedItem.created_by === userId}
                        isSuperAdmin={userRole === 'super_admin'}
                    />
                )
            }

            {
                selectedPrintItem && (
                    <SuratJalanPrintModal
                        open={isPrintModalOpen}
                        onOpenChange={setIsPrintModalOpen}
                        trackingItem={selectedPrintItem}
                    />
                )
            }
        </div >
    );
}
