import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Trash2, Plus, Check, ChevronsUpDown, Pencil } from "lucide-react";
import { DeleteConfirmationDialog } from "@/components/DeleteConfirmationDialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

export default function CustomerCostManagement() {
  const queryClient = useQueryClient();
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [editingSettingId, setEditingSettingId] = useState<string | null>(null);

  // Fetch customers
  const { data: customers } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .order("company_name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch difficulty settings
  const { data: difficultySettings } = useQuery({
    queryKey: ["default_difficulty_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("default_difficulty_settings")
        .select("*")
        .order("difficulty_level");
      if (error) throw error;
      return data;
    },
  });

  // Fetch delivery time settings
  const { data: deliveryTimeSettings } = useQuery({
    queryKey: ["default_delivery_time_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("default_delivery_time_settings")
        .select("*")
        .order("time_category");
      if (error) throw error;
      return data;
    },
  });

  // Fetch payment time settings
  const { data: paymentTimeSettings } = useQuery({
    queryKey: ["default_payment_time_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("default_payment_time_settings")
        .select("*")
        .order("payment_category");
      if (error) throw error;
      return data;
    },
  });

  // Fetch overall cost settings
  const { data: overallCostSettings } = useQuery({
    queryKey: ["default_overall_cost_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("default_overall_cost_settings")
        .select("*")
        .order("cost_category");
      if (error) throw error;
      return data;
    },
  });

  // Fetch all customer default settings with customer info
  const { data: allCustomerSettings } = useQuery({
    queryKey: ["customer_default_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_default_settings")
        .select(`
          *,
          customer:customers(company_name),
          payment_category:default_payment_time_settings(payment_category),
          creator:team_members!fk_created_by_team_member(name)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Add difficulty mutation
  const addDifficultyMutation = useMutation({
    mutationFn: async (data: { difficulty_level: string; percentage: number }) => {
      const { error } = await supabase
        .from("default_difficulty_settings")
        .insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["default_difficulty_settings"] });
      toast.success("Kategori difficulty berhasil ditambahkan");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  // Delete difficulty mutation
  const deleteDifficultyMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("default_difficulty_settings")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["default_difficulty_settings"] });
      toast.success("Kategori difficulty berhasil dihapus");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  // Add delivery time mutation
  const addDeliveryTimeMutation = useMutation({
    mutationFn: async (data: { time_category: string; percentage: number }) => {
      const { error } = await supabase
        .from("default_delivery_time_settings")
        .insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["default_delivery_time_settings"] });
      toast.success("Kategori waktu tiba berhasil ditambahkan");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  // Delete delivery time mutation
  const deleteDeliveryTimeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("default_delivery_time_settings")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["default_delivery_time_settings"] });
      toast.success("Kategori waktu tiba berhasil dihapus");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  // Add payment time mutation
  const addPaymentTimeMutation = useMutation({
    mutationFn: async (data: { payment_category: string; percentage: number }) => {
      const { error } = await supabase
        .from("default_payment_time_settings")
        .insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["default_payment_time_settings"] });
      toast.success("Kategori waktu pembayaran berhasil ditambahkan");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  // Delete payment time mutation
  const deletePaymentTimeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("default_payment_time_settings")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["default_payment_time_settings"] });
      toast.success("Kategori waktu pembayaran berhasil dihapus");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  // Add overall cost mutation
  const addOverallCostMutation = useMutation({
    mutationFn: async (data: { cost_category: string; amount: number }) => {
      const { error } = await supabase
        .from("default_overall_cost_settings")
        .insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["default_overall_cost_settings"] });
      toast.success("Kategori biaya berhasil ditambahkan");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  // Delete overall cost mutation
  const deleteOverallCostMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("default_overall_cost_settings")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["default_overall_cost_settings"] });
      toast.success("Kategori biaya berhasil dihapus");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  // Add customer settings mutation
  const addCustomerSettingsMutation = useMutation({
    mutationFn: async (data: {
      customer_id: string;
      margin_percentage: number;
      payment_category_id: string | null;
    }) => {
      // Check if customer already has settings
      const { data: existing } = await supabase
        .from("customer_default_settings")
        .select("id")
        .eq("customer_id", data.customer_id)
        .maybeSingle();

      if (existing) {
        throw new Error("Customer ini sudah memiliki pengaturan. Silakan edit data yang ada.");
      }

      const { error } = await supabase
        .from("customer_default_settings")
        .insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer_default_settings"] });
      toast.success("Data customer berhasil ditambahkan");
      setSelectedCustomerId("");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  // Update customer settings mutation
  const updateCustomerSettingsMutation = useMutation({
    mutationFn: async (data: {
      id: string;
      margin_percentage: number;
      payment_category_id: string | null;
    }) => {
      const { error } = await supabase
        .from("customer_default_settings")
        .update({
          margin_percentage: data.margin_percentage,
          payment_category_id: data.payment_category_id,
        })
        .eq("id", data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer_default_settings"] });
      toast.success("Data customer berhasil diperbarui");
      setEditingSettingId(null);
      setSelectedCustomerId("");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  // Delete customer settings mutation
  const deleteCustomerSettingsMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("customer_default_settings")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer_default_settings"] });
      toast.success("Data customer berhasil dihapus");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  // Form handlers
  const handleAddDifficulty = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const difficulty_level = formData.get("difficulty_level") as string;
    const percentage = parseFloat(formData.get("percentage") as string);

    if (!difficulty_level || isNaN(percentage)) {
      toast.error("Mohon isi semua field");
      return;
    }

    addDifficultyMutation.mutate({ difficulty_level, percentage });
    e.currentTarget.reset();
  };

  const handleAddDeliveryTime = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const time_category = formData.get("time_category") as string;
    const percentage = parseFloat(formData.get("percentage") as string);

    if (!time_category || isNaN(percentage)) {
      toast.error("Mohon isi semua field");
      return;
    }

    addDeliveryTimeMutation.mutate({ time_category, percentage });
    e.currentTarget.reset();
  };

  const handleAddPaymentTime = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const payment_category = formData.get("payment_category") as string;
    const percentage = parseFloat(formData.get("percentage") as string);

    if (!payment_category || isNaN(percentage)) {
      toast.error("Mohon isi semua field");
      return;
    }

    addPaymentTimeMutation.mutate({ payment_category, percentage });
    e.currentTarget.reset();
  };

  const handleAddOverallCost = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const cost_category = formData.get("cost_category") as string;
    const amount = parseFloat(formData.get("amount") as string);

    if (!cost_category || isNaN(amount)) {
      toast.error("Mohon isi semua field");
      return;
    }

    addOverallCostMutation.mutate({ cost_category, amount });
    e.currentTarget.reset();
  };

  const handleAddCustomerSettings = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedCustomerId) {
      toast.error("Pilih customer terlebih dahulu");
      return;
    }

    const formData = new FormData(e.currentTarget);
    const margin_percentage = parseFloat(formData.get("margin_percentage") as string) || 0;
    const payment_category_id_value = formData.get("payment_category_id") as string;
    const payment_category_id = payment_category_id_value === "none" ? null : payment_category_id_value;

    if (editingSettingId) {
      updateCustomerSettingsMutation.mutate({
        id: editingSettingId,
        margin_percentage,
        payment_category_id,
      });
    } else {
      addCustomerSettingsMutation.mutate({
        customer_id: selectedCustomerId,
        margin_percentage,
        payment_category_id,
      });
    }
    e.currentTarget.reset();
  };

  const handleEditSettings = (setting: any) => {
    setSelectedCustomerId(setting.customer_id);
    setEditingSettingId(setting.id);
  };

  const handleCancelEdit = () => {
    setEditingSettingId(null);
    setSelectedCustomerId("");
  };

  return (
    <div className="container mx-auto py-8">


      <Tabs defaultValue="difficulty" className="space-y-4">
        <TabsList>
          <TabsTrigger value="difficulty">Difficulty of Item</TabsTrigger>
          <TabsTrigger value="delivery">Waktu Tiba</TabsTrigger>
          <TabsTrigger value="payment">Waktu Pembayaran</TabsTrigger>
          <TabsTrigger value="overall">Biaya Keseluruhan</TabsTrigger>
          <TabsTrigger value="customer">Pengaturan Customer</TabsTrigger>
        </TabsList>

        <TabsContent value="difficulty">
          <Card>
            <CardHeader>
              <CardTitle>Kategori Difficulty of Item</CardTitle>
              <CardDescription>
                Kelola kategori kesulitan item dan persentase biaya tambahan
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <form onSubmit={handleAddDifficulty} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="difficulty_level">Kategori</Label>
                    <Input
                      id="difficulty_level"
                      name="difficulty_level"
                      placeholder="Contoh: Easy, Medium, Hard, Rare"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="difficulty_percentage">Persentase (%)</Label>
                    <Input
                      id="difficulty_percentage"
                      name="percentage"
                      type="number"
                      step="0.01"
                      placeholder="0"
                      required
                    />
                  </div>
                </div>
                <Button type="submit">
                  <Plus className="w-4 h-4 mr-2" />
                  Tambah Kategori
                </Button>
              </form>

              <div className="space-y-2">
                <h3 className="font-semibold">Daftar Kategori</h3>
                {difficultySettings?.map((setting) => (
                  <div
                    key={setting.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div>
                      <span className="font-medium">{setting.difficulty_level}</span>
                      <span className="ml-4 text-muted-foreground">
                        {setting.percentage}%
                      </span>
                    </div>
                    <DeleteConfirmationDialog
                      onDelete={() => deleteDifficultyMutation.mutate(setting.id)}
                      trigger={
                        <Button variant="ghost" size="icon">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      }
                    />
                  </div>
                ))}
                {!difficultySettings?.length && (
                  <p className="text-muted-foreground text-sm">
                    Belum ada kategori difficulty
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="delivery">
          <Card>
            <CardHeader>
              <CardTitle>Kategori Waktu Tiba</CardTitle>
              <CardDescription>
                Kelola kategori waktu pengiriman dan persentase biaya tambahan
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <form onSubmit={handleAddDeliveryTime} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="time_category">Kategori Waktu</Label>
                    <Input
                      id="time_category"
                      name="time_category"
                      placeholder="Contoh: 1-2 minggu, 2-3 minggu"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="delivery_percentage">Persentase (%)</Label>
                    <Input
                      id="delivery_percentage"
                      name="percentage"
                      type="number"
                      step="0.01"
                      placeholder="0"
                      required
                    />
                  </div>
                </div>
                <Button type="submit">
                  <Plus className="w-4 h-4 mr-2" />
                  Tambah Kategori
                </Button>
              </form>

              <div className="space-y-2">
                <h3 className="font-semibold">Daftar Kategori</h3>
                {deliveryTimeSettings?.map((setting) => (
                  <div
                    key={setting.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div>
                      <span className="font-medium">{setting.time_category}</span>
                      <span className="ml-4 text-muted-foreground">
                        {setting.percentage}%
                      </span>
                    </div>
                    <DeleteConfirmationDialog
                      onDelete={() => deleteDeliveryTimeMutation.mutate(setting.id)}
                      trigger={
                        <Button variant="ghost" size="icon">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      }
                    />
                  </div>
                ))}
                {!deliveryTimeSettings?.length && (
                  <p className="text-muted-foreground text-sm">
                    Belum ada kategori waktu tiba
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payment">
          <Card>
            <CardHeader>
              <CardTitle>Kategori Waktu Pembayaran</CardTitle>
              <CardDescription>
                Kelola kategori waktu pembayaran
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <form onSubmit={handleAddPaymentTime} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="payment_category">Kategori Pembayaran</Label>
                    <Input
                      id="payment_category"
                      name="payment_category"
                      placeholder="Contoh: 30 hari, 60 hari, COD"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="payment_percentage">Persentase (%)</Label>
                    <Input
                      id="payment_percentage"
                      name="percentage"
                      type="number"
                      step="0.01"
                      placeholder="0"
                      required
                    />
                  </div>
                </div>
                <Button type="submit">
                  <Plus className="w-4 h-4 mr-2" />
                  Tambah Kategori
                </Button>
              </form>

              <div className="space-y-2">
                <h3 className="font-semibold">Daftar Kategori</h3>
                {paymentTimeSettings?.map((setting) => (
                  <div
                    key={setting.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div>
                      <span className="font-medium">{setting.payment_category}</span>
                      <span className="ml-4 text-muted-foreground">
                        {setting.percentage}%
                      </span>
                    </div>
                    <DeleteConfirmationDialog
                      onDelete={() => deletePaymentTimeMutation.mutate(setting.id)}
                      trigger={
                        <Button variant="ghost" size="icon">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      }
                    />
                  </div>
                ))}
                {!paymentTimeSettings?.length && (
                  <p className="text-muted-foreground text-sm">
                    Belum ada kategori waktu pembayaran
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overall">
          <Card>
            <CardHeader>
              <CardTitle>Kategori Biaya Keseluruhan</CardTitle>
              <CardDescription>
                Kelola kategori biaya dan jumlah dalam Rupiah
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <form onSubmit={handleAddOverallCost} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="cost_category">Kategori Biaya</Label>
                    <Input
                      id="cost_category"
                      name="cost_category"
                      placeholder="Contoh: Document Cost, Return Cost"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="amount">Jumlah (Rp)</Label>
                    <Input
                      id="amount"
                      name="amount"
                      type="number"
                      step="0.01"
                      placeholder="0"
                      required
                    />
                  </div>
                </div>
                <Button type="submit">
                  <Plus className="w-4 h-4 mr-2" />
                  Tambah Kategori
                </Button>
              </form>

              <div className="space-y-2">
                <h3 className="font-semibold">Daftar Kategori</h3>
                {overallCostSettings?.map((setting) => (
                  <div
                    key={setting.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div>
                      <span className="font-medium">{setting.cost_category}</span>
                      <span className="ml-4 text-muted-foreground">
                        Rp {setting.amount.toLocaleString('id-ID')}
                      </span>
                    </div>
                    <DeleteConfirmationDialog
                      onDelete={() => deleteOverallCostMutation.mutate(setting.id)}
                      trigger={
                        <Button variant="ghost" size="icon">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      }
                    />
                  </div>
                ))}
                {!overallCostSettings?.length && (
                  <p className="text-muted-foreground text-sm">
                    Belum ada kategori biaya
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="customer">
          <Card>
            <CardHeader>
              <CardTitle>Pengaturan Default Per Customer</CardTitle>
              <CardDescription>
                Atur margin, kategori pembayaran, dan biaya default untuk setiap customer
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <form onSubmit={handleAddCustomerSettings} className="space-y-4">
                <div>
                  <Label>Pilih Customer</Label>
                  <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-full justify-between"
                      >
                        {selectedCustomerId
                          ? customers?.find((customer) => customer.id === selectedCustomerId)?.company_name
                          : "Pilih customer..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0">
                      <Command>
                        <CommandInput placeholder="Cari customer..." />
                        <CommandEmpty>Pencarian tidak ditemukan.</CommandEmpty>
                        <CommandGroup>
                          {customers?.map((customer) => (
                            <CommandItem
                              key={customer.id}
                              value={customer.company_name}
                              onSelect={() => {
                                setSelectedCustomerId(customer.id);
                                setOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedCustomerId === customer.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {customer.company_name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {selectedCustomerId && (
                  <>
                    <div>
                      <Label htmlFor="margin_percentage">Margin (%)</Label>
                      <Input
                        id="margin_percentage"
                        name="margin_percentage"
                        type="number"
                        step="0.01"
                        defaultValue={
                          editingSettingId
                            ? allCustomerSettings?.find((s) => s.id === editingSettingId)?.margin_percentage || 0
                            : 0
                        }
                        placeholder="0"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="payment_category_id">Kategori Pembayaran</Label>
                      <Select
                        name="payment_category_id"
                        defaultValue={
                          editingSettingId
                            ? allCustomerSettings?.find((s) => s.id === editingSettingId)?.payment_category_id || "none"
                            : "none"
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih kategori pembayaran" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Tidak ada</SelectItem>
                          {paymentTimeSettings?.map((payment) => (
                            <SelectItem key={payment.id} value={payment.id}>
                              {payment.payment_category}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit">
                        {editingSettingId ? "Simpan Perubahan" : "Tambah Data"}
                      </Button>
                      {editingSettingId && (
                        <Button type="button" variant="outline" onClick={handleCancelEdit}>
                          Batal
                        </Button>
                      )}
                    </div>
                  </>
                )}
              </form>

              <div className="space-y-2">
                <h3 className="font-semibold">Daftar Pengaturan Customer</h3>
                {allCustomerSettings?.map((setting: any) => (
                  <div
                    key={setting.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="font-medium">{setting.customer?.company_name}</div>
                      <div className="text-sm text-muted-foreground">
                        Margin: {setting.margin_percentage}% | Kategori Pembayaran:{" "}
                        {setting.payment_category?.payment_category || "Tidak ada"}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Dibuat Oleh: <span className="font-medium text-foreground">{setting.creator?.name || "-"}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditSettings(setting)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <DeleteConfirmationDialog
                        onDelete={() => deleteCustomerSettingsMutation.mutate(setting.id)}
                        trigger={
                          <Button variant="ghost" size="icon">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        }
                      />
                    </div>
                  </div>
                ))}
                {!allCustomerSettings?.length && (
                  <p className="text-muted-foreground text-sm">
                    Belum ada pengaturan customer
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}