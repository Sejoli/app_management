import { useRef, useState, useEffect } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [companyName, setCompanyName] = useState("B2B Management System");
  const [userProfile, setUserProfile] = useState<{ name: string; photo_path: string | null; role: string; position: string } | null>(null);
  const navigate = useNavigate();

  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    fetchCompanyData();
    fetchUserProfile();

    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const fetchCompanyData = async () => {
    try {
      const { data, error } = await supabase
        .from("company")
        .select("name")
        .maybeSingle();

      if (data && data.name) {
        setCompanyName(data.name);
      }
    } catch (error) {
      console.error("Error fetching company data:", error);
    }
  };

  const fetchUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (user && user.email) {
        const { data: member, error } = await supabase
          .from("team_members")
          .select("name, photo_path, role, position")
          .eq("email", user.email)
          .maybeSingle();

        if (member) {
          // @ts-ignore
          setUserProfile(member);
        }
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    }
  };

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      navigate("/login");
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Gagal logout");
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 0 && hour < 11) return "Selamat Pagi";
    if (hour >= 11 && hour < 15) return "Selamat Siang";
    if (hour >= 15 && hour < 19) return "Selamat Sore";
    return "Selamat Malam";
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("id-ID", {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).replace(/\./g, ':');
  };

  return (
    <div className="fixed inset-0 overflow-hidden w-full h-full bg-background">
      <SidebarProvider className="h-full w-full overflow-hidden">
        <div className="flex h-full w-full overflow-hidden">
          <AppSidebar userProfile={userProfile} />
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4 shrink-0">
              <div className="flex items-center">
                <SidebarTrigger className="mr-4" />
                <div className="flex flex-col">
                  <h1 className="text-lg font-semibold text-foreground leading-none">
                    {getGreeting()}
                  </h1>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <span className="text-sm font-medium tabular-nums text-muted-foreground">
                  {formatTime(currentTime)}
                </span>
                <div className="h-4 w-px bg-border"></div>
                <Button variant="ghost" size="icon" onClick={handleLogout} title="Logout">
                  <LogOut className="h-5 w-5" />
                </Button>
              </div>
            </header>
            <main className="flex-1 overflow-auto p-6">
              {children}
            </main>
          </div>
        </div>
      </SidebarProvider>
    </div>
  );
}
