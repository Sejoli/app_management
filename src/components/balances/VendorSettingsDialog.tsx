import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Settings, Save } from "lucide-react";

interface VendorSettingsDialogProps {
    balanceId: string;
    entryId: number;
    vendorId: string;
    vendorName: string;
    trigger?: React.ReactNode;
    readOnly?: boolean;
    defaultLetterNumber?: string; // New Prop
    defaultLetterDate?: string;   // New Prop
}

export function VendorSettingsDialog({
    balanceId,
    entryId,
    vendorId,
    vendorName,
    trigger,
    readOnly = false,
    defaultLetterNumber = "",
    defaultLetterDate = ""
}: VendorSettingsDialogProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // Form State
    const [discount, setDiscount] = useState<number>(0);
    const [paymentTerms, setPaymentTerms] = useState<string>("");
    const [dpType, setDpType] = useState<"amount" | "percentage">("percentage");
    const [dpValue, setDpValue] = useState<number>(0);
    const [vendorLetterNumber, setVendorLetterNumber] = useState("");
    const [vendorLetterDate, setVendorLetterDate] = useState("");

    useEffect(() => {
        if (open) {
            fetchSettings();
        }
    }, [open]);

    const fetchSettings = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from("balance_vendor_settings")
            .select("*")
            .eq("balance_id", balanceId)
            .eq("balance_entry_id", entryId)
            .eq("vendor_id", vendorId)
            .maybeSingle();

        if (error) {
            console.error("Error fetching settings:", error);
            toast.error("Gagal memuat pengaturan vendor");
        } else if (data) {
            setDiscount(data.discount || 0);
            setPaymentTerms(data.payment_terms || "");
            setVendorLetterNumber(data.vendor_letter_number || "");
            setVendorLetterDate(data.vendor_letter_date || "");
            if (data.dp_percentage !== null) {
                setDpType("percentage");
                setDpValue(data.dp_percentage);
            } else if (data.dp_amount !== null) {
                setDpType("amount");
                setDpValue(data.dp_amount);
            } else {
                setDpType("percentage");
                setDpValue(0);
            }
        } else {
            // Reset defaults if no record exists
            setDiscount(0);
            setPaymentTerms("");

            // Fallback to Item Defaults if Setting is Missing
            setVendorLetterNumber(defaultLetterNumber);
            setVendorLetterDate(defaultLetterDate);

            setDpType("percentage");
            setDpValue(0);
        }
        setLoading(false);
    };

    const handleSave = async () => {
        setSaving(true);

        const payload: any = {
            balance_id: balanceId,
            balance_entry_id: entryId, // Include Entry ID
            vendor_id: vendorId,
            discount: discount,
            payment_terms: paymentTerms,
            vendor_letter_number: vendorLetterNumber,
            vendor_letter_date: vendorLetterDate,
            updated_at: new Date().toISOString()
        };

        if (dpType === "percentage") {
            payload.dp_percentage = dpValue;
            payload.dp_amount = null;
        } else {
            payload.dp_amount = dpValue;
            payload.dp_percentage = null;
        }

        const { error } = await supabase
            .from("balance_vendor_settings")
            .upsert(payload, { onConflict: "balance_id,vendor_id,balance_entry_id" }); // Updated Constraint

        if (error) {
            console.error("Error saving settings:", error);
            toast.error("Gagal menyimpan pengaturan");
        } else {
            // Trigger Bulk Update for items with this vendor
            const { error: bulkError } = await supabase
                .from("balance_items")
                .update({
                    offering_letter_number: vendorLetterNumber,
                    offering_date: vendorLetterDate || null
                })
                .eq("balance_id", balanceId)
                .eq("balance_entry_id", entryId) // Scope to entry
                .eq("vendor_id", vendorId);

            if (bulkError) {
                console.error("Error syncing items:", bulkError);
                toast.error("Gagal menyingkronkan item (Settings tersimpan)");
            } else {
                toast.success("Pengaturan & Item berhasil diperbarui");
            }
            setOpen(false);
            // Reload page or trigger refresh might be needed if parent doesn't auto-refresh items on modal close. 
            // Since we are in a dialog inside a list, usually parent re-fetches or we need a callback. 
            // Adding window.location.reload() is harsh. Ideally 'onSuccess' prop. 
            // For now, let's rely on the fact that BalanceDetail might re-fetch or we simply close.
            // Actually, sorting/re-fetching might be needed.
            // Let's add window.location.reload() for safety or if we can pass a callback?
            // The prop trigger refresh is not passed. Let's just toast. The user might need to refresh manually to see item changes if we don't force it.
            // Wait, BalanceDetail fetches items. If we suspect stale data, a refresh is safer.
            // window.location.reload(); 
        }
        setSaving(false);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <div onClick={() => setOpen(true)} className="inline-block cursor-pointer">
                {trigger || (
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                        <Settings className="h-4 w-4" />
                    </Button>
                )}
            </div>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Pengaturan Vendor: {vendorName}</DialogTitle>
                </DialogHeader>

                {loading ? (
                    <div className="py-4 text-center text-sm text-muted-foreground">Memuat pengaturan...</div>
                ) : (
                    <div className="grid gap-4 py-4">

                        {/* Discount Section */}
                        <div className="grid gap-2">
                            <Label htmlFor="discount">Diskon Vendor (%)</Label>
                            <Input
                                id="discount"
                                type="number"
                                value={discount}
                                onChange={(e) => setDiscount(Number(e.target.value))}
                                placeholder="0"
                                disabled={readOnly}
                            />
                        </div>

                        {/* Offering Letter Details */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="letterNo">No Surat Penawaran</Label>
                                <Input
                                    id="letterNo"
                                    value={vendorLetterNumber}
                                    onChange={(e) => setVendorLetterNumber(e.target.value)}
                                    placeholder="Nomor Surat"
                                    disabled={readOnly}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="letterDate">Tanggal Penawaran</Label>
                                <Input
                                    id="letterDate"
                                    type="date"
                                    value={vendorLetterDate}
                                    onChange={(e) => setVendorLetterDate(e.target.value)}
                                    disabled={readOnly}
                                />
                            </div>
                        </div>

                        {/* Payment Terms Section */}
                        <div className="grid gap-2">
                            <Label htmlFor="terms">Term of Payment</Label>
                            <Input
                                id="terms"
                                value={paymentTerms}
                                onChange={(e) => setPaymentTerms(e.target.value)}
                                placeholder="Contoh: Net 30 Days"
                                disabled={readOnly}
                            />
                        </div>

                        {/* Down Payment Section */}
                        <div className="grid gap-2">
                            <Label>Uang Muka (DP)</Label>
                            <Tabs value={dpType} onValueChange={(v) => { if (!readOnly) { setDpType(v as any); setDpValue(0); } }}>
                                <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger value="percentage" disabled={readOnly}>Persentase (%)</TabsTrigger>
                                    <TabsTrigger value="amount" disabled={readOnly}>Nominal (Rp)</TabsTrigger>
                                </TabsList>
                                <TabsContent value="percentage">
                                    <Input
                                        type="number"
                                        value={dpValue}
                                        onChange={(e) => setDpValue(Number(e.target.value))}
                                        placeholder="Masukkan % DP"
                                        disabled={readOnly}
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Nilai DP akan dihitung otomatis dari total PO.
                                    </p>
                                </TabsContent>
                                <TabsContent value="amount">
                                    <Input
                                        type="number"
                                        value={dpValue}
                                        onChange={(e) => setDpValue(Number(e.target.value))}
                                        placeholder="Masukkan Nominal DP"
                                        disabled={readOnly}
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Nilai DP fix, tidak terpengaruh total PO.
                                    </p>
                                </TabsContent>
                            </Tabs>
                        </div>
                    </div>
                )}

                <DialogFooter>
                    {!readOnly && (
                        <Button onClick={handleSave} disabled={loading || saving}>
                            {saving ? "Menyimpan..." : (
                                <>
                                    <Save className="mr-2 h-4 w-4" /> Simpan
                                </>
                            )}
                        </Button>
                    )}
                    {readOnly && (
                        <Button variant="outline" onClick={() => setOpen(false)}>
                            Tutup
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
