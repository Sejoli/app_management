import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Trash2, Edit, FileText, X, Link as LinkIcon, Upload, Image as ImageIcon, ChevronDown, Shield, Key, Eye, EyeOff } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { DeleteConfirmationDialog } from "@/components/DeleteConfirmationDialog";
import { toast } from "sonner";
import { format, isValid } from "date-fns";
import { id } from "date-fns/locale";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  birthplace: string;
  birthdate: string;
  address: string;
  position: string;
  role?: string;
  password?: string;
  joining_date: string | null;
  photo_path: string | null;
  documents: TeamMemberDocument[];
}

interface TeamMemberDocument {
  id: string;
  file_name: string;
  file_path: string;
}

interface TeamMember {
  id: string;
  user_id?: string; // Add user_id to interface
  name: string;
  email: string;
  birthplace: string;
  birthdate: string;
  address: string;
  position: string;
  role?: string;
  password?: string;
  joining_date: string | null;
  photo_path: string | null;
  documents: TeamMemberDocument[];
}

export default function TeamTab() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  // Form States
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    birthplace: "",
    birthdate: "",
    address: "",
    position: "",
    joining_date: "",
    photo_path: "",
    role: "staff",
  });
  const [authPassword, setAuthPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [documentFiles, setDocumentFiles] = useState<File[]>([]);

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    setIsDataLoading(true);
    setIsError(false);
    const { data, error } = await supabase
      .from("team_members")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setIsError(true);
      setIsDataLoading(false);
      return;
    }

    // Fetch documents for each member
    const membersWithDocs = await Promise.all(
      (data || []).map(async (member) => {
        const { data: docs } = await supabase
          .from("team_member_documents")
          .select("*")
          .eq("team_member_id", member.id);

        return {
          ...member,
          // @ts-ignore
          joining_date: member.joining_date,
          // @ts-ignore
          photo_path: member.photo_path,
          // @ts-ignore
          // @ts-ignore
          role: member.role || 'staff',
          // @ts-ignore
          password: member.password,
          documents: docs || [],
        };
      })
    );

    setMembers(membersWithDocs);
    setIsDataLoading(false);
  };

  const uploadFile = async (file: File): Promise<string | null> => {
    const fileExt = file.name.split(".").pop();
    const fileName = `team/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;

    const { error } = await supabase.storage
      .from("company-files")
      .upload(fileName, file);

    if (error) {
      console.error("Upload error:", error);
      return null;
    }

    return fileName;
  };

  const handleSave = async () => {
    if (!formData.name || !formData.email || !formData.birthplace || !formData.birthdate || !formData.address || !formData.position || !formData.joining_date) {
      toast.error("Semua field wajib diisi");
      return;
    }

    // Require password for new users to ensure login access is created
    if (!editingMember && !authPassword) {
      toast.error("Password wajib diisi untuk anggota baru agar bisa login");
      return;
    }

    setIsLoading(true);

    try {
      let authUserId: string | null = null;

      // 1. Handle Auth User Creation (RPC) FIRST if password provided
      if (authPassword && formData.email) {
        const { data: rpcData, error: rpcError } = await supabase.rpc('admin_create_user', {
          new_email: formData.email,
          new_password: authPassword,
          new_role: formData.role
        });

        if (rpcError) {
          console.error("RPC Error:", rpcError);
          // Fallback: If creation fails, we might still want to save the profile? 
          // Or abort? Usually safer to abort if this is a "New User" flow intended for login.
          if (!editingMember) throw new Error("Gagal membuat user auth: " + rpcError.message);
          toast.warning("Gagal membuat akses login: " + rpcError.message);
        } else {
          authUserId = rpcData; // The RPC returns the new User ID
          toast.success("Akses login berhasil disiapkan");
        }
      }

      let memberId = editingMember?.id;

      // 2. Save Team Member Data
      if (editingMember) {
        const updateData: any = {
          name: formData.name,
          email: formData.email,
          birthplace: formData.birthplace,
          birthdate: formData.birthdate,
          address: formData.address,
          position: formData.position,
          joining_date: formData.joining_date,
          role: formData.role,
          password: authPassword // Save plaintext password (optional/legacy)
        };
        // Verify mismatch: if we generated a NEW auth user for an existing member, update the link
        if (authUserId) {
          updateData.user_id = authUserId;
        }

        const { error } = await supabase
          .from("team_members")
          .update(updateData)
          .eq("id", editingMember.id);

        if (error) throw error;
      } else {
        const insertData: any = {
          name: formData.name,
          email: formData.email,
          birthplace: formData.birthplace,
          birthdate: formData.birthdate,
          address: formData.address,
          position: formData.position,
          joining_date: formData.joining_date,
          role: formData.role,
          password: authPassword, // Save plaintext password
          photo_path: formData.photo_path
        };
        // Link to Auth User if created
        if (authUserId) {
          insertData.user_id = authUserId;
        }

        const { data, error } = await supabase
          .from("team_members")
          .insert(insertData)
          .select()
          .single();

        if (error) throw error;
        memberId = data.id;
      }

      // 3. Handle Documents
      if (documentFiles.length > 0 && memberId) {
        for (const file of documentFiles) {
          const path = await uploadFile(file);
          if (path) {
            await supabase.from("team_member_documents").insert({
              team_member_id: memberId,
              file_name: file.name,
              file_path: path,
              file_size: file.size,
            });
          }
        }
      }

      // 4. Handle Photo
      if (photoFile && memberId) {
        const path = await uploadFile(photoFile);
        if (path) {
          await supabase
            .from("team_members")
            .update({ photo_path: path })
            .eq("id", memberId);
        }
      }

      toast.success(editingMember ? "Data berhasil diupdate" : "Anggota tim berhasil ditambah");
      resetForm();
      fetchMembers();
    } catch (error: any) {
      console.error(error);
      toast.error("Gagal menyimpan data: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("team_members").delete().eq("id", id);

    if (error) {
      toast.error("Gagal menghapus data");
      return;
    }

    toast.success("Anggota tim berhasil dihapus");
    fetchMembers();
  };

  const handleDeleteDocument = async (docId: string, filePath: string) => {
    await supabase.storage.from("company-files").remove([filePath]);
    await supabase.from("team_member_documents").delete().eq("id", docId);
    toast.success("Dokumen berhasil dihapus");
    fetchMembers();
  };

  const handleEdit = (member: TeamMember) => {
    setEditingMember(member);
    setFormData({
      name: member.name,
      email: member.email,
      birthplace: member.birthplace,
      birthdate: member.birthdate,
      address: member.address,
      position: member.position,
      joining_date: member.joining_date || "",
      photo_path: member.photo_path || "",
      role: member.role || "staff",
    });
    setAuthPassword(member.password || ""); // Fill with existing password
    setShowPassword(false);
    setIsAuthOpen(false);
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      birthplace: "",
      birthdate: "",
      address: "",
      position: "",
      joining_date: "",
      photo_path: "",
      role: "staff",
    });
    setAuthPassword("");
    setIsAuthOpen(false);
    setPhotoFile(null);
    setDocumentFiles([]);
    setEditingMember(null);
    setIsDialogOpen(false);
  };

  const getStorageUrl = (path: string) => {
    return `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/company-files/${path}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Daftar Tim</h2>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          if (!open) resetForm();
          setIsDialogOpen(open);
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Tambah Anggota
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto w-full">
            <DialogHeader>
              <DialogTitle>{editingMember ? "Edit Anggota Tim" : "Tambah Anggota Tim"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Photo Upload */}
              <div className="flex flex-col items-center gap-4">
                <div className="relative h-24 w-24 rounded-full overflow-hidden border bg-muted flex items-center justify-center">
                  {photoFile ? (
                    <img
                      src={URL.createObjectURL(photoFile)}
                      alt="Preview"
                      className="h-full w-full object-cover"
                    />
                  ) : formData.photo_path ? (
                    <img
                      src={getStorageUrl(formData.photo_path)}
                      alt="Profile"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="photo-upload" className="cursor-pointer">
                    <div className="flex items-center gap-2 text-sm text-primary hover:underline">
                      <Upload className="h-4 w-4" />
                      Upload Foto
                    </div>
                  </Label>
                  <Input
                    id="photo-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                  />
                  {(photoFile || formData.photo_path) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setPhotoFile(null);
                        setFormData({ ...formData, photo_path: "" });
                      }}
                      className="h-8 w-8 p-0"
                    >
                      <X className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nama</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Nama lengkap"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="Email"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tempat Lahir</Label>
                  <Input
                    value={formData.birthplace}
                    onChange={(e) => setFormData({ ...formData, birthplace: e.target.value })}
                    placeholder="Tempat lahir"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tanggal Lahir</Label>
                  <Input
                    type="date"
                    value={formData.birthdate}
                    onChange={(e) => setFormData({ ...formData, birthdate: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Alamat</Label>
                <Textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Alamat lengkap"
                />
              </div>

              <div className="space-y-2">
                <Label>Jabatan</Label>
                <Input
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                  placeholder="Jabatan"
                />
              </div>

              <div className="space-y-2">
                <Label>Tanggal Gabung</Label>
                <Input
                  type="date"
                  value={formData.joining_date}
                  onChange={(e) => setFormData({ ...formData, joining_date: e.target.value })}
                />
              </div>

              {/* Login Access Section */}
              <Collapsible
                open={isAuthOpen}
                onOpenChange={setIsAuthOpen}
                className="border rounded-md p-4 space-y-2 bg-muted/30"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-medium">
                    <Shield className="h-4 w-4 text-primary" />
                    <span>Pengaturan Akses Login</span>
                  </div>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-9 p-0">
                      <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isAuthOpen ? "rotate-180" : ""}`} />
                      <span className="sr-only">Toggle</span>
                    </Button>
                  </CollapsibleTrigger>
                </div>
                <CollapsibleContent className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label>Role / Hak Akses</Label>
                    <Select
                      value={formData.role}
                      onValueChange={(val) => setFormData({ ...formData, role: val })}
                    >
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Pilih Role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="staff">Staff</SelectItem>
                        <SelectItem value="pimpinan">Pimpinan</SelectItem>
                        <SelectItem value="super_admin">Super Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Password Login</Label>
                    <div className="relative">
                      <Key className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        type={showPassword ? "text" : "password"}
                        className="pl-9 pr-10 bg-background"
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                        placeholder="Masukan password untuk user ini"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-9 w-9 px-0 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="sr-only">Toggle password visibility</span>
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      *Password ini digunakan untuk login. Username menggunakan <strong>Email</strong> di atas.
                    </p>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <div className="space-y-2">
                <Label>Upload Dokumen</Label>
                <Input
                  type="file"
                  multiple
                  onChange={(e) => setDocumentFiles(Array.from(e.target.files || []))}
                />
                {documentFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {documentFiles.map((file, idx) => (
                      <span key={idx} className="text-sm bg-muted px-2 py-1 rounded">
                        {file.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {editingMember && editingMember.documents.length > 0 && (
                <div className="space-y-2">
                  <Label>Dokumen Tersimpan</Label>
                  {editingMember.documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between bg-muted px-3 py-2 rounded">
                      <a
                        href={getStorageUrl(doc.file_path)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline flex items-center gap-1"
                      >
                        <FileText className="h-4 w-4" />
                        {doc.file_name}
                      </a>

                      <DeleteConfirmationDialog
                        onDelete={() => handleDeleteDocument(doc.id, doc.file_path)}
                        trigger={
                          <Button size="icon" variant="ghost">
                            <X className="h-4 w-4 text-destructive" />
                          </Button>
                        }
                      />
                    </div>
                  ))}
                </div>
              )}

              <Button onClick={handleSave} disabled={isLoading} className="w-full">
                {isLoading ? "Menyimpan..." : "Simpan"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">No</TableHead>
              <TableHead>Anggota Tim</TableHead>
              <TableHead>Jabatan</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Tanggal Gabung</TableHead>
              <TableHead>Dokumen</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isDataLoading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                  <TableCell>
                    <div className="flex items-start gap-4">
                      <Skeleton className="h-12 w-12 rounded-full" />
                      <div className="grid gap-1">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-40" />
                        <Skeleton className="h-3 w-48" />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Skeleton className="h-8 w-8" />
                      <Skeleton className="h-8 w-8" />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-destructive p-8">
                  Pastikan koneksi internet anda baik
                </TableCell>
              </TableRow>
            ) : members.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground p-8">
                  Belum ada anggota tim
                </TableCell>
              </TableRow>
            ) : (
              members.map((member, index) => (
                <TableRow key={member.id}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>
                    <div className="flex items-start gap-4">
                      {member.photo_path ? (
                        <img
                          src={getStorageUrl(member.photo_path)}
                          alt={member.name}
                          className="h-12 w-12 rounded-full object-cover border"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                          <span className="text-xs text-muted-foreground">No Img</span>
                        </div>
                      )}
                      <div className="grid gap-1">
                        <span className="font-semibold text-base leading-none">{member.name}</span>
                        <a href={`mailto:${member.email}`} className="text-sm text-muted-foreground hover:underline hover:text-blue-600">
                          {member.email}
                        </a>
                        <span className="text-xs text-muted-foreground">
                          {member.birthplace}, {member.birthdate && isValid(new Date(member.birthdate)) ? format(new Date(member.birthdate), "dd/MM/yyyy", { locale: id }) : "-"}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{member.position}</TableCell>
                  <TableCell>
                    <Badge variant={member.role === 'pimpinan' ? "default" : "secondary"} className="capitalize">
                      {member.role || 'staff'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {member.joining_date && isValid(new Date(member.joining_date)) ? format(new Date(member.joining_date), "dd/MM/yyyy", { locale: id }) : "-"}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {member.documents.map((doc, idx) => (
                        <a
                          key={doc.id}
                          href={getStorageUrl(doc.file_path)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-blue-600 hover:underline text-sm"
                        >
                          <LinkIcon className="h-3 w-3" />
                          data {idx + 1}
                        </a>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(member)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <DeleteConfirmationDialog onDelete={() => handleDelete(member.id)} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div >
  );
}
