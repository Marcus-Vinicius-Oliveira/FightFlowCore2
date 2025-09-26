import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { CalendarIcon, Filter, X, ArrowUpDown, ArrowDown, ArrowUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface FilterOptions {
  status: "all" | "active" | "inactive";
  dateFrom: string;
  dateTo: string;
  sortBy: "name" | "date";
  sortOrder: "asc" | "desc";
}

interface AdvancedFiltersProps {
  filters: FilterOptions;
  onFiltersChange: (filters: FilterOptions) => void;
  className?: string;
}

export function AdvancedFilters({ filters, onFiltersChange, className = "" }: AdvancedFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleFilterChange = <K extends keyof FilterOptions>(
    key: K,
    value: FilterOptions[K]
  ) => {
    onFiltersChange({
      ...filters,
      [key]: value,
    });
  };

  const clearAllFilters = () => {
    onFiltersChange({
      status: "all",
      dateFrom: "",
      dateTo: "",
      sortBy: "name",
      sortOrder: "asc",
    });
  };

  const hasActiveFilters = 
    filters.status !== "all" ||
    filters.dateFrom ||
    filters.dateTo ||
    filters.sortBy !== "name" ||
    filters.sortOrder !== "asc";

  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.status !== "all") count++;
    if (filters.dateFrom) count++;
    if (filters.dateTo) count++;
    if (filters.sortBy !== "name" || filters.sortOrder !== "asc") count++;
    return count;
  };

  const getSortIcon = () => {
    if (filters.sortOrder === "asc") {
      return <ArrowUp className="h-4 w-4" />;
    } else {
      return <ArrowDown className="h-4 w-4" />;
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2" data-testid="button-open-filters">
              <Filter className="h-4 w-4" />
              Filtros
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-1">
                  {getActiveFiltersCount()}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-96" align="start">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Filtros Avançados</h4>
                {hasActiveFilters && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={clearAllFilters}
                    className="text-muted-foreground hover:text-foreground gap-1"
                    data-testid="button-clear-filters"
                  >
                    <X className="h-3 w-3" />
                    Limpar
                  </Button>
                )}
              </div>

                {/* Status Filter */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Status</Label>
                  <Select
                    value={filters.status}
                    onValueChange={(value) => handleFilterChange("status", value as FilterOptions["status"])}
                  >
                    <SelectTrigger data-testid="select-status-filter">
                      <SelectValue placeholder="Selecione o status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="active">Apenas Ativos</SelectItem>
                      <SelectItem value="inactive">Apenas Inativos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Date Range Filter */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Data de Cadastro</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">De</Label>
                      <Input
                        type="date"
                        value={filters.dateFrom}
                        onChange={(e) => handleFilterChange("dateFrom", e.target.value)}
                        data-testid="input-date-from"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Até</Label>
                      <Input
                        type="date"
                        value={filters.dateTo}
                        onChange={(e) => handleFilterChange("dateTo", e.target.value)}
                        data-testid="input-date-to"
                      />
                    </div>
                  </div>
                </div>

                {/* Sort Options */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Ordenação</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Select
                      value={filters.sortBy}
                      onValueChange={(value) => handleFilterChange("sortBy", value as FilterOptions["sortBy"])}
                    >
                      <SelectTrigger data-testid="select-sort-by">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="name">Nome</SelectItem>
                        <SelectItem value="date">Data de Cadastro</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <Button
                      variant="outline"
                      onClick={() => 
                        handleFilterChange("sortOrder", filters.sortOrder === "asc" ? "desc" : "asc")
                      }
                      className="gap-2"
                      data-testid="button-sort-order"
                    >
                      {getSortIcon()}
                      {filters.sortOrder === "asc" ? "Crescente" : "Decrescente"}
                    </Button>
                  </div>
                </div>

              <div className="flex justify-end">
                <Button 
                  type="button"
                  variant="default" 
                  size="sm" 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsOpen(false);
                  }}
                  data-testid="button-apply-filters"
                >
                  Aplicar
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Active Filters Display */}
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2">
            {filters.status !== "all" && (
              <Badge variant="secondary" className="gap-1">
                Status: {filters.status === "active" ? "Ativo" : "Inativo"}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 hover:bg-transparent"
                  onClick={() => handleFilterChange("status", "all")}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            )}
            {filters.dateFrom && (
              <Badge variant="secondary" className="gap-1">
                De: {new Date(filters.dateFrom).toLocaleDateString('pt-BR')}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 hover:bg-transparent"
                  onClick={() => handleFilterChange("dateFrom", "")}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            )}
            {filters.dateTo && (
              <Badge variant="secondary" className="gap-1">
                Até: {new Date(filters.dateTo).toLocaleDateString('pt-BR')}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 hover:bg-transparent"
                  onClick={() => handleFilterChange("dateTo", "")}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            )}
            {(filters.sortBy !== "name" || filters.sortOrder !== "asc") && (
              <Badge variant="secondary" className="gap-1">
                {filters.sortBy === "name" ? "Nome" : "Data"} ({filters.sortOrder === "asc" ? "A-Z" : "Z-A"})
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 hover:bg-transparent"
                  onClick={() => {
                    handleFilterChange("sortBy", "name");
                    handleFilterChange("sortOrder", "asc");
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Utility function to apply filters to an array of items
export function applyFilters<T extends { active: boolean; createdAt: string; name: string }>(
  items: T[],
  filters: FilterOptions,
  searchTerm: string = ""
): T[] {
  let filteredItems = [...items];

  // Apply text search
  if (searchTerm.trim()) {
    filteredItems = filteredItems.filter(item =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ('email' in item && (item as any).email.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }

  // Apply status filter
  if (filters.status !== "all") {
    filteredItems = filteredItems.filter(item => 
      filters.status === "active" ? item.active : !item.active
    );
  }

  // Apply date range filter
  if (filters.dateFrom) {
    const fromDate = new Date(filters.dateFrom);
    filteredItems = filteredItems.filter(item => 
      new Date(item.createdAt) >= fromDate
    );
  }

  if (filters.dateTo) {
    const toDate = new Date(filters.dateTo);
    toDate.setHours(23, 59, 59, 999); // Include the entire day
    filteredItems = filteredItems.filter(item => 
      new Date(item.createdAt) <= toDate
    );
  }

  // Apply sorting
  filteredItems.sort((a, b) => {
    let comparison = 0;
    
    if (filters.sortBy === "name") {
      comparison = a.name.localeCompare(b.name, 'pt-BR', { 
        sensitivity: 'base',
        numeric: true 
      });
    } else {
      const dateA = new Date(a.createdAt);
      const dateB = new Date(b.createdAt);
      comparison = dateA.getTime() - dateB.getTime();
    }

    return filters.sortOrder === "asc" ? comparison : -comparison;
  });

  return filteredItems;
}