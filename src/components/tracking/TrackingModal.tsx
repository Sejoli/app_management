import React, { useState, useEffect } from "react";
import { usePermission } from "@/hooks/usePermission";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { MapPin, Calendar, FileText, Upload, Circle, CheckCircle2, Truck, Package, Archive, Pencil, X, ArrowLeft, Link as LinkIcon, Trash2 } from "lucide-react";

interface TrackingModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    internalLetterId: string;
    letterDetails?: any; // To show info in header
    isOwner?: boolean;
    isSuperAdmin?: boolean;
}

const STATUS_OPTIONS = [
    { value: "Diproses", label: "Diproses", icon: Archive },
    { value: "Dikirim", label: "Dikirim", icon: Truck },
    { value: "Tiba", label: "Tiba", icon: MapPin },
    { value: "Selesai", label: "Selesai", icon: CheckCircle2 },
];

export default function TrackingModal({ open, onOpenChange, internalLetterId, letterDetails, isOwner, isSuperAdmin }: TrackingModalProps) {
    const { canManage } = usePermission("purchase_orders");
    const canEdit = canManage && (isOwner || isSuperAdmin);
    const [activities, setActivities] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Form State
    const [status, setStatus] = useState("Diproses");
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");

    const [location, setLocation] = useState("");
    const [files, setFiles] = useState<File[]>([]);
    const [existingAttachments, setExistingAttachments] = useState<any[]>([]);
    const [deletedAttachmentIds, setDeletedAttachmentIds] = useState<string[]>([]);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (open && internalLetterId) {
            fetchActivities();
        }
    }, [open, internalLetterId]);

    const fetchActivities = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from("tracking_activities")
            .select(`
                *,
                attachments:tracking_attachments(*)
            `)
            .eq("internal_letter_id", internalLetterId)
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Error fetching tracking:", error);
            toast.error("Gagal memuat histori tracking");
        } else {
            setActivities(data || []);
            // Auto-fill form based on latest activity? Optional. 
            // Maybe set next logical status?
        }
        setLoading(false);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
        }
        // Reset input value so the same file can be selected again if needed
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const removeFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const removeExistingAttachment = (index: number) => {
        const attachment = existingAttachments[index];
        setDeletedAttachmentIds(prev => [...prev, attachment.id]);
        setExistingAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const handleEdit = (activity: any) => {
        setEditingId(activity.id);
        setStatus(activity.status);
        setTitle(activity.title);
        setDescription(activity.description || "");
        setLocation(activity.location || "");
        setFiles([]);
        setExistingAttachments(activity.attachments || []);
        setDeletedAttachmentIds([]);
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setStatus("Diproses");
        setTitle("");
        setDescription("");
        setLocation("");
        setFiles([]);
        setExistingAttachments([]);
        setDeletedAttachmentIds([]);
    };

    const handleDeleteActivity = async (id: string) => {
        if (!window.confirm("Apakah Anda yakin ingin menghapus status ini?")) return;

        const { error } = await supabase.from("tracking_activities").delete().eq("id", id);
        if (error) {
            toast.error("Gagal menghapus status");
        } else {
            toast.success("Status berhasil dihapus");
            fetchActivities();
        }
    };

    const handleSubmit = async () => {
        if (!title) {
            toast.error("Judul update harus diisi");
            return;
        }

        setUploading(true);
        try {
            let activity;

            if (editingId) {
                // UPDATE Existing
                const { data, error } = await supabase
                    .from("tracking_activities")
                    .update({
                        status,
                        title,
                        description,
                        location
                    })
                    .eq("id", editingId)
                    .select()
                    .single();

                if (error) throw error;
                activity = data;
                if (error) throw error;
                activity = data;

                // Handle Deleted Attachments
                if (deletedAttachmentIds.length > 0) {
                    const { error: delError } = await supabase
                        .from('tracking_attachments')
                        .delete()
                        .in('id', deletedAttachmentIds);

                    if (delError) throw delError;

                    // Note: Ideally we should also delete from storage, but for now just DB link.
                    // To delete from storage we'd need the file paths. 
                    // Assuming row level security handles it or we accept orphaned files for now.
                }

                toast.success("Update tracking berhasil diperbarui");
            } else {
                // INSERT New
                const { data, error } = await supabase
                    .from("tracking_activities")
                    .insert({
                        internal_letter_id: internalLetterId,
                        status,
                        title,
                        description,
                        location
                    })
                    .select()
                    .single();

                if (error) throw error;
                activity = data;
                toast.success("Update tracking berhasil disimpan");
            }

            // 2. Upload Files (Common for both)
            if (files.length > 0) {
                for (const file of files) {
                    const fileExt = file.name.split('.').pop();
                    const fileName = `${activity.id}/${crypto.randomUUID()}.${fileExt}`;
                    const filePath = `${fileName}`;

                    const { error: uploadError } = await supabase.storage
                        .from('tracking-attachments')
                        .upload(filePath, file);

                    if (uploadError) throw uploadError;

                    const { error: attError } = await supabase
                        .from('tracking_attachments')
                        .insert({
                            tracking_activity_id: activity.id,
                            file_path: filePath,
                            file_name: file.name,
                            file_type: fileExt
                        });

                    if (attError) throw attError;
                }
            }

            // Reset Form and Refresh
            handleCancelEdit(); // This resets everything including editingId
            fetchActivities();

        } catch (error: any) {
            console.error("Error submitting tracking:", error);
            toast.error("Gagal menyimpan update: " + error.message);
        } finally {
            setUploading(false);
        }
    };

    const getStorageUrl = (path: string) => {
        return `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/tracking-attachments/${path}`;
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
                <DialogHeader className="border-b pb-4">
                    <DialogTitle>{canEdit ? "Tambah Tracking Barang" : "Riwayat Tracking Barang"}</DialogTitle>
                    <DialogDescription>
                        {letterDetails?.quotation?.request?.request_code} - {letterDetails?.quotation?.request?.title}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-hidden flex flex-col md:flex-row gap-6 py-4">
                    {/* LEFT: FORM */}
                    {canEdit && (
                        <div className="flex-1 flex flex-col space-y-4 overflow-y-auto pr-2">
                            <div className="space-y-2">
                                <Label>Status</Label>
                                <Select value={status} onValueChange={setStatus}>
                                    <SelectTrigger className="border-gray-200">
                                        <SelectValue placeholder="Pilih status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {STATUS_OPTIONS.map(opt => (
                                            <SelectItem key={opt.value} value={opt.value}>
                                                <div className="flex items-center gap-2">
                                                    <opt.icon className="h-4 w-4" />
                                                    {opt.label}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Lokasi Terkini</Label>
                                <div className="relative">
                                    <MapPin className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Contoh: Gudang Vendor, Pelabuhan..."
                                        className="pl-9 border-gray-200"
                                        value={location}
                                        onChange={e => setLocation(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Judul Update</Label>
                                <Input
                                    placeholder="Contoh: Barang dalam proses packing"
                                    value={title}
                                    className="border-gray-200"
                                    onChange={e => setTitle(e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Catatan (Opsional)</Label>
                                <Textarea
                                    placeholder="Detail tambahan..."
                                    className="resize-none h-20 border-gray-200"
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Upload Foto/Dokumen Bukti</Label>
                                <div className="flex flex-col gap-3">
                                    <div className="flex items-center gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => fileInputRef.current?.click()}
                                        >
                                            <Upload className="h-4 w-4 mr-2" />
                                            Choose Files
                                        </Button>
                                        <span className="text-xs text-muted-foreground">
                                            {files.length === 0 ? "No file chosen" : `${files.length} file dipilih`}
                                        </span>
                                    </div>
                                    <Input
                                        type="file"
                                        multiple
                                        ref={fileInputRef}
                                        onChange={handleFileChange}
                                        className="hidden"
                                    />

                                    {files.length > 0 && (
                                        <div className="flex flex-col gap-2 p-3 bg-muted/40 rounded-md border border-dashed">
                                            <span className="text-xs font-semibold text-muted-foreground">File yang akan diupload:</span>
                                            {existingAttachments.map((att, i) => (
                                                <div key={`existing-${i}`} className="flex items-center justify-between text-sm bg-background p-2 rounded border shadow-sm">
                                                    <a href={getStorageUrl(att.file_path)} target="_blank" className="truncate max-w-[200px] text-blue-600 hover:underline">
                                                        {att.file_name}
                                                    </a>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                        onClick={() => removeExistingAttachment(i)}
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            ))}
                                            {files.map((file, i) => (
                                                <div key={`new-${i}`} className="flex items-center justify-between text-sm bg-background p-2 rounded border shadow-sm">
                                                    <span className="truncate max-w-[200px]">{file.name}</span>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                        onClick={() => removeFile(i)}
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {(files.length === 0 && existingAttachments.length > 0) && (
                                        <div className="flex flex-col gap-2 p-3 bg-muted/40 rounded-md border border-dashed">
                                            <span className="text-xs font-semibold text-muted-foreground">File terlampir:</span>
                                            {existingAttachments.map((att, i) => (
                                                <div key={`existing-${i}`} className="flex items-center justify-between text-sm bg-background p-2 rounded border shadow-sm">
                                                    <a href={getStorageUrl(att.file_path)} target="_blank" className="truncate max-w-[200px] text-blue-600 hover:underline">
                                                        {att.file_name}
                                                    </a>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                        onClick={() => removeExistingAttachment(i)}
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex gap-2 mt-4">
                                <Button onClick={handleSubmit} disabled={uploading} className="flex-1">
                                    {uploading ? "Menyimpan..." : editingId ? "Simpan Perubahan" : "Tambah Status"}
                                </Button>
                                {editingId && (
                                    <Button variant="outline" onClick={handleCancelEdit} disabled={uploading}>
                                        <X className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* RIGHT: TIMELINE */}
                    <div className={`w-full ${canEdit ? "md:w-[400px]" : ""} bg-muted/30 rounded-lg border p-4 flex flex-col`}>
                        <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
                            <Calendar className="h-4 w-4" /> Riwayat Perjalanan
                        </h3>

                        <ScrollArea className="flex-1 -mr-3 pr-3">
                            <div className="space-y-6 relative pl-2">
                                {/* Vertical Line */}
                                <div className="absolute left-[7px] top-2 bottom-2 w-[2px] bg-border" />

                                {loading ? (
                                    <div className="text-sm text-muted-foreground text-center py-4">Loading history...</div>
                                ) : activities.length === 0 ? (
                                    <div className="text-sm text-muted-foreground text-center py-4 italic">Belum ada histori tracking</div>
                                ) : (
                                    activities
                                        .filter(a => a.status !== 'Inisiasi')
                                        .map((activity, index) => {
                                            const isLatest = index === 0;
                                            return (
                                                <div key={activity.id} className="relative pl-6">
                                                    {/* Dot */}
                                                    <div className={`absolute left-0 top-1.5 h-4 w-4 rounded-full border-2 ${isLatest ? 'bg-primary border-primary' : 'bg-background border-muted-foreground'} z-10 flex items-center justify-center`}>
                                                        {isLatest && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                                                    </div>

                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className={`text-sm font-semibold ${isLatest ? 'text-primary' : 'text-foreground'}`}>
                                                                {activity.title}
                                                            </span>
                                                            {canEdit && (
                                                                <>
                                                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={() => handleEdit(activity)}>
                                                                        <Pencil className="h-3 w-3" />
                                                                    </Button>
                                                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDeleteActivity(activity.id)}>
                                                                        <Trash2 className="h-3 w-3" />
                                                                    </Button>
                                                                </>
                                                            )}
                                                        </div>

                                                        <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                                                            <span className="flex items-center gap-1">
                                                                {format(new Date(activity.created_at), "dd MMM yyyy, HH:mm", { locale: id })}
                                                            </span>
                                                            {activity.location && (
                                                                <span className="flex items-center gap-1 text-foreground/80">
                                                                    <MapPin className="h-3 w-3" /> {activity.location}
                                                                </span>
                                                            )}
                                                            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] w-fit font-medium border mt-1 ${activity.status === 'Diproses' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                                                                activity.status === 'Dikirim' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                                                                    activity.status === 'Tiba' ? 'bg-orange-100 text-orange-800 border-orange-200' :
                                                                        activity.status === 'Selesai' ? 'bg-green-100 text-green-800 border-green-200' :
                                                                            'bg-secondary text-secondary-foreground'
                                                                }`}>
                                                                {activity.status}
                                                            </span>
                                                        </div>

                                                        {activity.description && (
                                                            <p className="text-xs text-muted-foreground mt-1 bg-background/50 p-1.5 rounded border border-dashed">
                                                                {activity.description}
                                                            </p>
                                                        )}

                                                        {activity.attachments && activity.attachments.length > 0 && (
                                                            <div className="flex flex-wrap gap-1 mt-2">
                                                                {activity.attachments.map((att: any) => (
                                                                    <a
                                                                        key={att.id}
                                                                        href={getStorageUrl(att.file_path)}
                                                                        target="_blank"
                                                                        className="block h-10 w-10 relative border rounded overflow-hidden hover:opacity-80 transition-opacity"
                                                                    >
                                                                        {att.file_type === 'pdf' ? (
                                                                            <div className="w-full h-full flex items-center justify-center bg-gray-100 text-[8px]">PDF</div>
                                                                        ) : (
                                                                            <img src={getStorageUrl(att.file_path)} className="w-full h-full object-cover" />
                                                                        )}
                                                                    </a>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })
                                )}
                            </div>
                        </ScrollArea>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
