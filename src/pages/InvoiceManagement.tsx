import { useState, useEffect } from "react";
import { usePermission } from "@/hooks/usePermission";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Link } from "react-router-dom";
import { startOfDay, endOfDay, isWithinInterval, format, isValid } from "date-fns";
import { id } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import { DatePickerWithRange } from "@/components/ui/date-picker-with-range";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Link as LinkIcon, Printer, Search, RefreshCw, Trash2, ChevronLeft, ChevronRight, ChevronsUpDown, Check as CheckIcon } from "lucide-react";
import { DeleteConfirmationDialog } from "@/components/DeleteConfirmationDialog";
import InvoicePrintModal from "@/components/invoices/InvoicePrintModal";


export default function InvoiceManagement() {
    const { userId, userRole, canManage, loading: permLoading } = usePermission("invoices");
    const [invoices, setInvoices] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    // Filters
    const [dateRange, setDateRange] = useState<DateRange | undefined>();
    const [customers, setCustomers] = useState<any[]>([]);
    const [selectedCustomerFilter, setSelectedCustomerFilter] = useState<string>("all");
    const [openCustomerCombobox, setOpenCustomerCombobox] = useState(false);

    // Deprecated old search term if present, using searchQuery for standardization
    // const [searchTerm, setSearchTerm] = useState(""); 
    const [isLoading, setIsLoading] = useState(true);
    const [isError, setIsError] = useState(false);
    const [company, setCompany] = useState<any>(null);
    const [signer, setSigner] = useState<any>(null);

    // Print Modal State
    const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
    const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

    const [creatorMap, setCreatorMap] = useState<Record<string, string>>({});

    useEffect(() => {
        if (permLoading) return;
        fetchInvoices();
        fetchCompanyData();
        fetchCreators();
        fetchCustomers();
    }, [userId, userRole, permLoading]);

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

    const fetchCompanyData = async () => {
        const { data } = await supabase.from("company").select("*").maybeSingle();
        if (data) setCompany(data);

        const { data: members } = await supabase
            .from("team_members")
            .select("name, position")
            .or("position.ilike.%direktur%,position.ilike.%director%")
            .limit(1);

        if (members && members.length > 0) {
            setSigner(members[0]);
        }
    };

    const fetchInvoices = async () => {
        setIsLoading(true);
        setIsError(false);
        let query = supabase
            .from("po_ins")
            .select(`
        *,
        is_completed,
        attachments:po_in_attachments(id, file_name, file_path),
        quotation:quotations(
          id,
          quotation_number,
          created_at,
          request:requests(
            id,
            title,
            letter_number,
            request_code,
            request_date,
            created_at,
            customer:customers(id, company_name, delivery_address, customer_code),
            customer_pic:customer_pics(name),
            customer_attachments:request_attachments(file_name, file_path)
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
        ),
        creator:team_members(name)
      `);

        if (userRole !== "super_admin" && userRole !== "pimpinan" && userId) {
            query = query.eq("created_by", userId);
        }

        const { data, error } = await query
            .not('invoice_number', 'is', null) // Only fetch validated invoices
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Error fetching invoices:", error);
            toast.error("Gagal mengambil data invoice");
            setIsError(true);
            setIsLoading(false);
            return;
        }

        // Process to resolve balance codes
        const processedInvoices = (data || []).map((inv: any) => {
            let balanceCode = "-";
            let balanceDate = null;
            if (inv.quotation?.quotation_balances?.length > 0) {
                const pb = inv.quotation.quotation_balances[0];
                const entry = pb.balance?.balance_entries?.find((e: any) => e.id === pb.entry_id);
                if (entry) balanceCode = entry.code;
                if (pb.balance?.created_at) balanceDate = pb.balance.created_at;
            }

            return {
                ...inv,
                balance_code: balanceCode,
                balance_date: balanceDate
            };
        });

        setInvoices(processedInvoices);
        setIsLoading(false);
    };

    const handleDeleteInvoice = async (invoiceId: string) => {
        const toastId = toast.loading("Menghapus invoice...");
        try {
            const { error } = await supabase
                .from("po_ins")
                .update({
                    invoice_number: null,
                    invoice_date: null
                })
                .eq("id", invoiceId);

            if (error) throw error;
            toast.success("Invoice berhasil dihapus/dibatalkan", { id: toastId });
            fetchInvoices();
        } catch (e) {
            console.error(e);
            toast.error("Gagal menghapus invoice", { id: toastId });
        }
    };

    const handleStatusToggle = async (invoiceId: string, currentStatus: string) => {
        const newStatus = currentStatus === 'approved' ? 'pending' : 'approved';

        // Optimistic Update
        setInvoices(invoices.map(inv =>
            inv.id === invoiceId ? { ...inv, status: newStatus } : inv
        ));

        const toastId = toast.loading("Memperbarui status...");
        try {
            const { error } = await supabase
                .from("po_ins")
                .update({
                    status: newStatus,
                    approved_at: newStatus === 'approved' ? new Date().toISOString() : null
                })
                .eq("id", invoiceId);

            if (error) throw error;
            toast.success(`Status berhasil diubah menjadi ${newStatus}`, { id: toastId });
        } catch (e) {
            console.error(e);
            toast.error("Gagal mengubah status", { id: toastId });
            // Revert optimistic update
            setInvoices(invoices.map(inv =>
                inv.id === invoiceId ? { ...inv, status: currentStatus } : inv
            ));
        }
    };

    const handleToggleComplete = async (id: string, currentIsCompleted: boolean) => {
        const newIsCompleted = !currentIsCompleted;

        const { error } = await supabase.from('po_ins').update({ is_completed: newIsCompleted }).eq('id', id);
        if (error) {
            console.error(error);
            toast.error("Gagal mengubah status selesai");
        } else {
            toast.success(newIsCompleted ? "Proyek Ditandai Selesai" : "Status selesai dibatalkan");

            // Allow auto-delete of unused balance entries if completed
            if (newIsCompleted) {
                const invoice = invoices.find(i => i.id === id);
                if (invoice && invoice.quotation?.request?.id) {
                    const requestId = invoice.quotation.request.id;

                    // 1. Get all balances for this request
                    const { data: balances } = await supabase
                        .from('balances')
                        .select('id')
                        .eq('request_id', requestId);

                    if (balances && balances.length > 0) {
                        const balanceIds = balances.map(b => b.id);

                        // 2. Get all entries for these balances
                        const { data: entries } = await supabase
                            .from('balance_entries')
                            .select('id')
                            .in('balance_id', balanceIds);

                        if (entries && entries.length > 0) {
                            const entryIds = entries.map(e => e.id);

                            // 3. Check which ones are linked to quotations
                            const { data: linked } = await supabase
                                .from('quotation_balances')
                                .select('entry_id')
                                .in('entry_id', entryIds);

                            const linkedIds = new Set(linked?.map(l => l.entry_id));
                            const unlinkedIds = entryIds.filter(id => !linkedIds.has(id));

                            // 4. Delete unlinked entries
                            if (unlinkedIds.length > 0) {
                                const { error: delError } = await supabase
                                    .from('balance_entries')
                                    .delete()
                                    .in('id', unlinkedIds);

                                if (delError) console.error("Error cleaning up balances:", delError);
                                else toast.info(`${unlinkedIds.length} data neraca tidak terpakai dihapus.`);
                            }
                        }
                    }
                }
            }

            fetchInvoices();
        }
    };

    const handlePrint = (invoice: any) => {
        setSelectedInvoice(invoice);
        setIsPrintModalOpen(true);
    };

    const getStorageUrl = (path: string, bucket: string = "company-files") => {
        return `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
    };

    const filteredInvoices = invoices.filter((inv) => {
        const searchLower = searchQuery.toLowerCase();
        const invoiceNumber = inv.invoice_number?.toLowerCase() || "";
        const customer = inv.quotation?.request?.customer?.company_name?.toLowerCase() || "";
        const subject = inv.subject?.toLowerCase() || "";
        const requestCode = inv.quotation?.request?.request_code?.toLowerCase() || "";

        const matchesSearch = invoiceNumber.includes(searchLower) ||
            customer.includes(searchLower) ||
            subject.includes(searchLower) ||
            requestCode.includes(searchLower);

        if (!matchesSearch) return false;

        // Date Filter (using invoice_date)
        if (dateRange?.from) {
            const invDate = inv.invoice_date ? new Date(inv.invoice_date) : null;
            if (invDate) {
                if (dateRange.to) {
                    if (!isWithinInterval(invDate, { start: startOfDay(dateRange.from), end: endOfDay(dateRange.to) })) return false;
                } else {
                    if (format(invDate, 'yyyy-MM-dd') !== format(dateRange.from, 'yyyy-MM-dd')) return false;
                }
            }
        }

        // Customer Filter
        if (selectedCustomerFilter !== "all") {
            const custId = inv.quotation?.request?.customer?.id;
            if (custId !== selectedCustomerFilter) return false;
        }

        return true;
    });

    const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage);
    const paginatedInvoices = filteredInvoices.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, itemsPerPage]);

    return (
        <div className="container mx-auto py-6 space-y-6">


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
                            Total Data: <span className="text-foreground">{filteredInvoices.length}</span>
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
                </div>
            </div>
            <div className="border rounded-lg">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-12 text-center align-middle whitespace-nowrap border-r border-gray-100">No</TableHead>
                            <TableHead className="w-12 text-center align-middle whitespace-nowrap"></TableHead>

                            <TableHead className="text-center align-middle whitespace-nowrap border-r border-gray-100">No Invoice</TableHead>
                            <TableHead className="text-center align-middle whitespace-nowrap">Info Permintaan</TableHead>
                            <TableHead className="text-center align-middle whitespace-nowrap">No Neraca</TableHead>
                            <TableHead className="text-center align-middle whitespace-nowrap">No Penawaran</TableHead>
                            {userRole && userRole !== 'staff' && <TableHead className="text-center align-middle whitespace-nowrap">Dibuat Oleh</TableHead>}
                            <TableHead className="text-center align-middle whitespace-nowrap">Info PO In</TableHead>
                            <TableHead className="text-center align-middle whitespace-nowrap">Aksi</TableHead>
                        </TableRow>
                    </TableHeader >
                    <TableBody>
                        {isLoading ? (
                            Array.from({ length: itemsPerPage }).map((_, index) => (
                                <TableRow key={index}>
                                    <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>

                                    <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                    {userRole && userRole !== 'staff' && <TableCell><Skeleton className="h-4 w-32" /></TableCell>}
                                    <TableCell><Skeleton className="h-4 w-8 ml-auto" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                                </TableRow>
                            ))
                        ) : isError ? (
                            <TableRow>
                                <TableCell colSpan={9} className="text-center text-red-500 p-8">
                                    Pastikan koneksi internet anda baik
                                </TableCell>
                            </TableRow>
                        ) : filteredInvoices.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={9} className="text-center text-muted-foreground p-8">
                                    {searchQuery ? "Pencarian tidak ditemukan" : "Belum ada invoice yang dibuat"}
                                </TableCell>
                            </TableRow>
                        ) : (
                            paginatedInvoices.map((inv, index) => {
                                const globalIndex = (currentPage - 1) * itemsPerPage + index + 1;
                                return (
                                    <TableRow key={inv.id} className="relative group">
                                        <TableCell className="text-center align-middle relative overflow-hidden p-0 h-16 border-r border-gray-100">
                                            <span className="relative z-10">{globalIndex}</span>
                                            {/* Corner Ribbon */}
                                            <div className="absolute top-0 left-0 w-[75px] h-[75px] overflow-hidden pointer-events-none">
                                                <div className={`absolute top-[10px] left-[-30px] w-[100px] text-center -rotate-45 ${(inv.status === 'approved') ? 'bg-emerald-600' : 'bg-amber-600'} text-white text-[9px] font-bold py-1 shadow-sm`}>
                                                    {(inv.status === 'approved') ? 'OK' : 'PEND'}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center align-middle">
                                            {(userRole === 'pimpinan' && !inv.is_completed && inv.created_by !== userId) ? (
                                                <div className="w-4 h-4 mx-auto" />
                                            ) : (
                                                <Checkbox
                                                    checked={inv.is_completed}
                                                    onCheckedChange={() => {
                                                        if (inv.status !== 'approved') {
                                                            toast.error("Belum bisa ditandai selesai, tunggu di approve");
                                                            return;
                                                        }
                                                        handleToggleComplete(inv.id, inv.is_completed);
                                                    }}
                                                    disabled={(userRole !== 'staff' && !canManage) || (userRole === 'pimpinan' && inv.is_completed && inv.created_by !== userId)}
                                                />
                                            )}
                                        </TableCell>


                                        {/* No Invoice Column */}
                                        <TableCell className="align-middle whitespace-nowrap border-r border-gray-100">
                                            <div className="flex flex-col gap-1">
                                                <div className="font-mono bg-purple-100 text-purple-700 px-2 py-1 rounded inline-block w-fit">
                                                    {inv.invoice_number}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {inv.invoice_date && isValid(new Date(inv.invoice_date)) ? format(new Date(inv.invoice_date), "dd/MM/yyyy", { locale: id }) : "-"}
                                                </div>
                                            </div>
                                        </TableCell>

                                        {/* Customer Info Column (Full Detail) */}
                                        <TableCell className="align-middle bg-white/50 relative whitespace-nowrap">
                                            {inv.is_completed && (
                                                <div className="hidden" />
                                            )}
                                            <div className="flex flex-col gap-1 relative z-10">
                                                <span className="font-medium bg-green-100 text-green-800 px-2 py-1 rounded text-xs inline-block mb-2 w-fit">
                                                    {inv.quotation?.request?.request_code || "-"}
                                                </span>
                                                <span className="font-bold text-base">{inv.quotation?.request?.customer?.company_name || "-"}</span>
                                                <span className="font-medium">{inv.quotation?.request?.title || "-"}</span>

                                                <div className="text-sm text-muted-foreground flex flex-col gap-1 mt-1">
                                                    <div>
                                                        <span className="font-semibold">No Surat:</span> {inv.quotation?.request?.letter_number || "-"}
                                                    </div>
                                                    <div>
                                                        <span className="font-semibold">PIC:</span> {inv.quotation?.request?.customer_pic?.name || "-"}
                                                    </div>
                                                    <div>
                                                        <span className="font-semibold">Tanggal:</span> {inv.quotation?.request?.created_at && isValid(new Date(inv.quotation?.request?.created_at)) ? format(new Date(inv.quotation?.request?.created_at), "dd/MM/yyyy", { locale: id }) : "-"}
                                                    </div>

                                                    {inv.quotation?.request?.customer_attachments && inv.quotation.request.customer_attachments.length > 0 && (
                                                        <div className="flex flex-wrap gap-2 mt-1">
                                                            {inv.quotation.request.customer_attachments.map((attachment: any, i: number) => (
                                                                <a
                                                                    key={i}
                                                                    href={getStorageUrl(attachment.file_path, "request-attachments")}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="flex items-center gap-1 text-blue-600 hover:underline text-xs"
                                                                >
                                                                    <LinkIcon className="h-3 w-3" />
                                                                    {attachment.file_name || `data ${i + 1}`}
                                                                </a>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </TableCell>

                                        <TableCell className="align-middle whitespace-nowrap">
                                            <Link to="/balances" className="block w-fit">
                                                <div className="flex flex-col gap-1">
                                                    <div className="text-sm font-mono bg-amber-50 text-amber-900 border border-amber-200 px-1 rounded w-fit hover:bg-amber-100 transition-colors">
                                                        {inv.balance_code || "-"}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {inv.balance_date && isValid(new Date(inv.balance_date)) ? format(new Date(inv.balance_date), "dd/MM/yyyy", { locale: id }) : "-"}
                                                    </div>
                                                </div>
                                            </Link>
                                        </TableCell>

                                        <TableCell className="align-middle whitespace-nowrap">
                                            <Link to="/quotations" className="block w-fit">
                                                <div className="flex flex-col gap-1">
                                                    <div className="font-mono text-sm bg-muted px-2 py-1 rounded inline-block">
                                                        {inv.quotation?.quotation_number}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {inv.quotation?.created_at && isValid(new Date(inv.quotation.created_at)) ? format(new Date(inv.quotation.created_at), "dd/MM/yyyy", { locale: id }) : "-"}
                                                    </div>
                                                </div>
                                            </Link>
                                        </TableCell>

                                        {
                                            userRole && userRole !== 'staff' && (
                                                <TableCell className="align-middle whitespace-nowrap">
                                                    <div className="flex flex-col gap-1 items-center justify-center h-full mt-2">
                                                        {(() => {
                                                            const rawId = (inv as any).created_by;
                                                            let name = "-";

                                                            if (rawId && creatorMap[rawId]) {
                                                                name = creatorMap[rawId];
                                                            } else {
                                                                const creator = inv.creator;
                                                                if (Array.isArray(creator) && creator.length > 0) name = creator[0]?.name;
                                                                else if (creator && typeof creator === 'object' && 'name' in creator) name = (creator as any).name;
                                                                else name = rawId || "-";
                                                            }

                                                            return <span className="text-sm font-medium">{name}</span>;
                                                        })()}
                                                    </div>
                                                </TableCell>
                                            )
                                        }

                                        {/* Info PO In Column */}

                                        {/* Info PO In Column */}
                                        <TableCell className="align-middle whitespace-nowrap">
                                            <div className="flex flex-col space-y-1">
                                                <span className="font-medium">{inv.subject || "-"}</span>
                                                <span className="text-xs text-muted-foreground">
                                                    No Surat: <span className="text-foreground/80">{inv.vendor_letter_number || "-"}</span>
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    Tanggal: <span className="text-foreground/80">{inv.vendor_letter_date ? format(new Date(inv.vendor_letter_date), "dd/MM/yyyy") : "-"}</span>
                                                </span>
                                                {inv.attachments?.length > 0 && (
                                                    <div className="flex flex-wrap gap-1 pt-1">
                                                        {inv.attachments.map((att: any, ai: number) => (
                                                            <a key={ai} href={getStorageUrl(att.file_path, 'purchase-order-attachments')} target="_blank" className="text-blue-600 hover:underline flex items-center text-xs">
                                                                <LinkIcon className="h-3 w-3 mr-1" /> File
                                                            </a>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </TableCell>

                                        <TableCell className="text-center align-middle relative overflow-hidden whitespace-nowrap">
                                            {/* Corner Ribbon for SELESAI */}
                                            {inv.is_completed && (
                                                <div className="absolute top-0 right-0 w-[75px] h-[75px] overflow-hidden pointer-events-none z-20">
                                                    <div className="absolute top-[10px] right-[-30px] w-[100px] text-center rotate-45 bg-green-600 text-white text-[9px] font-bold py-1 shadow-sm">
                                                        SELESAI
                                                    </div>
                                                </div>
                                            )}
                                            <div className="flex flex-col gap-2 items-center relative z-10">
                                                <div className="flex justify-center gap-1">
                                                    <Button variant="ghost" size="icon" onClick={() => {
                                                        if (inv.status !== 'approved') {
                                                            toast.error("Belum bisa dicetak, tunggu di approve");
                                                            return;
                                                        }
                                                        handlePrint(inv);
                                                    }}>
                                                        <Printer className="h-4 w-4" />
                                                    </Button>
                                                    {(!inv.is_completed && ((userRole === 'staff') || (userRole === 'super_admin') || (userRole === 'pimpinan' && inv.created_by === userId))) && (
                                                        <DeleteConfirmationDialog
                                                            onDelete={() => handleDeleteInvoice(inv.id)}
                                                            trigger={
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            }
                                                        />
                                                    )}
                                                </div>

                                                {/* Pimpinan Toggle */}
                                                {userRole === 'pimpinan' && (
                                                    <div className="flex items-center space-x-2 mt-1 bg-gray-50 p-1 rounded border">
                                                        <span className={`text-[10px] font-bold ${inv.status === 'approved' ? 'text-green-600' : 'text-yellow-600'}`}>
                                                            {inv.status === 'approved' ? 'Aprv' : 'Pend'}
                                                        </span>
                                                        <Switch
                                                            checked={inv.status === 'approved'}
                                                            onCheckedChange={() => handleStatusToggle(inv.id, inv.status || 'pending')}
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
                </Table >
            </div >


            {/* Pagination Controls */}
            {filteredInvoices.length > 0 && (
                <div className="flex items-center justify-between p-4 border rounded-lg bg-card text-card-foreground shadow-sm">
                    <div className="text-sm text-muted-foreground">
                        Menampilkan {(currentPage - 1) * itemsPerPage + 1} sampai {Math.min(currentPage * itemsPerPage, filteredInvoices.length)} dari {filteredInvoices.length} entri
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
            <InvoicePrintModal
                open={isPrintModalOpen}
                onOpenChange={setIsPrintModalOpen}
                invoice={selectedInvoice}
                company={company}
            />
        </div >
    );
}
