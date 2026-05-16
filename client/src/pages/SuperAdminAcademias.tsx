import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Building2, 
  Users, 
  Search,
  Eye,
  Calendar,
  Mail,
  Phone
} from "lucide-react";
import { Link } from "wouter";
import type { Academy } from "@shared/schema";

export default function SuperAdminAcademias() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: academies, isLoading } = useQuery<Academy[]>({
    queryKey: ["/api/superadmin/academias"],
  });

  const filteredAcademies = academies?.filter(academy =>
    academy.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    academy.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
    academy.email?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Gerenciar Academias</h1>
          <p className="text-muted-foreground mt-2">
            Visualizar e gerenciar todas as academias cadastradas
          </p>
        </div>
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-muted rounded"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gerenciar Academias</h1>
          <p className="text-muted-foreground mt-2">
            Visualizar e gerenciar todas as academias cadastradas na plataforma
          </p>
        </div>
        <Button asChild>
          <Link href="/superadmin/dashboard" data-testid="button-back-dashboard">
            Voltar ao Dashboard
          </Link>
        </Button>
      </div>

      {/* Stats Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Academias</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="total-academies">
              {academies?.length || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Com Email</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {academies?.filter(a => a.email).length || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Com Telefone</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {academies?.filter(a => a.phone).length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Buscar Academias</CardTitle>
          <CardDescription>
            Pesquise por nome, slug ou email da academia
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar academias..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-search-academies"
            />
          </div>
        </CardContent>
      </Card>

      {/* Academies Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Academias</CardTitle>
          <CardDescription>
            {filteredAcademies.length} academias encontradas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Academia</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Cadastro</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAcademies.map((academy) => (
                <TableRow key={academy.id} data-testid={`row-academy-${academy.id}`}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{academy.name}</div>
                      <div className="text-sm text-muted-foreground">
                        /{academy.slug}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {academy.email && (
                        <div className="flex items-center gap-1 text-sm">
                          <Mail className="h-3 w-3" />
                          {academy.email}
                        </div>
                      )}
                      {academy.phone && (
                        <div className="flex items-center gap-1 text-sm">
                          <Phone className="h-3 w-3" />
                          {academy.phone}
                        </div>
                      )}
                      {!academy.email && !academy.phone && (
                        <span className="text-sm text-muted-foreground">
                          Sem contato
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      <Calendar className="h-3 w-3" />
                      {academy.createdAt ? new Date(academy.createdAt).toLocaleDateString('pt-BR') : 'N/A'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                      Ativa
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      asChild 
                      variant="outline" 
                      size="sm"
                      data-testid={`button-view-academy-${academy.id}`}
                    >
                      <Link href={`/superadmin/academias/${academy.id}`}>
                        <Eye className="h-4 w-4 mr-2" />
                        Ver Detalhes
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filteredAcademies.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <Building2 className="h-8 w-8 text-muted-foreground" />
                      <div className="text-sm text-muted-foreground">
                        {searchTerm ? 'Nenhuma academia encontrada' : 'Nenhuma academia cadastrada'}
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}