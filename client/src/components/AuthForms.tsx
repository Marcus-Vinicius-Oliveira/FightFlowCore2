import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, EyeOff, Shield } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface LoginFormProps {
  onSuccess?: () => void;
}

interface SignupFormProps {
  onSuccess?: () => void;
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoggingIn } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    login({ email, password }, {
      onSuccess: () => {
        onSuccess?.();
      }
    });
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
          <Shield className="h-12 w-12 text-primary" />
        </div>
        <CardTitle className="text-2xl">Welcome Back</CardTitle>
        <CardDescription>
          Sign in to your academy management account
        </CardDescription>
      </CardHeader>
      
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="admin@academy.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              data-testid="input-login-email"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                data-testid="input-login-password"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8"
                onClick={() => setShowPassword(!showPassword)}
                data-testid="button-toggle-password"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardContent>
        
        <CardFooter className="flex flex-col space-y-4">
          <Button 
            type="submit" 
            className="w-full" 
            disabled={isLoggingIn}
            data-testid="button-login-submit"
          >
            {isLoggingIn ? "Signing In..." : "Sign In"}
          </Button>
          
          <div className="text-sm text-center">
            <a href="#" className="text-primary hover:underline">
              Forgot your password?
            </a>
          </div>
        </CardFooter>
      </form>
    </Card>
  );
}

export function SignupForm({ onSuccess }: SignupFormProps) {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    name: "",
    role: "",
    academyName: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const { signup, isSigningUp } = useAuth();

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      // This should show a proper error message
      return;
    }
    
    signup({
      name: formData.name,
      email: formData.email,
      password: formData.password,
      role: formData.role as 'ADMIN_ACADEMIA' | 'PROFESSOR' | 'ALUNO',
      academyName: formData.academyName || undefined
    }, {
      onSuccess: () => {
        onSuccess?.();
      }
    });
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
          <Shield className="h-12 w-12 text-primary" />
        </div>
        <CardTitle className="text-2xl">Create Account</CardTitle>
        <CardDescription>
          Start managing your martial arts academy
        </CardDescription>
      </CardHeader>
      
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="signup-name">Full Name</Label>
            <Input
              id="signup-name"
              type="text"
              placeholder="John Silva"
              value={formData.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              required
              data-testid="input-signup-name"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="signup-email">Email</Label>
            <Input
              id="signup-email"
              type="email"
              placeholder="admin@academy.com"
              value={formData.email}
              onChange={(e) => handleInputChange("email", e.target.value)}
              required
              data-testid="input-signup-email"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select value={formData.role} onValueChange={(value) => handleInputChange("role", value)}>
              <SelectTrigger data-testid="select-role">
                <SelectValue placeholder="Select your role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ADMIN_ACADEMIA">Academy Administrator</SelectItem>
                <SelectItem value="PROFESSOR">Professor/Instructor</SelectItem>
                <SelectItem value="ALUNO">Student</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {formData.role === "ADMIN_ACADEMIA" && (
            <div className="space-y-2">
              <Label htmlFor="academy-name">Academy Name</Label>
              <Input
                id="academy-name"
                type="text"
                placeholder="Dragon Martial Arts Academy"
                value={formData.academyName}
                onChange={(e) => handleInputChange("academyName", e.target.value)}
                required
                data-testid="input-academy-name"
              />
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="signup-password">Password</Label>
            <div className="relative">
              <Input
                id="signup-password"
                type={showPassword ? "text" : "password"}
                placeholder="Create a strong password"
                value={formData.password}
                onChange={(e) => handleInputChange("password", e.target.value)}
                required
                data-testid="input-signup-password"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8"
                onClick={() => setShowPassword(!showPassword)}
                data-testid="button-toggle-signup-password"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm Password</Label>
            <Input
              id="confirm-password"
              type="password"
              placeholder="Confirm your password"
              value={formData.confirmPassword}
              onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
              required
              data-testid="input-confirm-password"
            />
          </div>
        </CardContent>
        
        <CardFooter>
          <Button 
            type="submit" 
            className="w-full" 
            disabled={isSigningUp}
            data-testid="button-signup-submit"
          >
            {isSigningUp ? "Creating Account..." : "Create Account"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

export function AuthTabs() {
  return (
    <div className="w-full max-w-md mx-auto">
      <Tabs defaultValue="login" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="login" data-testid="tab-login">Login</TabsTrigger>
          <TabsTrigger value="signup" data-testid="tab-signup">Sign Up</TabsTrigger>
        </TabsList>
        <TabsContent value="login">
          <LoginForm onSuccess={() => console.log('Login successful')} />
        </TabsContent>
        <TabsContent value="signup">
          <SignupForm onSuccess={() => console.log('Signup successful')} />
        </TabsContent>
      </Tabs>
    </div>
  );
}