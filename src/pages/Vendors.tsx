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
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { DeleteConfirmationDialog } from "@/components/DeleteConfirmationDialog";
import { Skeleton } from "@/components/ui/skeleton";

type Vendor = {
  id: string;
  company_name: string;
  office_address: string;
  email: string;
  npwp: string;
  npwp_url?: string;
  products?: string;
  bank_name?: string;
  bank_account_number?: string;
  bank_account_holder?: string;
};

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VendorPicsTab } from "@/components/vendors/VendorPicsTab";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Vendors() {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [formData, setFormData] = useState({
    company_name: "",
    office_address: "",
    email: "",
    npwp: "",
    npwp_url: "",
    products: "",
    bank_name: "",
    bank_account_number: "",
    bank_account_holder: "",
  });
  const queryClient = useQueryClient();

  const { data: vendors = [], isLoading, isError } = useQuery({
    queryKey: ["vendors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendors")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Vendor[];
    },
    retry: 1,
  });

  useEffect(() => {
    if (isError) {
      toast.error("Gagal mengambil data vendor");
    }
  }, [isError]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = event.target.files?.[0];
      if (!file) return;

      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('vendor-documents')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage
        .from('vendor-documents')
        .getPublicUrl(filePath);

      setFormData(prev => ({ ...prev, npwp_url: data.publicUrl }));
      toast.success("File NPWP berhasil diupload");
    } catch (error: any) {
      toast.error("Gagal mengupload file: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from("vendors").insert([data]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      toast.success("Vendor berhasil ditambahkan");
      resetForm();
    },
    onError: (error: any) => {
      toast.error("Gagal menambahkan vendor", {
        description: error.message,
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase
        .from("vendors")
        .update(data)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      toast.success("Vendor berhasil diperbarui");
      resetForm();
    },
    onError: (error: any) => {
      toast.error("Gagal memperbarui vendor", {
        description: error.message,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vendors").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      toast.success("Vendor berhasil dihapus");
    },
    onError: (error: any) => {
      if (error.message.includes("foreign key constraint") || error.message.includes("purchase_orders")) {
        toast.error("Gagal Menghapus Vendor", {
          description: "Vendor ini sedang terhubung dengan satu atau lebih Purchase Order. Mohon hapus Purchase Order terkait terlebih dahulu.",
        });
      } else {
        toast.error("Error", {
          description: error.message,
        });
      }
    },
  });

  const filteredVendors = vendors.filter((vendor) => {
    if (!searchQuery) return true;
    const lowerQuery = searchQuery.toLowerCase();

    return (
      vendor.company_name?.toLowerCase().includes(lowerQuery) ||
      vendor.office_address?.toLowerCase().includes(lowerQuery) ||
      vendor.email?.toLowerCase().includes(lowerQuery) ||
      vendor.npwp?.toLowerCase().includes(lowerQuery) ||
      vendor.products?.toLowerCase().includes(lowerQuery) ||
      vendor.bank_name?.toLowerCase().includes(lowerQuery) ||
      vendor.bank_account_number?.toLowerCase().includes(lowerQuery) ||
      vendor.bank_account_holder?.toLowerCase().includes(lowerQuery)
    );
  });

  const totalPages = Math.ceil(filteredVendors.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedVendors = filteredVendors.slice(
    startIndex,
    startIndex + itemsPerPage
  );

  const resetForm = () => {
    setFormData({
      company_name: "",
      office_address: "",
      email: "",
      npwp: "",
      npwp_url: "",
      products: "",
      bank_name: "",
      bank_account_number: "",
      bank_account_holder: "",
    });
    setEditingVendor(null);
    setIsDialogOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingVendor) {
      updateMutation.mutate({ id: editingVendor.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (vendor: Vendor) => {
    setEditingVendor(vendor);
    setFormData({
      company_name: vendor.company_name,
      office_address: vendor.office_address,
      email: vendor.email,
      npwp: vendor.npwp,
      npwp_url: vendor.npwp_url || "",
      products: vendor.products || "",
      bank_name: vendor.bank_name || "",
      bank_account_number: vendor.bank_account_number || "",
      bank_account_holder: vendor.bank_account_holder || "",
    });
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
      </div>

      <Tabs defaultValue="vendors" className="space-y-4">
        <TabsList>
          <TabsTrigger value="vendors">Vendors</TabsTrigger>
          <TabsTrigger value="pics">Vendor PICs</TabsTrigger>
        </TabsList>

        <TabsContent value="vendors" className="space-y-6">
          <div className="flex flex-col gap-4 bg-card p-4 rounded-lg border shadow-sm">
            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
              <div className="relative w-full md:max-w-xs">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cari data..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-8 w-full"
                />
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => resetForm()} className="gap-2 w-full md:w-auto">
                      <Plus className="h-4 w-4" />
                      Tambah Vendor
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>
                        {editingVendor ? "Edit Vendor" : "Tambah Vendor Baru"}
                      </DialogTitle>
                      <DialogDescription className="sr-only">
                        Form to add or edit vendor details
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
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
                          <Label htmlFor="npwp">Nomor NPWP *</Label>
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

                      <div className="space-y-2">
                        <Label htmlFor="npwp_file">Upload NPWP (PDF/Gambar)</Label>
                        <div className="flex gap-2 items-center">
                          <Input
                            id="npwp_file"
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={handleFileUpload}
                            disabled={uploading}
                          />
                          {formData.npwp_url && (
                            <a
                              href={formData.npwp_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-blue-600 hover:underline shrink-0"
                            >
                              Lihat Saat Ini
                            </a>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="products">Produk / Layanan</Label>
                        <Textarea
                          id="products"
                          value={formData.products}
                          onChange={(e) =>
                            setFormData({ ...formData, products: e.target.value })
                          }
                          placeholder="Tuliskan produk atau layanan yang disediakan..."
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="bank_name">Nama Bank</Label>
                          <Input
                            id="bank_name"
                            value={formData.bank_name}
                            onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                            placeholder="e.g. BCA"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="bank_account_number">Nomor Rekening</Label>
                          <Input
                            id="bank_account_number"
                            value={formData.bank_account_number}
                            onChange={(e) => setFormData({ ...formData, bank_account_number: e.target.value })}
                            type="number"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="bank_account_holder">Pemilik Rekening</Label>
                          <Input
                            id="bank_account_holder"
                            value={formData.bank_account_holder}
                            onChange={(e) => setFormData({ ...formData, bank_account_holder: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={resetForm}>
                          Batal
                        </Button>
                        <Button type="submit">
                          {editingVendor ? "Perbarui" : "Buat"}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <div className="flex flex-wrap justify-between items-center gap-4 pt-2 border-t">
              <div className="flex items-center gap-4">
                <div className="text-sm font-medium text-muted-foreground bg-muted/50 px-3 py-1 rounded-md">
                  Total Data: <span className="text-foreground">{filteredVendors.length}</span>
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
            </div>
          </div>

          <div className="border rounded-lg bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 whitespace-nowrap">No</TableHead>
                  <TableHead className="whitespace-nowrap">Nama Perusahaan</TableHead>
                  <TableHead className="whitespace-nowrap">Alamat Kantor</TableHead>
                  <TableHead className="whitespace-nowrap">Email</TableHead>
                  <TableHead className="whitespace-nowrap">NPWP</TableHead>
                  <TableHead className="whitespace-nowrap">Produk / Layanan</TableHead>
                  <TableHead className="whitespace-nowrap">Detail Bank</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Skeleton className="h-4 w-20" />
                          <Skeleton className="h-3 w-32" />
                        </div>
                      </TableCell>
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
                    <TableCell colSpan={8} className="text-center text-destructive p-8">
                      Pastikan koneksi internet anda baik
                    </TableCell>
                  </TableRow>
                ) : paginatedVendors.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center p-8 text-muted-foreground">
                      {searchQuery ? "Pencarian tidak ditemukan" : "Belum ada vendor ditemukan"}
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedVendors.map((vendor, index) => (
                    <TableRow key={vendor.id}>
                      <TableCell>{startIndex + index + 1}</TableCell>
                      <TableCell className="font-medium whitespace-nowrap">
                        {vendor.company_name}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{vendor.office_address}</TableCell>
                      <TableCell className="whitespace-nowrap">{vendor.email}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="flex flex-col">
                          <span>{vendor.npwp}</span>
                          {vendor.npwp_url && (
                            <a
                              href={vendor.npwp_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-blue-600 hover:underline"
                            >
                              Buka Data NPWP
                            </a>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate" title={vendor.products}>
                        {vendor.products || "-"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="flex flex-col text-sm">
                          <span className="font-medium">{vendor.bank_name || "-"}</span>
                          <span>{vendor.bank_account_number || "-"}</span>
                          <span className="text-muted-foreground text-xs">{vendor.bank_account_holder || "-"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleEdit(vendor)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <DeleteConfirmationDialog
                            onDelete={() => deleteMutation.mutate(vendor.id)}
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

          {paginatedVendors.length > 0 && (
            <div className="flex items-center justify-between p-4 border rounded-lg bg-card text-card-foreground shadow-sm">
              <div className="text-sm text-muted-foreground">
                Menampilkan {startIndex + 1} sampai {Math.min(startIndex + itemsPerPage, filteredVendors.length)} dari {filteredVendors.length} entri
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
        </TabsContent>

        <TabsContent value="pics">
          <VendorPicsTab />
        </TabsContent>
      </Tabs>
    </div >
  );
}
