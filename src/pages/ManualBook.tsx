import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BookOpen, Calculator, Workflow, ShieldCheck, HelpCircle } from "lucide-react";

export default function ManualBook() {
    return (
        <div className="container mx-auto py-8 space-y-8">
            <div className="flex items-center gap-4 mb-8">
                <div className="p-3 bg-blue-100 text-blue-700 rounded-lg">
                    <BookOpen className="h-8 w-8" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Manual Book Sistem</h1>
                    <p className="text-gray-500">Panduan lengkap operasional, perhitungan, dan fitur aplikasi.</p>
                </div>
            </div>

            <Tabs defaultValue="workflow" className="w-full">
                <TabsList className="grid w-full grid-cols-4 lg:w-[600px] mb-8">
                    <TabsTrigger value="workflow">Alur Kerja</TabsTrigger>
                    <TabsTrigger value="calc">Perhitungan</TabsTrigger>
                </TabsList>

                <TabsContent value="workflow" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Workflow className="h-5 w-5" />
                                Panduan Operasional Per-Halaman
                            </CardTitle>
                            <CardDescription>
                                Klik pada nama halaman untuk melihat detail cara kerjanya.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Accordion type="single" collapsible className="w-full">

                                {/* 1. REQUESTS */}
                                <AccordionItem value="page-requests">
                                    <AccordionTrigger className="font-bold text-lg text-blue-800">1. Halaman Requests (Permintaan)</AccordionTrigger>
                                    <AccordionContent className="space-y-4 pt-2">
                                        <div className="p-3 bg-blue-50 rounded text-sm text-blue-900">
                                            <strong>Fungsi:</strong> Mencatat semua permintaan masuk dari customer sebelum dihitung harganya.
                                        </div>
                                        <div className="space-y-2">
                                            <h4 className="font-semibold underline">Langkah-Langkah:</h4>
                                            <ol className="list-decimal list-inside text-sm text-gray-700 space-y-1">
                                                <li>Klik tombol <strong>"Tambah Request"</strong> di pojok kanan atas.</li>
                                                <li><strong>Pilih Customer:</strong> Bisa cari nama customer lama, atau buat baru.</li>
                                                <li><strong>Isi Detail:</strong> Judul Proyek, Nomor Surat (dari Customer), dan Deadline.</li>
                                                <li><strong>Upload Lampiran:</strong> Masukkan gambar teknik, spesifikasi, atau dokumen pendukung lainnya.</li>
                                                <li>Klik Simpan.</li>
                                            </ol>
                                        </div>
                                        <div className="p-3 bg-yellow-50 rounded text-sm text-yellow-900 border border-yellow-200 mt-2">
                                            <strong>Notifikasi Deadline:</strong> Sistem akan memunculkan peringatan otomatis pada halaman ini jika request sudah melewati tanggal jatuh tempo (deadline).
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                {/* 2. BALANCES */}
                                <AccordionItem value="page-balances">
                                    <AccordionTrigger className="font-bold text-lg text-blue-800">2. Halaman Balances (Neraca / RAB)</AccordionTrigger>
                                    <AccordionContent className="space-y-4 pt-2">
                                        <div className="p-3 bg-blue-50 rounded text-sm text-blue-900">
                                            <strong>Fungsi:</strong> "Jantung" aplikasi. Tempat menghitung Modal (HPP) vs Harga Jual.
                                        </div>
                                        <div className="space-y-2">
                                            <h4 className="font-semibold underline">Cara Membuat Neraca:</h4>
                                            <ol className="list-decimal list-inside text-sm text-gray-700 space-y-1">
                                                <li>Klik <strong>"Tambah Neraca"</strong>.</li>
                                                <li><strong>Pilih Request:</strong> Cari request yang sudah dibuat sebelumnya (Langkah 1).</li>
                                                <li>Neraca baru akan muncul di tabel. Klik icon <strong>Mata (View)</strong> atau baris tabel untuk masuk ke detail.</li>
                                            </ol>
                                        </div>
                                        <div className="space-y-2">
                                            <h4 className="font-semibold underline">Cara Isi Item (Hitung Harga):</h4>
                                            <ol className="list-decimal list-inside text-sm text-gray-700 space-y-1">
                                                <li>Di dalam detail neraca, klik <strong>"Tambah Item"</strong>.</li>
                                                <li><strong>Pilih Vendor:</strong> Siapa supplier barang ini?</li>
                                                <li><strong>Input Biaya:</strong> Masukkan Harga Beli (dari Vendor) dan Qty.</li>
                                                <li><strong>Faktor Tambahan:</strong> Sesuaikan Difficulty, Delivery Time, dll (ini akan menambah HPP).</li>
                                                <li><strong>Margin:</strong> Tentukan % keuntungan yang diinginkan dari customer.</li>
                                                <li>Sistem otomatis menghitung <strong>Harga Jual Akhir</strong> (Lihat tab Perhitungan untuk rumusnya).</li>
                                            </ol>
                                        </div>
                                        <div className="p-3 bg-amber-50 rounded text-sm text-amber-900 border border-amber-200 mt-2">
                                            <strong>Tips Cerdas:</strong>
                                            <ul className="list-disc list-inside mt-1 space-y-1">
                                                <li>
                                                    <strong>Icon Gear (Pengaturan Vendor):</strong> Ikon ini muncul di sebelah nama Vendor. Klik untuk mengatur <strong>Diskon Vendor, DP, dan Termin Pembayaran</strong>. Pengaturan ini berlaku untuk semua item yang dibeli dari vendor tersebut.
                                                </li>
                                                <li>
                                                    <strong>Mengatur Urutan Baris (Drag & Drop):</strong> Di sebelah kiri nomor urut, ada ikon <strong>Titik Enam Vertikal (::)</strong>. Klik tahan dan geser (drag) ke posisi baris yang diinginkan untuk mengubah urutan item.
                                                </li>
                                            </ul>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                {/* 3. QUOTATIONS */}
                                <AccordionItem value="page-quotations">
                                    <AccordionTrigger className="font-bold text-lg text-blue-800">3. Halaman Quotations (Penawaran)</AccordionTrigger>
                                    <AccordionContent className="space-y-4 pt-2">
                                        <div className="p-3 bg-blue-50 rounded text-sm text-blue-900">
                                            <strong>Fungsi:</strong> Dokumen resmi penawaran harga kepada Customer.
                                        </div>
                                        <div className="space-y-2">
                                            <h4 className="font-semibold underline">Cara Membuat Penawaran:</h4>
                                            <ol className="list-decimal list-inside text-sm text-gray-700 space-y-1">
                                                <li>Kembali ke halaman <strong>Balances</strong>.</li>
                                                <li>Centang (Checklist) item-item yang ingin ditawarkan. (Bisa pilih sebagian item saja).</li>
                                                <li>Klik tombol <strong>"Buat Penawaran"</strong> yang muncul di atas tabel.</li>
                                                <li>Sistem akan men-generate Nomor Quotation otomatis (Format: Q/XXX/Bulan/Tahun).</li>
                                            </ol>
                                        </div>
                                        <div className="space-y-2">
                                            <h4 className="font-semibold underline">Aksi Lanjutan:</h4>
                                            <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                                                <li>Masuk ke menu <strong>Quotations</strong>.</li>
                                                <li>Klik icon <strong>Printer</strong> untuk download PDF.</li>
                                                <li>Jika Customer setuju, ubah status menjadi <strong>Deal / PO Received</strong>.</li>
                                            </ul>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                {/* 4. PURCHASE ORDERS */}
                                <AccordionItem value="page-po">
                                    <AccordionTrigger className="font-bold text-lg text-blue-800">4. Halaman Purchase Orders (PO)</AccordionTrigger>
                                    <AccordionContent className="space-y-4 pt-2">
                                        <div className="p-3 bg-blue-50 rounded text-sm text-blue-900">
                                            <strong>Fungsi:</strong> Surat pesanan pembelian barang kepada Vendor (Supplier).
                                        </div>
                                        <div className="space-y-2">
                                            <h4 className="font-semibold underline">Cara Generate PO:</h4>
                                            <ol className="list-decimal list-inside text-sm text-gray-700 space-y-1">
                                                <li>Pastikan Quotation statusnya sudah <strong>Deal</strong>.</li>
                                                <li>Di halaman Quotations, klik tombol <strong>"Checklist" (Centang)</strong> item-item yang ingin dipesankan PO ke Vendor.</li>
                                                <li>Klik tombol <strong>"Buat PO"</strong> yang muncul.</li>
                                                <li>Sistem akan otomatis <strong>mengelompokkan item</strong> berdasarkan Vendor.
                                                    <ul className="pl-6 list-disc text-gray-500 text-xs mt-1">
                                                        <li>Misal: Anda mencentang 5 item. 3 item ternyata dari "Vendor A", 2 item dari "Vendor B".</li>
                                                        <li>Sistem akan membuat <strong>2 PO terpisah</strong> secara otomatis.</li>
                                                    </ul>
                                                </li>
                                            </ol>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                {/* 5. INTERNAL LETTERS (SURAT PENGAJUAN) */}
                                <AccordionItem value="page-internal-letters">
                                    <AccordionTrigger className="font-bold text-lg text-blue-800">5. Halaman Internal Letter (Surat Pengajuan)</AccordionTrigger>
                                    <AccordionContent className="space-y-4 pt-2">
                                        <div className="p-3 bg-blue-50 rounded text-sm text-blue-900">
                                            <strong>Fungsi:</strong> Dokumen pengajuan belanja ke atasan/keuangan agar PO bisa diproses (dicairkan dananya).
                                        </div>
                                        <div className="space-y-2">
                                            <h4 className="font-semibold underline">Cara Membuat Surat Pengajuan:</h4>
                                            <ol className="list-decimal list-inside text-sm text-gray-700 space-y-1">
                                                <li>Masuk ke Halaman <strong>Purchase Orders</strong>.</li>
                                                <li>Pilih Tab <strong>PO In</strong> (atau tab yang sesuai dengan jenis PO).</li>
                                                <li><strong>Centang (Checklist)</strong> item PO yang ingin diajukan.</li>
                                                <li>Klik tombol <strong>"Tambah Internal Letter"</strong>.</li>
                                            </ol>
                                        </div>
                                        <div className="p-3 bg-red-50 rounded text-sm text-red-900 border border-red-200 mt-2">
                                            <strong>Penting:</strong> Surat Pengajuan TIDAK BISA dibuat jika Status PO masih <strong>Pending</strong>. Pastikan PO sudah disetujui (Approved) oleh atasan terlebih dahulu.
                                        </div>
                                        <div className="space-y-2 pt-2">
                                            <h4 className="font-semibold underline">Fitur Otomatis:</h4>
                                            <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                                                <li>Surat baru akan muncul di halaman <strong>Internal Letters</strong>.</li>
                                                <li><strong>Print:</strong> Tersedia fitur cetak langsung.</li>
                                            </ul>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                {/* 6. TRACKING PAGE */}
                                <AccordionItem value="page-tracking">
                                    <AccordionTrigger className="font-bold text-lg text-blue-800">6. Halaman Tracking (Pelacakan Barang)</AccordionTrigger>
                                    <AccordionContent className="space-y-4 pt-2">
                                        <div className="p-3 bg-blue-50 rounded text-sm text-blue-900">
                                            <strong>Fungsi:</strong> Memantau posisi update barang yang sudah dipesan (PO) agar bisa dimonitor oleh atasan.
                                        </div>
                                        <div className="space-y-2">
                                            <h4 className="font-semibold underline">Cara Menambah Tracking:</h4>
                                            <ol className="list-decimal list-inside text-sm text-gray-700 space-y-1">
                                                <li>Masuk ke Halaman <strong>Internal Letters</strong>.</li>
                                                <li><strong>Centang (Checklist)</strong> baris surat pengajuan yang ingin ditracking.</li>
                                                <li>Klik tombol <strong>"Tambah Tracking"</strong>.</li>
                                            </ol>
                                        </div>
                                        <div className="p-3 bg-red-50 rounded text-sm text-red-900 border border-red-200 mt-2">
                                            <strong>Penting:</strong> Tombol Tracking tidak akan aktif jika Internal Letter masih berstatus <strong>Pending</strong>. Pastikan surat sudah di-approve atasan.
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                {/* 7. INVOICES */}
                                <AccordionItem value="page-invoices">
                                    <AccordionTrigger className="font-bold text-lg text-blue-800">7. Halaman Invoices (Penagihan)</AccordionTrigger>
                                    <AccordionContent className="space-y-4 pt-2">
                                        <div className="p-3 bg-blue-50 rounded text-sm text-blue-900">
                                            <strong>Fungsi:</strong> Membuat tagihan (Invoice) dari barang yang sudah dikirim (Tracking) dan menandai proyek selesai.
                                        </div>
                                        <div className="space-y-2">
                                            <h4 className="font-semibold underline">Alur Pembuatan Invoice:</h4>
                                            <ol className="list-decimal list-inside text-sm text-gray-700 space-y-1">
                                                <li>Masuk ke Halaman <strong>Tracking</strong>.</li>
                                                <li><strong>Centang (Checklist)</strong> data tracking yang akan dijadikan invoice.</li>
                                                <li>Klik tombol <strong>"Tambah Invoice"</strong>.</li>
                                                <li>Data baru akan dibuat di halaman <strong>Invoices</strong> dengan status <strong>Pending</strong>.</li>
                                            </ol>
                                        </div>
                                        <div className="space-y-2 pt-2">
                                            <h4 className="font-semibold underline">Penyelesaian Projek:</h4>
                                            <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                                                <li>Setelah status Invoice berubah menjadi <strong>Approve</strong> (disetujui), checkbox pada baris tersebut akan aktif.</li>
                                                <li><strong>Klik Checkbox</strong> pada invoice yang sudah approve.</li>
                                                <li>Akan muncul <strong>Badge Corner "SELESAI"</strong> yang menandakan projek untuk item tersebut telah rampung.</li>
                                            </ul>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                            </Accordion>
                        </CardContent>
                    </Card>
                </TabsContent>


                {/* --- CALCULATIONS SECTION --- */}
                <TabsContent value="calc" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Calculator className="h-5 w-5" />
                                Rumus Harga Jual
                            </CardTitle>
                            <CardDescription>
                                Bagaimana sistem menghitung angka di halaman Neraca (RAB)?
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-8">

                            <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                                <h3 className="font-bold text-lg mb-4 text-center">Rumus Dasar</h3>
                                <div className="text-center font-mono text-xl bg-white p-4 rounded shadow-sm border mb-4">
                                    Harga Jual = (Biaya Total + Margin) + PPN
                                </div>
                                <p className="text-center text-sm text-muted-foreground">
                                    *Semua perhitungan dilakukan per-satuan (per pcs) terlebih dahulu, baru dikali Qty.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                                {/* Left: Input Variables */}
                                <div className="space-y-4">
                                    <h4 className="font-bold text-blue-700">1. Komponen Biaya (HPP)</h4>
                                    <ul className="space-y-3 text-sm">
                                        <li className="flex justify-between border-b pb-2">
                                            <span><strong>B</strong> (Harga Beli Vendor)</span>
                                            <span className="font-mono text-gray-600">Input Manual</span>
                                        </li>
                                        <li className="flex justify-between border-b pb-2">
                                            <span><strong>Ongkir Vendor</strong></span>
                                            <span className="font-mono text-gray-600">(Total Ongkir / Qty)</span>
                                        </li>
                                        <li className="flex justify-between border-b pb-2">
                                            <span><strong>Ongkir Customer</strong></span>
                                            <span className="font-mono text-gray-600">(Total Ongkir / Qty)</span>
                                        </li>
                                        <li className="flex justify-between border-b pb-2">
                                            <span><strong>Difficulty</strong> (Resiko)</span>
                                            <span className="font-mono text-gray-600">B x %Difficulty</span>
                                        </li>
                                        <li className="flex justify-between border-b pb-2">
                                            <span><strong>Delivery Time</strong> (Lama Kirim)</span>
                                            <span className="font-mono text-gray-600">B x %Delivery</span>
                                        </li>
                                        <li className="flex justify-between border-b pb-2">
                                            <span><strong>Payment Term</strong> (Tempo Bayar)</span>
                                            <span className="font-mono text-gray-600">B x %Payment</span>
                                        </li>
                                        <li className="flex justify-between border-b pb-2">
                                            <span><strong>Biaya Keseluruhan</strong> (Distributed)</span>
                                            <span className="font-mono text-gray-600">Total Biaya / Total Qty</span>
                                        </li>

                                        <div className="bg-yellow-50 p-2 rounded text-xs font-semibold text-yellow-800 mt-2">
                                            Total Cost (HPP) = Jumlahkan semua poin di atas
                                        </div>
                                    </ul>
                                </div>

                                {/* Right: Output Variables */}
                                <div className="space-y-4">
                                    <h4 className="font-bold text-green-700">2. Harga Akhir</h4>
                                    <ul className="space-y-3 text-sm">
                                        <li className="flex justify-between border-b pb-2">
                                            <span><strong>Total Cost (HPP)</strong></span>
                                            <span className="font-mono text-gray-600">Rp 100.000 (Misal)</span>
                                        </li>
                                        <li className="flex justify-between border-b pb-2">
                                            <span><strong>Margin</strong> (Keuntungan)</span>
                                            <span className="font-mono text-gray-600">+ 30%</span>
                                        </li>
                                        <li className="flex justify-between border-b pb-2 font-semibold">
                                            <span>Harga Sebelum PPN</span>
                                            <span className="font-mono text-gray-600">Rp 130.000</span>
                                        </li>
                                        <li className="flex justify-between border-b pb-2">
                                            <span><strong>PPN</strong> (Pajak)</span>
                                            <span className="font-mono text-gray-600">+ 11% (Dr 130rb)</span>
                                        </li>
                                        <div className="bg-green-100 p-3 rounded text-lg font-bold text-green-900 mt-4 text-center border border-green-200">
                                            Harga Jual = Rp 144.300
                                        </div>
                                    </ul>
                                </div>


                            </div>

                            <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
                                <h3 className="font-bold text-lg mb-4 text-blue-900 border-b border-blue-200 pb-2">Contoh Kasus Nyata</h3>
                                <div className="space-y-4 text-sm text-blue-800">
                                    <p>
                                        <strong>Kasus:</strong> Anda membeli <strong>Laptop Gaming</strong> seharga <strong>Rp 15.000.000</strong> dari Vendor.
                                    </p>
                                    <ul className="list-disc list-inside space-y-1 pl-4">
                                        <li><strong>Harga Beli (Vendor):</strong> Rp 15.000.000</li>
                                        <li><strong>Ongkir Vendor:</strong> Rp 100.000 (Ditanggung kantor)</li>
                                        <li><strong>Ongkir Customer:</strong> Rp 150.000 (Biaya kirim ke klien)</li>
                                        <li><strong>Difficulty/Resiko:</strong> 2% (Rp 300.000 - untuk garansi/handling)</li>
                                        <li><strong>Delivery Time:</strong> 1% (Rp 150.000 - kompensasi waktu)</li>
                                        <li><strong>Payment Term:</strong> 1% (Rp 150.000 - bunga/tempo)</li>
                                        <li><strong>Biaya Keseluruhan:</strong> Rp 50.000 (Asumsi beban admin per unit)</li>
                                    </ul>
                                    <div className="bg-white p-3 rounded border border-blue-100 font-mono mt-2">
                                        Total HPP (Modal) = 15.000.000 + 100.000 + 150.000 + 300.000 + 150.000 + 150.000 + 50.000<br />
                                        = <strong>Rp 15.900.000</strong>
                                    </div>
                                    <p className="mt-2">
                                        Anda ingin untung <strong>Margin 20%</strong> dari Customer.
                                    </p>
                                    <div className="bg-white p-3 rounded border border-blue-100 font-mono mt-2">
                                        Harga Jual (Sebelum PPN) = Rp 15.900.000 + 20% = <strong>Rp 19.080.000</strong>
                                    </div>
                                    <p className="mt-2">
                                        Terakhir, ditambah <strong>PPN 11%</strong>.
                                    </p>
                                    <div className="bg-blue-600 text-white p-4 rounded text-center font-bold text-lg mt-4 shadow-sm">
                                        Harga Final ke Customer = Rp 21.178.800
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>





            </Tabs >
        </div >
    );
}
