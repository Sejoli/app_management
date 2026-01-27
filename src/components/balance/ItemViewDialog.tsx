import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface ItemViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: {
    id: string;
    vendor: { company_name: string } | null;
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
  } | null;
}

export default function ItemViewDialog({ open, onOpenChange, item }: ItemViewDialogProps) {
  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Detail Item</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Vendor</p>
              <p className="font-medium">{item.vendor?.company_name || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Unit</p>
              <p className="font-medium">{item.unit}</p>
            </div>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Spek Vendor</p>
            <p className="font-medium whitespace-pre-wrap">{item.vendor_spec || "-"}</p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Spek Customer</p>
            <p className="font-medium whitespace-pre-wrap">{item.customer_spec || "-"}</p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Harga Beli</p>
              <p className="font-medium">Rp {item.purchase_price.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Qty</p>
              <p className="font-medium">{item.qty}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Berat</p>
              <p className="font-medium">{item.weight} kg</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Ongkir Vendor-MPA</p>
              <p className="font-medium">Group {item.shipping_vendor_group}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Ongkir MPA-Customer</p>
              <p className="font-medium">Group {item.shipping_customer_group}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Waktu Sampai</p>
              <p className="font-medium">{item.delivery_time}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Difficulty</p>
              <p className="font-medium">{item.difficulty}</p>
            </div>
          </div>

          <div className="border-t pt-4 grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Harga Jual/Unit</p>
              <p className="font-medium text-lg">Rp {item.unit_selling_price?.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Harga Jual</p>
              <p className="font-medium text-lg">Rp {item.total_selling_price?.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
