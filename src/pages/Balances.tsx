import { useState, useEffect } from "react";
import { usePermission } from "@/hooks/usePermission";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { DeleteConfirmationDialog } from "@/components/DeleteConfirmationDialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Plus, Trash2, Link as LinkIcon, Edit, Trash, FileText, Check, ChevronsUpDown, Search, Eye, ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { format, isToday, isThisWeek, isThisMonth, isValid } from "date-fns";
import { id } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Request {
  id: string;
  request_code: string;
  letter_number: string;
  created_at: string;
  customer: {
    company_name: string;
    delivery_address: string;
  };
  customer_pic: {
    name: string;
    phone: string;
  };
}

interface Balance {
  id: string;
  request_id: string;
  balance_entries: BalanceEntry[];
  created_at: string;
  request: {
    request_code: string;
    letter_number: string;
    title: string;
    request_date: string;
    customer: {
      company_name: string;
      delivery_address: string;
    };
    customer_pic: {
      name: string;
      phone: string;
    };
  };
  file_name: string;
  file_path: string;
  attachments?: { file_name: string; file_path: string }[];

  created_by?: string;
  creator?: { name: string; user_id?: string };
}

interface BalanceEntry {
  id: number;
  code: string;
  date: string;
}

interface QuotationLink {
  balance_id: string;
  entry_id: number;
  quotation?: {
    quotation_number: string;
    created_at?: string;
    is_closed?: boolean;
    po_ins?: { id: string; status?: string; is_completed?: boolean }[];
  };
}

