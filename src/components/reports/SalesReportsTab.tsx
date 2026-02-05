import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePickerWithRange } from "@/components/ui/date-picker-with-range";
import { useState, useEffect } from "react";
import { DateRange } from "react-day-picker";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown, Printer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { printReport } from "./printReport";

interface ReportRow {
    no: number;
    id: string; // unique key
    user: string;
    date: string;
    customer: string;
    item_name: string;
    qty: number;
    unit: string;
    price: number;
    total: number;
}

export function SalesReportsTab() {
    const [date, setDate] = useState<DateRange | undefined>();
    const [data, setData] = useState<ReportRow[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [customers, setCustomers] = useState<any[]>([]);
    const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
    const [openCombobox, setOpenCombobox] = useState(false);

    useEffect(() => {
        const fetchCustomers = async () => {
            const { data } = await supabase.from("customers").select("id, company_name").order("company_name");
            setCustomers(data || []);
        };
        fetchCustomers();
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                let query = supabase
                    .from("purchase_orders")
                    .select(`
            id,
            po_number,
            created_at,
            vendor_id,
            creator:team_members(name),
            quotations:purchase_order_quotations(
              quotation:quotations(
                id,
                created_at,
                request:requests(
                  customer:customers(id, company_name)
                ),
                quotation_balances(
                  balance_id,
                  entry_id
                )
              )
            )
          `)
                    .order("created_at", { ascending: false });

                if (date?.from) {
                    const fromStr = date.from.toISOString();
                    query = query.gte("created_at", fromStr);
                }
                if (date?.to) {
                    // Adjust to end of day
                    const toDate = new Date(date.to);
                    toDate.setHours(23, 59, 59, 999);
                    query = query.lte("created_at", toDate.toISOString());
                }

                const { data: poData, error: poError } = await query;
                if (poError) throw poError;

                if (!poData || poData.length === 0) {
                    setData([]);
                    setIsLoading(false);
                    return;
                }

                // Collect all related balance IDs
                const balanceIds = new Set<string>();
                poData.forEach((po: any) => {
                    po.quotations?.forEach((pq: any) => {
                        const q = pq.quotation;
                        q.quotation_balances?.forEach((qb: any) => {
                            if (qb.balance_id) balanceIds.add(qb.balance_id);
                        });
                    });
                });

                let itemsData: any[] = [];
                if (balanceIds.size > 0) {
                    const { data: items, error: itemsError } = await supabase
                        .from("balance_items")
                        .select("*")
                        .in("balance_id", Array.from(balanceIds));

                    if (itemsError) throw itemsError;
                    itemsData = items || [];
                }

                const rows: ReportRow[] = [];
                let sequence = 1;

                poData.forEach((po: any) => {
                    // Match items exactly like Purchase Report
                    const poItems: any[] = [];

                    po.quotations?.forEach((pq: any) => {
                        const q = pq.quotation;
                        q.quotation_balances?.forEach((qb: any) => {
                            const validItems = itemsData.filter(i =>
                                i.balance_id === qb.balance_id &&
                                (qb.entry_id ? i.balance_entry_id === qb.entry_id : true) &&
                                i.vendor_id === po.vendor_id
                            );

                            validItems.forEach(vi => {
                                if (!poItems.find(pi => pi.id === vi.id)) {
                                    // Augment item with quotation/customer info for display
                                    poItems.push({
                                        ...vi,
                                        _quotation_date: q.created_at,
                                        _customer_name: q.request?.customer?.company_name,
                                        _customer_id: q.request?.customer?.id
                                    });
                                }
                            });
                        });
                    });

                    // Sort or process if needed

                    poItems.forEach((item, idx) => {
                        // Apply Customer Filter (Multi-select)
                        // If selectedCustomers is empty, show all.
                        if (selectedCustomers.length > 0 && !selectedCustomers.includes(item._customer_id)) {
                            return;
                        }

                        rows.push({
                            no: sequence++,
                            id: `${po.id}-${item.id}-${idx}`,
                            user: po.creator?.name || "-",
                            date: item._quotation_date || po.created_at,
                            customer: item._customer_name || "-",
                            item_name: item.customer_spec || item.vendor_spec || "-",
                            qty: item.qty || 0,
                            unit: item.unit || "",
                            price: item.unit_selling_price || 0,
                            total: item.total_selling_price || ((item.qty || 0) * (item.unit_selling_price || 0))
                        });
                    });
                });

                setData(rows);

            } catch (error) {
                console.error("Error fetching sales report:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [date, selectedCustomers]);

    const toggleCustomer = (customerId: string) => {
        setSelectedCustomers(prev =>
            prev.includes(customerId)
                ? prev.filter(id => id !== customerId)
                : [...prev, customerId]
        );
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <CardTitle>Laporan Penjualan</CardTitle>
                <div className="flex items-center gap-2">
                    <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={openCombobox}
                                className="w-[250px] justify-between"
                            >
                                {selectedCustomers.length === 0
                                    ? "Pilih Customer..."
                                    : selectedCustomers.length > 2
                                        ? `${selectedCustomers.length} customer dipilih`
                                        : customers
                                            .filter(c => selectedCustomers.includes(c.id))
                                            .map(c => c.company_name)
                                            .join(", ")}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[250px] p-0">
                            <Command>
                                <CommandInput placeholder="Cari customer..." />
                                <CommandList>
                                    <CommandEmpty>Tidak ditemukan.</CommandEmpty>
                                    <CommandGroup>
                                        {customers.map((customer) => (
                                            <CommandItem
                                                key={customer.id}
                                                value={customer.company_name}
                                                onSelect={() => toggleCustomer(customer.id)}
                                            >
                                                <div
                                                    className={cn(
                                                        "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                                        selectedCustomers.includes(customer.id)
                                                            ? "bg-primary text-primary-foreground"
                                                            : "opacity-50 [&_svg]:invisible"
                                                    )}
                                                >
                                                    <Check className={cn("h-4 w-4")} />
                                                </div>
                                                {customer.company_name}
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
                    <DatePickerWithRange date={date} setDate={setDate} />
                    <Button variant="outline" size="icon" onClick={() => {
                        printReport("Laporan Penjualan", data, 'sales');
                    }} title="Cetak Laporan">
                        <Printer className="h-4 w-4" />
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[50px] text-center">No</TableHead>
                                <TableHead className="w-[120px]">User</TableHead>
                                <TableHead className="w-[120px]">Tanggal Jual</TableHead>
                                <TableHead>Customer</TableHead>
                                <TableHead>Item</TableHead>
                                <TableHead className="text-center w-[100px]">Qty</TableHead>
                                <TableHead className="text-right w-[150px]">Harga</TableHead>
                                <TableHead className="text-right w-[150px]">Total</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-[200px]" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                                    </TableRow>
                                ))
                            ) : data.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="h-24 text-center">
                                        Tidak ada data ditemukan.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                data.map((row) => (
                                    <TableRow key={row.id}>
                                        <TableCell className="text-center">{row.no}</TableCell>
                                        <TableCell>{row.user}</TableCell>
                                        <TableCell>
                                            {format(new Date(row.date), "dd/MM/yyyy", { locale: idLocale })}
                                        </TableCell>
                                        <TableCell>{row.customer}</TableCell>
                                        <TableCell className="max-w-[300px] truncate" title={row.item_name}>{row.item_name}</TableCell>
                                        <TableCell className="text-center">{row.qty} {row.unit}</TableCell>
                                        <TableCell className="text-right">
                                            Rp {row.price.toLocaleString("id-ID")}
                                        </TableCell>
                                        <TableCell className="text-right font-medium">
                                            Rp {row.total.toLocaleString("id-ID")}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                        {data.length > 0 && (
                            <TableBody className="border-t-2 border-muted bg-muted/20 font-medium">
                                <TableRow>
                                    <TableCell colSpan={7} className="text-right font-bold">Grand Total</TableCell>
                                    <TableCell className="text-right font-bold text-lg">
                                        Rp {data.reduce((sum, item) => sum + item.total, 0).toLocaleString("id-ID")}
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        )}
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
