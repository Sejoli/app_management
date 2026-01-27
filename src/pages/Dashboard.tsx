
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    ArrowUpRight, ArrowDownRight, DollarSign, CreditCard, Activity, Users,
    FileText, CheckCircle, Clock, Calendar as CalendarIcon, Filter, Briefcase,
    AlertCircle, TrendingUp, Receipt, ListTodo, CalendarDays
} from "lucide-react";
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, Legend, PieChart, Pie, Cell
} from 'recharts';
import {
    format, subMonths, startOfMonth, endOfMonth, eachMonthOfInterval,
    isSameMonth, subDays, startOfDay, endOfDay, differenceInDays, formatDistanceToNow
} from "date-fns";
import { id } from "date-fns/locale";
import { usePermission } from "@/hooks/usePermission";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

const stringToColor = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 70%, 50%)`;
};

export default function Dashboard() {
    const { userRole, userId, loading: permLoading } = usePermission("dashboard");
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(true);

    // Filter State
    const [date, setDate] = useState<DateRange | undefined>({
        from: subMonths(new Date(), 1),
        to: new Date(),
    });

    // Metrics & Data State
    const [metrics, setMetrics] = useState({
        totalRevenue: 0,
        totalExpenses: 0,
        netProfit: 0,
        pendingInvoicesCount: 0,
        pendingInvoicesAmount: 0,
        activeProjects: 0,
        totalCustomers: 0,
        accountsReceivable: 0,
        accountsPayable: 0,
        taxOut: 0,
        taxIn: 0,
    });

    // Charts & Lists
    const [revenueTrend, setRevenueTrend] = useState<any[]>([]);
    const [topCustomers, setTopCustomers] = useState<any[]>([]);
    const [vendorSpend, setVendorSpend] = useState<any[]>([]);
    const [quotationPipeline, setQuotationPipeline] = useState<any[]>([]);
    const [invoiceAging, setInvoiceAging] = useState<any[]>([]);
    const [projectMargins, setProjectMargins] = useState<any[]>([]);
    const [staffWorkload, setStaffWorkload] = useState<any[]>([]);
    const [recentActivities, setRecentActivities] = useState<any[]>([]);
    const [upcomingDeadlines, setUpcomingDeadlines] = useState<any[]>([]);
    const [invoiceDueDates, setInvoiceDueDates] = useState<any[]>([]);
    const [staffBottleneck, setStaffBottleneck] = useState<any[]>([]);
    const [myTasks, setMyTasks] = useState<any[]>([]);

    useEffect(() => {
        if (!permLoading && date?.from && date?.to) {
            fetchDashboardData();
        }
    }, [permLoading, date]);

    const fetchDashboardData = async () => {
        setIsLoading(true);
        try {
            const startDate = date?.from ? startOfDay(date.from).toISOString() : null;
            const endDate = date?.to ? endOfDay(date.to).toISOString() : null;

            if (!startDate || !endDate) return;

            // Call the Global RPC to get aggregated data
            const { data, error } = await supabase.rpc('get_dashboard_stats', {
                start_date: startDate,
                end_date: endDate
            });

            if (error) {
                console.error("RPC Error:", error);
                // Fallback or alert?
                return;
            }

            if (data) {
                // Map RPC result to state
                setMetrics({
                    // Only approved invoices in period are 'revenue'
                    totalRevenue: data.metrics.totalRevenue,
                    totalExpenses: data.metrics.totalExpenses,
                    netProfit: data.metrics.netProfit,
                    // Receivables & Payables are usually "All Time Pending", assuming RPC handles that logic
                    pendingInvoicesCount: data.metrics.pendingInvoicesCount,
                    pendingInvoicesAmount: data.metrics.pendingInvoicesAmount,
                    // Active projects is size of pipeline? or just quotation count. The RPC returns pipeline
                    activeProjects: data.charts.quotationPipeline.reduce((acc: number, cur: any) => acc + cur.count, 0),
                    totalCustomers: 0, // Not critical
                    accountsReceivable: data.metrics.accountsReceivable,
                    accountsPayable: data.metrics.accountsPayable,
                    taxIn: data.metrics.taxIn,
                    taxOut: data.metrics.taxOut
                });

                setRevenueTrend(data.charts.revenueTrend);
                setTopCustomers(data.charts.topCustomers);
                setVendorSpend(data.charts.vendorSpend);
                setQuotationPipeline(data.charts.quotationPipeline);
                setInvoiceAging(data.charts.invoiceAging);
                setProjectMargins(data.charts.projectMargins);
                setProjectMargins(data.charts.projectMargins);
                setStaffWorkload(data.charts.staffWorkload);
                setStaffBottleneck(data.charts.staffBottleneck || []);

                setRecentActivities(data.lists.recentActivities);
                setUpcomingDeadlines(data.lists.upcomingDeadlines);
                setInvoiceDueDates(data.lists.invoiceDueDates);
                setMyTasks(data.lists.myTasks);
            }

        } catch (error) {
            console.error("Dashboard Data fetch error", error);
        } finally {
            setIsLoading(false);
        }
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
    };

    if (isLoading) {
        return <div className="p-8 space-y-8">
            <div className="flex justify-between">
                <Skeleton className="h-10 w-64" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 w-full" />)}
            </div>
            <Skeleton className="h-96 w-full" />
        </div>;
    }

    return (
        <div className="p-6 space-y-8 animate-in fade-in bg-background min-h-screen">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Analisis Dashboard</h1>
                    <p className="text-muted-foreground">Ringkasan performa bisnis global (Seluruh Perusahaan).</p>
                </div>

                {/* Date Filter */}
                <div className="flex items-center gap-2">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button id="date" variant={"outline"} className={cn("w-[260px] justify-start text-left font-normal", !date && "text-muted-foreground")}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {date?.from ? (
                                    date.to ? (
                                        <>
                                            {format(date.from, "dd MMM y", { locale: id })} -{" "}
                                            {format(date.to, "dd MMM y", { locale: id })}
                                        </>
                                    ) : (
                                        format(date.from, "dd MMM y", { locale: id })
                                    )
                                ) : (
                                    <span>Pilih Tanggal</span>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                            <Calendar
                                initialFocus
                                mode="range"
                                defaultMonth={date?.from}
                                selected={date}
                                onSelect={setDate}
                                numberOfMonths={2}
                                locale={id}
                            />
                        </PopoverContent>
                    </Popover>
                    <Button onClick={() => fetchDashboardData()} variant="default">Terapkan</Button>
                </div>
            </div>

            {/* Key Metrics Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Pendapatan (Cash In)</CardTitle>
                        <DollarSign className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(metrics.totalRevenue)}</div>
                        <p className="text-xs text-muted-foreground">Dari Invoice Selesai (Lunas)</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Pengeluaran</CardTitle>
                        <CreditCard className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(metrics.totalExpenses)}</div>
                        <p className="text-xs text-muted-foreground">PO Keluar (DP + Sisa)</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Laba Bersih (Cash)</CardTitle>
                        <Activity className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${metrics.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {formatCurrency(metrics.netProfit)}
                        </div>
                        <p className="text-xs text-muted-foreground">Pendapatan Lunas - Pengeluaran</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Status Pembayaran</CardTitle>
                        <ArrowUpRight className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-sm font-medium flex justify-between">
                            <span>Piutang (Pending):</span>
                            <span className="text-amber-600">{formatCurrency(metrics.accountsReceivable)}</span>
                        </div>
                        <div className="text-sm font-medium flex justify-between mt-1">
                            <span>Hutang Vendor:</span>
                            <span className="text-red-500">{formatCurrency(metrics.accountsPayable)}</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Tax & Tasks */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="col-span-2">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <div className="flex items-center gap-2">
                            <Receipt className="h-5 w-5 text-indigo-500" />
                            <div>
                                <CardTitle className="text-base font-medium">Estimasi PPN (11%)</CardTitle>
                                <CardDescription>Perkiraan pajak periode ini</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 gap-4 mt-2">
                            <div>
                                <p className="text-xs text-muted-foreground font-medium uppercase">PPN Keluaran (Jual)</p>
                                <p className="text-lg font-bold text-emerald-600">{formatCurrency(metrics.taxOut)}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground font-medium uppercase">PPN Masukan (Beli)</p>
                                <p className="text-lg font-bold text-red-500">{formatCurrency(metrics.taxIn)}</p>
                            </div>
                        </div>
                        <div className="mt-4 pt-3 border-t">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-medium">Selisih PPN:</span>
                                <span className={`font-bold ${(metrics.taxOut - metrics.taxIn) > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                    {formatCurrency(metrics.taxOut - metrics.taxIn)}
                                </span>
                            </div>
                        </div>
                    </CardContent>
                </Card>


                <Card className="col-span-2">
                    <CardHeader>
                        <CardTitle>Margin Proyek Tertinggi</CardTitle>
                        <CardDescription>Top 5 Proyek Berdasarkan Profit</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="whitespace-nowrap">Proyek</TableHead>
                                    <TableHead className="text-right whitespace-nowrap">Revenue</TableHead>
                                    <TableHead className="text-right whitespace-nowrap">Margin</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {projectMargins.map((p, i) => (
                                    <TableRow key={i}>
                                        <TableCell className="font-medium max-w-[200px] truncate whitespace-nowrap">
                                            <div className="flex flex-col gap-1">
                                                <span className="font-semibold text-base">{p.request_code || p.name}</span>
                                                {p.request_code && <span className="text-sm text-muted-foreground truncate">{p.title || p.name}</span>}
                                                {p.creator_name && (
                                                    <span className="text-xs text-muted-foreground/80 flex items-center gap-1">
                                                        <span
                                                            className="w-2 h-2 rounded-full"
                                                            style={{ backgroundColor: stringToColor(p.creator_name) }}
                                                        />
                                                        {p.creator_name}
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right text-sm whitespace-nowrap">{formatCurrency(p.revenue)}</TableCell>
                                        <TableCell className="text-right whitespace-nowrap">
                                            <div className="flex flex-col items-end">
                                                <span className="font-bold text-emerald-600 text-base">{formatCurrency(p.margin)}</span>
                                                <span className="text-xs text-muted-foreground">{p.marginPercent.toFixed(1)}%</span>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {projectMargins.length === 0 && <TableRow><TableCell colSpan={3} className="text-center">Belum ada data profit</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>

            {/* Profitability, Pipeline & Aging */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>Tren Profitabilitas</CardTitle>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={revenueTrend}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis tickFormatter={(val) => `${(val / 1000000).toFixed(0)}M`} fontSize={12} tickLine={false} axisLine={false} />
                                    <Tooltip formatter={(val: number) => formatCurrency(val)} />
                                    <Legend />
                                    <Bar dataKey="revenue" fill="#10b981" name="Pendapatan" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="expense" fill="#ef4444" name="Pengeluaran" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>Umur Piutang (Aging)</CardTitle>
                        <CardDescription>Invoice Belum Lunas</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={invoiceAging} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="range" type="category" width={100} fontSize={12} />
                                    <Tooltip formatter={(val: number) => formatCurrency(val)} />
                                    <Bar dataKey="value" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={32} name="Total Piutang" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Project Margins & Staff Workload */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">



                <Card>
                    <CardHeader>
                        <CardTitle>Top Customer (Revenue)</CardTitle>
                        <CardDescription>Pelanggan dengan Transaksi Terbesar</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={topCustomers} layout="vertical" margin={{ left: 40 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={120} fontSize={13} />
                                    <Tooltip formatter={(val: number) => formatCurrency(val)} />
                                    <Bar dataKey="value" fill="#10b981" radius={[0, 4, 4, 0]} barSize={20} name="Total Pendapatan" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Pengeluaran Vendor</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={vendorSpend} layout="vertical" margin={{ left: 40 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={120} fontSize={13} />
                                    <Tooltip formatter={(val: number) => formatCurrency(val)} />
                                    <Bar dataKey="value" fill="#ef4444" radius={[0, 4, 4, 0]} barSize={20} name="Total Biaya" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Vendor Spend */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-full lg:col-span-7">
                    <CardHeader>
                        <CardTitle>Beban Kerja & Bottleneck Staff</CardTitle>
                        <CardDescription>Pipeline Pekerjaan per Tim</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={staffBottleneck}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} />
                                    <YAxis fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                                    <Tooltip content={({ active, payload, label }) => {
                                        if (active && payload && payload.length) {
                                            return (
                                                <div className="bg-background border rounded-lg shadow-lg text-xs overflow-hidden">
                                                    <div className="bg-muted/50 px-3 py-2 border-b font-medium text-muted-foreground">
                                                        {label}
                                                    </div>
                                                    <div className="p-2 space-y-1">
                                                        <div className="h-2" /> {/* Spacer */}
                                                        {payload.map((entry: any, index: number) => (
                                                            <div key={index} className="flex items-center gap-2">
                                                                <div
                                                                    className="w-2 h-2 rounded-full"
                                                                    style={{ backgroundColor: entry.color }}
                                                                />
                                                                <span className="text-muted-foreground capitalize flex-1">
                                                                    {entry.name}:
                                                                </span>
                                                                <span className="font-medium">
                                                                    {entry.value}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }} />
                                    <Legend />
                                    <Bar dataKey="request_baru" stackId="a" fill="#18181b" name="Request" />
                                    <Bar dataKey="balance_baru" stackId="a" fill="#06b6d4" name="Balance" />
                                    <Bar dataKey="quotation_baru" stackId="a" fill="#a855f7" name="Quotation" />
                                    <Bar dataKey="menunggu_letter" stackId="a" fill="#60a5fa" name="Purchase Order" />
                                    <Bar dataKey="menunggu_tracking" stackId="a" fill="#fbbf24" name="Internal Letter" />
                                    <Bar dataKey="proses_tracking" stackId="a" fill="#f97316" name="Tracking" />
                                    <Bar dataKey="selesai_invoice" stackId="a" fill="#10b981" name="Invoice" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Deadlines & Activity */}
            <div className="grid gap-4 md:grid-cols-2">
                <Card className="border-l-4 border-l-amber-500">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Clock className="h-5 w-5 text-amber-500" />
                            Jatuh Tempo Request
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {upcomingDeadlines.map((req, i) => {
                                const daysLeft = differenceInDays(new Date(req.submission_deadline), new Date());
                                return (
                                    <div key={i} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
                                        <div className="space-y-1">
                                            <p className="font-semibold text-base">{req.request_code || "No Code"}</p>

                                            <div className="flex items-center text-sm text-muted-foreground gap-2">
                                                <Briefcase className="h-4 w-4" />
                                                <span>{req.company_name}</span>
                                            </div>

                                            <p className="text-sm text-muted-foreground truncate max-w-[200px]">{req.title}</p>

                                            {req.created_at && (
                                                <div className="flex items-center text-sm text-muted-foreground gap-2">
                                                    <CalendarIcon className="h-4 w-4" />
                                                    <span>{format(new Date(req.created_at), 'dd MMM yyyy')}</span>
                                                </div>
                                            )}

                                            {req.creator_name && (
                                                <div className="flex items-center text-xs text-muted-foreground/80 gap-1">
                                                    <span
                                                        className="w-2 h-2 rounded-full"
                                                        style={{ backgroundColor: stringToColor(req.creator_name) }}
                                                    />
                                                    {req.creator_name}
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <Badge variant={daysLeft < 3 ? "destructive" : "secondary"} className="text-sm">
                                                {format(new Date(req.submission_deadline), 'dd MMM', { locale: id })}
                                            </Badge>
                                            <p className="text-sm font-medium text-muted-foreground mt-1">
                                                {daysLeft < 0 ? 'Terlewat' : `${daysLeft} hari lagi`}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                            {upcomingDeadlines.length === 0 && <p className="text-center text-muted-foreground">Tidak ada deadline dekat</p>}
                        </div>
                    </CardContent>
                </Card>

            </div>

            {/* Invoice Due Dates & Logistics */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
                {/* Invoice Due Dates */}
                <Card className="border-l-4 border-l-red-500">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Clock className="h-5 w-5 text-red-500" />
                            Jatuh Tempo Invoice
                        </CardTitle>
                        <CardDescription>Invoice yang akan jatuh tempo</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {invoiceDueDates.map((inv: any, i) => {
                                const daysLeft = inv.due_date ? differenceInDays(new Date(inv.due_date), new Date()) : 0;
                                return (
                                    <div key={i} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
                                        <div className="space-y-1">
                                            <p className="font-semibold text-base">{inv.invoice_number}</p>
                                            <div className="flex items-center text-sm text-muted-foreground gap-2">
                                                <Briefcase className="h-4 w-4" />
                                                <span>{inv.company_name}</span>
                                            </div>
                                            {inv.invoice_date && (
                                                <div className="flex items-center text-sm text-muted-foreground/80 gap-1.5">
                                                    <CalendarDays className="h-4 w-4" />
                                                    <span>{format(new Date(inv.invoice_date), 'dd MMM yyyy')}</span>
                                                </div>
                                            )}
                                            {inv.term && <p className="text-sm text-muted-foreground/80">Term: {inv.term}</p>}
                                            {inv.creator_name && (
                                                <div className="flex items-center text-xs text-muted-foreground/80 gap-1">
                                                    <span
                                                        className="w-2 h-2 rounded-full"
                                                        style={{ backgroundColor: stringToColor(inv.creator_name) }}
                                                    />
                                                    {inv.creator_name}
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <Badge
                                                variant={daysLeft < 3 ? "destructive" : "outline"}
                                                className={`text-sm ${daysLeft >= 3 ? "bg-red-100 text-red-800 border-red-200 hover:bg-red-100" : ""}`}
                                            >
                                                {inv.due_date ? format(new Date(inv.due_date), 'dd MMM', { locale: id }) : '-'}
                                            </Badge>
                                            <p className="text-sm font-medium text-muted-foreground mt-1">
                                                {inv.due_date ? formatDistanceToNow(new Date(inv.due_date), { addSuffix: true, locale: id }) : ''}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                            {invoiceDueDates.length === 0 && <p className="text-center text-muted-foreground text-sm py-4">Tidak ada invoice jatuh tempo.</p>}
                        </div>
                    </CardContent>
                </Card>

                {/* Logistics */}
                <Card>
                    <CardHeader>
                        <CardTitle>Update Logistik Terbaru</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="whitespace-nowrap">Subjek</TableHead>
                                    <TableHead className="whitespace-nowrap">Status</TableHead>
                                    <TableHead className="text-right whitespace-nowrap">Waktu</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {recentActivities.map((act) => (
                                    <TableRow key={act.id}>
                                        <TableCell className="font-medium max-w-[200px] truncate">
                                            <div className="flex flex-col gap-1">
                                                <span className="font-semibold text-base">{act.subject}</span>
                                                {act.title && <span className="text-sm text-muted-foreground truncate">{act.title}</span>}
                                                {act.customer_name && <span className="text-xs text-muted-foreground truncate flex items-center gap-1">
                                                    <Briefcase className="h-3 w-3" />
                                                    {act.customer_name}
                                                </span>}
                                                {act.creator_name && <span className="text-xs text-muted-foreground/80 flex items-center gap-1">
                                                    <span
                                                        className="w-2 h-2 rounded-full"
                                                        style={{ backgroundColor: stringToColor(act.creator_name) }}
                                                    />
                                                    {act.creator_name}
                                                </span>}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={`text-xs border ${act.status === 'Diproses' ? 'bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100' :
                                                act.status === 'Dikirim' ? 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100' :
                                                    act.status === 'Tiba' ? 'bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-100' :
                                                        act.status === 'Selesai' ? 'bg-green-100 text-green-800 border-green-200 hover:bg-green-100' :
                                                            'bg-secondary text-secondary-foreground hover:bg-secondary'
                                                }`}>
                                                {act.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right text-sm text-muted-foreground">
                                            {format(new Date(act.created_at), 'dd/MM HH:mm')}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {recentActivities.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center py-4 text-muted-foreground">Tidak ada aktivitas</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>

            {/* Quick Links */}
            <div className="flex gap-2 justify-center flex-wrap">
                <Button variant="ghost" size="sm" onClick={() => navigate('/requests')}>Buka Requests</Button>
                <Button variant="ghost" size="sm" onClick={() => navigate('/invoices')}>Buka Invoice</Button>
                <Button variant="ghost" size="sm" onClick={() => navigate('/quotations')}>Buka Penawaran</Button>
                <Button variant="ghost" size="sm" onClick={() => navigate('/purchase-orders')}>Buka PO</Button>
            </div>
        </div >
    );
}