export default function Balances() {
  const navigate = useNavigate();
  const [balances, setBalances] = useState<Balance[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [selectedRequestIds, setSelectedRequestIds] = useState<string[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState<"today" | "week" | "month" | "all">("today");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEntries, setSelectedEntries] = useState<Map<string, Set<number>>>(new Map());
  const [quotationLinks, setQuotationLinks] = useState<QuotationLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const { canManage, userId, userRole } = usePermission("balances");

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    fetchBalances();
    fetchRequests();
    fetchQuotationLinks();
  }, []);

  const fetchQuotationLinks = async () => {
    const { data, error } = await supabase
      .from("quotation_balances")
      .select(`
        balance_id,
        entry_id,
        quotation:quotations(
          quotation_number, 
          created_at,
          is_closed,
          po_ins(id, status, is_completed)
        )
      `);

    if (error) {
      console.error(error);
      return;
    }

    setQuotationLinks(data as any || []);
  };

  const fetchBalances = async () => {
    setIsLoading(true);
    setIsError(false);
    const { data, error } = await supabase
      .from("balances")
      .select(`
        *,
        request:requests(
          request_code,
          letter_number,
          title,
          request_date,
          customer:customers(*),
          customer_pic:customer_pics(*)
        ),
        creator:team_members!fk_created_by_team_member(name, user_id)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Gagal mengambil data neraca");
      setIsError(true);
      setIsLoading(false);
      return;
    }

    // Fetch attachments for each balance
    const balancesWithAttachments = await Promise.all(
      (data || []).map(async (balance) => {
        const { data: attachments } = await supabase
          .from("request_attachments")
          .select("file_name, file_path")
          .eq("request_id", balance.request_id);

        return {
          ...balance,
          attachments: attachments || [],
        };
      })
    );

    setBalances(balancesWithAttachments as any);
    setIsLoading(false);
  };

  const fetchRequests = async () => {
    const { data, error } = await supabase
      .from("requests")
      .select(`
        id,
        request_code,
        letter_number,
        created_at,
        customer:customers(company_name, delivery_address),
        customer_pic:customer_pics(name, phone)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    setRequests(data as Request[]);
  };

  const generateUniqueBalanceCode = (existingBalances: Balance[]): string => {
    let isUnique = false;
    let newCode = "";

    while (!isUnique) {
      const randomNumber = Math.floor(100000 + Math.random() * 900000); // 6 digit number
      newCode = `N-${randomNumber}`;

      // Check if this code exists in any balance entry
      const exists = existingBalances.some(balance =>
        balance.balance_entries.some(entry => entry.code === newCode)
      );

      if (!exists) {
        isUnique = true;
      }
    }

    return newCode;
  };

  const getFilteredRequests = () => {
    return requests.filter(req => {
      const date = new Date(req.created_at);
      if (dateFilter === "today") return isToday(date);
      if (dateFilter === "week") return isThisWeek(date, { weekStartsOn: 1 });
      if (dateFilter === "month") return isThisMonth(date);
      return true;
    });
  };

  const handleCreateBalance = async () => {
    if (selectedRequestIds.length === 0) {
      toast.error("Pilih minimal satu request");
      return;
    }

    let successCount = 0;

    for (const requestId of selectedRequestIds) {
      const now = new Date();
      const currentBalanceState = [...balances, ...Array(successCount).fill({ balance_entries: [] })];
      const uniqueCode = generateUniqueBalanceCode(currentBalanceState as any);

      const initialEntry: BalanceEntry = {
        id: 1,
        code: uniqueCode,
        date: now.toISOString(),
      };

      const { error } = await supabase.from("balances").insert({
        request_id: requestId,
        balance_entries: [initialEntry] as any,
      });

      if (error) {
        console.error(`Failed to create balance for request ${requestId}`, error);
      } else {
        successCount++;
      }
    }

    if (successCount > 0) {
      toast.success(`${successCount} Neraca berhasil dibuat`);
      setIsDialogOpen(false);
      setSelectedRequestIds([]);
      setDateFilter("today");
      fetchBalances();
    } else {
      toast.error("Gagal membuat neraca");
    }
  };

  const handleAddEntry = async (balanceId: string, currentEntries: BalanceEntry[]) => {
    const now = new Date();
    const nextId = currentEntries.length > 0
      ? Math.max(...currentEntries.map(e => e.id)) + 1
      : 1;

    const uniqueCode = generateUniqueBalanceCode(balances);

    const newEntry: BalanceEntry = {
      id: nextId,
      code: uniqueCode,
      date: now.toISOString(),
    };

    const updatedEntries = [...currentEntries, newEntry];

    const { error } = await supabase
      .from("balances")
      .update({ balance_entries: updatedEntries as any })
      .eq("id", balanceId);

    if (error) {
      toast.error("Gagal menambahkan entri");
      console.error(error);
      return;
    }

    toast.success("Entri berhasil ditambahkan");
    fetchBalances();
  };

  const handleDeleteBalance = async (id: string) => {
    const { error } = await supabase.from("balances").delete().eq("id", id);

    if (error) {
      toast.error("Gagal menghapus neraca");
      console.error(error);
      return;
    }

    toast.success("Neraca berhasil dihapus");
    fetchBalances();
  };

  const handleDeleteEntry = async (balanceId: string, entryId: number, currentEntries: BalanceEntry[]) => {
    const hasQuotation = quotationLinks.some(
      link => link.balance_id === balanceId && link.entry_id === entryId
    );

    if (hasQuotation) {
      toast.error("Entri ini sudah memiliki penawaran. Hapus penawaran terlebih dahulu.");
      return;
    }

    const updatedEntries = currentEntries.filter(entry => entry.id !== entryId);

    const { error } = await supabase
      .from("balances")
      .update({ balance_entries: updatedEntries as any })
      .eq("id", balanceId);

    if (error) {
      toast.error("Gagal menghapus entri");
      console.error(error);
      return;
    }

    toast.success("Entri berhasil dihapus");
    fetchBalances();
  };

  const handleEditEntry = (balanceId: string, entryId: number, entryCode: string) => {
    navigate(`/balances/${balanceId}/entry/${entryId}?code=${entryCode}`);
  };

  // Enhanced Filter Logic
  const filteredBalances = balances.filter((balance) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();

    // Check Balance Entries and Quotations
    const hasMatchingEntry = balance.balance_entries.some(entry => {
      if (entry.code.toLowerCase().includes(searchLower)) return true;
      const link = quotationLinks.find(l => l.balance_id === balance.id && l.entry_id === entry.id);
      if (link?.quotation?.quotation_number.toLowerCase().includes(searchLower)) return true;
      return false;
    });

    return (
      balance.request.request_code?.toLowerCase().includes(searchLower) ||
      balance.request.letter_number?.toLowerCase().includes(searchLower) ||
      balance.request.title?.toLowerCase().includes(searchLower) ||
      balance.request.customer?.company_name?.toLowerCase().includes(searchLower) ||
      balance.request.customer_pic?.name?.toLowerCase().includes(searchLower) ||
      balance.creator?.name?.toLowerCase().includes(searchLower) ||
      hasMatchingEntry
    );
  });

  const finalDisplayBalances = filteredBalances.map(balance => {
    let visibleEntries = balance.balance_entries;
    return { ...balance, balance_entries: visibleEntries };
  }).filter(b => b.balance_entries.length > 0);

  // Pagination Logic
  const totalPages = Math.ceil(finalDisplayBalances.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedBalances = finalDisplayBalances.slice(startIndex, startIndex + itemsPerPage);


  const getStorageUrl = (path: string) => {
    return `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/${path}`;
  };

  const hasSelectedEntries = () => {
    for (const [_, entries] of selectedEntries) {
      if (entries.size > 0) return true;
    }
    return false;
  };

  const handleCreateQuotation = async () => {
    if (!hasSelectedEntries()) {
      toast.error("Pilih minimal satu neraca untuk membuat quotation");
      return;
    }

    const { data: company } = await supabase.from("company").select("abbreviation").maybeSingle();
    const abbreviation = company?.abbreviation || "XXX";
    const now = new Date();
    const monthYear = `${String(now.getMonth() + 1).padStart(2, "0")}.${now.getFullYear()}`;
    let createdCount = 0;

    for (const [balanceId, entryIds] of selectedEntries) {
      if (entryIds.size === 0) continue;
      const balance = balances.find(b => b.id === balanceId);
      if (!balance) continue;

      for (const entryId of entryIds) {
        let quotationNumber = "";
        let isUnique = false;

        while (!isUnique) {
          const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
          let randomStr = '';
          for (let i = 0; i < 6; i++) {
            randomStr += chars.charAt(Math.floor(Math.random() * chars.length));
          }
          quotationNumber = `Q/${randomStr}/${abbreviation}/${monthYear}`;
          const { data: existing } = await supabase
            .from("quotations")
            .select("id")
            .eq("quotation_number", quotationNumber)
            .maybeSingle();
          if (!existing) isUnique = true;
        }

        const { count, error: countError } = await supabase
          .from("balance_items")
          .select("id", { count: 'exact', head: true })
          .eq("balance_id", balanceId)
          .eq("balance_entry_id", entryId);

        if (countError) {
          console.error("Error checking items", countError);
          toast.error("Gagal memvalidasi item neraca");
          return;
        }

        if (count === 0) {
          toast.error("Tidak dapat membuat penawaran. Detail neraca tidak memiliki item.");
          continue;
        }

        const { data: quotation, error: quotationError } = await supabase
          .from("quotations")
          .insert({
            request_id: balance.request_id,
            quotation_number: quotationNumber,
            franco: balance.request.customer.delivery_address,
            customer_snapshot: {
              customer: (balance.request as any).customer,
              pic: (balance.request as any).customer_pic
            }
          })
          .select()
          .single();

        if (quotationError) {
          console.error(quotationError);
          toast.error("Gagal membuat penawaran");
          return;
        }

        const { error: linkError } = await supabase
          .from("quotation_balances")
          .insert({
            quotation_id: quotation.id,
            balance_id: balanceId,
            entry_id: entryId,
          });

        if (linkError) {
          console.error(linkError);
        } else {
          createdCount++;
        }
      }
    }

    if (createdCount > 0) {
      toast.success(`${createdCount} Penawaran berhasil dibuat`);
      setSelectedEntries(new Map());
      fetchQuotationLinks();
      navigate("/quotations");
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-card p-4 rounded-lg border shadow-sm mt-6">
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="cari data...."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full"
          />
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Rows per page:</span>
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

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            {canManage && (
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Tambah Neraca
                </Button>
              </DialogTrigger>
            )}
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Tambah Neraca Baru</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="flex gap-2 p-1 bg-muted rounded-lg">
                  <Button
                    variant={dateFilter === "today" ? "default" : "ghost"}
                    size="sm"
                    className="flex-1 h-7 text-xs"
                    onClick={() => setDateFilter("today")}
                  >
                    Hari Ini
                  </Button>
                  <Button
                    variant={dateFilter === "week" ? "default" : "ghost"}
                    size="sm"
                    className="flex-1 h-7 text-xs"
                    onClick={() => setDateFilter("week")}
                  >
                    Minggu Ini
                  </Button>
                  <Button
                    variant={dateFilter === "month" ? "default" : "ghost"}
                    size="sm"
                    className="flex-1 h-7 text-xs"
                    onClick={() => setDateFilter("month")}
                  >
                    Bulan Ini
                  </Button>
                  <Button
                    variant={dateFilter === "all" ? "default" : "ghost"}
                    size="sm"
                    className="flex-1 h-7 text-xs"
                    onClick={() => setDateFilter("all")}
                  >
                    Semua
                  </Button>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Pilih Permintaan (Bisa lebih dari satu)</label>
                  <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-full justify-between font-normal text-left h-auto min-h-[40px]"
                      >
                        {selectedRequestIds.length > 0
                          ? `${selectedRequestIds.length} permintaan dipilih`
                          : "Pilih permintaan..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[500px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Cari permintaan..." />
                        <CommandList>
                          <CommandEmpty>Pencarian tidak ditemukan.</CommandEmpty>
                          <CommandGroup>
                            {getFilteredRequests().map((request) => {
                              const isExisting = balances.some(b => b.request_id === request.id);
                              const isSelected = selectedRequestIds.includes(request.id);

                              return (
                                <CommandItem
                                  key={request.id}
                                  value={`${request.request_code} ${request.letter_number} ${request.customer.company_name}`}
                                  disabled={isExisting}
                                  onSelect={() => {
                                    if (isExisting) return;
                                    setSelectedRequestIds(prev =>
                                      isSelected
                                        ? prev.filter(id => id !== request.id)
                                        : [...prev, request.id]
                                    );
                                  }}
                                  className="flex items-center gap-2 cursor-pointer"
                                >
                                  <div className={`w-4 h-4 border rounded flex items-center justify-center ${isSelected ? 'bg-primary border-primary text-white' : 'border-gray-400'}`}>
                                    {isSelected && <Check className="h-3 w-3" />}
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className={isExisting ? "text-muted-foreground" : ""}>
                                        {request.request_code} - {request.letter_number}
                                      </span>
                                      {isExisting && (
                                        <span className="text-xs text-amber-600 font-medium bg-amber-50 px-1.5 py-0.5 rounded">
                                          Sudah ada di tabel
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {request.customer.company_name}
                                    </div>
                                  </div>
                                  <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                                    {request.created_at && isValid(new Date(request.created_at)) ? format(new Date(request.created_at), "dd/MM/yyyy", { locale: id }) : "-"}
                                  </span>
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Batal</Button>
                  <Button onClick={handleCreateBalance} disabled={selectedRequestIds.length === 0}>
                    Buat {selectedRequestIds.length > 0 ? `(${selectedRequestIds.length})` : ''} Neraca
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {canManage && hasSelectedEntries() && (
            <Button onClick={handleCreateQuotation} variant="default">
              <FileText className="h-4 w-4 mr-2" />
              Buat Penawaran
            </Button>
          )}
        </div>
      </div>

      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12 whitespace-nowrap">No</TableHead>
              <TableHead className="whitespace-nowrap">Permintaan Pelanggan</TableHead>
              <TableHead className="whitespace-nowrap">Data</TableHead>
              {userRole && userRole !== 'staff' && <TableHead className="whitespace-nowrap">Dibuat Oleh</TableHead>}
              <TableHead className="text-right whitespace-nowrap">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell>
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                  </TableCell>
                  {userRole && userRole !== 'staff' && <TableCell><Skeleton className="h-4 w-20" /></TableCell>}
                  <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Skeleton className="h-8 w-8" />
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
            ) : paginatedBalances.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground p-8">
                  {searchTerm ? "Pencarian tidak ditemukan" : "Belum ada neraca ditemukan"}
                </TableCell>
              </TableRow>
            ) : (
              paginatedBalances.map((balance, index) => (
                <TableRow key={balance.id}>
                  <TableCell>{startIndex + index + 1}</TableCell>

                  <TableCell className="relative whitespace-nowrap">
                    {(() => {
                      const isBalanceCompleted = balance.balance_entries.some(entry => {
                        const link = quotationLinks.find(l => l.balance_id === balance.id && l.entry_id === entry.id);
                        return link?.quotation?.po_ins?.some((pi: any) => pi.is_completed);
                      });

                      return null; // Stamp Removed
                    })()}
                    <div className="flex flex-col gap-1 relative z-10">
                      <span className="font-medium bg-green-100 text-green-800 px-2 py-1 rounded w-fit mb-1">
                        {balance.request.request_code}
                      </span>
                      <span className="font-bold text-base">{balance.request.customer.company_name}</span>
                      <span className="font-medium">{balance.request.title}</span>
                      <div className="text-sm text-muted-foreground flex flex-col gap-1">
                        <div>
                          <span className="font-semibold">No Surat:</span> {balance.request.letter_number}
                        </div>
                        <div>
                          <span className="font-semibold">PIC:</span> {balance.request.customer_pic.name}
                        </div>
                        <div>
                          <span className="font-semibold">Tanggal:</span> {balance.request.request_date && isValid(new Date(balance.request.request_date)) ? format(new Date(balance.request.request_date), "dd/MM/yyyy", { locale: id }) : "-"}
                        </div>
                      </div>
                      {balance.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-1">
                          {balance.attachments.map((attachment, idx) => (
                            <a
                              key={idx}
                              href={getStorageUrl(`request-attachments/${attachment.file_path}`)}
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
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <div className="space-y-2">
                      <div className="border rounded-md p-3 space-y-2 bg-card">
                        {balance.balance_entries.map((entry, idx) => {
                          const quotationLink = quotationLinks.find(
                            link => link.balance_id === balance.id && link.entry_id === entry.id
                          );
                          const isLinked = !!quotationLink && !!quotationLink.quotation;
                          const isClosed = quotationLink?.quotation?.is_closed;
                          return (
                            <div key={idx} className={`flex items-center gap-2 justify-between ${isClosed ? "opacity-60" : ""}`}>
                              <div className="flex items-center gap-2">
                                {/* Checkbox Visibility Logic:
                                    - Always show for Owner / Super Admin
                                    - For Pimpinan (viewing others' data): ONLY show if it's already linked (isLinked). If not linked, hide it.
                                 */}
                                {((userRole === 'pimpinan' && balance.creator?.user_id !== userId && !isLinked)) ? (
                                  <div className="w-4 h-4 mr-2" />
                                ) : (
                                  <Checkbox
                                    checked={isLinked || selectedEntries.get(balance.id)?.has(entry.id) || false}
                                    disabled={isLinked || (userRole === 'pimpinan' && balance.creator?.user_id !== userId)}
                                    onCheckedChange={(checked) => {
                                      if (isLinked) return;
                                      const newSelected = new Map(selectedEntries);
                                      if (!newSelected.has(balance.id)) {
                                        newSelected.set(balance.id, new Set());
                                      }
                                      const entrySet = newSelected.get(balance.id)!;
                                      if (checked) {
                                        entrySet.add(entry.id);
                                      } else {
                                        entrySet.delete(entry.id);
                                      }
                                      setSelectedEntries(newSelected);
                                    }}
                                  />
                                )}
                                <div className="flex flex-col">
                                  <span className={`text-xs font-mono bg-amber-50 text-amber-900 border border-amber-200 px-1 rounded ${isLinked ? 'opacity-70' : ''} ${isClosed ? 'line-through' : ''}`}>
                                    {idx + 1}. {entry.code}
                                  </span>
                                  {isLinked && quotationLink?.quotation && (
                                    <span className={`text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded w-fit mt-0.5 ${isClosed ? 'line-through' : ''}`}>
                                      {quotationLink.quotation.quotation_number}{isClosed && <span className="text-red-600 font-bold"> (Tutup)</span>}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="flex flex-col items-end justify-center h-full">
                                  {entry.date && (
                                    <span className="text-[10px] text-muted-foreground">
                                      {isValid(new Date(entry.date)) ? format(new Date(entry.date), "dd/MM/yyyy", { locale: id }) : ""}
                                    </span>
                                  )}
                                  {isLinked && quotationLink?.quotation?.created_at && (
                                    <span className="text-[10px] text-muted-foreground mt-0.5">
                                      {isValid(new Date(quotationLink.quotation.created_at)) ? format(new Date(quotationLink.quotation.created_at), "dd/MM/yyyy", { locale: id }) : ""}
                                    </span>
                                  )}
                                </div>
                                <div className="flex gap-1">
                                  {/* Edit/View Button */}
                                  {(canManage || userRole === 'pimpinan' || userRole === 'staff') && (
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-6 w-6"
                                      onClick={() => handleEditEntry(balance.id, entry.id, entry.code)}
                                    >
                                      {/* Logic: Show Eye if "Locked" (PO Exists) OR if User is NOT owner/admin viewing others data */}
                                      {/* Locked Condition: Linked Quotation has POs */}
                                      {(() => {
                                        const isLocked = quotationLink?.quotation?.po_ins && quotationLink.quotation.po_ins.length > 0;
                                        const isClosed = quotationLink?.quotation?.is_closed;
                                        const isOwnerOrAdmin = balance.created_by === userId || userRole === 'super_admin';

                                        if (isLocked || isClosed) return <Eye className="h-3 w-3" />; // Always View Only if Locked or Closed
                                        if (isOwnerOrAdmin) return <Edit className="h-3 w-3" />; // Editable if Owner & Not Locked/Closed
                                        return <Eye className="h-3 w-3" />; // View Only otherwise (Pimpinan viewing others)
                                      })()}
                                    </Button>
                                  )}

                                  {/* Delete Button - Only for Owner/SuperAdmin */}
                                  {!isLinked && canManage && (balance.created_by === userId || userRole === 'super_admin') && (
                                    <DeleteConfirmationDialog
                                      onDelete={() => handleDeleteEntry(balance.id, entry.id, balance.balance_entries)}
                                      trigger={
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="h-6 w-6"
                                        >
                                          <Trash className="h-3 w-3 text-destructive" />
                                        </Button>
                                      }
                                    />
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {canManage && (balance.created_by === userId || userRole === 'super_admin') && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAddEntry(balance.id, balance.balance_entries)}
                          className="w-full"
                          disabled={balance.balance_entries.some(entry => {
                            const link = quotationLinks.find(l => l.balance_id === balance.id && l.entry_id === entry.id);
                            return link?.quotation?.po_ins?.some((pi: any) => pi.is_completed);
                          })}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          TAMBAH
                        </Button>
                      )}
                    </div>
                  </TableCell>
                  {userRole && userRole !== 'staff' && (
                    <TableCell className="align-top whitespace-nowrap">
                      <div className="mt-4">
                        <span className="text-sm font-medium">{balance.creator?.name || "-"}</span>
                      </div>
                    </TableCell>
                  )}
                  <TableCell className="text-right relative overflow-hidden whitespace-nowrap">
                    {/* Corner Badge */}
                    {balance.balance_entries.some(entry => {
                      const link = quotationLinks.find(l => l.balance_id === balance.id && l.entry_id === entry.id);
                      return link?.quotation?.po_ins?.some((pi: any) => pi.status === 'completed');
                    }) && (
                        <div className="absolute top-0 right-0 w-[75px] h-[75px] overflow-hidden pointer-events-none z-20">
                          <div className="absolute top-[10px] right-[-30px] w-[100px] text-center rotate-45 bg-green-600 text-white text-[9px] font-bold py-1 shadow-sm">
                            SELESAI
                          </div>
                        </div>
                      )}
                    <div className="relative z-10">
                      {(() => {
                        const isAnyLinked = balance.balance_entries.some(entry => {
                          const link = quotationLinks.find(l => l.balance_id === balance.id && l.entry_id === entry.id);
                          return !!link && !!link.quotation;
                        });

                        const isOwner = balance.created_by === userId;
                        const isSuperAdmin = userRole === 'super_admin';
                        const canDelete = !isAnyLinked && canManage && (isOwner || isSuperAdmin);

                        if (canDelete) {
                          return (
                            <DeleteConfirmationDialog
                              onDelete={() => handleDeleteBalance(balance.id)}
                              trigger={
                                <Button
                                  variant="ghost"
                                  size="icon"
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              }
                            />
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {paginatedBalances.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Menampilkan {startIndex + 1} sampai {Math.min(startIndex + itemsPerPage, finalDisplayBalances.length)} dari {finalDisplayBalances.length} entri
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
    </div>
  );
}
