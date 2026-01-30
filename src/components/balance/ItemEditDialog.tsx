import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, X, Paperclip } from "lucide-react";

interface ItemEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: {
    id: string;
    vendor_id?: string;
    vendor?: { company_name: string } | null;
    vendor_spec: string;
    customer_spec?: string;
    purchase_price: number;
    qty: number;
    unit: string;
    weight: number;
    shipping_vendor_group: string;
    shipping_customer_group: string;
    delivery_time: string;
    difficulty: string;
    document_path?: string;
    offering_letter_number?: string;
    offering_date?: string;
    balance_entry_id: number;
  } | null;
  balanceId: string;
  shippingVendorGroups: Array<{ id: string; group_name: string; cost: number }>;
  shippingCustomerGroups: Array<{ id: string; group_name: string; cost: number }>;
  onSuccess: () => void;
}

export default function ItemEditDialog({
  open,
  onOpenChange,
  item,
  shippingVendorGroups,
  shippingCustomerGroups,
  onSuccess,
  balanceId,
}: ItemEditDialogProps) {
  const [step, setStep] = useState(1);
  const [vendors, setVendors] = useState<Array<{ id: string; company_name: string }>>([]);
  const [searchTerm, setSearchTerm] = useState("");

  // Step 1
  const [selectedVendorId, setSelectedVendorId] = useState("");
  const [vendorSpec, setVendorSpec] = useState("");
  const [customerSpec, setCustomerSpec] = useState("");
  const [documents, setDocuments] = useState<File[]>([]);
  const [existingDocuments, setExistingDocuments] = useState<string[]>([]);
  const [offeringLetterNumber, setOfferingLetterNumber] = useState("");
  const [offeringDate, setOfferingDate] = useState("");
  const [isOfferingSynced, setIsOfferingSynced] = useState(false);

  // Step 2
  const [purchasePrice, setPurchasePrice] = useState("");
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState("");
  const [weight, setWeight] = useState("");
  const [shippingVendorGroup, setShippingVendorGroup] = useState("");
  const [shippingCustomerGroup, setShippingCustomerGroup] = useState("");
  const [deliveryTime, setDeliveryTime] = useState("");
  const [difficulty, setDifficulty] = useState("");

  const [deliveryTimeCategories, setDeliveryTimeCategories] = useState<Array<{ id: string; time_category: string; percentage: number }>>([]);
  const [difficultyCategories, setDifficultyCategories] = useState<Array<{ id: string; difficulty_level: string; percentage: number }>>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (item && open) {
      setStep(1);
      setSelectedVendorId(item.vendor_id || "");
      setSearchTerm(item.vendor?.company_name || "");
      setVendorSpec(item.vendor_spec || "");
      setCustomerSpec(item.customer_spec || "");
      setPurchasePrice(item.purchase_price.toString());
      setQty(item.qty.toString());
      setUnit(item.unit);
      setWeight(item.weight?.toString() || "");
      setShippingVendorGroup(item.shipping_vendor_group);
      setShippingCustomerGroup(item.shipping_customer_group);
      setDeliveryTime(item.delivery_time);
      setDifficulty(item.difficulty);
      setExistingDocuments(item.document_path ? item.document_path.split(",").filter(Boolean) : []);
      setDocuments([]);
    }
  }, [item, open]);

  // Helper to format number with thousands separator
  const formatNumber = (value: string) => {
    if (!value) return "";
    const clean = value.replace(/[^0-9.]/g, "");
    const parts = clean.split(".");
    if (parts.length > 2) return value;
    const integerPart = parts[0];
    const decimalPart = parts.length > 1 ? "." + parts[1] : "";
    if (!integerPart && !decimalPart) return "";
    const formattedInteger = integerPart ? parseInt(integerPart).toLocaleString("en-US") : "0";
    if (!integerPart && decimalPart) return "0" + decimalPart;
    return formattedInteger + decimalPart;
  };

  const parseNumber = (value: string) => {
    if (!value) return 0;
    return parseFloat(value.replace(/,/g, "")) || 0;
  };

  const handleNumberChange = (value: string, setter: (val: string) => void) => {
    if (value.includes("-")) return;
    const raw = value.replace(/,/g, "");
    if (!/^[0-9]*\.?[0-9]*$/.test(raw)) return;
    const formatted = formatNumber(raw);
    setter(formatted);
  };

  useEffect(() => {
    if (item && open) {
      setStep(1);
      setSelectedVendorId(item.vendor_id || "");
      setSearchTerm(item.vendor?.company_name || "");
      setVendorSpec(item.vendor_spec || "");
      setCustomerSpec(item.customer_spec || "");

      // Initialize with formatted string
      setPurchasePrice(item.purchase_price ? item.purchase_price.toLocaleString("en-US") : "0");
      setQty(item.qty ? item.qty.toLocaleString("en-US") : "0");

      setUnit(item.unit);
      setWeight(item.weight ? item.weight.toLocaleString("en-US") : "");

      setShippingVendorGroup(item.shipping_vendor_group);
      setShippingCustomerGroup(item.shipping_customer_group);
      setDeliveryTime(item.delivery_time);
      setDifficulty(item.difficulty);
      setExistingDocuments(item.document_path ? item.document_path.split(",").filter(Boolean) : []);
      setDocuments([]);
      setOfferingLetterNumber(item.offering_letter_number || "");
      setOfferingDate(item.offering_date || "");
    }
  }, [item, open]);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    const [deliveryResult, difficultyResult] = await Promise.all([
      supabase.from("default_delivery_time_settings").select("*").order("time_category"),
      supabase.from("default_difficulty_settings").select("*").order("difficulty_level"),
    ]);
    if (deliveryResult.data) setDeliveryTimeCategories(deliveryResult.data);
    if (difficultyResult.data) setDifficultyCategories(difficultyResult.data);
  };

  const calculateSellingPrice = () => {
    const B = parseNumber(purchasePrice);
    const Q = parseNumber(qty) || 1;

    const V_group_total = shippingVendorGroups.find(g => g.group_name === shippingVendorGroup)?.cost || 0;
    const M_group_total = shippingCustomerGroups.find(g => g.group_name === shippingCustomerGroup)?.cost || 0;

    const Vendor_per_pc = V_group_total / Q;
    const Mpa_per_pc = M_group_total / Q;

    const diffPercentage = difficultyCategories.find(d => d.difficulty_level === difficulty)?.percentage || 0;
    const diff_pct = diffPercentage / 100;
    const Difficulty = diff_pct * B;

    const deliveryPercentage = deliveryTimeCategories.find(d => d.time_category === deliveryTime)?.percentage || 0;
    const ship_pct = deliveryPercentage / 100;
    const Shipping = ship_pct * B;

    // Assume 0% payment for preview since we don't have customer settings here
    const pay_pct = 0;
    const Payment_cost = pay_pct * B;

    const Cost_per_pc = B + Vendor_per_pc + Mpa_per_pc + Difficulty + Shipping + Payment_cost;

    // Assume 0% margin for preview
    const margin_pct = 0;
    const Price_per_pc = Math.round(Cost_per_pc * (1 + margin_pct));
    const totalPrice = Math.round(Price_per_pc * Q);

    return { unitPrice: Price_per_pc, totalPrice };
  };

  const searchVendors = async (term: string) => {
    if (!term) {
      setVendors([]);
      return;
    }

    const { data, error } = await supabase
      .from("vendors")
      .select("id, company_name")
      .ilike("company_name", `%${term}%`)
      .limit(10);

    if (error) {
      console.error(error);
      return;
    }

    setVendors(data || []);
  };

  useEffect(() => {
    const fetchVendorSettings = async () => {
      if (!selectedVendorId || !item) return;

      // Check settings exist
      const { data } = await supabase
        .from("balance_vendor_settings")
        .select("vendor_letter_number, vendor_letter_date")
        .eq("balance_id", balanceId)
        .eq("balance_entry_id", item.balance_entry_id) // Filter by Entry ID
        .eq("vendor_id", selectedVendorId)
        .maybeSingle();

      if (data && (data.vendor_letter_number || data.vendor_letter_date)) {
        setOfferingLetterNumber(data.vendor_letter_number || "");
        setOfferingDate(data.vendor_letter_date || "");
        setIsOfferingSynced(true);
      } else {
        setIsOfferingSynced(false);
        // If switching to a vendor without settings:
        if (selectedVendorId === item.vendor_id) {
          // If it's the original vendor, restore the original item values (e.g. manual entry persistence)
          setOfferingLetterNumber(item.offering_letter_number || "");
          setOfferingDate(item.offering_date || "");
        } else {
          // If it's a NEW vendor (and no settings found), CLEAR the fields to prevent lingering values
          setOfferingLetterNumber("");
          setOfferingDate("");
        }
      }
    };
    fetchVendorSettings();
  }, [selectedVendorId, balanceId, item]);

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    searchVendors(value);
  };

  const handleDocumentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      setDocuments(prev => [...prev, ...Array.from(files)]);
    }
  };

  const removeNewDocument = (index: number) => {
    setDocuments(prev => prev.filter((_, i) => i !== index));
  };

  const removeExistingDocument = (index: number) => {
    setExistingDocuments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!item) return;
    setIsLoading(true);

    let documentPaths = [...existingDocuments];

    if (documents.length > 0) {
      for (const doc of documents) {
        const fileName = `${item.id}_${Date.now()}_${doc.name}`;
        const { error: uploadError } = await supabase.storage
          .from("request-attachments")
          .upload(fileName, doc);

        if (uploadError) {
          toast.error(`Failed to upload ${doc.name}`);
          setIsLoading(false);
          return;
        }

        documentPaths.push(fileName);
      }
    }

    // Fetch Full Vendor Details for Snapshot
    let snapshotData = null;
    if (selectedVendorId) {
      const { data: fullVendor } = await supabase
        .from("vendors")
        .select("*")
        .eq("id", selectedVendorId)
        .single();

      if (fullVendor) {
        snapshotData = { vendor: fullVendor };
      }
    }

    const { error } = await supabase
      .from("balance_items")
      .update({
        vendor_id: selectedVendorId || null,
        vendor_spec: vendorSpec,
        customer_spec: customerSpec,
        purchase_price: parseNumber(purchasePrice),
        qty: parseNumber(qty),
        unit,
        weight: parseNumber(weight),
        shipping_vendor_group: shippingVendorGroup,
        shipping_customer_group: shippingCustomerGroup,
        delivery_time: deliveryTime,
        difficulty,

        document_path: documentPaths.join(","),
        offering_letter_number: offeringLetterNumber,
        offering_date: offeringDate || null,
        vendor_snapshot: snapshotData
      })
      .eq("id", item.id);

    // Sync to vendor settings (ALWAYS Upsert to ensure latest manual entry is saved/corrected)
    if (selectedVendorId && item) {
      await supabase
        .from("balance_vendor_settings")
        .upsert({
          balance_id: balanceId,
          balance_entry_id: item.balance_entry_id, // Scope to specific entry/option
          vendor_id: selectedVendorId,
          vendor_letter_number: offeringLetterNumber,
          vendor_letter_date: offeringDate || null,
          updated_at: new Date().toISOString()
        }, { onConflict: "balance_id,vendor_id,balance_entry_id" }); // Updated constraint
    }

    setIsLoading(false);

    if (error) {
      toast.error("Gagal mengupdate item");
      return;
    }

    toast.success("Item berhasil diupdate");
    onSuccess();
    onOpenChange(false);
  };

  if (!item) return null;

  const vendorShippingCost = shippingVendorGroups.find(g => g.group_name === shippingVendorGroup)?.cost || 0;
  const customerShippingCost = shippingCustomerGroups.find(g => g.group_name === shippingCustomerGroup)?.cost || 0;
  const totalPurchasePrice = (parseFloat(purchasePrice) || 0) * (parseFloat(qty) || 0);
  const deliveryPercentage = deliveryTimeCategories.find(d => d.time_category === deliveryTime)?.percentage || 0;
  const difficultyPercentage = difficultyCategories.find(d => d.difficulty_level === difficulty)?.percentage || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Item - Step {step} of 3</DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <Label>Search Vendor</Label>
              <Input
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Cari vendor..."
              />
              {vendors.length > 0 && (
                <div className="border rounded-md mt-2 max-h-40 overflow-y-auto">
                  {vendors.map((vendor) => (
                    <div
                      key={vendor.id}
                      className="p-2 hover:bg-accent cursor-pointer"
                      onClick={() => {
                        setSelectedVendorId(vendor.id);
                        setSearchTerm(vendor.company_name);
                        setVendors([]);
                      }}
                    >
                      {vendor.company_name}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <Label>Spek Vendor</Label>
              <textarea
                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={vendorSpec}
                onChange={(e) => setVendorSpec(e.target.value)}
                placeholder="Masukkan spesifikasi vendor..."
              />
            </div>

            <div>
              <Label>Spek Customer</Label>
              <textarea
                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={customerSpec}
                onChange={(e) => setCustomerSpec(e.target.value)}
                placeholder="Masukkan spesifikasi customer..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nomor Surat Penawaran {isOfferingSynced && <span className="text-xs text-green-600 font-normal">(Tersinkronisasi)</span>}</Label>
                <Input
                  value={offeringLetterNumber}
                  onChange={(e) => setOfferingLetterNumber(e.target.value)}
                  placeholder="Contoh: INV/2025/001"
                  disabled
                  className="bg-muted text-muted-foreground"
                />
              </div>
              <div>
                <Label>Tanggal Penawaran</Label>
                <Input
                  type="date"
                  value={offeringDate}
                  onChange={(e) => setOfferingDate(e.target.value)}
                  disabled
                  className="bg-muted text-muted-foreground"
                />
              </div>
            </div>



            <div>
              <Label>Upload Dokumen Pendukung</Label>
              <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 mt-2">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Input
                      type="file"
                      multiple
                      onChange={handleDocumentUpload}
                      className="hidden"
                      id="edit-document-upload"
                    />
                    <label
                      htmlFor="edit-document-upload"
                      className="cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
                    >
                      Choose Files
                    </label>
                    <span className="text-sm text-muted-foreground italic">
                      {documents.length === 0 ? "No file chosen" : `${documents.length} files selected`}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {existingDocuments.map((doc, idx) => (
                      <div key={`existing-${idx}`} className="flex items-center justify-between p-2 bg-blue-50 text-blue-700 rounded-md border border-blue-100">
                        <div className="flex items-center gap-2 text-sm overflow-hidden">
                          <Paperclip className="h-4 w-4 shrink-0" />
                          <span className="truncate">{doc.split('_').pop()}</span>
                        </div>
                        <button onClick={() => removeExistingDocument(idx)} className="text-blue-700 hover:text-blue-900 shrink-0">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    {documents.map((doc, idx) => (
                      <div key={`new-${idx}`} className="flex items-center justify-between p-2 bg-blue-50 text-blue-700 rounded-md border border-blue-100">
                        <div className="flex items-center gap-2 text-sm overflow-hidden">
                          <Paperclip className="h-4 w-4 shrink-0" />
                          <span className="truncate">{doc.name} (New)</span>
                        </div>
                        <button onClick={() => removeNewDocument(idx)} className="text-blue-700 hover:text-blue-900 shrink-0">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <Button onClick={() => setStep(2)} className="w-full">
              Next
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Harga Beli</Label>
                <Input
                  type="text"
                  value={purchasePrice}
                  onChange={(e) => handleNumberChange(e.target.value, setPurchasePrice)}
                />
              </div>
              <div>
                <Label>Qty</Label>
                <Input
                  type="text"
                  value={qty}
                  onChange={(e) => handleNumberChange(e.target.value, setQty)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Satuan</Label>
                <Input
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="pcs, kg, dll"
                />
              </div>
              <div>
                <Label>Berat (kg)</Label>
                <Input
                  type="text"
                  value={weight}
                  onChange={(e) => handleNumberChange(e.target.value, setWeight)}
                />
              </div>
            </div>

            <div>
              <Label>Ongkir Vendor-MPA</Label>
              <Select value={shippingVendorGroup} onValueChange={setShippingVendorGroup}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih group..." />
                </SelectTrigger>
                <SelectContent>
                  {shippingVendorGroups.map((group) => (
                    <SelectItem key={group.id} value={group.group_name}>
                      Group {group.group_name} (Rp {group.cost.toLocaleString()})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Ongkir MPA-Customer</Label>
              <Select value={shippingCustomerGroup} onValueChange={setShippingCustomerGroup}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih group..." />
                </SelectTrigger>
                <SelectContent>
                  {shippingCustomerGroups.map((group) => (
                    <SelectItem key={group.id} value={group.group_name}>
                      Group {group.group_name} (Rp {group.cost.toLocaleString()})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Waktu Sampai</Label>
              <Select value={deliveryTime} onValueChange={setDeliveryTime}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih waktu..." />
                </SelectTrigger>
                <SelectContent>
                  {deliveryTimeCategories.map((time) => (
                    <SelectItem key={time.id} value={time.time_category}>
                      {time.time_category} ({time.percentage}%)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Difficult of Item</Label>
              <Select value={difficulty} onValueChange={setDifficulty}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih tingkat kesulitan..." />
                </SelectTrigger>
                <SelectContent>
                  {difficultyCategories.map((diff) => (
                    <SelectItem key={diff.id} value={diff.difficulty_level}>
                      {diff.difficulty_level} ({diff.percentage}%)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                Back
              </Button>
              <Button onClick={() => setStep(3)} className="flex-1">
                Next
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (() => {
          const { unitPrice, totalPrice } = calculateSellingPrice();
          return (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Summary</h3>

              <div className="space-y-2 border rounded-md p-4">
                <div className="border-b pb-2">
                  <h4 className="font-medium mb-2">Spesifikasi</h4>
                  <div className="space-y-1 text-sm">
                    <div>
                      <span className="text-muted-foreground">Spek Vendor:</span>
                      <p className="mt-1">{vendorSpec || "-"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Spek Customer:</span>
                      <p className="mt-1">{customerSpec || "-"}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Qty:</span>
                    <span className="font-medium">{qty} {unit}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Harga Beli:</span>
                    <span className="font-medium">Rp {parseNumber(purchasePrice).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Beli:</span>
                    <span className="font-medium">Rp {totalPurchasePrice.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Berat:</span>
                    <span className="font-medium">{parseNumber(weight)} kg</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Ongkir Vendor-MPA:</span>
                    <span className="font-medium">Group {shippingVendorGroup} | Rp {vendorShippingCost.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Ongkir MPA-Customer:</span>
                    <span className="font-medium">Group {shippingCustomerGroup} | Rp {customerShippingCost.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Waktu Sampai:</span>
                    <span className="font-medium">{deliveryTime} | {deliveryPercentage}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Difficult of Item:</span>
                    <span className="font-medium">{difficulty} | {difficultyPercentage}%</span>
                  </div>
                  <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between">
                      <span>Harga Jual/Unit:</span>
                      <span className="font-medium text-muted-foreground italic">Dihitung setelah disimpan</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-bold">Total Harga Jual:</span>
                      <span className="font-medium text-muted-foreground italic">Dihitung setelah disimpan</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      * Harga jual akan dihitung berdasarkan semua item yang ada di neraca ini
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                  Back
                </Button>
                <Button onClick={handleSubmit} className="flex-1" disabled={isLoading}>
                  {isLoading ? "Menyimpan..." : "Simpan Perubahan"}
                </Button>
              </div>
            </div>
          );
        })()}
      </DialogContent>
    </Dialog>
  );
}