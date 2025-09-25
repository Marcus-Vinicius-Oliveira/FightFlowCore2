import { AuthTabs } from "@/components/AuthForms";
import { Swords } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function AuthPage() {
  return (
    <div className="min-h-screen bg-muted/50 flex items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Swords className="h-12 w-12 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Fight Club App Management</h1>
          <p className="text-muted-foreground mt-2">
            Professional martial arts academy platform
          </p>
        </div>
        
        {/* Auth Forms */}
        <AuthTabs />
      </div>
    </div>
  );
}