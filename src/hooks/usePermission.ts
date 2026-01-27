import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function usePermission(featureKey: string) {
    const [canView, setCanView] = useState(false);
    const [canManage, setCanManage] = useState(false);
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState<string | null>(null);
    const [userRole, setUserRole] = useState<string | null>(null);

    useEffect(() => {
        checkPermissions();
    }, [featureKey]);

    const checkPermissions = async () => {
        try {
            // Get current user role
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setLoading(false);
                return;
            }

            const { data: memberData } = await supabase
                .from("team_members")
                .select("role")
                .eq("email", user.email)
                .single();

            const role = memberData?.role || "staff";
            setUserId(user.id);
            setUserRole(role);

            if (role === "pimpinan" || role === "super_admin") {
                setCanView(true);
                setCanManage(true);
                setLoading(false);
                return;
            }

            // Fetch specific permissions for the role
            const { data: permissions } = await supabase
                .from("role_permissions")
                .select("permission_key, is_enabled")
                .eq("role", role)
                .in("permission_key", [`view_${featureKey}`, `manage_${featureKey}`]);

            if (permissions) {
                const viewPerm = permissions.find(p => p.permission_key === `view_${featureKey}`);
                const managePerm = permissions.find(p => p.permission_key === `manage_${featureKey}`);

                setCanView(viewPerm?.is_enabled ?? false);
                setCanManage(managePerm?.is_enabled ?? false);
            }
        } catch (error) {
            console.error("Error checking permissions:", error);
        } finally {
            setLoading(false);
        }
    };

    return { canView, canManage, loading, userId, userRole };
}
