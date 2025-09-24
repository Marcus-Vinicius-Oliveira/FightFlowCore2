import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Search, UserPlus, Edit, Trash2, Eye } from "lucide-react";

interface Student {
  id: string;
  name: string;
  email: string;
  phone: string;
  membershipPlan: string;
  status: "active" | "inactive" | "suspended";
  joinDate: string;
  lastPayment: string;
  avatar?: string;
}

interface StudentTableProps {
  onAddStudent?: () => void;
  onEditStudent?: (student: Student) => void;
  onViewStudent?: (student: Student) => void;
  onDeleteStudent?: (student: Student) => void;
}

export function StudentTable({ 
  onAddStudent, 
  onEditStudent, 
  onViewStudent, 
  onDeleteStudent 
}: StudentTableProps) {
  const [searchTerm, setSearchTerm] = useState("");

  // TODO: Remove mock data - replace with real data from API
  const mockStudents: Student[] = [
    {
      id: "1",
      name: "Carlos Silva",
      email: "carlos@email.com",
      phone: "(11) 99999-1111",
      membershipPlan: "Monthly 3x/week",
      status: "active",
      joinDate: "2024-01-15",
      lastPayment: "2024-09-01",
    },
    {
      id: "2",
      name: "Ana Costa",
      email: "ana@email.com",
      phone: "(11) 99999-2222",
      membershipPlan: "Weekly Unlimited",
      status: "active",
      joinDate: "2024-02-20",
      lastPayment: "2024-09-01",
    },
    {
      id: "3",
      name: "João Santos",
      email: "joao@email.com",
      phone: "(11) 99999-3333",
      membershipPlan: "Monthly 2x/week",
      status: "inactive",
      joinDate: "2023-12-10",
      lastPayment: "2024-08-01",
    },
    {
      id: "4",
      name: "Maria Oliveira",
      email: "maria@email.com",
      phone: "(11) 99999-4444",
      membershipPlan: "Monthly 3x/week",
      status: "suspended",
      joinDate: "2024-03-05",
      lastPayment: "2024-07-15",
    },
    {
      id: "5",
      name: "Pedro Lima",
      email: "pedro@email.com",
      phone: "(11) 99999-5555",
      membershipPlan: "Weekly Unlimited",
      status: "active",
      joinDate: "2024-04-12",
      lastPayment: "2024-09-01",
    },
  ];

  const filteredStudents = mockStudents.filter(student =>
    student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: Student["status"]) => {
    const variants = {
      active: "default",
      inactive: "secondary",
      suspended: "destructive",
    } as const;

    return (
      <Badge variant={variants[status]} data-testid={`badge-status-${status}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle>Students</CardTitle>
            <CardDescription>
              Manage your academy students and their memberships
            </CardDescription>
          </div>
          <Button onClick={() => onAddStudent?.()} data-testid="button-add-student">
            <UserPlus className="mr-2 h-4 w-4" />
            Add Student
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search students..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="input-student-search"
          />
        </div>

        {/* Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Membership</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Join Date</TableHead>
                <TableHead>Last Payment</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStudents.map((student) => (
                <TableRow key={student.id} data-testid={`row-student-${student.id}`}>
                  <TableCell className="font-medium">
                    <div className="flex items-center space-x-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={student.avatar} alt={student.name} />
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
                  <TableCell data-testid={`text-membership-${student.id}`}>
                    {student.membershipPlan}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(student.status)}
                  </TableCell>
                  <TableCell data-testid={`text-join-date-${student.id}`}>
                    {new Date(student.joinDate).toLocaleDateString()}
                  </TableCell>
                  <TableCell data-testid={`text-last-payment-${student.id}`}>
                    {new Date(student.lastPayment).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          className="h-8 w-8 p-0"
                          data-testid={`button-student-actions-${student.id}`}
                        >
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem 
                          onClick={() => {
                            console.log('View student:', student);
                            onViewStudent?.(student);
                          }}
                          data-testid={`button-view-student-${student.id}`}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => {
                            console.log('Edit student:', student);
                            onEditStudent?.(student);
                          }}
                          data-testid={`button-edit-student-${student.id}`}
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-destructive"
                          onClick={() => {
                            console.log('Delete student:', student);
                            onDeleteStudent?.(student);
                          }}
                          data-testid={`button-delete-student-${student.id}`}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
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
            <p className="text-muted-foreground">No students found</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}