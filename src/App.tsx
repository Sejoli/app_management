import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import AuthGuard from "./components/AuthGuard";
import { useEffect, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Requests = lazy(() => import("./pages/Requests"));
const Balances = lazy(() => import("./pages/Balances"));
const BalanceDetail = lazy(() => import("./pages/BalanceDetail"));
const Customers = lazy(() => import("./pages/Customers"));
const CustomerPics = lazy(() => import("./pages/CustomerPics"));
const Vendors = lazy(() => import("./pages/Vendors"));
const VendorPics = lazy(() => import("./pages/VendorPics"));
const CustomerCostManagement = lazy(() => import("./pages/CustomerCostManagement"));
const CompanyManagement = lazy(() => import("./pages/CompanyManagement"));
const Quotations = lazy(() => import("./pages/Quotations"));
const PurchaseOrders = lazy(() => import("./pages/PurchaseOrders"));
const InternalLetters = lazy(() => import("./pages/InternalLetters"));
const TrackingPage = lazy(() => import("./pages/TrackingPage"));
const InvoiceManagement = lazy(() => import("./pages/InvoiceManagement"));
const ManualBook = lazy(() => import("./pages/ManualBook"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Login = lazy(() => import("./pages/Login"));
const Reports = lazy(() => import("./pages/Reports"));

const queryClient = new QueryClient();

const LoadingFallback = () => (
  <div className="flex h-screen w-full items-center justify-center">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

const App = () => {
  useEffect(() => {
    const updateFavicon = async () => {
      try {
        const { data } = await supabase.from("company").select("logo_path").limit(1).single();
        if (data?.logo_path) {
          const { data: publicUrl } = supabase.storage.from("company-files").getPublicUrl(data.logo_path);

          let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
          if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.head.appendChild(link);
          }
          link.href = publicUrl.publicUrl;
        }
      } catch (error) {
        console.error("Failed to update favicon:", error);
      }
    };
    updateFavicon();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route
                path="/"
                element={
                  <AuthGuard>
                    <Layout>
                      <Dashboard />
                    </Layout>
                  </AuthGuard>
                }
              />
              <Route
                path="/requests"
                element={
                  <AuthGuard>
                    <Layout>
                      <Requests />
                    </Layout>
                  </AuthGuard>
                }
              />
              <Route
                path="/balances"
                element={
                  <AuthGuard>
                    <Layout>
                      <Balances />
                    </Layout>
                  </AuthGuard>
                }
              />
              <Route
                path="/balances/:balanceId/entry/:entryId"
                element={
                  <AuthGuard>
                    <Layout>
                      <BalanceDetail />
                    </Layout>
                  </AuthGuard>
                }
              />
              <Route
                path="/customers"
                element={
                  <AuthGuard>
                    <Layout>
                      <Customers />
                    </Layout>
                  </AuthGuard>
                }
              />
              <Route
                path="/customer-pics"
                element={
                  <AuthGuard>
                    <Layout>
                      <CustomerPics />
                    </Layout>
                  </AuthGuard>
                }
              />
              <Route
                path="/vendors"
                element={
                  <AuthGuard>
                    <Layout>
                      <Vendors />
                    </Layout>
                  </AuthGuard>
                }
              />
              <Route
                path="/vendor-pics"
                element={
                  <AuthGuard>
                    <Layout>
                      <VendorPics />
                    </Layout>
                  </AuthGuard>
                }
              />
              <Route
                path="/customer-cost-management"
                element={
                  <AuthGuard>
                    <Layout>
                      <CustomerCostManagement />
                    </Layout>
                  </AuthGuard>
                }
              />
              <Route
                path="/company"
                element={
                  <AuthGuard>
                    <Layout>
                      <CompanyManagement />
                    </Layout>
                  </AuthGuard>
                }
              />
              <Route
                path="/quotations"
                element={
                  <AuthGuard>
                    <Layout>
                      <Quotations />
                    </Layout>
                  </AuthGuard>
                }
              />
              <Route
                path="/purchase-orders"
                element={
                  <AuthGuard>
                    <Layout>
                      <PurchaseOrders />
                    </Layout>
                  </AuthGuard>
                }
              />
              <Route
                path="/internal-letters"
                element={
                  <AuthGuard>
                    <Layout>
                      <InternalLetters />
                    </Layout>
                  </AuthGuard>
                }
              />
              <Route
                path="/invoices"
                element={
                  <AuthGuard>
                    <Layout>
                      <InvoiceManagement />
                    </Layout>
                  </AuthGuard>
                }
              />
              <Route
                path="/tracking"
                element={
                  <AuthGuard>
                    <Layout>
                      <TrackingPage />
                    </Layout>
                  </AuthGuard>
                }
              />
              <Route
                path="/manual-book"
                element={
                  <AuthGuard>
                    <Layout>
                      <ManualBook />
                    </Layout>
                  </AuthGuard>
                }
              />
              <Route
                path="/reports"
                element={
                  <AuthGuard>
                    <Layout>
                      <Reports />
                    </Layout>
                  </AuthGuard>
                }
              />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
