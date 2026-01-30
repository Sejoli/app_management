import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { CompletedStamp } from "@/components/ui/CompletedStamp";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DeleteConfirmationDialog } from "@/components/DeleteConfirmationDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Edit, Printer, Mail, PhoneCall, Link as LinkIcon, Trash2, ShoppingBag, Search, ChevronLeft, ChevronRight, Plus, FileDown, Loader2, CalendarClock, MoreHorizontal, Check, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";
import { format, isValid, differenceInWeeks, differenceInDays, startOfDay, endOfDay, isWithinInterval } from "date-fns";
import { DateRange } from "react-day-picker";
import { DatePickerWithRange } from "@/components/ui/date-picker-with-range";
import { id as idLocale } from "date-fns/locale";
import { usePermission } from "@/hooks/usePermission";
import { useNavigate, Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import QuotationEditor from "@/components/quotation/QuotationEditor";
import { Skeleton } from "@/components/ui/skeleton";

interface Request {
  id: string;
  request_code: string;
  letter_number: string;
  customer: {
    id: string;
    customer_code: string;
    company_name: string;
    delivery_address: string;
  };
  customer_pic: {
    name: string;
    phone: string;
  };
  title: string;
  request_date: string;
}

interface BalanceEntry {
  id: number;
  code: string;
}

interface Balance {
  balance_entries: BalanceEntry[];
  created_at?: string;
}

interface QuotationBalance {
  balance_id: string;
  entry_id: number;
  balance: Balance;
}

interface Attachment {
  file_name: string;
  file_path: string;
}

interface Quotation {
  id: string;
  quotation_number: string;
  created_at: string;
  status: string;
  request_id: string;
  request: Request;
  quotation_balances: QuotationBalance[];
  attachments: Attachment[];
  purchase_order_quotations: { purchase_order_id: string }[];
  creator?: { name: string };
  created_by?: string;
  po_ins?: { id: string; status: string; is_completed: boolean }[];
  display_balance_code?: string;
  balance_date?: string;
  compositeId?: string;
  last_follow_up_at?: string;
  is_closed?: boolean;
}

export default function Quotations() {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [selectedCustomer, setSelectedCustomer] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedQuotations, setSelectedQuotations] = useState<Set<string>>(new Set());
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [openCombobox, setOpenCombobox] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { canManage, userRole, userId } = usePermission("quotations");
  const navigate = useNavigate();


  const navigator = useNavigate();

  const handleFollowUp = async (quotationId: string, quotation: Quotation) => {
    // 1. Open WhatsApp Logic (Immediate)
    const picPhone = quotation.request?.customer_pic?.phone;
    if (picPhone) {
      // Format phone number: remove non-digits, replace leading 0 with 62
      let formattedPhone = picPhone.replace(/\D/g, "");
      if (formattedPhone.startsWith("0")) {
        formattedPhone = "62" + formattedPhone.slice(1);
      }

      const letterNumber = quotation.request?.letter_number || "-";
      const requestDate = quotation.request?.request_date ? format(new Date(quotation.request.request_date), "dd/MM/yyyy", { locale: idLocale }) : "-";
      const quotationNumber = quotation.quotation_number || "-";

      const hour = new Date().getHours();
      let greeting = "pagi";
      if (hour >= 11 && hour < 15) greeting = "siang";
      else if (hour >= 15 && hour < 19) greeting = "sore";
      else if (hour >= 19 || hour < 4) greeting = "malam";

      const message = `Selamat ${greeting} Bapak/Ibu
Izin follow up terkait :
permintaan no ${letterNumber} tanggal ${requestDate}, dengan no quotation ${quotationNumber}
apakah ada kabar baik ?`;

      const waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
      window.open(waUrl, "_blank");
    } else {
      toast.warning("PIC tidak memiliki nomor telepon terdaftar");
    }

    // 2. Update Database Status (Only if > 7 days or never followed up)
    const isRecentlyFollowedUp = quotation.last_follow_up_at && differenceInDays(new Date(), new Date(quotation.last_follow_up_at)) < 7;

    if (!isRecentlyFollowedUp) {
      const toastId = toast.loading("Mengupdate status follow up...");
      const { error } = await supabase
        .from("quotations")
        .update({ last_follow_up_at: new Date().toISOString() })
        .eq("id", quotationId);

      if (error) {
        console.error(error);
        toast.error("Gagal update follow up (Database)", { id: toastId });
      } else {
        toast.success("Status follow up diperbarui", { id: toastId });
        fetchQuotations(); // Refresh list
      }
    } else {
      toast.info("WhatsApp dibuka (Status tidak diperbarui karena sudah follow-up minggu ini)");
    }
  };
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    fetchQuotations();
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    const { data } = await supabase
      .from("customers")
      .select("id, company_name")
      .order("company_name", { ascending: true });
    if (data) setCustomers(data);
  };

  const fetchQuotations = async () => {

    setIsLoading(true);
    setIsError(false);
    const { data, error } = await supabase
      .from("quotations")
      .select(`
  *,
  is_closed,
  request: requests(
    id,
    request_code,
    letter_number,
    title,
    request_date,
    customer: customers(id, customer_code, company_name, delivery_address),
    customer_pic: customer_pics(name, phone)
  ),
    quotation_balances(
      balance_id,
      entry_id,
      balance: balances(
        created_at,
        balance_entries
      )
    ),
    purchase_order_quotations(
      purchase_order_id
    ),
    po_ins(id, status, is_completed),
    creator: team_members!fk_created_by_team_member(name)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching quotations:", error);
      toast.error("Gagal mengambil data quotation");
      setIsError(true);
      setIsLoading(false);
      return;
    }


    // Attachments are usually on the Request directly.
    // Let's fetch attachments for these requests.
    const quotationsWithAttachments = await Promise.all(
      (data || []).map(async (q: any) => {
        const { data: attachments } = await supabase
          .from("request_attachments")
          .select("file_name, file_path")
          .eq("request_id", q.request_id);

        return {
          ...q,
          attachments: attachments || []
        };
      })
    );

    setQuotations(quotationsWithAttachments);
    setIsLoading(false);
  };

  const handleDelete = async (id: string) => {
    // Manually delete related quotation_balances first to avoid FK constraint error
    const { error: errorBalances } = await supabase.from("quotation_balances").delete().eq("quotation_id", id);
    if (errorBalances) {
      console.error("Error deleting balances:", errorBalances);
      // Continue trying to delete quotation anyway, or stop?
      // Usually safe to notify but try main delete in case balances were already gone.
    }

    const { error } = await supabase.from("quotations").delete().eq("id", id);
    if (error) {
      console.error(error);
      toast.error("Gagal menghapus quotation");
      return;
    }
    toast.success("Quotation berhasil dihapus");
    fetchQuotations();
  };

  const handleEdit = (quotation: Quotation) => {
    setSelectedQuotation(quotation);
    setIsEditorOpen(true);
  };

  const handleSendEmail = (quotation: Quotation) => {
    // Implement email sending logic here
    const subject = `Penawaran Harga - ${quotation.quotation_number} `;
    const body = `Yth.${quotation.request.customer.company_name}, \n\nBerikut kami lampirkan penawaran harga...`;
    window.location.href = `mailto:? subject = ${encodeURIComponent(subject)}& body=${encodeURIComponent(body)} `;
  };


  const handleCreatePO = () => {
    if (selectedQuotations.size === 0) {
      toast.error("Pilih minimal satu quotation");
      return;
    }
    const selectedIds = Array.from(selectedQuotations);
    navigate("/purchase-orders", { state: { selectedQuotationIds: selectedIds } });
  };

  const getStorageUrl = (path: string) => {
    return `${import.meta.env.VITE_SUPABASE_URL} /storage/v1 / object / public / request - attachments / ${path} `;
  };

  const flattenedQuotations = quotations.flatMap(q => {
    // If no balances, return the quotation as is (with placeholder for balance code)
    if (!q.quotation_balances || q.quotation_balances.length === 0) {
      return [{ ...q, display_balance_code: "-", compositeId: `${q.id}| -` }];
    }

    // Map each linked balance entry to a distinct row
    return q.quotation_balances.map(qb => {
      const entry = qb.balance?.balance_entries?.find((e: any) => e.id === qb.entry_id);
      return {
        ...q,
        display_balance_code: entry ? entry.code : "-",
        balance_date: qb.balance?.created_at,
        compositeId: `${q.id}| ${entry ? entry.code : "-"} `
      };
    });
  }).filter((q: any) => {
    const searchLower = searchTerm.toLowerCase();

    // Search Term Filter
    const matchesSearch = (
      q.request.request_code?.toLowerCase().includes(searchLower) ||
      q.request.letter_number?.toLowerCase().includes(searchLower) ||
      q.request.customer?.company_name?.toLowerCase().includes(searchLower) ||
      q.quotation_number?.toLowerCase().includes(searchLower) ||
      q.display_balance_code?.toLowerCase().includes(searchLower) ||
      q.request.title?.toLowerCase().includes(searchLower) ||
      q.creator?.name?.toLowerCase().includes(searchLower)
    );

    if (!matchesSearch) return false;

    // Date Filter
    if (dateRange?.from) {
      const qDate = new Date(q.created_at);
      if (dateRange.to) {
        if (!isWithinInterval(qDate, { start: startOfDay(dateRange.from), end: endOfDay(dateRange.to) })) return false;
      } else {
        // Exact date match (day)
        if (format(qDate, 'yyyy-MM-dd') !== format(dateRange.from, 'yyyy-MM-dd')) return false;
      }
    }

    // Customer Filter
    if (selectedCustomer !== "all") {
      if (q.request?.customer?.id !== selectedCustomer) return false;
    }

    return true;
  });

  const totalPages = Math.ceil(flattenedQuotations.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedQuotations = flattenedQuotations.slice(startIndex, startIndex + itemsPerPage);

  const toggleClosedStatus = async (quotationId: string, isClosed: boolean) => {
    const { error } = await supabase
      .from("quotations")
      .update({ is_closed: isClosed })
      .eq("id", quotationId);

    if (error) {
      console.error("Error updating status:", error);
      toast.error("Gagal update status");
    } else {
      toast.success(isClosed ? "Quotation ditutup" : "Quotation dibuka kembali");
      fetchQuotations();
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">

      </div>

      <div className="flex flex-col gap-4 bg-card p-4 rounded-lg border shadow-sm mt-6">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
          {/* Search Bar */}
          <div className="relative w-full md:max-w-xs">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari data..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-8 w-full"
            />
          </div>

          {/* Filters Group - Stack on mobile, Row on Desktop */}
          <div className="flex flex-col sm:flex-row gap-6 w-full md:w-auto">
            <DatePickerWithRange date={dateRange} setDate={setDateRange} className="w-full sm:w-[240px]" />

            <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={openCombobox}
                  className="w-full sm:w-[250px] justify-between"
                >
                  {selectedCustomer && selectedCustomer !== "all"
                    ? customers.find((c) => c.id === selectedCustomer)?.company_name
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
                          setSelectedCustomer("all");
                          setOpenCombobox(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedCustomer === "all" ? "opacity-100" : "opacity-0"
                          )}
                        />
                        Semua Customer
                      </CommandItem>
                      {customers.map((c) => (
                        <CommandItem
                          key={c.id}
                          value={c.company_name}
                          onSelect={() => {
                            setSelectedCustomer(c.id);
                            setOpenCombobox(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedCustomer === c.id ? "opacity-100" : "opacity-0"
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

        {/* Action Bar - Pagination & PO Button */}
        <div className="flex flex-wrap justify-between items-center gap-4 pt-2 border-t">
          <div className="flex items-center gap-4">
            <div className="text-sm font-medium text-muted-foreground bg-muted/50 px-3 py-1 rounded-md">
              Total Data: <span className="text-foreground">{flattenedQuotations.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground whitespace-nowrap">Baris per halaman:</span>
              <Select
                value={itemsPerPage.toString()}
                onValueChange={(v) => {
                  setItemsPerPage(Number(v));
                  setCurrentPage(1);
                }}
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

          {selectedQuotations.size > 0 && canManage && (
            <Button onClick={handleCreatePO} variant="default" className="w-full sm:w-auto">
              <ShoppingBag className="h-4 w-4 mr-2" />
              Buat Purchase Order ({selectedQuotations.size})
            </Button>
          )}
        </div>
      </div>

      <div className="border rounded-lg bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 whitespace-nowrap">No</TableHead>
                <TableHead className="whitespace-nowrap">Info Permintaan</TableHead>
                <TableHead className="w-12 whitespace-nowrap">
                  {/* Checkbox Header */}
                </TableHead>
                <TableHead className="whitespace-nowrap">No Neraca</TableHead>
                <TableHead className="whitespace-nowrap">No Penawaran</TableHead>
                {userRole && userRole !== 'staff' && <TableHead className="w-[150px] whitespace-nowrap">Dibuat Oleh</TableHead>}

                <TableHead className="w-48 text-right whitespace-nowrap">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                    <TableCell>
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-4 w-28" />
                      </div>
                    </TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    {userRole && userRole !== 'staff' && <TableCell><Skeleton className="h-4 w-32" /></TableCell>}
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Skeleton className="h-8 w-8" />
                        <Skeleton className="h-8 w-8" />
                        <Skeleton className="h-8 w-8" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={userRole !== 'staff' ? 7 : 6} className="text-center text-destructive p-8">
                    Pastikan koneksi internet anda baik
                  </TableCell>
                </TableRow>
              ) : paginatedQuotations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={userRole !== 'staff' ? 7 : 6} className="text-center text-muted-foreground p-8">
                    {searchTerm ? "Pencarian tidak ditemukan" : "Belum ada penawaran ditemukan"}
                  </TableCell>
                </TableRow>
              ) : (
                // Group logic
                Object.values(
                  paginatedQuotations.reduce((acc, q) => {
                    const reqId = q.request.id;
                    if (!acc[reqId]) acc[reqId] = [];
                    acc[reqId].push(q);
                    return acc;
                  }, {} as Record<string, typeof paginatedQuotations>)
                ).map((group, groupIndex) => {
                  return group.map((quotation, rowIndex) => {
                    const isFirst = rowIndex === 0;
                    return (
                      <TableRow key={`${quotation.id}-${rowIndex}`} className={quotation.is_closed ? "bg-muted/50" : ""}>
                        {/* Merged Columns (Render only for first row of group) */}
                        {isFirst && (
                          <>
                            <TableCell rowSpan={group.length} className="align-top bg-white/50 border-r whitespace-nowrap">
                              {startIndex + groupIndex + 1}
                            </TableCell>
                            <TableCell rowSpan={group.length} className="align-top bg-white/50 border-r relative whitespace-nowrap">
                              <div className="relative z-10">
                                <span className="font-medium bg-green-100 text-green-800 px-2 py-1 rounded inline-block mb-2">
                                  {quotation.request?.request_code || "-"}
                                </span>
                                <div className="flex flex-col gap-1">
                                  <span className="font-bold text-base">{quotation.request?.customer?.company_name || "-"}</span>
                                  <span className="font-medium">{quotation.request?.title || "-"}</span>
                                  <div className="text-sm text-muted-foreground flex flex-col gap-1">
                                    <div>
                                      <span className="font-semibold">No Surat:</span> {quotation.request?.letter_number || "-"}
                                    </div>
                                    <div>
                                      <span className="font-semibold">PIC:</span> {quotation.request?.customer_pic?.name || "-"}
                                    </div>
                                    <div>
                                      <span className="font-semibold">Tanggal:</span> {quotation.created_at && isValid(new Date(quotation.created_at)) ? format(new Date(quotation.created_at), "dd/MM/yyyy", { locale: idLocale }) : "-"}
                                    </div>
                                  </div>
                                  {quotation.attachments.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-1">
                                      {quotation.attachments.map((attachment, idx) => (
                                        <a
                                          key={idx}
                                          href={getStorageUrl(attachment.file_path)}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="flex items-center gap-1 text-blue-600 hover:underline text-xs"
                                        >
                                          <LinkIcon className="h-3 w-3" />
                                          data {idx + 1}
                                        </a>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                          </>
                        )}

                        {/* Individual Columns */}
                        <TableCell className="whitespace-nowrap">
                          {!quotation.is_closed && (
                            <Checkbox
                              checked={selectedQuotations.has((quotation as any).compositeId) || (quotation.purchase_order_quotations && quotation.purchase_order_quotations.length > 0)}
                              disabled={!canManage || (quotation.purchase_order_quotations && quotation.purchase_order_quotations.length > 0)}
                              onCheckedChange={(checked) => {
                                const compId = (quotation as any).compositeId;
                                if (checked) {
                                  // Single select: Replace entire set with just this one
                                  setSelectedQuotations(new Set([compId]));
                                } else {
                                  setSelectedQuotations(new Set());
                                }
                              }}
                            />
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Link to="/balances" className={`block w-fit ${quotation.is_closed ? "line-through opacity-50" : ""}`}>
                            <div className="flex flex-col gap-1">
                              <div className="text-sm font-mono bg-amber-50 text-amber-900 border border-amber-200 px-1 rounded w-fit hover:bg-amber-100 transition-colors">
                                {(quotation as any).display_balance_code}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {(quotation as any).balance_date && isValid(new Date((quotation as any).balance_date)) ? format(new Date((quotation as any).balance_date), "dd/MM/yyyy", { locale: idLocale }) : "-"}
                              </div>
                            </div>
                          </Link>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <div className={`flex flex-col gap-1 ${quotation.is_closed ? "line-through opacity-50" : ""}`}>
                            <div className="font-mono text-sm bg-muted px-2 py-1 rounded inline-block">
                              {quotation.quotation_number}{quotation.is_closed && <span className="text-red-600 font-bold"> (Tutup)</span>}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {quotation.created_at && isValid(new Date(quotation.created_at)) ? format(new Date(quotation.created_at), "dd/MM/yyyy", { locale: idLocale }) : "-"}
                            </div>
                          </div>
                        </TableCell>
                        {userRole && userRole !== 'staff' && (
                          <TableCell className="whitespace-nowrap">
                            <div className="flex flex-col gap-1 items-center justify-center h-full mt-2">
                              <span className="text-sm font-medium">{quotation.creator?.name || "-"}</span>
                            </div>
                          </TableCell>
                        )}

                        <TableCell className="text-right relative overflow-visible whitespace-nowrap">
                          {/* Corner Badge */}
                          {quotation.po_ins?.some((pi: any) => pi.is_completed) && (
                            <div className="absolute top-0 right-0 w-[75px] h-[75px] overflow-hidden pointer-events-none z-20">
                              <div className="absolute top-[10px] right-[-30px] w-[100px] text-center rotate-45 bg-green-600 text-white text-[9px] font-bold py-1 shadow-sm">
                                SELESAI
                              </div>
                            </div>
                          )}
                          <div className="flex justify-end gap-1 relative z-10 items-center">
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(quotation)} title="Edit/Cetak" disabled={quotation.is_closed}>
                              <Printer className="h-4 w-4" />
                            </Button>

                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="relative inline-block">
                                    {(() => {
                                      const weekAge = quotation.created_at ? differenceInWeeks(new Date(), new Date(quotation.created_at)) : 0;
                                      const isNew = weekAge === 0;
                                      const isRecent = quotation.last_follow_up_at ? differenceInDays(new Date(), new Date(quotation.last_follow_up_at)) < 7 : false;
                                      const isGreen = isNew || isRecent;
                                      const badgeNumber = isGreen ? weekAge : Math.max(0, weekAge - 1);

                                      return (
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => handleFollowUp(quotation.id, quotation)}
                                          className="relative"
                                          disabled={isGreen || quotation.is_closed}
                                        >
                                          <PhoneCall className="h-4 w-4" />
                                          <span className={`absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px] text-white ${isGreen ? 'bg-green-600' : 'bg-red-600'}`}>
                                            {badgeNumber}
                                          </span>
                                        </Button>
                                      );
                                    })()}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs">
                                    Terakhir follow up: {quotation.last_follow_up_at
                                      ? format(new Date(quotation.last_follow_up_at), "dd MMMM yyyy HH:mm", { locale: idLocale })
                                      : "Belum pernah"}
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>

                            {canManage && (quotation.created_by === userId || userRole === 'super_admin') && (!quotation.purchase_order_quotations || quotation.purchase_order_quotations.length === 0) && (
                              quotation.is_closed ? (
                                <Button variant="ghost" size="icon" title="Hapus (Tutup)" disabled>
                                  <Trash2 className="h-4 w-4 text-destructive opacity-50" />
                                </Button>
                              ) : (
                                <DeleteConfirmationDialog
                                  onDelete={() => handleDelete(quotation.id)}
                                  trigger={
                                    <Button variant="ghost" size="icon" title="Hapus">
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  }
                                />
                              )
                            )}

                            {canManage && (!quotation.purchase_order_quotations || quotation.purchase_order_quotations.length === 0) && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => toggleClosedStatus(quotation.id, false)}>
                                    Masih Buka
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => toggleClosedStatus(quotation.id, true)}>
                                    Sudah Tutup
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
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
      </div>

      {paginatedQuotations.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Menampilkan {startIndex + 1} sampai {Math.min(startIndex + itemsPerPage, flattenedQuotations.length)} dari {flattenedQuotations.length} entri
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
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
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="max-w-5xl max-h-[95vh] flex flex-col overflow-hidden">

          {selectedQuotation && (
            <QuotationEditor
              quotation={selectedQuotation as any}
              onClose={() => {
                setIsEditorOpen(false);
                fetchQuotations();
              }}
              onUpdate={fetchQuotations}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
