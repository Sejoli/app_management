import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PurchaseReportsTab } from "@/components/reports/PurchaseReportsTab";
import { SalesReportsTab } from "@/components/reports/SalesReportsTab";
import { FileText, ShoppingCart, TrendingUp } from "lucide-react";

export default function Reports() {
    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2">
                <FileText className="h-8 w-8 text-primary" />
                <h1 className="text-3xl font-bold tracking-tight text-foreground">Laporan</h1>
            </div>

            <Tabs defaultValue="purchase" className="w-full">
                <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
                    <TabsTrigger value="purchase" className="gap-2">
                        <ShoppingCart className="h-4 w-4" />
                        Laporan Pembelian
                    </TabsTrigger>
                    <TabsTrigger value="sales" className="gap-2">
                        <TrendingUp className="h-4 w-4" />
                        Laporan Penjualan
                    </TabsTrigger>
                </TabsList>
                <TabsContent value="purchase" className="mt-6">
                    <PurchaseReportsTab />
                </TabsContent>
                <TabsContent value="sales" className="mt-6">
                    <SalesReportsTab />
                </TabsContent>
            </Tabs>
        </div>
    );
}
