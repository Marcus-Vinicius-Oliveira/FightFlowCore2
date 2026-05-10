import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Search, UserPlus, Edit, Trash2, Eye } from "lucide-react";
import { apiClient, type Student } from "@/lib/api";

interface StudentTableRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  active: boolean;
  createdAt: string;
}

interface StudentTableProps {
  onAddStudent?: () => void;
  onEditStudent?: (student: StudentTableRow) => void;
  onViewStudent?: (student: StudentTableRow) => void;
  onDeleteStudent?: (student: StudentTableRow) => void;
}

export function StudentTable({
  onAddStudent,
  onEditStudent,
  onViewStudent,
  onDeleteStudent,
}: StudentTableProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: studentsData = [] } = useQuery<Student[]>({
    queryKey: ['students'],
    queryFn: () => apiClient.getStudents(),
  });

  const students: StudentTableRow[] = studentsData.map(s => ({
    id: s.id,
    name: s.name,
    email: s.email,
    phone: s.phone ?? '',
    active: s.active ?? true,
    createdAt: s.createdAt ?? '',
  }));

  const filteredStudents = students.filter(student =>
    student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (active: boolean) => (
    <Badge
      variant={active ? 'default' : 'secondary'}
      data-testid={`badge-status-${active ? 'active' : 'inactive'}`}
    >
      {active ? 'Ativo' : 'Inativo'}
    </Badge>
  );

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase();

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle>Alunos</CardTitle>
            <CardDescription>Gerencie os alunos da academia</CardDescription>
          </div>
          <Button onClick={() => onAddStudent?.()} data-testid="button-add-student">
            <UserPlus className="mr-2 h-4 w-4" />
            Adicionar Aluno
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar alunos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="input-student-search"
          />
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Aluno</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Cadastro</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStudents.map((student) => (
                <TableRow key={student.id} data-testid={`row-student-${student.id}`}>
                  <TableCell className="font-medium">
                    <div className="flex items-center space-x-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage alt={student.name} />
                        <AvatarFallback className="text-xs">
                          {getInitials(student.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span data-testid={`text-student-name-${student.id}`}>{student.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div data-testid={`text-student-email-${student.id}`}>{student.email}</div>
                      <div className="text-muted-foreground">{student.phone}</div>
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(student.active)}</TableCell>
                  <TableCell data-testid={`text-join-date-${student.id}`}>
                    {student.createdAt ? new Date(student.createdAt).toLocaleDateString('pt-BR') : '-'}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          data-testid={`button-student-actions-${student.id}`}
                        >
                          <span className="sr-only">Abrir menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => onViewStudent?.(student)}
                          data-testid={`button-view-student-${student.id}`}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          Ver Detalhes
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onEditStudent?.(student)}
                          data-testid={`button-edit-student-${student.id}`}
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => onDeleteStudent?.(student)}
                          data-testid={`button-delete-student-${student.id}`}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Remover
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {filteredStudents.length === 0 && (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Nenhum aluno encontrado</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
