import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { usePermission } from "@/hooks/usePermission";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Save, Eye, Pencil } from "lucide-react";
import { DeleteConfirmationDialog } from "@/components/DeleteConfirmationDialog";
import { toast } from "sonner";
import AddItemForm from "@/components/balance/AddItemForm";
import ItemViewDialog from "@/components/balance/ItemViewDialog";
import ItemEditDialog from "@/components/balance/ItemEditDialog";
import { VendorSettingsDialog } from "@/components/balances/VendorSettingsDialog";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

interface BalanceItem {
  id: string;
  vendor: { company_name: string } | null;
  vendor_id?: string;
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
  unit_selling_price: number;
  total_selling_price: number;
  document_path?: string;
  position: number;
}

interface SortableRowProps {
  item: BalanceItem;
  globalIndex: number;
  vendorName: string;
  documents: string[];
  showSettings: boolean;
  balanceId: string | null;
  canEdit: boolean;
  setViewItem: (item: BalanceItem) => void;
  setEditItem: (item: BalanceItem) => void;
  deleteItem: (id: string) => void;
}

const SortableRow = ({
  item,
  globalIndex,
  vendorName,
  documents,
  showSettings,
  balanceId,
  canEdit,
  setViewItem,
  setEditItem,
  deleteItem,
}: SortableRowProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.5 : 1,
  };

  return (

    <TableRow ref={setNodeRef} style={style} className="group">
      <TableCell className="text-center whitespace-nowrap relative">
        {canEdit && (
          <div
            className="absolute left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground transition-opacity z-10"
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-4 w-4" />
          </div>
        )}
        <span className={canEdit ? "ml-4" : ""}>{globalIndex}</span>
      </TableCell>
      <TableCell className="align-middle font-medium border-r bg-slate-50 whitespace-nowrap">


        <div className="flex items-center justify-between gap-2">
          <span>{vendorName}</span>
          {showSettings && balanceId && (
            <VendorSettingsDialog
              balanceId={balanceId}
              entryId={item.balance_entry_id}
              vendorId={item.vendor_id!}
              vendorName={vendorName}
              readOnly={!canEdit}
              defaultLetterNumber={item.offering_letter_number || ""}
              defaultLetterDate={item.offering_date || ""}
            />
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-3">
          <div>
            <span className="font-semibold text-xs text-muted-foreground block mb-1">Spek Pelanggan:</span>
            <div className="text-sm whitespace-pre-wrap">{item.customer_spec || "-"}</div>
          </div>
          <div>
            <span className="font-semibold text-xs text-muted-foreground block mb-1">Spek Vendor:</span>
            <div className="text-sm whitespace-pre-wrap">{item.vendor_spec || "-"}</div>
            {documents.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {documents.map((doc, docIdx) => (
                  <a
                    key={docIdx}
                    href={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/request-attachments/${doc}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs bg-muted px-2 py-1 rounded hover:bg-muted/80 transition-colors"
                  >
                    L{docIdx + 1}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell className="whitespace-nowrap">Rp {item.purchase_price.toLocaleString()}</TableCell>
      <TableCell className="whitespace-nowrap">{item.qty} {item.unit}</TableCell>
      <TableCell className="whitespace-nowrap">{item.weight} kg</TableCell>
      <TableCell className="whitespace-nowrap">Group {item.shipping_vendor_group}</TableCell>
      <TableCell className="whitespace-nowrap">Group {item.shipping_customer_group}</TableCell>
      <TableCell className="whitespace-nowrap">{item.delivery_time}</TableCell>
      <TableCell className="whitespace-nowrap">{item.difficulty}</TableCell>
      <TableCell className="whitespace-nowrap">Rp {item.unit_selling_price?.toLocaleString()}</TableCell>
      <TableCell className="whitespace-nowrap">Rp {item.total_selling_price?.toLocaleString()}</TableCell>
      <TableCell>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setViewItem(item)}
          >
            <Eye className="h-4 w-4" />
          </Button>
          {canEdit && (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setEditItem(item)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <DeleteConfirmationDialog
                onDelete={() => deleteItem(item.id)}
                trigger={
                  <Button
                    variant="ghost"
                    size="icon"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                }
              />
            </>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
};

interface ShippingGroup {
  id: string;
  group_name: string;
  cost: number;
}

interface DifficultySettings {
  id: string;
  difficulty_level: string;
  percentage: number;
}

interface BalanceSettings {
  margin_percentage: number;
  payment_terms: string;
  ppn_percentage: number;
  document_cost: number;
  return_cost: number;
  discount_percentage: number;
}

interface OverallCost {
  id: string;
  cost_category: string;
  amount: number;
}

interface DeliveryTimeSetting {
  id: string;
  time_category: string;
  percentage: number;
}

interface DifficultySetting {
  id: string;
  difficulty_level: string;
  percentage: number;
}

export default function BalanceDetail() {
  const navigate = useNavigate();
  const { balanceId, entryId } = useParams();
  const [searchParams] = useSearchParams();
  const entryCode = searchParams.get("code") || "";
  const { canManage, userId, userRole } = usePermission("balances");
  const [balanceInfo, setBalanceInfo] = useState<any>(null);
  const [isLocked, setIsLocked] = useState(false);

  const isOwner = balanceInfo?.created_by === userId;
  const isSuperAdmin = userRole === 'super_admin';
  const canEdit = canManage && (isOwner || isSuperAdmin) && !isLocked;

  const [items, setItems] = useState<BalanceItem[]>([]);
  const itemsRef = useRef<BalanceItem[]>([]); // Ref to track latest items for async/debounce access

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const [shippingVendor, setShippingVendor] = useState<ShippingGroup[]>([]);
  const [shippingCustomer, setShippingCustomer] = useState<ShippingGroup[]>([]);
  const [overallCosts, setOverallCosts] = useState<OverallCost[]>([]);
  const [deliveryTimeSettings, setDeliveryTimeSettings] = useState<DeliveryTimeSetting[]>([]);
  const [difficultySettings, setDifficultySettings] = useState<DifficultySetting[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      setItems((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over?.id);

        const newItems = arrayMove(items, oldIndex, newIndex);

        // Update positions in DB asynchronously
        const updates = newItems.map((item, index) => ({
          id: item.id,
          position: index + 1,
        }));

        const updatePromises = updates.map((update) =>
          supabase
            .from("balance_items")
            .update({ position: update.position })
            .eq("id", update.id)
        );

        Promise.all(updatePromises).catch(console.error);

        return newItems;
      });
    }
  };
  const [settings, setSettings] = useState<BalanceSettings>({
    margin_percentage: 0,
    payment_terms: "",
    ppn_percentage: 11,
    document_cost: 0,
    return_cost: 0,
    discount_percentage: 0,
  });
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);

  const [customerSettings, setCustomerSettings] = useState<{ payment_category: string; margin: number; payment_percentage: number } | null>(null);
  const [viewItem, setViewItem] = useState<BalanceItem | null>(null);
  const [editItem, setEditItem] = useState<BalanceItem | null>(null);

  useEffect(() => {
    if (balanceId && entryId) {
      // Try to load from localStorage first
      const storageKey = `balance_${balanceId}_entry_${entryId}`;
      const savedData = localStorage.getItem(storageKey);

      fetchBalanceInfo();
      fetchItems();
      fetchShippingGroups();
      fetchCostSettings();
      fetchSettings();
      fetchLockStatus();
    }
  }, [balanceId, entryId]);

  const fetchLockStatus = async () => {
    if (!balanceId || !entryId) return;
    // Check if this entry is linked to a Quotation that has a PO or is Closed
    const { data } = await supabase
      .from("quotation_balances")
      .select("quotation:quotations(po_ins(id), is_closed)")
      .eq("balance_id", balanceId)
      .eq("entry_id", parseInt(entryId))
      .maybeSingle();

    if ((data?.quotation?.po_ins && data.quotation.po_ins.length > 0) || data?.quotation?.is_closed) {
      setIsLocked(true);
    } else {
      setIsLocked(false);
    }
  };

  const fetchBalanceInfo = async () => {
    if (!balanceId) return;

    const { data, error } = await supabase
      .from("balances")
      .select(`
            *,
            request:requests(
            request_code,
            letter_number,
            customer_id,
            customer:customers(company_name)
            )
            `)
      .eq("id", balanceId)
      .single();

    if (error) {
      console.error(error);
      return;
    }

    setBalanceInfo(data);

    // Fetch customer settings
    if (data.request.customer_id) {
      const { data: settingsData } = await supabase
        .from("customer_default_settings")
        .select(`
            margin_percentage,
            payment_category:default_payment_time_settings(payment_category, percentage)
            `)
        .eq("customer_id", data.request.customer_id)
        .single();

      if (settingsData) {
        setCustomerSettings({
          payment_category: settingsData.payment_category?.payment_category || "-",
          margin: settingsData.margin_percentage,
          payment_percentage: settingsData.payment_category?.percentage || 0,
        });
      }
    }
  };

  const fetchItems = async () => {
    if (!balanceId || !entryId) return;

    const { data, error } = await supabase
      .from("balance_items")
      .select(`
            *,
            vendor:vendors(company_name)
            `)
      .eq("balance_id", balanceId)
      .eq("balance_entry_id", parseInt(entryId))
      .eq("balance_entry_id", parseInt(entryId))
      .order("position", { ascending: true })
      .order("id", { ascending: true });

    if (error) {
      console.error(error);
      return;
    }

    setItems(data as any);
    return data as any;
  };

  const fetchShippingGroups = async () => {
    if (!balanceId) return;

    const [vendorResult, customerResult] = await Promise.all([
      (supabase as any).from("shipping_vendor_mpa").select("*").eq("balance_id", balanceId).eq("balance_entry_id", parseInt(entryId!)).order('group_name', { ascending: true }),
      (supabase as any).from("shipping_mpa_customer").select("*").eq("balance_id", balanceId).eq("balance_entry_id", parseInt(entryId!)).order('group_name', { ascending: true }),
    ]);

    if (vendorResult.data) setShippingVendor(vendorResult.data);
    if (customerResult.data) setShippingCustomer(customerResult.data);

    // Initialize default groups if not exists
    if (!vendorResult.data || vendorResult.data.length === 0) {
      await initializeShippingVendorGroups();
    }
    if (!customerResult.data || customerResult.data.length === 0) {
      await initializeShippingCustomerGroups();
    }
  };

  const initializeShippingVendorGroups = async () => {
    if (!balanceId) return;

    const groups = ["A", "B", "C", "D", "E"];
    const inserts = groups.map((group) => ({
      balance_id: balanceId,
      balance_entry_id: parseInt(entryId!),
      group_name: group,
      cost: 0,
    }));

    await supabase.from("shipping_vendor_mpa").insert(inserts);
    fetchShippingGroups();
  };

  const initializeShippingCustomerGroups = async () => {
    if (!balanceId) return;

    const groups = ["X", "Y", "Z"];
    const inserts = groups.map((group) => ({
      balance_id: balanceId,
      balance_entry_id: parseInt(entryId!),
      group_name: group,
      cost: 0,
    }));

    await supabase.from("shipping_mpa_customer").insert(inserts);
    fetchShippingGroups();
  };

  const fetchCostSettings = async () => {
    const [overallResult, deliveryResult, difficultyResult] = await Promise.all([
      supabase.from("default_overall_cost_settings").select("*"),
      supabase.from("default_delivery_time_settings").select("*"),
      supabase.from("default_difficulty_settings").select("*"),
    ]);

    if (overallResult.data) setOverallCosts(overallResult.data);
    if (deliveryResult.data) setDeliveryTimeSettings(deliveryResult.data);
    if (difficultyResult.data) setDifficultySettings(difficultyResult.data);
  };

  const fetchSettings = async () => {
    if (!balanceId) return;

    const { data, error } = await (supabase as any)
      .from("balance_settings")
      .select("*")
      .eq("balance_id", balanceId)
      .eq("balance_entry_id", parseInt(entryId!))
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      console.error(error);
      return;
    }

    if (data) {
      setSettings(data);
    } else {
      // Initialize default settings
      await supabase.from("balance_settings").insert({
        balance_id: balanceId,
        balance_entry_id: parseInt(entryId!),
        margin_percentage: 0,
        payment_terms: "",
        ppn_percentage: 11,
        document_cost: 0,
        return_cost: 0,
        discount_percentage: 0,
      });
      fetchSettings();
    }
  };

  const updateShippingCost = async (id: string, cost: number, type: "vendor" | "customer") => {
    const table = type === "vendor" ? "shipping_vendor_mpa" : "shipping_mpa_customer";

    // Optimistic Update: Update local state IMMEDIATELY
    let newShippingVendor = [...shippingVendor];
    let newShippingCustomer = [...shippingCustomer];

    if (type === "vendor") {
      newShippingVendor = shippingVendor.map(g => g.id === id ? { ...g, cost } : g);
      setShippingVendor(newShippingVendor);
    } else {
      newShippingCustomer = shippingCustomer.map(g => g.id === id ? { ...g, cost } : g);
      setShippingCustomer(newShippingCustomer);
    }

    // Debounce the DB update and Recalculation
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(async () => {
      const { error } = await supabase.from(table).update({ cost }).eq("id", id);
      if (error) {
        toast.error("Gagal memperbarui ongkos kirim");
        // Revert or re-fetch could happen here, but for now we warn.
        return;
      }

      // Save to local storage and Recalculate Items logic (Bulk)
      saveToLocalStorage();
      await recalculateAllItems(newShippingVendor, newShippingCustomer);
    }, 500); // 500ms debounce
  };

  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Original function modified to support bulk updates
  const recalculateAllItems = async (
    overrideShippingVendor?: ShippingGroup[],
    overrideShippingCustomer?: ShippingGroup[],
    overrideItems?: BalanceItem[]
  ): Promise<any> => { // Return error if any
    // Use override if present, otherwise use Ref (fresh), fallback to State (stale closure protection)
    const itemsToProcess = overrideItems || itemsRef.current || items;
    if (itemsToProcess.length === 0) return;

    // Use overrides if provided, otherwise use state
    const currentShippingVendor = overrideShippingVendor || shippingVendor;
    const currentShippingCustomer = overrideShippingCustomer || shippingCustomer;

    const paymentPercentage = customerSettings?.payment_percentage || 0;
    const margin = customerSettings?.margin || 0;

    // Group items by shipping vendor group and calculate total qty per group
    const qtyByVendorGroup: Record<string, number> = {};
    const qtyByCustomerGroup: Record<string, number> = {};

    itemsToProcess.forEach(item => {
      // Total qty for vendor shipping group
      if (!qtyByVendorGroup[item.shipping_vendor_group]) {
        qtyByVendorGroup[item.shipping_vendor_group] = 0;
      }
      qtyByVendorGroup[item.shipping_vendor_group] += item.qty;

      // Total qty for customer shipping group
      if (!qtyByCustomerGroup[item.shipping_customer_group]) {
        qtyByCustomerGroup[item.shipping_customer_group] = 0;
      }
      qtyByCustomerGroup[item.shipping_customer_group] += item.qty;
    });

    // Calculate for each item using the new formula
    const itemsUpdates: any[] = [];
    for (const item of itemsToProcess) {
      // B = harga beli per pcs
      const B = item.purchase_price;
      // Q = qty
      const Q = item.qty;

      // V_group_total = total ongkir vendor untuk group
      const V_group_total = currentShippingVendor.find(g => g.group_name === item.shipping_vendor_group)?.cost || 0;
      // ΣQ_vendor(group) = total qty semua item yang pakai vendor group itu
      const sumQVendor = qtyByVendorGroup[item.shipping_vendor_group] || 1;
      // 1. Vendor_per_pc = V_group_total / ΣQ_vendor(group)
      const Vendor_per_pc = V_group_total / sumQVendor;

      // M_group_total = total ongkir MPA untuk group
      const M_group_total = currentShippingCustomer.find(g => g.group_name === item.shipping_customer_group)?.cost || 0;
      // ΣQ_mpa(group) = total qty semua item yang pakai mpa group itu
      const sumQMpa = qtyByCustomerGroup[item.shipping_customer_group] || 1;
      // 2. Mpa_per_pc = M_group_total / ΣQ_mpa(group)
      const Mpa_per_pc = M_group_total / sumQMpa;

      // diff_pct = persentase difficulty (mis. easy 2% → 0.02)
      const diffPercentage = difficultySettings.find(d => d.difficulty_level === item.difficulty)?.percentage || 0;
      const diff_pct = diffPercentage / 100;
      // 3. Difficulty = diff_pct × B
      const Difficulty = diff_pct * B;

      // ship_pct = persentase biaya kirim sesuai waktu (mis. 1–2 minggu 2% → 0.02)
      const deliveryPercentage = deliveryTimeSettings.find(d => d.time_category === item.delivery_time)?.percentage || 0;
      const ship_pct = deliveryPercentage / 100;
      // 4. Shipping = ship_pct × B
      const Shipping = ship_pct * B;

      // pay_pct = persentase biaya waktu pembayaran (20% → 0.20)
      const pay_pct = paymentPercentage / 100;
      // 5. Payment_cost = pay_pct × B
      const Payment_cost = pay_pct * B;

      // 6. Cost_per_pc = B + Vendor_per_pc + Mpa_per_pc + Difficulty + Shipping + Payment_cost
      const Cost_per_pc = B + Vendor_per_pc + Mpa_per_pc + Difficulty + Shipping + Payment_cost;

      // margin = margin penjualan (20% → 0.20)
      const margin_pct = margin / 100;
      // 7. Price_per_pc = Cost_per_pc × (1 + margin)
      const Price_per_pc = Math.round(Cost_per_pc * (1 + margin_pct));

      // Total selling price = Price_per_pc * Q
      const totalSellingPrice = Math.round(Price_per_pc * Q);

      itemsUpdates.push({
        id: item.id,
        // spread existing item properties to keep local state complete
        ...item,
        unit_selling_price: Price_per_pc,
        total_selling_price: totalSellingPrice,
      });
    }

    // Optimistic Update: Update local ITEMS state with calculated values
    // merging existing items with updates
    if (itemsUpdates.length > 0) {
      // Since we are rebuilding the array based on calculation loop which iterates `items`,
      // `itemsUpdates` effectively contains all items with updated values.
      // We need to ensure we don't lose any other properties.
      // In the loop above, we should push the Full Item structure or map it.
      // Actually, let's map `items` to new array directly in the loop.
      setItems(itemsUpdates); // Update UI immediately

      // Prepare DB Payload
      // Use concurrent standard UPDATE calls to avoid "upsert/insert" constraints if rows exist
      // Since recalculateAllItems iterates over existing `items`, we know IDs exist.
      const updatePromises = itemsUpdates.map(u =>
        supabase.from("balance_items").update({
          unit_selling_price: u.unit_selling_price,
          total_selling_price: u.total_selling_price
        }).eq("id", u.id)
      );

      const results = await Promise.all(updatePromises);
      const firstError = results.find(r => r.error)?.error;

      if (firstError) {
        console.error("Bulk update failed (partial):", firstError);
        return firstError;
      }
    }

    // We can still fetch to be safe, or skip it if confident.
    // fetchItems();
  };

  const updateSettings = async (field: keyof BalanceSettings, value: number | string) => {
    const mathVal = typeof value === 'string' ? parseFloat(value) : value;
    const { error } = await (supabase as any)
      .from("balance_settings")
      .update({ [field]: mathVal })
      .eq("balance_id", balanceId)
      .eq("balance_entry_id", parseInt(entryId!));

    if (error) {
      toast.error("Gagal memperbarui pengaturan");
      return;
    }

    setSettings({ ...settings, [field]: mathVal });
    saveToLocalStorage();
    // toast.success("Settings updated"); // Removed notification
  };

  const saveToLocalStorage = () => {
    if (!balanceId || !entryId) return;

    const storageKey = `balance_${balanceId}_entry_${entryId}`;
    const data = {
      items,
      shippingVendor,
      shippingCustomer,
      difficultySettings,
      settings,
      balanceInfo,
      customerSettings,
    };
    localStorage.setItem(storageKey, JSON.stringify(data));
  };

  const handleSave = async () => {
    try {
      // Abort any pending auto-saves to prevent race conditions
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      toast.loading("Menyimpan data...");

      // 1. Force Save Shipping Costs (Vendor & Customer)
      // We upsert all groups just to be safe and ensure consistency with what's on screen
      if (shippingVendor.length > 0) {
        const { error: errVendor } = await (supabase as any).from("shipping_vendor_mpa").upsert(shippingVendor.map(g => ({
          id: g.id,
          balance_id: balanceId,
          balance_entry_id: parseInt(entryId!),
          group_name: g.group_name,
          cost: g.cost
        })));
        if (errVendor) throw errVendor;
      }

      if (shippingCustomer.length > 0) {
        const { error: errCustomer } = await (supabase as any).from("shipping_mpa_customer").upsert(shippingCustomer.map(g => ({
          id: g.id,
          balance_id: balanceId,
          balance_entry_id: parseInt(entryId!),
          group_name: g.group_name,
          cost: g.cost
        })));
        if (errCustomer) throw errCustomer;
      }

      // 2. Force Save Settings
      const { error: errSettings } = await (supabase as any).from("balance_settings").upsert({
        balance_id: balanceId,
        balance_entry_id: parseInt(entryId!),
        ...settings
      });
      if (errSettings) throw errSettings;

      // 3. Force Recalculate Items (Updates Prices based on new costs)
      // Use itemsRef.current to ensure we have the latest items list (even if state update is pending)
      const currentItems = itemsRef.current || items;
      const recalcError = await recalculateAllItems(shippingVendor, shippingCustomer, currentItems);
      if (recalcError) throw recalcError;

      // 4. Clear Draft
      const storageKey = `balance_${balanceId}_entry_${entryId}`;
      localStorage.removeItem(storageKey);

      // --- AUTO-CREATE PO FOR NEW VENDORS ---
      // If this Balance Entry is already linked to a Quotation, 
      // adding a new Vendor should auto-generate a PO for that Vendor.
      if (balanceId && entryId) {
        const { data: qLinks } = await supabase
          .from("quotation_balances")
          .select("quotation_id, quotation:quotations(quotation_number)")
          .eq("balance_id", balanceId)
          .eq("entry_id", parseInt(entryId));

        if (qLinks && qLinks.length > 0) {
          const quotationId = qLinks[0].quotation_id; // Usually one quotation per entry in current flow

          // Get all distinct vendors currently in this entry
          const { data: currentItems } = await supabase
            .from("balance_items")
            .select("vendor_id")
            .eq("balance_id", balanceId)
            .eq("balance_entry_id", parseInt(entryId));

          const currentVendorIds = Array.from(new Set(currentItems?.map(i => i.vendor_id).filter(Boolean)));

          if (currentVendorIds.length > 0) {
            // Check existing POs for this quotation
            const { data: existingPOs } = await (supabase as any)
              .from("purchase_order_quotations")
              .select("purchase_order_id, purchase_orders(vendor_id)")
              .eq("quotation_id", quotationId);

            const existingVendorIds = new Set(existingPOs?.map((p: any) => p.purchase_orders?.vendor_id).filter(Boolean));

            // Find missing vendors
            const missingVendorIds = currentVendorIds.filter((vId: any) => !existingVendorIds.has(vId));

            if (missingVendorIds.length > 0) {
              // Fetch company abbreviation
              const { data: company } = await supabase.from("company").select("abbreviation").maybeSingle();
              const abbreviation = company?.abbreviation || "XXX";

              // Get current month.year
              const now = new Date();
              const monthYear = `${String(now.getMonth() + 1).padStart(2, "0")}.${now.getFullYear()}`;

              // Create POs for missing vendors
              for (const vId of missingVendorIds) {
                // Generate PO Number
                let isUnique = false;
                let newCode = "";
                while (!isUnique) {
                  // Generate 6-char alphanumeric string
                  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
                  let randomStr = '';
                  for (let i = 0; i < 6; i++) {
                    randomStr += chars.charAt(Math.floor(Math.random() * chars.length));
                  }

                  newCode = `PO/${randomStr}/${abbreviation}/${monthYear}`;
                  const { data } = await (supabase as any).from("purchase_orders").select("id").eq("po_number", newCode).maybeSingle();
                  if (!data) isUnique = true;
                }

                // Create PO
                const { data: newPO, error: poError } = await (supabase as any)
                  .from("purchase_orders")
                  .insert({
                    po_number: newCode,
                    vendor_id: vId,
                    status: "Draft",
                    ppn: 0,
                    discount: 0
                  })
                  .select()
                  .single();

                if (newPO) {
                  // Link to Quotation
                  await (supabase as any).from("purchase_order_quotations").insert({
                    purchase_order_id: newPO.id,
                    quotation_id: quotationId
                  });
                }
              }
              toast.success(`Berhasil membuat PO untuk ${missingVendorIds.length} vendor baru.`);
            }
          }
        }
      }
      // --- END AUTO-CREATE PO ---

      toast.dismiss(); // Dismiss loading
      toast.success("Data berhasil disimpan ke database");

      // Verify persistence by fetching
      fetchBalanceInfo();
      fetchItems();
      fetchShippingGroups();
      fetchCostSettings();
      fetchSettings();
    } catch (error) {
      console.error(error);
      toast.dismiss();
      toast.error("Gagal menyimpan data");
    }
  };

  const deleteItem = async (id: string): Promise<void> => {
    // 1. Fetch item to get details before deletion
    const { data: itemToDelete } = await supabase
      .from("balance_items")
      .select("vendor_id, balance_id, balance_entry_id")
      .eq("id", id)
      .single();

    if (itemToDelete && itemToDelete.vendor_id) {
      // 2. Check if other items exist for this SAME Vendor in this Entry
      const { count } = await supabase
        .from("balance_items")
        .select("id", { count: 'exact', head: true })
        .eq("balance_id", itemToDelete.balance_id)
        .eq("balance_entry_id", itemToDelete.balance_entry_id)
        .eq("vendor_id", itemToDelete.vendor_id)
        .neq("id", id); // Exclude self

      // If count is 0, this is the LAST item for this Vendor
      if (count === 0) {
        // 1. Delete Vendor Settings (Cleanup)
        const { error: settingsError } = await supabase
          .from("balance_vendor_settings")
          .delete()
          .eq("balance_id", itemToDelete.balance_id)
          .eq("vendor_id", itemToDelete.vendor_id);

        if (settingsError) {
          console.error("Failed to cleanup vendor settings", settingsError);
        } else {
          console.log("Cleaned up vendor settings for removed vendor.");
        }

        // Find Quotation linked to this entry
        const { data: qLinks } = await supabase
          .from("quotation_balances")
          .select("quotation_id")
          .eq("balance_id", itemToDelete.balance_id)
          .eq("entry_id", itemToDelete.balance_entry_id);

        if (qLinks && qLinks.length > 0) {
          const quotationIds = qLinks.map(l => l.quotation_id);
          // Find PO linked to this Quotation AND this Vendor
          const { data: poLinks } = await (supabase as any)
            .from("purchase_order_quotations")
            .select("purchase_order_id, purchase_orders(vendor_id)")
            .in("quotation_id", quotationIds);

          if (poLinks) {
            const poIdsToDelete = poLinks
              .filter((l: any) => l.purchase_orders?.vendor_id === itemToDelete.vendor_id)
              .map((l: any) => l.purchase_order_id);

            if (poIdsToDelete.length > 0) {
              // Delete PO dependencies
              await (supabase as any).from("purchase_order_quotations").delete().in("purchase_order_id", poIdsToDelete);
              await (supabase as any).from("purchase_order_attachments").delete().in("purchase_order_id", poIdsToDelete);
              // Delete PO
              await (supabase as any).from("purchase_orders").delete().in("id", poIdsToDelete);
              toast.info("PO dan Pengaturan untuk vendor ini dihapus karena item terakhir dihapus.");
            }
          }
        }
      }
    }

    const { error } = await supabase.from("balance_items").delete().eq("id", id);

    if (error) {
      toast.error("Gagal menghapus item");
      return;
    }

    toast.success("Item berhasil dihapus");
    const newItems = await fetchItems();
    saveToLocalStorage();
    await recalculateAllItems(undefined, undefined, newItems);

    // Check if no items remain, then cascade delete linked quotation
    if (newItems.length === 0 && balanceId && entryId) {
      // Find quotation linked to this balance entry
      const { data: qLinks } = await supabase
        .from("quotation_balances")
        .select("quotation_id")
        .eq("balance_id", balanceId)
        .eq("entry_id", parseInt(entryId));

      if (qLinks && qLinks.length > 0) {
        const quotationIds = qLinks.map(l => l.quotation_id);
        // Delete the quotations
        // Note: If a quotation is linked to multiple balances (unlikely in this flow but possible in data model), 
        // deleting it might affect other balances. 
        // User requirement: "quotation yang sudah dibuat ikut terhapus".
        // Since we create ONE quotation PER entry in the current logic (handleCreateQuotation), 
        // it is safe to delete the quotation if this entry is empty.

        // First find and cleanup PO Ins (and their dependencies)
        const { data: linkedPOIns } = await supabase
          .from("po_ins")
          .select("id")
          .in("quotation_id", quotationIds);

        if (linkedPOIns && linkedPOIns.length > 0) {
          const poInIds = linkedPOIns.map(p => p.id);
          // Delete dependants of PO In
          await (supabase as any).from("po_in_attachments").delete().in("po_in_id", poInIds);
          await (supabase as any).from("internal_letters").delete().in("po_in_id", poInIds);
          // Delete PO Ins
          await (supabase as any).from("po_ins").delete().in("id", poInIds);
        }

        // Delete Purchase Order Quotation Links (PO Out Link)
        // This is critical because "Detail Internal Letter" modal queries this link table.
        await (supabase as any)
          .from("purchase_order_quotations")
          .delete()
          .in("quotation_id", quotationIds);

        // Delete Quotation Balances (should cascade but explicit is safer)
        await supabase
          .from("quotation_balances")
          .delete()
          .in("quotation_id", quotationIds);

        // Finally Delete Quotations
        const { error: delError } = await supabase
          .from("quotations")
          .delete()
          .in("id", quotationIds);

        if (!delError) {
          toast.info("Data terkait (Quotation, PO In, Surat Internal) telah dibersihkan.");
        } else {
          console.error("Failed to auto-delete quotation", delError);
          toast.error("Gagal menghapus data terkait.");
        }
      }
    }
  };

  const calculateResume = () => {
    const totalPurchase = Math.round(items.reduce((sum, item) => sum + item.purchase_price * item.qty, 0));
    const totalSelling = Math.round(items.reduce((sum, item) => sum + (item.total_selling_price || 0), 0));
    const discountAmount = Math.round(totalSelling * (settings.discount_percentage / 100));
    const afterDiscount = totalSelling - discountAmount;
    const ppnAmount = Math.round(afterDiscount * (settings.ppn_percentage / 100));
    const grandTotal = Math.round(afterDiscount + ppnAmount);

    return {
      totalPurchase,
      totalSelling,
      discount: discountAmount,
      afterDiscount,
      ppnAmount,
      grandTotal,
    };
  };

  // Also pass canEdit to components actions column logic (not shown in snippet, need to find Table Cell actions)

  const resume = calculateResume();

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Detail Neraca: {entryCode}</h1>
          {balanceInfo && (
            <div className="space-y-1">
              <p className="text-muted-foreground">
                Permintaan: {balanceInfo.request.request_code} | Surat: {balanceInfo.request.letter_number} |
                Customer: {balanceInfo.request.customer.company_name}
              </p>
              {customerSettings && (
                <p className="text-muted-foreground">
                  Kategori Pembayaran: {customerSettings.payment_category} | Margin: {customerSettings.margin}%
                </p>
              )}
            </div>
          )}
        </div>
        <Dialog open={isAddItemOpen} onOpenChange={setIsAddItemOpen}>
          <div className="flex gap-2">
            {canEdit && (
              <>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Tambah Item
                  </Button>
                </DialogTrigger>
                <Button onClick={handleSave} variant="default">
                  <Save className="h-4 w-4 mr-2" />
                  Simpan
                </Button>
              </>
            )}
          </div>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Tambah Item Baru</DialogTitle>
            </DialogHeader>
            <AddItemForm
              balanceId={balanceId!}
              entryId={parseInt(entryId!)}
              shippingVendorGroups={shippingVendor}
              shippingCustomerGroups={shippingCustomer}
              customerMargin={customerSettings?.margin || 0}
              customerPaymentPercentage={customerSettings?.payment_percentage || 0}
              onSuccess={async () => {
                setIsAddItemOpen(false);
                // Optimistically calculate without waiting for full fetch if possible? 
                // For now, fetch is safer to get ID, but let's assume fetchItems is fast enough if DB is responsive.
                // We await fetchItems only just to get the new item.
                const newItems = await fetchItems();
                saveToLocalStorage();
                // We DO NOT await recalculateAllItems here to allow modal to close instantly visually?
                // No, onSuccess awaits. 
                // Issue: "Process" slow.
                // We'll wrap recalculate in non-blocking if we want speed, but for consistency we should await.
                // Maybe the slowdown is valid.
                await recalculateAllItems(undefined, undefined, newItems);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Navigation Tabs */}
      {balanceInfo && balanceInfo.balance_entries && balanceInfo.balance_entries.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2 border-b">
          {balanceInfo.balance_entries
            .sort((a: any, b: any) => a.id - b.id)
            .map((entry: any) => {
              const isActive = entry.id === parseInt(entryId!);
              return (
                <Button
                  key={entry.id}
                  variant={isActive ? "outline" : "secondary"}
                  size="sm"
                  onClick={() => navigate(`/balances/${balanceId}/entry/${entry.id}?code=${entry.code}`)}
                  className={isActive
                    ? "bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100 hover:text-amber-900"
                    : "bg-muted text-muted-foreground hover:text-foreground"}
                >
                  {entry.code}
                </Button>
              );
            })}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Ongkir Vendor-MPA */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Ongkir Vendor-MPA</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Group</TableHead>
                  <TableHead>Rp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shippingVendor.map((group) => (
                  <TableRow key={group.id}>
                    <TableCell>Group {group.group_name}</TableCell>
                    <TableCell>
                      <Input
                        type="text"
                        value={group.cost === 0 ? "" : group.cost.toLocaleString("en-US")}
                        onChange={(e) => {
                          // Remove non-numeric characters except if it's empty
                          const rawValue = e.target.value.replace(/[^0-9]/g, "");
                          const numValue = parseInt(rawValue, 10);

                          // Handle NaN (empty string)
                          if (isNaN(numValue)) {
                            updateShippingCost(group.id, 0, "vendor");
                          } else {
                            // Correct negative check redundant due to regex but safe to have
                            updateShippingCost(group.id, Math.abs(numValue), "vendor");
                          }
                        }}
                        className="h-8"
                        disabled={!canEdit}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Ongkir MPA-Customer */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Ongkir MPA-Customer</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Group</TableHead>
                  <TableHead>Rp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shippingCustomer.map((group) => (
                  <TableRow key={group.id}>
                    <TableCell>Group {group.group_name}</TableCell>
                    <TableCell>
                      <Input
                        type="text"
                        value={group.cost === 0 ? "" : group.cost.toLocaleString("en-US")}
                        onChange={(e) => {
                          const rawValue = e.target.value.replace(/[^0-9]/g, "");
                          const numValue = parseInt(rawValue, 10);

                          if (isNaN(numValue)) {
                            updateShippingCost(group.id, 0, "customer");
                          } else {
                            updateShippingCost(group.id, Math.abs(numValue), "customer");
                          }
                        }}
                        className="h-8"
                        disabled={!canEdit}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Resume */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Ringkasan</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right">Rp {resume.totalSelling.toLocaleString()}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    Diskon
                    <Input
                      type="number"
                      value={settings.discount_percentage}
                      onChange={(e) => updateSettings("discount_percentage", Math.max(0, parseFloat(e.target.value) || 0))}
                      min={0}
                      className="h-6 w-16 inline-block ml-2"
                      disabled={!canEdit}
                    />
                    %
                  </TableCell>
                  <TableCell className="text-right">Rp {resume.discount.toLocaleString()}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Setelah Diskon</TableCell>
                  <TableCell className="text-right">Rp {resume.afterDiscount.toLocaleString()}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    PPN
                    <Input
                      type="number"
                      value={settings.ppn_percentage}
                      onChange={(e) => updateSettings("ppn_percentage", Math.max(0, parseFloat(e.target.value) || 0))}
                      min={0}
                      className="h-6 w-16 inline-block ml-2"
                      disabled={!canEdit}
                    />
                    %
                  </TableCell>
                  <TableCell className="text-right">Rp {resume.ppnAmount.toLocaleString()}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-bold">Total Keseluruhan</TableCell>
                  <TableCell className="text-right font-bold">Rp {resume.grandTotal.toLocaleString()}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Items Table */}
      <Card>
        <CardHeader>
          <CardTitle>Item</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 whitespace-nowrap">No</TableHead>
                <TableHead className="whitespace-nowrap">Vendor</TableHead>
                <TableHead className="min-w-[350px] whitespace-nowrap">Spesifikasi</TableHead>
                <TableHead className="whitespace-nowrap">Harga Beli</TableHead>
                <TableHead className="whitespace-nowrap">Qty</TableHead>
                <TableHead className="whitespace-nowrap">Berat</TableHead>
                <TableHead className="whitespace-nowrap">Ongkir V-MPA</TableHead>
                <TableHead className="whitespace-nowrap">Ongkir MPA-C</TableHead>
                <TableHead className="whitespace-nowrap">Waktu</TableHead>
                <TableHead className="whitespace-nowrap">Kesulitan</TableHead>
                <TableHead className="whitespace-nowrap">Harga Jual</TableHead>
                <TableHead className="whitespace-nowrap">Total</TableHead>
                <TableHead className="text-right whitespace-nowrap">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={14} className="text-center text-muted-foreground">
                    Belum ada item
                  </TableCell>
                </TableRow>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={canEdit ? items.map(item => item.id) : []}
                    strategy={verticalListSortingStrategy}
                  >
                    {(() => {
                      const seenVendors = new Set<string>();
                      return items.map((item, index) => {
                        const globalIndex = index + 1;
                        const vendorName = item.vendor?.company_name || "-";
                        const documents = item.document_path ? item.document_path.split(",").filter(Boolean) : [];

                        const showSettings = item.vendor_id && !seenVendors.has(item.vendor_id);
                        if (item.vendor_id) seenVendors.add(item.vendor_id);

                        return (
                          <SortableRow
                            key={item.id}
                            item={item}
                            globalIndex={globalIndex}
                            vendorName={vendorName}
                            documents={documents}
                            showSettings={!!showSettings}
                            balanceId={balanceId}
                            canEdit={canEdit}
                            setViewItem={setViewItem}
                            setEditItem={setEditItem}
                            deleteItem={deleteItem}
                          />
                        );
                      });
                    })()}
                  </SortableContext>
                </DndContext>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ItemViewDialog
        open={!!viewItem}
        onOpenChange={(open) => !open && setViewItem(null)}
        item={viewItem}
      />

      <ItemEditDialog
        open={!!editItem}
        onOpenChange={(open) => !open && setEditItem(null)}
        item={editItem}
        balanceId={balanceId || ""}
        shippingVendorGroups={shippingVendor}
        shippingCustomerGroups={shippingCustomer}
        onSuccess={async () => {
          setEditItem(null);
          const newItems = await fetchItems();
          // Force recalculation with the NEW items immediately
          await recalculateAllItems(undefined, undefined, newItems);
        }}
      />
    </div>
  );
}
