import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./ThemeToggle";
import { Menu, X, Shield } from "lucide-react";
import { useLocation } from "wouter";

export function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [, setLocation] = useLocation();

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
    console.log('Mobile menu toggled:', !isMenuOpen);
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center space-x-2">
            <Shield className="h-8 w-8 text-primary" />
            <span className="font-bold text-xl">Centro de Lutas</span>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            <button
              onClick={() => setLocation('/recursos')}
              className="text-muted-foreground hover:text-foreground transition-colors"
              data-testid="link-recursos-desktop"
            >
              Recursos
            </button>
            <button
              onClick={() => setLocation('/precos')}
              className="text-muted-foreground hover:text-foreground transition-colors"
              data-testid="link-precos-desktop"
            >
              Preços
            </button>
            <button
              onClick={() => setLocation('/sobre')}
              className="text-muted-foreground hover:text-foreground transition-colors"
              data-testid="link-sobre-desktop"
            >
              Sobre
            </button>
          </div>

          {/* Actions */}
          <div className="hidden md:flex items-center space-x-4">
            <Button 
              variant="ghost"
              data-testid="button-login"
              onClick={() => {
                console.log('Login clicked');
                setLocation('/login');
              }}
            >
              Entrar
            </Button>
            <Button 
              data-testid="button-signup"
              onClick={() => {
                console.log('Sign up clicked');
                setLocation('/cadastro');
              }}
            >
              Cadastrar
            </Button>
            <ThemeToggle />
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center space-x-2">
            <ThemeToggle />
            <Button 
              variant="ghost" 
              size="icon"
              onClick={toggleMenu}
              data-testid="button-mobile-menu"
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t">
            <div className="flex flex-col space-y-4">
              <button
                onClick={() => {
                  setLocation('/recursos');
                  setIsMenuOpen(false);
                }}
                className="text-muted-foreground hover:text-foreground transition-colors text-left"
                data-testid="link-recursos-mobile"
              >
                Recursos
              </button>
              <button
                onClick={() => {
                  setLocation('/precos');
                  setIsMenuOpen(false);
                }}
                className="text-muted-foreground hover:text-foreground transition-colors text-left"
                data-testid="link-precos-mobile"
              >
                Preços
              </button>
              <button
                onClick={() => {
                  setLocation('/sobre');
                  setIsMenuOpen(false);
                }}
                className="text-muted-foreground hover:text-foreground transition-colors text-left"
                data-testid="link-sobre-mobile"
              >
                Sobre
              </button>
              <div className="flex flex-col space-y-2 pt-4 border-t">
                <Button 
                  variant="ghost"
                  data-testid="button-mobile-login"
                  onClick={() => {
                    console.log('Mobile Login clicked');
                    setLocation('/login');
                    setIsMenuOpen(false);
                  }}
                >
                  Entrar
                </Button>
                <Button 
                  data-testid="button-mobile-signup"
                  onClick={() => {
                    console.log('Mobile Sign up clicked');
                    setLocation('/cadastro');
                    setIsMenuOpen(false);
                  }}
                >
                  Cadastrar
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}