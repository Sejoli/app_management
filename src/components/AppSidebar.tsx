import { Building2, Users, Package, UserCircle, FileText, Scale, Settings, Briefcase, FileSpreadsheet, Truck, LayoutDashboard, BookOpen } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const ALL_MENU_ITEMS = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, key: "view_dashboard" },
  { title: "Permintaan (Requests)", url: "/requests", icon: FileText, key: "view_requests" },
  { title: "Neraca", url: "/balances", icon: Scale, key: "view_balances" },
  { title: "Penawaran (Quotations)", url: "/quotations", icon: FileSpreadsheet, key: "view_quotations" },
  { title: "Pesanan Pembelian (PO)", url: "/purchase-orders", icon: FileText, key: "view_purchase_orders" },
  { title: "Surat Pengajuan", url: "/internal-letters", icon: FileText, key: "view_internal_letters" },
  { title: "Pelacakan (Tracking)", url: "/tracking", icon: Truck, key: "view_tracking" },
  { title: "Tagihan (Invoices)", url: "/invoices", icon: FileText, key: "view_invoices" },
  { title: "Manajemen Biaya", url: "/customer-cost-management", icon: Settings, key: "view_customer_cost_management" },
  { title: "Pelanggan", url: "/customers", icon: Building2, key: "view_customers" },
  { title: "Vendor", url: "/vendors", icon: Package, key: "view_vendors" },
  { title: "Perusahaan", url: "/company", icon: Briefcase, key: "view_company" },
  { title: "Manual Book", url: "/manual-book", icon: BookOpen, key: "view_manual_book" },
];

interface UserProfile {
  name: string;
  photo_path: string | null;
  role: string;
  position: string;
}

interface AppSidebarProps {
  userProfile?: UserProfile | null;
}

export function AppSidebar({ userProfile }: AppSidebarProps) {
  const { state } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;
  const collapsed = state === "collapsed";
  const [activeMenuItems, setActiveMenuItems] = useState(ALL_MENU_ITEMS);
  const [badges, setBadges] = useState<Record<string, number>>({});

  useEffect(() => {
    if (userProfile) {
      fetchPermissions(userProfile.role);
    }
    fetchBadges();

    // Set up real-time subscription or periodic refresh if needed
    // For now, simple fetch on mount
    const interval = setInterval(fetchBadges, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [userProfile]);

  const fetchBadges = async () => {
    try {
      const { data, error } = await supabase.rpc('get_sidebar_counts');
      if (error) {
        console.error("Error fetching sidebar badges:", error);
        return;
      }
      if (data) {
        setBadges(data as Record<string, number>);
      }
    } catch (e) {
      console.error("Error in fetchBadges:", e);
    }
  };

  const fetchPermissions = async (role: string) => {
    try {
      const { data, error } = await supabase
        .from("role_permissions")
        .select("permission_key")
        .eq("role", role)
        .eq("is_enabled", true);

      if (data) {
        const allowedKeys = data.map(p => p.permission_key);
        // Always include items that might not be in DB yet or are public if needed
        const filteredItems = ALL_MENU_ITEMS.filter(item =>
          item.key === 'view_dashboard' || item.key === 'view_manual_book' || allowedKeys.includes(item.key)
        );
        setActiveMenuItems(filteredItems);
      }
    } catch (error) {
      console.error("Error fetching menu permissions:", error);
    }
  };

  const getStorageUrl = (path: string) => {
    return `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/company-files/${path}`;
  };

  return (
    <Sidebar className={collapsed ? "w-14" : "w-60"} collapsible="icon">
      <SidebarContent className="bg-sidebar text-sidebar-foreground">

        {/* Profile Section */}
        <div className={`flex flex-col items-center justify-center transition-all duration-300 border-b border-sidebar-foreground/10 ${collapsed ? "py-4 gap-2" : "py-6 gap-3"}`}>
          {/* Avatar */}
          <div className={`relative flex items-center justify-center overflow-hidden rounded-full border-2 border-white bg-sidebar-accent/10 transition-all duration-300 ${collapsed ? "h-10 w-10" : "h-20 w-20"}`}>
            {userProfile?.photo_path ? (
              <img
                src={getStorageUrl(userProfile.photo_path)}
                alt="Profile"
                className="h-full w-full object-cover"
              />
            ) : (
              <UserCircle className={`text-sidebar-foreground/80 ${collapsed ? "h-6 w-6" : "h-12 w-12"}`} />
            )}
          </div>

          {/* User Info (Hidden when collapsed) */}
          {!collapsed && (
            <div className="flex flex-col items-center gap-0.5 text-center animate-in fade-in zoom-in duration-300">
              <h2 className="font-bold text-base leading-tight text-sidebar-foreground">
                {userProfile?.name || "Guest User"}
              </h2>
              <p className="text-xs text-muted-foreground font-medium">
                {userProfile?.position || "Staff"}
              </p>

              {/* Online Badge */}
              <div className="flex items-center gap-1.5 px-2 py-0.5 mt-2 bg-green-500/10 rounded-full border border-green-500/20">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[10px] font-medium text-green-600 uppercase tracking-wider">Online</span>
              </div>
            </div>
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/70">
            {!collapsed && "Menu"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {activeMenuItems.map((item) => (
                <SidebarMenuItem key={item.key}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className="hover:bg-sidebar-accent/10 transition-colors flex justify-between items-center group"
                      activeClassName="bg-sidebar-accent text-sidebar-foreground font-medium"
                    >
                      <div className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </div>
                      {!collapsed && badges[item.key] > 0 && (
                        <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                          {badges[item.key]}
                        </span>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
