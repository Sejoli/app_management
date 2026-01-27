import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, Pencil, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DeleteConfirmationDialog } from "@/components/DeleteConfirmationDialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";


type Customer = {
  id: string;
  customer_code: string;
  company_name: string;
  office_address: string;
  delivery_address: string;
  email: string;
  npwp: string;
};

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CustomerPicsTab } from "@/components/customers/CustomerPicsTab";

export default function Customers() {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [formData, setFormData] = useState({
    customer_code: "",
    company_name: "",
    office_address: "",
    delivery_address: "",
    email: "",
    npwp: "",
  });
  const queryClient = useQueryClient();

  const { data: customers = [], isLoading, isError } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Customer[];
    },
    retry: 1,
  });

  useEffect(() => {
    if (isError) {
      toast.error("Gagal mengambil data pelanggan");
    }
  }, [isError]);

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from("customers").insert([data]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Customer berhasil ditambahkan");
      resetForm();
    },
    onError: (error: any) => {
      toast.error("Gagal menambahkan customer", {
        description: error.message,
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase
        .from("customers")
        .update(data)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Customer berhasil diperbarui");
      resetForm();
    },
    onError: (error: any) => {
      toast.error("Gagal memperbarui customer", {
        description: error.message,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Customer berhasil dihapus");
    },
    onError: (error: any) => {
      if (error.message.includes("foreign key constraint") || error.message.includes("requests")) {
        toast.error("Gagal Menghapus Pelanggan", {
          description: "Pelanggan ini sedang terhubung dengan satu atau lebih Request. Mohon hapus Request terkait terlebih dahulu.",
        });
      } else {
        toast.error("Error", {
          description: error.message,
        });
      }
    },
  });

  const filteredCustomers = customers.filter((customer) => {
    if (!searchQuery) return true;
    const lowerQuery = searchQuery.toLowerCase();

    return (
      customer.customer_code?.toLowerCase().includes(lowerQuery) ||
      customer.company_name?.toLowerCase().includes(lowerQuery) ||
      customer.office_address?.toLowerCase().includes(lowerQuery) ||
      customer.delivery_address?.toLowerCase().includes(lowerQuery) ||
      customer.email?.toLowerCase().includes(lowerQuery) ||
      customer.npwp?.toLowerCase().includes(lowerQuery)
    );
  });

  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedCustomers = filteredCustomers.slice(
    startIndex,
    startIndex + itemsPerPage
  );

  const resetForm = () => {
    setFormData({
      customer_code: "",
      company_name: "",
      office_address: "",
      delivery_address: "",
      email: "",
      npwp: "",
    });
    setEditingCustomer(null);
    setIsDialogOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCustomer) {
      updateMutation.mutate({ id: editingCustomer.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      customer_code: customer.customer_code,
      company_name: customer.company_name,
      office_address: customer.office_address,
      delivery_address: customer.delivery_address,
      email: customer.email,
      npwp: customer.npwp,
    });
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
      </div>

      <Tabs defaultValue="customers" className="space-y-4">
        <TabsList>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="pics">Customer PICs</TabsTrigger>
        </TabsList>

        <TabsContent value="customers" className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-card p-4 rounded-lg border shadow-sm">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="cari data...."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-8"
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
                <DialogTrigger asChild>
                  <Button onClick={() => resetForm()} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Tambah Pelanggan
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>
                      {editingCustomer ? "Edit Pelanggan" : "Tambah Pelanggan Baru"}
                    </DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="customer_code">Kode Pelanggan *</Label>
                        <Input
                          id="customer_code"
                          value={formData.customer_code}
                          onChange={(e) =>
                            setFormData({ ...formData, customer_code: e.target.value })
                          }
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="company_name">Nama Perusahaan *</Label>
                        <Input
                          id="company_name"
                          value={formData.company_name}
                          onChange={(e) =>
                            setFormData({ ...formData, company_name: e.target.value })
                          }
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="office_address">Alamat Kantor *</Label>
                      <Textarea
                        id="office_address"
                        value={formData.office_address}
                        onChange={(e) =>
                          setFormData({ ...formData, office_address: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="delivery_address">Alamat Pengiriman *</Label>
                      <Textarea
                        id="delivery_address"
                        value={formData.delivery_address}
                        onChange={(e) =>
                          setFormData({ ...formData, delivery_address: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="email">Email *</Label>
                        <Input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={(e) =>
                            setFormData({ ...formData, email: e.target.value })
                          }
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="npwp">NPWP *</Label>
                        <Input
                          id="npwp"
                          value={formData.npwp}
                          onChange={(e) =>
                            setFormData({ ...formData, npwp: e.target.value })
                          }
                          required
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={resetForm}>
                        Batal
                      </Button>
                      <Button type="submit">
                        {editingCustomer ? "Perbarui" : "Buat"}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <div className="border rounded-lg bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 whitespace-nowrap">No</TableHead>
                  <TableHead className="whitespace-nowrap">Kode Pelanggan</TableHead>
                  <TableHead className="whitespace-nowrap">Nama Perusahaan</TableHead>
                  <TableHead className="whitespace-nowrap">Alamat Kantor</TableHead>
                  <TableHead className="whitespace-nowrap">Email</TableHead>
                  <TableHead className="whitespace-nowrap">NPWP</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
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
                    <TableCell colSpan={7} className="text-center text-destructive p-8">
                      Pastikan koneksi internet anda baik
                    </TableCell>
                  </TableRow>
                ) : paginatedCustomers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center p-8 text-muted-foreground">
                      {searchQuery ? "Pencarian tidak ditemukan" : "Belum ada pelanggan ditemukan"}
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedCustomers.map((customer, index) => (
                    <TableRow key={customer.id}>
                      <TableCell>{startIndex + index + 1}</TableCell>
                      <TableCell className="font-medium whitespace-nowrap">
                        {customer.customer_code}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{customer.company_name}</TableCell>
                      <TableCell className="whitespace-nowrap">{customer.office_address}</TableCell>
                      <TableCell className="whitespace-nowrap">{customer.email}</TableCell>
                      <TableCell className="whitespace-nowrap">{customer.npwp}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleEdit(customer)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <DeleteConfirmationDialog
                            onDelete={() => deleteMutation.mutate(customer.id)}
                            trigger={
                              <Button variant="outline" size="icon">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            }
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {paginatedCustomers.length > 0 && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredCustomers.length)} of {filteredCustomers.length} entries
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
                  Page {currentPage} of {totalPages}
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
        </TabsContent>

        <TabsContent value="pics">
          <CustomerPicsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
