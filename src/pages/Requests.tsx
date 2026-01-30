import { useState, useEffect } from "react";
import { usePermission } from "@/hooks/usePermission";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DeleteConfirmationDialog } from "@/components/DeleteConfirmationDialog";
import { toast } from "sonner";
import { Plus, Search, Pencil, Trash2, AlertCircle, X, Link as LinkIcon, ChevronLeft, ChevronRight } from "lucide-react";

import { id } from "date-fns/locale";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format, isPast, parseISO, isValid, startOfDay, endOfDay, isWithinInterval } from "date-fns";
import { DateRange } from "react-day-picker";
import { DatePickerWithRange } from "@/components/ui/date-picker-with-range";
import { ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

type Request = {
  id: string;
  request_code: string | null;
  request_date: string;
  title: string;
  letter_number: string;
  customer_id: string;
  customer_pic_id: string;
  submission_deadline: string;
  customers?: { id: string; company_name: string; customer_code: string };
  customer_pics?: { name: string };
  quotations?: {
    quotation_number: string;
    purchase_order_quotations: { purchase_order_id: string }[];
    po_ins?: {
      invoice_number?: string;
      is_completed?: boolean;
      internal_letters: {
        id: string;
        tracking_activities: { count: number }[];
      }[]
    }[];
  }[];
  balances?: { balance_entries: { code: string }[] }[];
  creator?: { name: string };
  created_by?: string;
};

type Customer = {
  id: string;
  company_name: string;
};

type CustomerPic = {
  id: string;
  name: string;
  customer_id: string;
};

type Attachment = {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
};

// Component for request row with attachments
const RequestRow = ({
  request,
  index,
  onEdit,
  onDelete,
  isDeadlinePassed,
  canManage,
  userId,
  userRole
}: {
  request: Request;
  index: number;
  onEdit: (request: Request) => void;
  onDelete: (id: string) => void;
  isDeadlinePassed: (deadline: string) => boolean;
  canManage: boolean;
  userId: string | null;
  userRole: string | null;
}) => {
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const isOwner = request.created_by === userId;
  const isSuperAdmin = userRole === 'super_admin';
  const canEdit = canManage && (isOwner || isSuperAdmin);

  useEffect(() => {
    const fetchAttachments = async () => {
      const { data } = await supabase
        .from("request_attachments")
        .select("*")
        .eq("request_id", request.id);
      setAttachments(data || []);
    };
    fetchAttachments();
  }, [request.id]);

  const getStorageUrl = (path: string) => {
    return `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/request-attachments/${path}`;
  };

  const hasQuotations = request.quotations && request.quotations.length > 0;
  const hasBalances = request.balances && request.balances.length > 0;
  const hasPOs = request.quotations?.some(q => q.purchase_order_quotations && q.purchase_order_quotations.length > 0);

  return (
    <TableRow>
      <TableCell className="w-[50px] font-medium text-center whitespace-nowrap">{index}</TableCell>

      <TableCell className="align-top whitespace-nowrap">
        <div className="flex flex-col gap-1">
          <span className="font-medium bg-green-100 text-green-800 px-2 py-1 rounded w-fit mb-1">
            {request.request_code || "-"}
          </span>
          <span className="font-bold text-base">{request.customers?.company_name}</span>
          <span className="font-medium">{request.title}</span>
          <div className="text-sm text-muted-foreground flex flex-col gap-1">
            <div>
              <span className="font-semibold">No Surat:</span> {request.letter_number}
            </div>
            <div>
              <span className="font-semibold">PIC:</span> {request.customer_pics?.name}
            </div>
            <div>
              <span className="font-semibold">Tanggal:</span> {isValid(parseISO(request.request_date)) ? format(parseISO(request.request_date), "dd/MM/yyyy", { locale: id }) : "-"}
            </div>
          </div>
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-1">
              {attachments.map((attachment, idx) => (
                <a
                  key={attachment.id}
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
      </TableCell>
      <TableCell className="text-center whitespace-nowrap">
        <span className={!hasQuotations && isDeadlinePassed(request.submission_deadline) ? "text-destructive font-semibold" : ""}>
          {isValid(parseISO(request.submission_deadline)) ? format(parseISO(request.submission_deadline), "dd/MM/yyyy", { locale: id }) : "-"}
        </span>
      </TableCell>
      {userRole && userRole !== 'staff' && (
        <TableCell className="text-center whitespace-nowrap">
          <div className="flex flex-col items-center justify-center">
            <span className="text-sm font-medium">{request.creator?.name || "-"}</span>
          </div>
        </TableCell>
      )}
      <TableCell className="text-center whitespace-nowrap">
        {(hasQuotations || hasBalances) ? (
          <div className="flex items-center justify-center gap-2 text-xs">
            {(() => {
              // Check for Internal Letters, Tracking, Invoice, and Selesai
              const hasInternalLetters = request.quotations?.some(q =>
                q.po_ins?.some((pi: any) => pi.internal_letters && pi.internal_letters.length > 0)
              );

              const hasTracking = request.quotations?.some(q =>
                q.po_ins?.some((pi: any) =>
                  pi.internal_letters?.some((il: any) =>
                    // Check if tracking_activities has any entries with count > 0
                    il.tracking_activities && il.tracking_activities[0]?.count > 0
                  )
                )
              );

              const hasInvoice = request.quotations?.some(q =>
                q.po_ins?.some((pi: any) => pi.invoice_number)
              );

              const isCompleted = request.quotations?.some(q =>
                q.po_ins?.some((pi: any) => pi.is_completed)
              );


              if (hasInternalLetters) {
                return (
                  <>
                    <span className="font-semibold text-emerald-600">Neraca</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="font-semibold text-blue-600">Quotation</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="font-semibold text-purple-600">PO</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="font-semibold text-orange-600">Internal Letter</span>

                    {hasTracking && (
                      <>
                        <span className="text-muted-foreground">→</span>
                        <span className="font-semibold text-indigo-600">Tracking</span>
                      </>
                    )}

                    {hasInvoice && (
                      <>
                        <span className="text-muted-foreground">→</span>
                        <span className="font-semibold text-pink-600">Invoice</span>
                      </>
                    )}

                    {isCompleted && (
                      <>
                        <span className="text-muted-foreground">→</span>
                        <span className="font-semibold text-green-700 bg-green-100 px-1 rounded">Selesai</span>
                      </>
                    )}
                  </>
                );
              }

              if (hasPOs) {
                return (
                  <>
                    <span className="font-semibold text-emerald-600">Neraca</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="font-semibold text-blue-600">Quotation</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="font-semibold text-purple-600">PO</span>
                  </>
                );
              }

              if (hasQuotations) {
                return (
                  <>
                    <span className="font-semibold text-emerald-600">Neraca</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="font-semibold text-blue-600">Quotation</span>
                  </>
                );
              }

              if (hasBalances) {
                return <span className="font-semibold text-emerald-600">Neraca</span>;
              }

              return null;
            })()}
          </div>
        ) : (
          canEdit && (
            <div className="flex justify-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => onEdit(request)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <DeleteConfirmationDialog
                onDelete={() => onDelete(request.id)}
                trigger={
                  <Button variant="ghost" size="sm">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                }
              />
            </div>
          )
        )}
      </TableCell>
    </TableRow>
  );
};


const Requests = () => {
  const [requests, setRequests] = useState<Request[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerPics, setCustomerPics] = useState<CustomerPic[]>([]);
  const { canManage, userId, userRole } = usePermission("requests");
  const [filteredRequests, setFilteredRequests] = useState<Request[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [selectedCustomerFilter, setSelectedCustomerFilter] = useState<string>("all");
  const [openCombobox, setOpenCombobox] = useState(false);
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5); // Default to 5

  const [isOpen, setIsOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState<Request | null>(null);
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [picSearchOpen, setPicSearchOpen] = useState(false);
  const [requestDateOpen, setRequestDateOpen] = useState(false);
  const [deadlineOpen, setDeadlineOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<Attachment[]>([]);

  const [formData, setFormData] = useState({
    request_date: new Date(),
    title: "",
    letter_number: "",
    customer_id: "",
    customer_pic_id: "",
    submission_deadline: new Date(),
  });

  useEffect(() => {
    fetchRequests();
    fetchCustomers();
    fetchCustomerPics();
  }, []);

  useEffect(() => {
    let filtered = requests.filter(
      (req) =>
        req.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.letter_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.customers?.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.customer_pics?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.request_code?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Date Filter
    if (dateRange?.from) {
      filtered = filtered.filter(req => {
        const rDate = new Date(req.request_date);
        if (dateRange.to) {
          return isWithinInterval(rDate, { start: startOfDay(dateRange.from), end: endOfDay(dateRange.to) });
        } else {
          return format(rDate, 'yyyy-MM-dd') === format(dateRange.from, 'yyyy-MM-dd');
        }
      });
    }

    // Customer Filter
    if (selectedCustomerFilter !== "all") {
      filtered = filtered.filter(req => req.customers?.id === selectedCustomerFilter);
    }

    setFilteredRequests(filtered);
    setCurrentPage(1);
  }, [searchTerm, requests, dateRange, selectedCustomerFilter]);

  const fetchRequests = async () => {
    setIsLoading(true);
    setIsError(false);
    const { data: requestsData, error: requestsError } = await supabase
      .from("requests")
      .select(`
        *,
        customers (id, company_name, customer_code),
        customer_pics (name),
        quotations (
          quotation_number,
          purchase_order_quotations ( purchase_order_id ),
          po_ins ( 
            invoice_number,
            is_completed,
            internal_letters ( 
              id,
              tracking_activities ( count )
            ) 
          )
        ),
        balances (
          balance_entries
        ),
        creator:team_members!fk_created_by_team_member(name)
      `)
      .order("created_at", { ascending: false });

    if (requestsError) {
      console.error(requestsError);
      toast.error("Gagal mengambil data permintaan");
      setIsError(true);
      setIsLoading(false);
      return;
    }
    setRequests((requestsData as unknown as Request[]) || []);
    setIsLoading(false);
  };

  const fetchCustomers = async () => {
    const { data, error } = await supabase
      .from("customers")
      .select("id, company_name")
      .order("company_name");

    if (error) {
      console.error(error);
      return;
    }
    setCustomers(data || []);
  };

  const fetchCustomerPics = async () => {
    const { data, error } = await supabase
      .from("customer_pics")
      .select("id, name, customer_id")
      .order("name");

    if (error) {
      console.error(error);
      return;
    }
    setCustomerPics(data || []);
  };

  const fetchAttachments = async (requestId: string) => {
    const { data, error } = await supabase
      .from("request_attachments")
      .select("*")
      .eq("request_id", requestId);

    if (error) {
      toast.error("Gagal mengambil lampiran");
      return;
    }
    setExistingAttachments(data || []);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(Array.from(e.target.files));
    }
  };

  const uploadFiles = async (requestId: string) => {
    for (const file of selectedFiles) {
      const filePath = `${requestId}/${Date.now()}-${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from("request-attachments")
        .upload(filePath, file);

      if (uploadError) {
        toast.error(`Gagal mengupload ${file.name}`);
        continue;
      }

      const { error: dbError } = await supabase
        .from("request_attachments")
        .insert({
          request_id: requestId,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
        });

      if (dbError) {
        toast.error(`Gagal menyimpan info lampiran untuk ${file.name}`);
      }
    }
  };

  const deleteAttachment = async (attachment: Attachment) => {
    const { error: storageError } = await supabase.storage
      .from("request-attachments")
      .remove([attachment.file_path]);

    if (storageError) {
      toast.error("Gagal menghapus file dari penyimpanan");
      return;
    }

    const { error: dbError } = await supabase
      .from("request_attachments")
      .delete()
      .eq("id", attachment.id);

    if (dbError) {
      toast.error("Gagal menghapus catatan lampiran");
      return;
    }

    setExistingAttachments(existingAttachments.filter((a) => a.id !== attachment.id));
    toast.success("Lampiran dihapus");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const requestDate = format(formData.request_date, "yyyy-MM-dd");

    const requestData = {
      request_date: requestDate,
      title: formData.title,
      letter_number: formData.letter_number,
      customer_id: formData.customer_id,
      customer_pic_id: formData.customer_pic_id,
      submission_deadline: format(formData.submission_deadline, "yyyy-MM-dd"),
    };

    if (editingRequest) {
      // Check if request_date changed to regenerate request_code
      const oldRequestDate = format(parseISO(editingRequest.request_date), "yyyy-MM-dd");
      const newRequestDate = requestDate;

      let updateData: any = { ...requestData };

      if (oldRequestDate !== newRequestDate) {
        // Get customer code
        const { data: customerData } = await supabase
          .from("customers")
          .select("customer_code")
          .eq("id", formData.customer_id)
          .single();

        if (customerData && editingRequest.request_code && editingRequest.request_code.includes("-")) {
          // Extract sequence ID from old request code (Only for old format)
          const oldCodeParts = editingRequest.request_code.split("-");
          const sequenceId = oldCodeParts[oldCodeParts.length - 1];

          // Generate new request code with new date but same sequence
          const dateFormatted = format(formData.request_date, "ddMMyyyy");
          const requestCode = `${customerData.customer_code}-${dateFormatted}-${sequenceId}`;
          updateData.request_code = requestCode;
        }
      }

      // Fetch Full Customer & PIC Details for Snapshot
      const { data: fullCustomer } = await supabase
        .from("customers")
        .select("*")
        .eq("id", formData.customer_id)
        .single();

      const { data: fullPic } = await supabase
        .from("customer_pics")
        .select("*")
        .eq("id", formData.customer_pic_id)
        .single();

      const snapshotData = {
        customer: fullCustomer,
        pic: fullPic
      };

      if (!fullCustomer) {
        toast.error("Data pelanggan tidak ditemukan untuk snapshot");
        return;
      }

      const updatePayload = {
        ...updateData,
        customer_snapshot: snapshotData
      };

      const { error } = await supabase
        .from("requests")
        .update(updatePayload)
        .eq("id", editingRequest.id);

      if (error) {
        toast.error("Gagal memperbarui permintaan");
        return;
      }

      if (selectedFiles.length > 0) {
        await uploadFiles(editingRequest.id);
      }

      toast.success("Permintaan berhasil diperbarui");
    } else {
      // Get customer code
      const { data: customerData } = await supabase
        .from("customers")
        .select("*") // Fetch all for snapshot
        .eq("id", formData.customer_id)
        .single();

      if (!customerData) {
        toast.error("Pelanggan tidak ditemukan");
        return;
      }

      const { data: picData } = await supabase
        .from("customer_pics")
        .select("*")
        .eq("id", formData.customer_pic_id)
        .single();

      const snapshotData = {
        customer: customerData,
        pic: picData
      };

      // Get total count for global sequence ID - DEPRECATED for new format
      // Generate random 6 character alphanumeric
      const randomString = Math.random().toString(36).substring(2, 8).toUpperCase();
      const requestCode = `${customerData.customer_code}_${randomString}`;

      const { data, error } = await supabase
        .from("requests")
        .insert({ ...requestData, request_code: requestCode, customer_snapshot: snapshotData })
        .select()
        .single();

      if (error) {
        toast.error("Gagal membuat permintaan");
        return;
      }

      if (selectedFiles.length > 0 && data) {
        await uploadFiles(data.id);
      }

      toast.success("Permintaan berhasil dibuat");
    }

    resetForm();
    setIsOpen(false);
    fetchRequests();
  };

  const handleEdit = async (request: Request) => {
    setEditingRequest(request);
    setFormData({
      request_date: parseISO(request.request_date),
      title: request.title,
      letter_number: request.letter_number,
      customer_id: request.customer_id,
      customer_pic_id: request.customer_pic_id,
      submission_deadline: parseISO(request.submission_deadline),
    });
    await fetchAttachments(request.id);
    setIsOpen(true);
  };

  const handleDelete = async (id: string) => {
    const { data: attachments } = await supabase
      .from("request_attachments")
      .select("file_path")
      .eq("request_id", id);

    if (attachments && attachments.length > 0) {
      await supabase.storage
        .from("request-attachments")
        .remove(attachments.map((a) => a.file_path));
    }

    const { error } = await supabase.from("requests").delete().eq("id", id);

    if (error) {
      toast.error("Gagal menghapus permintaan");
      return;
    }

    toast.success("Permintaan berhasil dihapus");
    fetchRequests();
  };

  const resetForm = () => {
    setFormData({
      request_date: new Date(),
      title: "",
      letter_number: "",
      customer_id: "",
      customer_pic_id: "",
      submission_deadline: new Date(),
    });
    setEditingRequest(null);
    setSelectedFiles([]);
    setExistingAttachments([]);
  };

  const isDeadlinePassed = (deadline: string) => {
    return isPast(parseISO(deadline));
  };

  const selectedCustomer = customers.find((c) => c.id === formData.customer_id);
  const selectedPic = customerPics.find((p) => p.id === formData.customer_pic_id);
  const availablePics = formData.customer_id
    ? customerPics.filter((p) => p.customer_id === formData.customer_id)
    : customerPics;

  const paginatedData = filteredRequests.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalPages = Math.ceil(filteredRequests.length / itemsPerPage);

  return (
    <div className="p-6 space-y-6">
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

          {/* Filters Group */}
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
                          setOpenCombobox(false);
                        }}
                      >
                        <Check
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
                            setOpenCombobox(false);
                          }}
                        >
                          <Check
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
              Total Data: <span className="text-foreground">{filteredRequests.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground whitespace-nowrap">Rows per page:</span>
              <Select
                value={itemsPerPage.toString()}
                onValueChange={(v) => {
                  setItemsPerPage(Number(v));
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-[70px]">
                  <SelectValue placeholder="5" />
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

          <Dialog open={isOpen} onOpenChange={(open) => {
            setIsOpen(open);
            if (!open) resetForm();
          }}>
            {canManage && (
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Tambah Permintaan
                </Button>
              </DialogTrigger>
            )}
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingRequest ? "Edit Permintaan" : "Tambah Permintaan Baru"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tanggal Permintaan</Label>
                    <Popover open={requestDateOpen} onOpenChange={setRequestDateOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                          {format(formData.request_date, "PPP")}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={formData.request_date}
                          onSelect={(date) => {
                            if (date) {
                              setFormData({ ...formData, request_date: date });
                              setRequestDateOpen(false);
                            }
                          }}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label>Nomor Surat</Label>
                    <Input
                      value={formData.letter_number}
                      onChange={(e) => setFormData({ ...formData, letter_number: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Judul</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Pelanggan</Label>
                  <Popover open={customerSearchOpen} onOpenChange={setCustomerSearchOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        {selectedCustomer ? selectedCustomer.company_name : "Pilih pelanggan..."}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Cari pelanggan..." />
                        <CommandList>
                          <CommandEmpty>Pencarian tidak ditemukan.</CommandEmpty>
                          <CommandGroup>
                            {customers.map((customer) => (
                              <CommandItem
                                key={customer.id}
                                onSelect={() => {
                                  setFormData({ ...formData, customer_id: customer.id, customer_pic_id: "" });
                                  setCustomerSearchOpen(false);
                                }}
                              >
                                {customer.company_name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>PIC Pelanggan</Label>
                  <Popover open={picSearchOpen} onOpenChange={setPicSearchOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                        disabled={!formData.customer_id}
                      >
                        {selectedPic ? selectedPic.name : "Pilih PIC pelanggan..."}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Cari PIC pelanggan..." />
                        <CommandList>
                          <CommandEmpty>Pencarian tidak ditemukan.</CommandEmpty>
                          <CommandGroup>
                            {availablePics.map((pic) => (
                              <CommandItem
                                key={pic.id}
                                onSelect={() => {
                                  setFormData({ ...formData, customer_pic_id: pic.id });
                                  setPicSearchOpen(false);
                                }}
                              >
                                {pic.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>Batas Waktu Pengajuan</Label>
                  <Popover open={deadlineOpen} onOpenChange={setDeadlineOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        {format(formData.submission_deadline, "dd/MM/yyyy", { locale: id })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formData.submission_deadline}
                        onSelect={(date) => {
                          if (date) {
                            setFormData({ ...formData, submission_deadline: date });
                            setDeadlineOpen(false);
                          }
                        }}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>Lampiran</Label>
                  <div className="border-2 border-dashed border-border rounded-lg p-4 space-y-2">
                    <Input
                      type="file"
                      multiple
                      onChange={handleFileSelect}
                      className="cursor-pointer"
                    />
                    {selectedFiles.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">File terpilih:</p>
                        {selectedFiles.map((file, index) => (
                          <div key={index} className="flex items-center justify-between text-sm">
                            <span>{file.name}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedFiles(selectedFiles.filter((_, i) => i !== index))}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                    {existingAttachments.length > 0 && (
                      <div className="space-y-1 pt-2 border-t">
                        <p className="text-sm text-muted-foreground">Lampiran yang ada:</p>
                        {existingAttachments.map((attachment) => (
                          <div key={attachment.id} className="flex items-center justify-between text-sm">
                            <span>{attachment.file_name}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteAttachment(attachment)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <Button type="submit" className="w-full">
                  {editingRequest ? "Perbarui Permintaan" : "Buat Permintaan"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>


      {
        filteredRequests.some(r => {
          const hasQuotations = r.quotations && r.quotations.length > 0;
          return !hasQuotations && isDeadlinePassed(r.submission_deadline);
        }) && (
          <Alert className="border-none mb-4">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <AlertDescription className="text-destructive">
              Beberapa permintaan telah melewati batas waktu pengajuan. Mohon ditinjau dan ditindaklanjuti.
            </AlertDescription>
          </Alert>
        )
      }

      < Card >
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px] text-center whitespace-nowrap">No</TableHead>
                <TableHead className="w-[30%] whitespace-nowrap">Info Permintaan</TableHead>
                <TableHead className="text-center whitespace-nowrap">Deadline</TableHead>
                {userRole && userRole !== 'staff' && <TableHead className="w-[150px] text-center whitespace-nowrap">Dibuat Oleh</TableHead>}
                <TableHead className="w-[100px] text-center whitespace-nowrap">Status / Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell><Skeleton className="h-4 w-8 mx-auto" /></TableCell>
                    <TableCell>
                      <div className="space-y-2">
                        <Skeleton className="h-5 w-20 mb-2" />
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                    </TableCell>
                    <TableCell><Skeleton className="h-4 w-24 mx-auto" /></TableCell>
                    {userRole && userRole !== 'staff' && (
                      <TableCell>
                        <div className="flex justify-center gap-2">
                          <Skeleton className="h-8 w-8" />
                          <Skeleton className="h-8 w-8" />
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-destructive p-8">
                    Pastikan koneksi internet anda baik
                  </TableCell>
                </TableRow>
              ) : paginatedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground p-8">
                    {searchTerm ? "Pencarian tidak ditemukan" : "Belum ada permintaan"}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedData.map((request, index) => (
                  <RequestRow
                    key={request.id}
                    request={request}
                    index={(currentPage - 1) * itemsPerPage + index + 1}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    isDeadlinePassed={isDeadlinePassed}
                    canManage={canManage}
                    userId={userId}
                    userRole={userRole}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card >



      {
        paginatedData.length > 0 && (
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Menampilkan {(currentPage - 1) * itemsPerPage + 1} sampai {Math.min(currentPage * itemsPerPage, filteredRequests.length)} dari {filteredRequests.length} entri
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
        )
      }
    </div >
  );
};

export default Requests;
