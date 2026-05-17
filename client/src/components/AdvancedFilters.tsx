import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Filter, X, ArrowDown, ArrowUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { BeltBadge } from "@/components/BeltBadge";
import { apiRequest } from "@/lib/queryClient";

const BELT_OPTIONS = [
  "branca", "cinza", "amarela", "laranja",
  "verde", "azul", "roxa", "marrom", "preta", "coral", "vermelha",
];

export interface FilterOptions {
  status: "all" | "active" | "inactive";
  belt: string;
  classTypeId: string;
  rankId: string;
  dateFrom: string;
  dateTo: string;
  sortBy: "name" | "date";
  sortOrder: "asc" | "desc";
}

interface GraduationRank {
  id: string;
  name: string;
  displayOrder: number;
  colorClass: string;
}

interface GraduationSystem {
  id: string;
  classTypeId: string | null;
  ranks: GraduationRank[];
}

interface AdvancedFiltersProps {
  filters: FilterOptions;
  onFiltersChange: (filters: FilterOptions) => void;
  /** IDs das modalidades que possuem ao menos um aluno matriculado */
  availableClassTypeIds?: Set<string>;
  className?: string;
}

export function AdvancedFilters({
  filters,
  onFiltersChange,
  availableClassTypeIds,
  className = "",
}: AdvancedFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);

  const { data: allClassTypes = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['/api/classes/class-types'],
  });

  const { data: graduationSystems = [] } = useQuery<GraduationSystem[]>({
    queryKey: ['/api/graduation/systems'],
    queryFn: () => apiRequest('GET', '/api/graduation/systems').then(r => r.json()),
    enabled: !!filters.classTypeId,
  });

  // Fix 6: só mostra modalidades com alunos matriculados (quando availableClassTypeIds é passado)
  const classTypes = useMemo(() => {
    if (!availableClassTypeIds) return allClassTypes;
    return allClassTypes.filter(ct => availableClassTypeIds.has(ct.id));
  }, [allClassTypes, availableClassTypeIds]);

  // Ranks da modalidade selecionada, ordenados
  const ranksForSelectedModality = useMemo(() => {
    if (!filters.classTypeId) return [];
    const system = graduationSystems.find(s => s.classTypeId === filters.classTypeId);
    return (system?.ranks ?? []).slice().sort((a, b) => a.displayOrder - b.displayOrder);
  }, [graduationSystems, filters.classTypeId]);

  const handleFilterChange = <K extends keyof FilterOptions>(
    key: K,
    value: FilterOptions[K]
  ) => {
    const next: FilterOptions = { ...filters, [key]: value };
    // Reset rankId quando a modalidade muda
    if (key === "classTypeId") next.rankId = "";
    onFiltersChange(next);
  };

  const clearAllFilters = () => {
    onFiltersChange({
      status: "all",
      belt: "",
      classTypeId: "",
      rankId: "",
      dateFrom: "",
      dateTo: "",
      sortBy: "name",
      sortOrder: "asc",
    });
  };

  const hasActiveFilters =
    filters.status !== "all" ||
    !!filters.belt ||
    !!filters.classTypeId ||
    !!filters.rankId ||
    !!filters.dateFrom ||
    !!filters.dateTo ||
    filters.sortBy !== "name" ||
    filters.sortOrder !== "asc";

  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.status !== "all") count++;
    if (filters.belt) count++;
    if (filters.classTypeId) count++;
    if (filters.rankId) count++;
    if (filters.dateFrom) count++;
    if (filters.dateTo) count++;
    if (filters.sortBy !== "name" || filters.sortOrder !== "asc") count++;
    return count;
  };

  const activeClassTypeName = allClassTypes.find(ct => ct.id === filters.classTypeId)?.name ?? "";
  const activeRankName = ranksForSelectedModality.find(r => r.id === filters.rankId)?.name ?? "";

  const getSortIcon = () =>
    filters.sortOrder === "asc"
      ? <ArrowUp className="h-4 w-4" />
      : <ArrowDown className="h-4 w-4" />;

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

              {/* Modality Filter — Fix 6: só exibe modalidades com alunos */}
              {classTypes.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Modalidade</Label>
                  <Select
                    value={filters.classTypeId || "all"}
                    onValueChange={(value) => handleFilterChange("classTypeId", value === "all" ? "" : value)}
                  >
                    <SelectTrigger data-testid="select-modality-filter">
                      <SelectValue placeholder="Todas as modalidades" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as modalidades</SelectItem>
                      {classTypes.map(ct => (
                        <SelectItem key={ct.id} value={ct.id}>{ct.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Fix 3: Rank filter — só exibe quando uma modalidade está selecionada e tem ranks */}
              {filters.classTypeId && ranksForSelectedModality.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Graduação na Modalidade</Label>
                  <Select
                    value={filters.rankId || "all"}
                    onValueChange={(value) => handleFilterChange("rankId", value === "all" ? "" : value)}
                  >
                    <SelectTrigger data-testid="select-rank-filter">
                      <SelectValue placeholder="Todas as graduações" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as graduações</SelectItem>
                      {ranksForSelectedModality.map(rank => (
                        <SelectItem key={rank.id} value={rank.id}>
                          {rank.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Belt Filter */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Graduação / Faixa</Label>
                <Select
                  value={filters.belt || "all"}
                  onValueChange={(value) => handleFilterChange("belt", value === "all" ? "" : value)}
                >
                  <SelectTrigger data-testid="select-belt-filter">
                    <SelectValue>
                      {filters.belt
                        ? <BeltBadge belt={filters.belt} />
                        : <span className="text-muted-foreground">Todas as faixas</span>}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <span className="text-muted-foreground text-sm">Todas as faixas</span>
                    </SelectItem>
                    {BELT_OPTIONS.map(belt => (
                      <SelectItem key={belt} value={belt}>
                        <BeltBadge belt={belt} />
                      </SelectItem>
                    ))}
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
            {filters.classTypeId && activeClassTypeName && (
              <Badge variant="secondary" className="gap-1">
                {activeClassTypeName}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 hover:bg-transparent"
                  onClick={() => handleFilterChange("classTypeId", "")}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            )}
            {filters.rankId && activeRankName && (
              <Badge variant="secondary" className="gap-1">
                {activeRankName}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 hover:bg-transparent"
                  onClick={() => handleFilterChange("rankId", "")}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            )}
            {filters.belt && (
              <Badge variant="secondary" className="gap-1 items-center">
                <BeltBadge belt={filters.belt} />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 hover:bg-transparent ml-1"
                  onClick={() => handleFilterChange("belt", "")}
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
                    const next = { ...filters, sortBy: "name" as const, sortOrder: "asc" as const };
                    onFiltersChange(next);
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
export function applyFilters<T extends { active: boolean; createdAt: string; name: string; email?: string; belt?: string | null }>(
  items: T[],
  filters: FilterOptions,
  searchTerm: string = ""
): T[] {
  let result = [...items];

  if (searchTerm.trim()) {
    const term = searchTerm.toLowerCase();
    result = result.filter(item =>
      item.name.toLowerCase().includes(term) ||
      (item.email != null && item.email.toLowerCase().includes(term))
    );
  }

  if (filters.status !== "all") {
    result = result.filter(item =>
      filters.status === "active" ? item.active : !item.active
    );
  }

  if (filters.belt) {
    const beltLower = filters.belt.toLowerCase();
    result = result.filter(item => item.belt?.toLowerCase() === beltLower);
  }

  if (filters.dateFrom) {
    const fromDate = new Date(filters.dateFrom);
    result = result.filter(item => new Date(item.createdAt) >= fromDate);
  }

  if (filters.dateTo) {
    const toDate = new Date(filters.dateTo);
    toDate.setHours(23, 59, 59, 999);
    result = result.filter(item => new Date(item.createdAt) <= toDate);
  }

  result.sort((a, b) => {
    let comparison = 0;
    if (filters.sortBy === "name") {
      comparison = a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base', numeric: true });
    } else {
      comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }
    return filters.sortOrder === "asc" ? comparison : -comparison;
  });

  return result;
}
