import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CompanyTab from "@/components/company/CompanyTab";
import TeamTab from "@/components/company/TeamTab";
import AccessControlTab from "@/components/company/AccessControlTab";

export default function CompanyManagement() {
  return (
    <div className="container mx-auto py-6 space-y-6">


      <Tabs defaultValue="company" className="w-full">
        <TabsList>
          <TabsTrigger value="company">Perusahaan</TabsTrigger>
          <TabsTrigger value="team">Tim</TabsTrigger>
          <TabsTrigger value="access">Hak Akses</TabsTrigger>
        </TabsList>

        <TabsContent value="company" className="mt-6">
          <CompanyTab />
        </TabsContent>

        <TabsContent value="team" className="mt-6">
          <TeamTab />
        </TabsContent>

        <TabsContent value="access" className="mt-6">
          <AccessControlTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
