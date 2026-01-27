import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface Permission {
    id: string;
    role: string;
    permission_key: string;
    is_enabled: boolean;
}

const FEATURES = [
    { key: "requests", label: "Requests" },
    { key: "balances", label: "Balances" },
    { key: "quotations", label: "Quotations" },
    { key: "purchase_orders", label: "Purchase Order" },
    { key: "customers", label: "Customers" },
    { key: "vendors", label: "Vendors" },
    { key: "customer_cost_management", label: "Management Biaya" },
    { key: "internal_letters", label: "Pengajuan Belanja" },
    { key: "tracking", label: "Tracking" },
    { key: "invoices", label: "Management Invoice" },
    { key: "company", label: "Perusahaan (Settings)" },
    { key: "team", label: "Tim (User Management)" },
];

export default function AccessControlTab() {
    const [permissions, setPermissions] = useState<Permission[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [selectedRole, setSelectedRole] = useState("staff");

    useEffect(() => {
        fetchPermissions();
    }, [selectedRole]);

    const fetchPermissions = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("role_permissions")
                .select("*")
                .eq("role", selectedRole);

            if (error) {
                console.error("Error fetching permissions:", error);
            }

            if (data) {
                setPermissions(data);
            } else {
                setPermissions([]);
            }
        } catch (error) {
            console.error("Unexpected error:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = (fullKey: string, currentStatus: boolean) => {
        const existingPermission = permissions.find((p) => p.permission_key === fullKey);

        // If disabling VIEW, also disable MANAGE
        let newPermissions = [...permissions];
        if (fullKey.startsWith("view_") && currentStatus === true) {
            const manageKey = fullKey.replace("view_", "manage_");
            // Check if manage permission exists
            const managePerm = newPermissions.find(p => p.permission_key === manageKey);
            if (managePerm && managePerm.is_enabled) {
                newPermissions = newPermissions.map(p =>
                    p.permission_key === manageKey ? { ...p, is_enabled: false } : p
                );
            }
        }

        // Toggle the target key
        if (existingPermission) {
            newPermissions = newPermissions.map((p) =>
                p.permission_key === fullKey ? { ...p, is_enabled: !currentStatus } : p
            );
        } else {
            newPermissions.push({
                id: "temp-" + Date.now() + Math.random(),
                role: selectedRole,
                permission_key: fullKey,
                is_enabled: true,
            });
        }

        setPermissions(newPermissions);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // Collect all current permissions state for upsert
            // We need to iterate over all features and both keys (view_ and manage_)
            const updates = [];

            for (const feature of FEATURES) {
                const viewKey = `view_${feature.key}`;
                const manageKey = `manage_${feature.key}`;

                const viewPerm = permissions.find(p => p.permission_key === viewKey);
                const managePerm = permissions.find(p => p.permission_key === manageKey);

                updates.push({
                    role: selectedRole,
                    permission_key: viewKey,
                    is_enabled: viewPerm ? viewPerm.is_enabled : false
                });

                updates.push({
                    role: selectedRole,
                    permission_key: manageKey,
                    is_enabled: viewPerm ? viewPerm.is_enabled : false
                });
            }

            const { error } = await supabase
                .from("role_permissions")
                .upsert(updates, { onConflict: "role,permission_key" });

            if (error) throw error;

            toast.success(`Hak akses ${selectedRole} berhasil disimpan`);
            fetchPermissions();
        } catch (error: any) {
            console.error("Save error:", error);
            toast.error("Gagal menyimpan hak akses: " + error.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Hak Akses</CardTitle>
                    <CardDescription>
                        Atur menu apa saja yang bisa diakses oleh role yang dipilih.
                    </CardDescription>
                </div>
                <div className="w-[200px]">
                    <Select value={selectedRole} onValueChange={setSelectedRole}>
                        <SelectTrigger>
                            <SelectValue placeholder="Pilih Role" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="staff">Staff</SelectItem>
                            <SelectItem value="pimpinan">Pimpinan</SelectItem>
                            <SelectItem value="super_admin">Super Admin</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {loading ? (
                    <div className="flex justify-center p-8">
                        <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                ) : (
                    <>
                        <div className="border rounded-md">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Menu / Fitur</TableHead>
                                        <TableHead className="w-[100px] text-center">Akses (View & Manage)</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {FEATURES.map((feature) => {
                                        const viewKey = `view_${feature.key}`;

                                        const viewPerm = permissions.find((p) => p.permission_key === viewKey);

                                        const isViewEnabled = viewPerm?.is_enabled ?? false;

                                        return (
                                            <TableRow key={feature.key}>
                                                <TableCell className="font-medium">{feature.label}</TableCell>
                                                <TableCell className="text-center">
                                                    <Checkbox
                                                        checked={isViewEnabled}
                                                        onCheckedChange={() => handleToggle(viewKey, isViewEnabled)}
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>

                        <div className="flex justify-end">
                            <Button onClick={handleSave} disabled={saving}>
                                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Simpan Perubahan"}
                            </Button>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
