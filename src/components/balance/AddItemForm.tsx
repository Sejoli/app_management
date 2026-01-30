import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Upload, X, Paperclip } from "lucide-react";

interface AddItemFormProps {
  balanceId: string;
  entryId: number;
  shippingVendorGroups: Array<{ id: string; group_name: string; cost: number }>;
  shippingCustomerGroups: Array<{ id: string; group_name: string; cost: number }>;
  customerMargin: number;
  customerPaymentPercentage: number;
  onSuccess: () => void;
}

export default function AddItemForm({
  balanceId,
  entryId,
  shippingVendorGroups,
  shippingCustomerGroups,
  customerMargin,
  customerPaymentPercentage,
  onSuccess,
}: AddItemFormProps) {
  const [step, setStep] = useState(1);
  const [vendors, setVendors] = useState<Array<{ id: string; company_name: string }>>([]);
  const [searchTerm, setSearchTerm] = useState("");

  // Step 1
  const [selectedVendorId, setSelectedVendorId] = useState("");
  const [vendorSpec, setVendorSpec] = useState("");
  const [customerSpec, setCustomerSpec] = useState("");
  const [offeringLetterNumber, setOfferingLetterNumber] = useState("");
  const [offeringDate, setOfferingDate] = useState("");
  const [isOfferingSynced, setIsOfferingSynced] = useState(false);

  const [documents, setDocuments] = useState<File[]>([]);
  const [errors, setErrors] = useState<{ vendor?: string; offeringNo?: string; offeringDate?: string }>({});

  const validateStep1 = () => {
    const newErrors: typeof errors = {};
    if (!selectedVendorId) newErrors.vendor = "Vendor harus dipilih";
    if (!offeringLetterNumber) newErrors.offeringNo = "Nomor Surat Penawaran wajib diisi";
    if (!offeringDate) newErrors.offeringDate = "Tanggal Penawaran wajib diisi";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep1()) {
      setStep(2);
    }
  };

  // Step 2
  const [purchasePrice, setPurchasePrice] = useState("");
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState("");
  const [weight, setWeight] = useState("");
  const [shippingVendorGroup, setShippingVendorGroup] = useState("");
  const [shippingCustomerGroup, setShippingCustomerGroup] = useState("");
  const [deliveryTime, setDeliveryTime] = useState("");
  const [difficulty, setDifficulty] = useState("");

  // Fetch categories from database
  const [deliveryTimeCategories, setDeliveryTimeCategories] = useState<Array<{ id: string; time_category: string; percentage: number }>>([]);
  const [difficultyCategories, setDifficultyCategories] = useState<Array<{ id: string; difficulty_level: string; percentage: number }>>([]);
  const [overallCosts, setOverallCosts] = useState<Array<{ id: string; cost_category: string; amount: number }>>([]);

  useEffect(() => {
    fetchDeliveryTimeCategories();
    fetchDifficultyCategories();
    fetchOverallCosts();
  }, []);

  const fetchDeliveryTimeCategories = async () => {
    const { data, error } = await supabase
      .from("default_delivery_time_settings")
      .select("*")
      .order("time_category");

    if (error) {
      console.error(error);
      return;
    }

    setDeliveryTimeCategories(data || []);
  };

  const fetchDifficultyCategories = async () => {
    const { data, error } = await supabase
      .from("default_difficulty_settings")
      .select("*")
      .order("difficulty_level");

    if (error) {
      console.error(error);
      return;
    }

    setDifficultyCategories(data || []);
  };

  const fetchOverallCosts = async () => {
    const { data, error } = await supabase
      .from("default_overall_cost_settings")
      .select("*");

    if (error) {
      console.error(error);
      return;
    }

    setOverallCosts(data || []);
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

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    searchVendors(value);
  };

  useEffect(() => {
    const fetchVendorSettings = async () => {
      if (!selectedVendorId) return;

      console.log("DEBUG ADD ITEM: Fetching settings for", { balanceId, entryId, selectedVendorId });

      // Reset first
      setOfferingLetterNumber("");
      setOfferingDate("");
      setIsOfferingSynced(false);

      // 1. Try fetching from explicit settings first
      const { data: settingsData } = await supabase
        .from("balance_vendor_settings")
        .select("vendor_letter_number, vendor_letter_date")
        .eq("balance_id", balanceId)
        .eq("balance_entry_id", entryId)
        .eq("vendor_id", selectedVendorId)
        .maybeSingle();

      if (settingsData && (settingsData.vendor_letter_number || settingsData.vendor_letter_date)) {
        console.log("DEBUG ADD ITEM: Found in Settings");
        setOfferingLetterNumber(settingsData.vendor_letter_number || "");
        setOfferingDate(settingsData.vendor_letter_date || "");
        setIsOfferingSynced(true);
        return;
      }

      // 2. Fallback: Fetch from existing items in this entry
      console.log("DEBUG ADD ITEM: Settings empty, trying latest item...");
      const { data: itemData } = await supabase
        .from("balance_items")
        .select("offering_letter_number, offering_date")
        .eq("balance_id", balanceId)
        .eq("balance_entry_id", entryId)
        .eq("vendor_id", selectedVendorId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (itemData && (itemData.offering_letter_number || itemData.offering_date)) {
        console.log("DEBUG ADD ITEM: Found in recent Item");
        setOfferingLetterNumber(itemData.offering_letter_number || "");
        setOfferingDate(itemData.offering_date || "");
        // We set synced to true so it feels like it's remembered, 
        // but user can still edit if they want (field is disabled if synced, maybe we should allow edit if it's just a fallback?)
        // User said "otomatis terisi", usually implies read-only default or pre-fill. 
        // Existing logic disables input if synced. Let's keep it disabled to show it's "Linked".
        setIsOfferingSynced(true);
      } else {
        console.log("DEBUG ADD ITEM: No data found anywhere.");
      }
    };
    fetchVendorSettings();
  }, [selectedVendorId, balanceId]);

  const handleDocumentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      setDocuments(prev => [...prev, ...Array.from(files)]);
    }
  };

  const removeDocument = (index: number) => {
    setDocuments(prev => prev.filter((_, i) => i !== index));
  };

  // Helper to format number with thousands separator
  const formatNumber = (value: string) => {
    if (!value) return "";

    // Remove all non-digit and non-dot characters
    const clean = value.replace(/[^0-9.]/g, "");

    // Prevent multiple dots
    const parts = clean.split(".");
    if (parts.length > 2) return value; // Don't format if invalid

    const integerPart = parts[0];
    const decimalPart = parts.length > 1 ? "." + parts[1] : "";

    if (!integerPart && !decimalPart) return "";

    // Format integer part
    const formattedInteger = integerPart ? parseInt(integerPart).toLocaleString("en-US") : "0";

    // If it starts with dot, e.g. ".5", it becomes "0.5"
    if (!integerPart && decimalPart) return "0" + decimalPart;

    return formattedInteger + decimalPart;
  };

  const parseNumber = (value: string) => {
    if (!value) return 0;
    return parseFloat(value.replace(/,/g, "")) || 0;
  };

  const handleNumberChange = (value: string, setter: (val: string) => void) => {
    // Prevent negative sign manually just in case, though regex handles it
    if (value.includes("-")) return;

    // Remove existing commas to get raw number for formatting logic
    const raw = value.replace(/,/g, "");

    // Allow digits and one dot
    if (!/^[0-9]*\.?[0-9]*$/.test(raw)) return;

    const formatted = formatNumber(raw);
    setter(formatted);
  };

  const calculateSellingPrice = () => {
    // B = harga beli per pcs
    const B = parseNumber(purchasePrice);
    // Q = qty
    const Q = parseNumber(qty) || 1;

    // Get shipping costs - will be distributed per pc (assume single item for now, actual distribution in recalculateAllItems)
    const V_group_total = shippingVendorGroups.find(g => g.group_name === shippingVendorGroup)?.cost || 0;
    const M_group_total = shippingCustomerGroups.find(g => g.group_name === shippingCustomerGroup)?.cost || 0;

    // For single item preview, assume this item is the only one in the group
    const Vendor_per_pc = V_group_total / Q;
    const Mpa_per_pc = M_group_total / Q;

    // diff_pct = persentase difficulty
    const diffPercentage = difficultyCategories.find(d => d.difficulty_level === difficulty)?.percentage || 0;
    const diff_pct = diffPercentage / 100;
    // Difficulty = diff_pct × B
    const Difficulty = diff_pct * B;

    // ship_pct = persentase biaya kirim sesuai waktu
    const deliveryPercentage = deliveryTimeCategories.find(d => d.time_category === deliveryTime)?.percentage || 0;
    const ship_pct = deliveryPercentage / 100;
    // Shipping = ship_pct × B
    const Shipping = ship_pct * B;

    // pay_pct = persentase biaya waktu pembayaran
    const pay_pct = customerPaymentPercentage / 100;
    // Payment_cost = pay_pct × B
    const Payment_cost = pay_pct * B;

    // Cost_per_pc = B + Vendor_per_pc + Mpa_per_pc + Difficulty + Shipping + Payment_cost
    const Cost_per_pc = B + Vendor_per_pc + Mpa_per_pc + Difficulty + Shipping + Payment_cost;

    // margin = margin penjualan
    const margin_pct = customerMargin / 100;
    // Price_per_pc = Cost_per_pc × (1 + margin)
    const Price_per_pc = Math.round(Cost_per_pc * (1 + margin_pct));

    // Total selling price = Price_per_pc * Q
    const totalPrice = Math.round(Price_per_pc * Q);

    return { unitPrice: Price_per_pc, totalPrice };
  };

  const handleSubmit = async () => {
    if (!selectedVendorId || !vendorSpec || !purchasePrice || !qty || !unit) {
      toast.error("Please fill all required fields");
      return;
    }

    let documentPaths: string[] = [];
    if (documents.length > 0) {
      for (const doc of documents) {
        const fileExt = doc.name.split(".").pop();
        const fileName = `${balanceId}_${Date.now()}_${doc.name}`;
        const { error: uploadError } = await supabase.storage
          .from("request-attachments")
          .upload(fileName, doc);

        if (uploadError) {
          toast.error(`Failed to upload ${doc.name}`);
          return;
        }

        documentPaths.push(fileName);
      }
    }

    const { unitPrice, totalPrice } = calculateSellingPrice();

    // Calculate position: Get max position + 1
    const { data: maxPosData } = await supabase
      .from("balance_items")
      .select("position")
      .eq("balance_id", balanceId)
      .eq("balance_entry_id", entryId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextPosition = (maxPosData?.position || 0) + 1;

    const { error } = await supabase.from("balance_items").insert({
      balance_id: balanceId,
      balance_entry_id: entryId,
      vendor_id: selectedVendorId,
      vendor_spec: vendorSpec,
      customer_spec: customerSpec,
      offering_letter_number: offeringLetterNumber,
      offering_date: offeringDate || null,
      document_path: documentPaths.join(","),
      purchase_price: parseNumber(purchasePrice),
      qty: parseNumber(qty),
      unit,
      weight: parseNumber(weight),
      shipping_vendor_group: shippingVendorGroup,
      shipping_customer_group: shippingCustomerGroup,
      delivery_time: deliveryTime,
      difficulty,
      unit_selling_price: unitPrice,
      total_selling_price: totalPrice,
      position: nextPosition,
    });

    if (error) {
      toast.error("Failed to add item");
      console.error(error);
      return;
    }

    // IF first time (not synced), save to settings
    if (!isOfferingSynced) {
      await supabase
        .from("balance_vendor_settings")
        .upsert({
          balance_id: balanceId,
          balance_entry_id: entryId, // Scope to entry
          vendor_id: selectedVendorId,
          vendor_letter_number: offeringLetterNumber,
          vendor_letter_date: offeringDate || null,
          updated_at: new Date().toISOString()
        }, { onConflict: "balance_id,vendor_id,balance_entry_id" });
    }

    toast.success("Item added successfully");
    onSuccess();
  };

  if (step === 1) {
    return (
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
          {errors.vendor && <p className="text-sm text-destructive mt-1">{errors.vendor}</p>}
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
              disabled={isOfferingSynced}
              className={isOfferingSynced ? "bg-muted" : ""}
            />
            {errors.offeringNo && <p className="text-sm text-destructive mt-1">{errors.offeringNo}</p>}
          </div>
          <div>
            <Label>Tanggal Penawaran</Label>
            <Input
              type="date"
              value={offeringDate}
              onChange={(e) => setOfferingDate(e.target.value)}
              disabled={isOfferingSynced}
              className={isOfferingSynced ? "bg-muted" : ""}
            />
            {errors.offeringDate && <p className="text-sm text-destructive mt-1">{errors.offeringDate}</p>}
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
                  id="document-upload"
                />
                <label
                  htmlFor="document-upload"
                  className="cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
                >
                  Choose Files
                </label>
                <span className="text-sm text-muted-foreground italic">
                  {documents.length === 0 ? "No file chosen" : `${documents.length} files selected`}
                </span>
              </div>

              <div className="space-y-2">
                {documents.map((doc, idx) => (
                  <div key={`new-${idx}`} className="flex items-center justify-between p-2 bg-blue-50 text-blue-700 rounded-md border border-blue-100">
                    <div className="flex items-center gap-2 text-sm overflow-hidden">
                      <Paperclip className="h-4 w-4 shrink-0" />
                      <span className="truncate">{doc.name} (New)</span>
                    </div>
                    <button onClick={() => removeDocument(idx)} className="text-blue-700 hover:text-blue-900 shrink-0">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>



        <Button onClick={handleNext} className="w-full">
          Next
        </Button>
      </div >
    );
  }

  if (step === 2) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Harga Beli</Label>
            <Input
              type="text"
              value={purchasePrice}
              onChange={(e) => handleNumberChange(e.target.value, setPurchasePrice)}
              placeholder="0"
            />
          </div>
          <div>
            <Label>Qty</Label>
            <Input
              type="text"
              value={qty}
              onChange={(e) => handleNumberChange(e.target.value, setQty)}
              placeholder="0"
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
              placeholder="0"
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
    );
  }

  // Step 3 - Summary
  const { unitPrice, totalPrice } = calculateSellingPrice();
  const vendorShippingCost = shippingVendorGroups.find(g => g.group_name === shippingVendorGroup)?.cost || 0;
  const customerShippingCost = shippingCustomerGroups.find(g => g.group_name === shippingCustomerGroup)?.cost || 0;
  const totalPurchasePrice = parseNumber(purchasePrice) * parseNumber(qty);
  const deliveryPercentage = deliveryTimeCategories.find(d => d.time_category === deliveryTime)?.percentage || 0;
  const difficultyPercentage = difficultyCategories.find(d => d.difficulty_level === difficulty)?.percentage || 0;

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
        <Button onClick={handleSubmit} className="flex-1">
          Process
        </Button>
      </div>
    </div>
  );
}
