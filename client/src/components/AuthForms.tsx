import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, EyeOff, Shield } from "lucide-react";
import { SiGoogle } from "react-icons/si";
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
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="admin@academia.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              data-testid="input-login-email"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="password" className="password-label-spacing">Senha</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Digite sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="password-input-padding"
                data-testid="input-login-password"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="password-icon-position h-8 w-8"
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
            {isLoggingIn ? "Entrando..." : "Entrar"}
          </Button>
          
          <div className="text-sm text-center">
            <a href="#" className="text-primary hover:underline">
              Esqueceu sua senha?
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
  const [passwordStrength, setPasswordStrength] = useState({ score: 0, text: "", color: "" });
  const { signup, isSigningUp } = useAuth();

  const calculatePasswordStrength = (password: string) => {
    if (!password) return { score: 0, text: "", color: "" };
    
    let score = 0;
    const checks = {
      length: password.length >= 8,
      lowercase: /[a-z]/.test(password),
      uppercase: /[A-Z]/.test(password),
      numbers: /\d/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
    };
    
    // Calculate score based on criteria
    if (checks.length) score += 20;
    if (checks.lowercase) score += 20;
    if (checks.uppercase) score += 20;
    if (checks.numbers) score += 20;
    if (checks.special) score += 20;
    
    // Determine strength level
    if (score < 40) {
      return { score, text: "Muito fraca", color: "bg-red-500" };
    } else if (score < 60) {
      return { score, text: "Fraca", color: "bg-orange-500" };
    } else if (score < 80) {
      return { score, text: "Boa", color: "bg-yellow-500" };
    } else if (score < 100) {
      return { score, text: "Forte", color: "bg-green-500" };
    } else {
      return { score, text: "Muito forte", color: "bg-green-600" };
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Update password strength when password changes
    if (field === "password") {
      const strength = calculatePasswordStrength(value);
      setPasswordStrength(strength);
    }
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
        <CardTitle className="text-2xl">Criar Conta</CardTitle>
      </CardHeader>
      
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="signup-name">Nome Completo</Label>
            <Input
              id="signup-name"
              type="text"
              placeholder="João Silva"
              value={formData.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              required
              data-testid="input-signup-name"
            />
            <p className="error-message" data-testid="error-name"></p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="signup-email">Email</Label>
            <Input
              id="signup-email"
              type="email"
              placeholder="admin@academia.com"
              value={formData.email}
              onChange={(e) => handleInputChange("email", e.target.value)}
              required
              data-testid="input-signup-email"
            />
            <p className="error-message" data-testid="error-email"></p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="role">Função</Label>
            <Select value={formData.role} onValueChange={(value) => handleInputChange("role", value)}>
              <SelectTrigger data-testid="select-role">
                <SelectValue placeholder="Selecione sua função" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ADMIN_ACADEMIA">Administrador da Academia</SelectItem>
                <SelectItem value="PROFESSOR">Professor/Instrutor</SelectItem>
                <SelectItem value="ALUNO">Aluno</SelectItem>
              </SelectContent>
            </Select>
            <p className="error-message" data-testid="error-role"></p>
          </div>
          
          {formData.role === "ADMIN_ACADEMIA" && (
            <div className="space-y-2">
              <Label htmlFor="academy-name">Nome da Academia</Label>
              <Input
                id="academy-name"
                type="text"
                placeholder="Academia Dragão de Artes Marciais"
                value={formData.academyName}
                onChange={(e) => handleInputChange("academyName", e.target.value)}
                required
                data-testid="input-academy-name"
              />
              <p className="error-message" data-testid="error-academy-name"></p>
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="signup-password" className="password-label-spacing">Senha</Label>
            <div className="relative">
              <Input
                id="signup-password"
                type={showPassword ? "text" : "password"}
                placeholder="Crie uma senha forte"
                value={formData.password}
                onChange={(e) => handleInputChange("password", e.target.value)}
                required
                className="password-input-padding"
                data-testid="input-signup-password"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="password-icon-position h-8 w-8"
                onClick={() => setShowPassword(!showPassword)}
                data-testid="button-toggle-signup-password"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="error-message" data-testid="error-password"></p>
            
            {/* Password Strength Meter */}
            {formData.password && (
              <div className="mt-2 space-y-2" data-testid="password-strength-meter">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Força da senha:</span>
                  <span className={`text-xs font-medium ${
                    passwordStrength.score < 40 ? "text-red-600" :
                    passwordStrength.score < 60 ? "text-orange-600" :
                    passwordStrength.score < 80 ? "text-yellow-600" :
                    "text-green-600"
                  }`}>
                    {passwordStrength.text}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 ${passwordStrength.color}`}
                    style={{ width: `${passwordStrength.score}%` }}
                  ></div>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div className="grid grid-cols-1 gap-1">
                    <div className={`flex items-center gap-1 ${
                      formData.password.length >= 8 ? "text-green-600" : "text-gray-400"
                    }`}>
                      <span className="text-xs">{formData.password.length >= 8 ? "✓" : "○"}</span>
                      <span>Pelo menos 8 caracteres</span>
                    </div>
                    <div className={`flex items-center gap-1 ${
                      /[A-Z]/.test(formData.password) ? "text-green-600" : "text-gray-400"
                    }`}>
                      <span className="text-xs">{/[A-Z]/.test(formData.password) ? "✓" : "○"}</span>
                      <span>Letra maiúscula</span>
                    </div>
                    <div className={`flex items-center gap-1 ${
                      /\d/.test(formData.password) ? "text-green-600" : "text-gray-400"
                    }`}>
                      <span className="text-xs">{/\d/.test(formData.password) ? "✓" : "○"}</span>
                      <span>Número</span>
                    </div>
                    <div className={`flex items-center gap-1 ${
                      /[!@#$%^&*(),.?":{}|<>]/.test(formData.password) ? "text-green-600" : "text-gray-400"
                    }`}>
                      <span className="text-xs">{/[!@#$%^&*(),.?":{}|<>]/.test(formData.password) ? "✓" : "○"}</span>
                      <span>Caractere especial</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirmar Senha</Label>
            <Input
              id="confirm-password"
              type="password"
              placeholder="Confirme sua senha"
              value={formData.confirmPassword}
              onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
              required
              data-testid="input-confirm-password"
            />
            <p className="error-message" data-testid="error-confirm-password"></p>
          </div>
        </CardContent>
        
        <CardFooter className="flex flex-col space-y-4">
          {/* Google Sign-up Button */}
          <Button 
            type="button" 
            variant="outline" 
            className="w-full bg-white hover:bg-gray-50 border-gray-300 text-gray-700 dark:bg-white dark:hover:bg-gray-50 dark:text-gray-700"
            data-testid="button-signup-google"
            onClick={() => {}}
          >
            <SiGoogle className="mr-2 h-4 w-4" />
            Cadastrar com o Google
          </Button>
          
          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">ou</span>
            </div>
          </div>
          
          {/* Terms of Service Text */}
          <p className="text-xs text-center text-muted-foreground">
            Ao criar sua conta, você concorda com nossos{" "}
            <a href="/termos" className="text-primary hover:underline">
              Termos de Serviço
            </a>
            {" "}e{" "}
            <a href="/privacidade" className="text-primary hover:underline">
              Política de Privacidade
            </a>
          </p>
          
          {/* Main Submit Button */}
          <Button 
            type="submit" 
            className="w-full" 
            disabled={isSigningUp}
            data-testid="button-signup-submit"
          >
            {isSigningUp ? "Criando Conta..." : "Criar Conta"}
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
          <TabsTrigger value="login" data-testid="tab-login">Entrar</TabsTrigger>
          <TabsTrigger value="signup" data-testid="tab-signup">Cadastrar</TabsTrigger>
        </TabsList>
        <TabsContent value="login">
          <LoginForm onSuccess={() => {}} />
        </TabsContent>
        <TabsContent value="signup">
          <SignupForm onSuccess={() => {}} />
        </TabsContent>
      </Tabs>
    </div>
  );
}