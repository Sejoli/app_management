import { useNavigate } from "react-router-dom";
import { Building2, Users, Package, UserCircle, FileText } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const modules = [
  {
    title: "Requests",
    description: "Manage customer requests with deadlines and attachments",
    icon: FileText,
    route: "/requests",
    color: "text-primary"
  },
  {
    title: "Customers",
    description: "Manage customer companies, addresses, and contact information",
    icon: Building2,
    route: "/customers",
    color: "text-primary"
  },
  {
    title: "Customer PICs",
    description: "Manage person in charge contacts for each customer",
    icon: Users,
    route: "/customer-pics",
    color: "text-primary"
  },
  {
    title: "Vendors",
    description: "Manage vendor companies and supplier information",
    icon: Package,
    route: "/vendors",
    color: "text-primary"
  },
  {
    title: "Vendor PICs",
    description: "Manage person in charge contacts for each vendor",
    icon: UserCircle,
    route: "/vendor-pics",
    color: "text-primary"
  }
];

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            B2B Management System
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Comprehensive solution for managing your business relationships, customers, and vendors in one centralized platform
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 max-w-7xl mx-auto">
          {modules.map((module) => (
            <Card 
              key={module.route}
              className="hover:shadow-lg transition-shadow cursor-pointer border-border"
              onClick={() => navigate(module.route)}
            >
              <CardHeader>
                <div className="flex items-center justify-between mb-2">
                  <module.icon className={`h-8 w-8 ${module.color}`} />
                </div>
                <CardTitle className="text-foreground">{module.title}</CardTitle>
                <CardDescription className="text-muted-foreground">
                  {module.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(module.route);
                  }}
                >
                  Access Module
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-sm text-muted-foreground">
            Built with modern technology for scalability, reliability, and ease of use
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;
