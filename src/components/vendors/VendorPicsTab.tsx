import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Pencil, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { DeleteConfirmationDialog } from "@/components/DeleteConfirmationDialog";

type VendorPic = {
    id: string;
    vendor_id: string;
    name: string;
    position: string;
    phone: string;
    vendors?: { company_name: string };
};

export function VendorPicsTab() {
    const [searchQuery, setSearchQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingPic, setEditingPic] = useState<VendorPic | null>(null);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const [formData, setFormData] = useState({
        vendor_id: "",
        name: "",
        position: "",
        phone: "",
    });
    const queryClient = useQueryClient();

    const { data: vendors = [] } = useQuery({
        queryKey: ["vendors"],
        queryFn: async () => {
            const { data, error } = await supabase.from("vendors").select("*");
            if (error) throw error;
            return data;
        },
    });

    const { data: pics = [], isLoading, isError } = useQuery({
        queryKey: ["vendor_pics"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("vendor_pics")
                .select("*, vendors(company_name)")
                .order("created_at", { ascending: false });
            if (error) throw error;
            return data as VendorPic[];
        },
        retry: 1,
    });

    const createMutation = useMutation({
        mutationFn: async (data: typeof formData) => {
            const { error } = await supabase.from("vendor_pics").insert([data]);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["vendor_pics"] });
            toast.success("PIC berhasil ditambahkan");
            resetForm();
        },
        onError: (error: any) => {
            toast.error("Gagal menambahkan PIC", {
                description: error.message,
            });
        },
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
            const { error } = await supabase
                .from("vendor_pics")
                .update(data)
                .eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["vendor_pics"] });
            toast.success("PIC berhasil diperbarui");
            resetForm();
        },
        onError: (error: any) => {
            toast.error("Gagal memperbarui PIC", {
                description: error.message,
            });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from("vendor_pics").delete().eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["vendor_pics"] });
            toast.success("PIC berhasil dihapus");
        },
        onError: (error: any) => {
            if (error.message.includes("foreign key constraint") || error.message.includes("purchase_orders")) {
                toast.error("Gagal Menghapus PIC", {
                    description: "PIC ini sedang terhubung dengan satu atau lebih Purchase Order. Mohon hapus Purchase Order terkait terlebih dahulu.",
                });
            } else {
                toast.error("Error", {
                    description: error.message,
                });
            }
        },
    });

    const filteredPics = pics.filter((pic) => {
        if (!searchQuery) return true;
        const lowerQuery = searchQuery.toLowerCase();

        return (
            pic.name?.toLowerCase().includes(lowerQuery) ||
            pic.position?.toLowerCase().includes(lowerQuery) ||
            pic.phone?.toLowerCase().includes(lowerQuery) ||
            pic.vendors?.company_name?.toLowerCase().includes(lowerQuery)
        );
    });

    const totalPages = Math.ceil(filteredPics.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedPics = filteredPics.slice(startIndex, startIndex + itemsPerPage);

    const resetForm = () => {
        setFormData({
            vendor_id: "",
            name: "",
            position: "",
            phone: "",
        });
        setEditingPic(null);
        setIsDialogOpen(false);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingPic) {
            updateMutation.mutate({ id: editingPic.id, data: formData });
        } else {
            createMutation.mutate(formData);
        }
    };

    const handleEdit = (pic: VendorPic) => {
        setEditingPic(pic);
        setFormData({
            vendor_id: pic.vendor_id,
            name: pic.name,
            position: pic.position,
            phone: pic.phone,
        });
        setIsDialogOpen(true);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-card p-4 rounded-lg border shadow-sm">
                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search vendor PICs..."
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
                                Tambah PIC Vendor
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-lg">
                            <DialogHeader>
                                <DialogTitle>
                                    {editingPic ? "Edit PIC Vendor" : "Tambah PIC Vendor Baru"}
                                </DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="vendor_id">Vendor *</Label>
                                    <Select
                                        value={formData.vendor_id}
                                        onValueChange={(value) =>
                                            setFormData({ ...formData, vendor_id: value })
                                        }
                                        required
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Pilih vendor" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {vendors.map((vendor: any) => (
                                                <SelectItem key={vendor.id} value={vendor.id}>
                                                    {vendor.company_name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="name">Nama *</Label>
                                    <Input
                                        id="name"
                                        value={formData.name}
                                        onChange={(e) =>
                                            setFormData({ ...formData, name: e.target.value })
                                        }
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="position">Posisi *</Label>
                                    <Input
                                        id="position"
                                        value={formData.position}
                                        onChange={(e) =>
                                            setFormData({ ...formData, position: e.target.value })
                                        }
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="phone">Telepon *</Label>
                                    <Input
                                        id="phone"
                                        value={formData.phone}
                                        onChange={(e) =>
                                            setFormData({ ...formData, phone: e.target.value })
                                        }
                                        required
                                    />
                                </div>
                                <div className="flex justify-end gap-2">
                                    <Button type="button" variant="outline" onClick={resetForm}>
                                        Batal
                                    </Button>
                                    <Button type="submit">
                                        {editingPic ? "Perbarui" : "Buat"}
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
                            <TableHead className="w-12">No</TableHead>
                            <TableHead>Nama</TableHead>
                            <TableHead>Posisi</TableHead>
                            <TableHead>Perusahaan</TableHead>
                            <TableHead>Telepon</TableHead>
                            <TableHead className="text-right">Aksi</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            Array.from({ length: 5 }).map((_, index) => (
                                <TableRow key={index}>
                                    <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
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
                                <TableCell colSpan={6} className="text-center text-destructive p-8">
                                    Pastikan koneksi internet anda baik
                                </TableCell>
                            </TableRow>
                        ) : paginatedPics.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center p-8 text-muted-foreground">
                                    {searchQuery ? "Pencarian tidak ditemukan" : "Belum ada PIC ditemukan"}
                                </TableCell>
                            </TableRow>
                        ) : (
                            paginatedPics.map((pic, index) => (
                                <TableRow key={pic.id}>
                                    <TableCell>{startIndex + index + 1}</TableCell>
                                    <TableCell className="font-medium">{pic.name}</TableCell>
                                    <TableCell>{pic.position}</TableCell>
                                    <TableCell>{pic.vendors?.company_name}</TableCell>
                                    <TableCell>{pic.phone}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                onClick={() => handleEdit(pic)}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <DeleteConfirmationDialog
                                                onDelete={() => deleteMutation.mutate(pic.id)}
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

            {paginatedPics.length > 0 && (
                <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                        Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredPics.length)} of {filteredPics.length} entries
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
        </div>
    );
}
