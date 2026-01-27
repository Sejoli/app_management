import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, X, FileText, Image, ChevronDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";

interface Company {
  id: string;
  name: string;
  abbreviation: string;
  address: string;
  phone: string;
  npwp: string;
  logo_path: string | null;
  npwp_document_path: string | null;
  profile_document_path: string | null;
  email: string | null;
  instagram: string | null;
  facebook: string | null;
  linkedin: string | null;
  youtube: string | null;
  bank_name: string | null;
  account_number: string | null;
  account_name: string | null;
}

interface ProductDocument {
  id: string;
  file_name: string;
  file_path: string;
}

export default function CompanyTab() {
  const [company, setCompany] = useState<Company | null>(null);
  const [productDocuments, setProductDocuments] = useState<ProductDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [isSocialMediaOpen, setIsSocialMediaOpen] = useState(false);
  const [isDocumentsOpen, setIsDocumentsOpen] = useState(false);
  const [isBankInfoOpen, setIsBankInfoOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    abbreviation: "",
    address: "",
    phone: "",
    npwp: "",
    email: "",
    instagram: "",
    facebook: "",
    linkedin: "",
    youtube: "",
    bank_name: "",
    account_number: "",
    account_name: "",
  });

  // File states
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [npwpDocFile, setNpwpDocFile] = useState<File | null>(null);
  const [profileDocFile, setProfileDocFile] = useState<File | null>(null);
  const [productFiles, setProductFiles] = useState<File[]>([]);

  useEffect(() => {
    fetchCompany();
  }, []);

  const fetchCompany = async () => {
    setIsDataLoading(true);
    const { data, error } = await supabase
      .from("company")
      .select("*")
      .maybeSingle();

    if (error) {
      console.error(error);
      setIsDataLoading(false);
      return;
    }

    if (data) {
      setCompany(data);
      setFormData({
        name: data.name,
        abbreviation: data.abbreviation,
        address: data.address,
        phone: data.phone,
        npwp: data.npwp,
        email: data.email || "",
        instagram: data.instagram || "",
        facebook: data.facebook || "",
        linkedin: data.linkedin || "",
        youtube: data.youtube || "",
        bank_name: data.bank_name || "",
        account_number: data.account_number || "",
        account_name: data.account_name || "",
      });

      // Fetch product documents
      const { data: docs } = await supabase
        .from("company_product_documents")
        .select("*")
        .eq("company_id", data.id);

      if (docs) {
        setProductDocuments(docs);
      }
    }
    setIsDataLoading(false);
  };

  const uploadFile = async (file: File, folder: string): Promise<string | null> => {
    const fileExt = file.name.split(".").pop();
    const fileName = `${folder}/${Date.now()}.${fileExt}`;

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
    if (!formData.name || !formData.abbreviation || !formData.address || !formData.phone || !formData.npwp) {
      toast.error("Semua field wajib diisi");
      return;
    }

    setIsLoading(true);

    try {
      let logoPath = company?.logo_path || null;
      let npwpDocPath = company?.npwp_document_path || null;
      let profileDocPath = company?.profile_document_path || null;

      // Upload logo if changed
      if (logoFile) {
        const path = await uploadFile(logoFile, "logo");
        if (path) logoPath = path;
      }

      // Upload NPWP document if changed
      if (npwpDocFile) {
        const path = await uploadFile(npwpDocFile, "npwp");
        if (path) npwpDocPath = path;
      }

      // Upload profile document if changed
      if (profileDocFile) {
        const path = await uploadFile(profileDocFile, "profile");
        if (path) profileDocPath = path;
      }

      const companyData = {
        ...formData,
        logo_path: logoPath,
        npwp_document_path: npwpDocPath,
        profile_document_path: profileDocPath,
      };

      let companyId = company?.id;

      if (company) {
        const { error } = await supabase
          .from("company")
          .update(companyData)
          .eq("id", company.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("company")
          .insert(companyData)
          .select()
          .single();

        if (error) throw error;
        companyId = data.id;
      }

      // Upload product documents
      if (productFiles.length > 0 && companyId) {
        for (const file of productFiles) {
          const path = await uploadFile(file, "products");
          if (path) {
            await supabase.from("company_product_documents").insert({
              company_id: companyId,
              file_name: file.name,
              file_path: path,
              file_size: file.size,
            });
          }
        }
      }

      toast.success("Data perusahaan berhasil disimpan");
      setLogoFile(null);
      setNpwpDocFile(null);
      setProfileDocFile(null);
      setProductFiles([]);
      fetchCompany();
    } catch (error) {
      console.error(error);
      toast.error("Gagal menyimpan data perusahaan");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteProductDoc = async (docId: string, filePath: string) => {
    await supabase.storage.from("company-files").remove([filePath]);
    await supabase.from("company_product_documents").delete().eq("id", docId);
    toast.success("Dokumen berhasil dihapus");
    fetchCompany();
  };

  const getStorageUrl = (path: string) => {
    return `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/company-files/${path}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Data Perusahaan</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Logo Upload */}
        {isDataLoading ? (
          <div className="space-y-6">
            <div className="space-y-2">
              <Skeleton className="h-5 w-32" />
              <div className="flex items-center gap-4">
                <Skeleton className="h-16 w-16 rounded" />
                <Skeleton className="h-10 flex-1" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
            <div className="space-y-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-24 w-full" />
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label>Logo Perusahaan</Label>
              <div className="flex items-center gap-4">
                {company?.logo_path && (
                  <img
                    src={getStorageUrl(company.logo_path)}
                    alt="Logo"
                    className="h-16 w-16 object-contain border rounded"
                  />
                )}
                <div className="flex-1">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                  />
                  {logoFile && (
                    <p className="text-sm text-muted-foreground mt-1">
                      <Image className="h-3 w-3 inline mr-1" />
                      {logoFile.name}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nama Perusahaan</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nama perusahaan"
                />
              </div>
              <div className="space-y-2">
                <Label>Singkatan</Label>
                <Input
                  value={formData.abbreviation}
                  onChange={(e) => setFormData({ ...formData, abbreviation: e.target.value })}
                  placeholder="Singkatan nama"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Alamat</Label>
              <Textarea
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Alamat perusahaan"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>No. HP</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="Nomor telepon"
                />
              </div>
              <div className="space-y-2">
                <Label>NPWP</Label>
                <Input
                  value={formData.npwp}
                  onChange={(e) => setFormData({ ...formData, npwp: e.target.value })}
                  placeholder="NPWP"
                />
              </div>
            </div>

            <Collapsible
              open={isSocialMediaOpen}
              onOpenChange={setIsSocialMediaOpen}
              className="space-y-4 border rounded-md p-4"
            >
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">Media Sosial & Kontak Tambahan</Label>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-9 p-0">
                    <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isSocialMediaOpen ? "rotate-180" : ""}`} />
                    <span className="sr-only">Toggle</span>
                  </Button>
                </CollapsibleTrigger>
              </div>
              <CollapsibleContent className="space-y-4 pt-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="Email perusahaan"
                      type="email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Instagram</Label>
                    <Input
                      value={formData.instagram}
                      onChange={(e) => setFormData({ ...formData, instagram: e.target.value })}
                      placeholder="Link Instagram"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Facebook</Label>
                    <Input
                      value={formData.facebook}
                      onChange={(e) => setFormData({ ...formData, facebook: e.target.value })}
                      placeholder="Link Facebook"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>LinkedIn</Label>
                    <Input
                      value={formData.linkedin}
                      onChange={(e) => setFormData({ ...formData, linkedin: e.target.value })}
                      placeholder="Link LinkedIn"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>YouTube</Label>
                    <Input
                      value={formData.youtube}
                      onChange={(e) => setFormData({ ...formData, youtube: e.target.value })}
                      placeholder="Link YouTube"
                    />
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>




            <Collapsible
              open={isDocumentsOpen}
              onOpenChange={setIsDocumentsOpen}
              className="space-y-4 border rounded-md p-4"
            >
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">File Dokumen</Label>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-9 p-0">
                    <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isDocumentsOpen ? "rotate-180" : ""}`} />
                    <span className="sr-only">Toggle</span>
                  </Button>
                </CollapsibleTrigger>
              </div>
              <CollapsibleContent className="space-y-4 pt-2">
                {/* NPWP Document Upload */}
                <div className="space-y-2">
                  <Label>Dokumen NPWP</Label>
                  <div className="space-y-2">
                    <Input
                      type="file"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      onChange={(e) => setNpwpDocFile(e.target.files?.[0] || null)}
                    />
                    {npwpDocFile && (
                      <p className="text-sm text-muted-foreground">
                        <FileText className="h-3 w-3 inline mr-1" />
                        {npwpDocFile.name}
                      </p>
                    )}

                    {company?.npwp_document_path && (
                      <div className="mt-2 space-y-2">
                        <div className="flex items-center justify-between bg-muted px-3 py-2 rounded">
                          <a
                            href={getStorageUrl(company.npwp_document_path)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline flex items-center gap-1"
                          >
                            <FileText className="h-4 w-4" />
                            Dokumen NPWP
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Profile Document Upload */}
                <div className="space-y-2">
                  <Label>Dokumen Company Profile</Label>
                  <div className="space-y-2">
                    <Input
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={(e) => setProfileDocFile(e.target.files?.[0] || null)}
                    />
                    {profileDocFile && (
                      <p className="text-sm text-muted-foreground">
                        <FileText className="h-3 w-3 inline mr-1" />
                        {profileDocFile.name}
                      </p>
                    )}

                    {company?.profile_document_path && (
                      <div className="mt-2 space-y-2">
                        <div className="flex items-center justify-between bg-muted px-3 py-2 rounded">
                          <a
                            href={getStorageUrl(company.profile_document_path)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline flex items-center gap-1"
                          >
                            <FileText className="h-4 w-4" />
                            Company Profile
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Product List Documents */}
                <div className="space-y-2">
                  <Label>Product List</Label>
                  <Input
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx"
                    multiple
                    onChange={(e) => setProductFiles(Array.from(e.target.files || []))}
                  />
                  {productFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {productFiles.map((file, idx) => (
                        <span key={idx} className="text-sm bg-muted px-2 py-1 rounded">
                          {file.name}
                        </span>
                      ))}
                    </div>
                  )}

                  {productDocuments.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {productDocuments.map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between bg-muted px-3 py-2 rounded">
                          <a
                            href={getStorageUrl(doc.file_path)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline flex items-center gap-1"
                          >
                            <FileText className="h-4 w-4" />
                            {doc.file_name}
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Collapsible
              open={isBankInfoOpen}
              onOpenChange={setIsBankInfoOpen}
              className="space-y-4 border rounded-md p-4"
            >
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">Informasi Bank</Label>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-9 p-0">
                    <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isBankInfoOpen ? "rotate-180" : ""}`} />
                    <span className="sr-only">Toggle</span>
                  </Button>
                </CollapsibleTrigger>
              </div>
              <CollapsibleContent className="space-y-4 pt-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nama Bank</Label>
                    <Input
                      value={formData.bank_name}
                      onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                      placeholder="Contoh: BCA"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Atas Nama (Account Name)</Label>
                    <Input
                      value={formData.account_name}
                      onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
                      placeholder="Nama pemilik rekening"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Nomor Rekening</Label>
                    <Input
                      value={formData.account_number}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "" || /^\d+$/.test(val)) {
                          setFormData({ ...formData, account_number: val });
                        }
                      }}
                      placeholder="Nomor rekening (angka saja)"
                      type="text"
                      inputMode="numeric"
                    />
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </>
        )}
        <Button onClick={handleSave} disabled={isLoading} className="w-full">
          {isLoading ? "Menyimpan..." : "Simpan"}
        </Button>
      </CardContent>
    </Card>
  );
}
