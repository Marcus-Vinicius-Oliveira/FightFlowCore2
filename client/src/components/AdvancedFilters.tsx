import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Filter, X, ArrowDown, ArrowUp, Search } from "lucide-react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { BeltBadge, BeltBar, BELT_HEX } from "@/components/BeltBadge";
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
  searchTerm?: string;
  onSearch?: (value: string) => void;
  availableClassTypeIds?: Set<string>;
  className?: string;
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isMobile;
}

function ActiveFilterTag({
  label,
  onRemove,
}: {
  label: React.ReactNode;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium pl-2.5 pr-1 py-1">
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remover filtro"
        className="ml-0.5 inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full hover:bg-primary/20 active:bg-primary/30 transition-colors"
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </span>
  );
}

export function AdvancedFilters({
  filters,
  onFiltersChange,
  searchTerm,
  onSearch,
  availableClassTypeIds,
  className = "",
}: AdvancedFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isMobile = useIsMobile();
  const mobileSearchRef = useRef<HTMLInputElement>(null);
  const desktopSearchRef = useRef<HTMLInputElement>(null);

  const { data: allClassTypes = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/classes/class-types"],
  });

  const { data: graduationSystems = [] } = useQuery<GraduationSystem[]>({
    queryKey: ["/api/graduation/systems"],
    queryFn: () => apiRequest("GET", "/api/graduation/systems").then((r) => r.json()),
    enabled: !!filters.classTypeId,
  });

  const classTypes = useMemo(() => {
    if (!availableClassTypeIds) return allClassTypes;
    return allClassTypes.filter((ct) => availableClassTypeIds.has(ct.id));
  }, [allClassTypes, availableClassTypeIds]);

  const ranksForSelectedModality = useMemo(() => {
    if (!filters.classTypeId) return [];
    const system = graduationSystems.find((s) => s.classTypeId === filters.classTypeId);
    return (system?.ranks ?? []).slice().sort((a, b) => a.displayOrder - b.displayOrder);
  }, [graduationSystems, filters.classTypeId]);

  const handleFilterChange = <K extends keyof FilterOptions>(key: K, value: FilterOptions[K]) => {
    const next: FilterOptions = { ...filters, [key]: value };
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

  const activeCount = [
    filters.status !== "all",
    !!filters.belt,
    !!filters.classTypeId,
    !!filters.rankId,
    !!filters.dateFrom,
    !!filters.dateTo,
    filters.sortBy !== "name" || filters.sortOrder !== "asc",
  ].filter(Boolean).length;

  const activeClassTypeName = allClassTypes.find((ct) => ct.id === filters.classTypeId)?.name ?? "";
  const activeRankName = ranksForSelectedModality.find((r) => r.id === filters.rankId)?.name ?? "";

  const selectedRank = ranksForSelectedModality.find((r) => r.id === filters.rankId);

  const activeTags = (
    <>
      {filters.status !== "all" && (
        <ActiveFilterTag
          label={`Status: ${filters.status === "active" ? "Ativo" : "Inativo"}`}
          onRemove={() => handleFilterChange("status", "all")}
        />
      )}
      {filters.classTypeId && activeClassTypeName && (
        <ActiveFilterTag
          label={activeClassTypeName}
          onRemove={() => handleFilterChange("classTypeId", "")}
        />
      )}
      {filters.rankId && activeRankName && (
        <ActiveFilterTag
          label={
            <span className="flex items-center gap-1.5">
              {selectedRank && (
                <BeltBar color={selectedRank.colorClass ?? "#6b7280"} name={selectedRank.name} width={20} height={8} />
              )}
              {activeRankName}
            </span>
          }
          onRemove={() => handleFilterChange("rankId", "")}
        />
      )}
      {filters.belt && (
        <ActiveFilterTag
          label={
            <span className="flex items-center gap-1.5">
              <BeltBar color={BELT_HEX[filters.belt] ?? "#6b7280"} name={filters.belt} width={20} height={8} />
              <span className="capitalize">{filters.belt}</span>
            </span>
          }
          onRemove={() => handleFilterChange("belt", "")}
        />
      )}
      {filters.dateFrom && (
        <ActiveFilterTag
          label={`De: ${new Date(filters.dateFrom).toLocaleDateString("pt-BR")}`}
          onRemove={() => handleFilterChange("dateFrom", "")}
        />
      )}
      {filters.dateTo && (
        <ActiveFilterTag
          label={`Até: ${new Date(filters.dateTo).toLocaleDateString("pt-BR")}`}
          onRemove={() => handleFilterChange("dateTo", "")}
        />
      )}
      {(filters.sortBy !== "name" || filters.sortOrder !== "asc") && (
        <ActiveFilterTag
          label={`${filters.sortBy === "name" ? "Nome" : "Data"} (${filters.sortOrder === "asc" ? "A-Z" : "Z-A"})`}
          onRemove={() => onFiltersChange({ ...filters, sortBy: "name", sortOrder: "asc" })}
        />
      )}
    </>
  );

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Mobile: search full-width on top */}
      {onSearch && (
        <div className="relative md:hidden">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            ref={mobileSearchRef}
            placeholder="Buscar..."
            value={searchTerm ?? ""}
            onChange={(e) => onSearch(e.target.value)}
            className={`pl-9 ${searchTerm ? "pr-8" : ""}`}
            data-testid="input-search-students"
          />
          {searchTerm && (
            <button
              type="button"
              aria-label="Limpar busca"
              onClick={() => { onSearch(""); mobileSearchRef.current?.focus(); }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Filter bar: [trigger] [scrollable tags] [search — desktop only] */}
      <div className="flex items-center gap-2 min-w-0">
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button
              variant={hasActiveFilters ? "default" : "outline"}
              size="sm"
              className="shrink-0 gap-1.5 h-9"
              data-testid="button-open-filters"
            >
              <Filter className="h-4 w-4" />
              <span className="hidden sm:inline">Filtros</span>
              {activeCount > 0 && (
                <span className="inline-flex items-center justify-center h-[18px] w-[18px] rounded-full bg-background/30 text-[10px] font-bold leading-none">
                  {activeCount}
                </span>
              )}
            </Button>
          </SheetTrigger>

          <SheetContent
            side={isMobile ? "bottom" : "right"}
            className={[
              "flex flex-col p-0 gap-0 overflow-hidden [&>button:last-child]:hidden",
              isMobile ? "h-[88dvh] rounded-t-2xl" : "w-[380px]",
            ].join(" ")}
          >
            <div className="px-4 pt-4 pb-3 border-b shrink-0 flex items-center gap-2">
              <SheetClose asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                  <X className="h-4 w-4" />
                  <span className="sr-only">Fechar</span>
                </Button>
              </SheetClose>
              <SheetTitle className="flex-1 text-base text-center">Filtros Avançados</SheetTitle>
              {hasActiveFilters ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFilters}
                  className="text-muted-foreground h-7 text-xs gap-1 shrink-0"
                  data-testid="button-clear-filters"
                >
                  <X className="h-3 w-3" />
                  Limpar
                </Button>
              ) : (
                <div className="h-8 w-8 shrink-0" />
              )}
            </div>

            {/* Scrollable filter form */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
              {/* Status */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Status</Label>
                <Select
                  value={filters.status}
                  onValueChange={(v) => handleFilterChange("status", v as FilterOptions["status"])}
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

              {/* Modalidade */}
              {classTypes.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Modalidade</Label>
                  <Select
                    value={filters.classTypeId || "all"}
                    onValueChange={(v) => handleFilterChange("classTypeId", v === "all" ? "" : v)}
                  >
                    <SelectTrigger data-testid="select-modality-filter">
                      <SelectValue placeholder="Todas as modalidades" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as modalidades</SelectItem>
                      {classTypes.map((ct) => (
                        <SelectItem key={ct.id} value={ct.id}>
                          {ct.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Graduação na Modalidade — com swatch de cor */}
              {filters.classTypeId && ranksForSelectedModality.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Graduação na Modalidade</Label>
                  <Select
                    value={filters.rankId || "all"}
                    onValueChange={(v) => handleFilterChange("rankId", v === "all" ? "" : v)}
                  >
                    <SelectTrigger data-testid="select-rank-filter">
                      {selectedRank ? (
                        <div className="flex items-center gap-2">
                          <BeltBar
                            color={selectedRank.colorClass ?? "#6b7280"}
                            name={selectedRank.name}
                            width={28}
                            height={10}
                          />
                          <span>{selectedRank.name}</span>
                        </div>
                      ) : (
                        <SelectValue placeholder="Todas as graduações" />
                      )}
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as graduações</SelectItem>
                      {ranksForSelectedModality.map((rank) => (
                        <SelectItem key={rank.id} value={rank.id}>
                          <div className="flex items-center gap-2">
                            <BeltBar
                              color={rank.colorClass ?? "#6b7280"}
                              name={rank.name}
                              width={28}
                              height={10}
                            />
                            <span>{rank.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Faixa — com swatch de cor — oculta quando há modalidade selecionada */}
              {!filters.classTypeId && <div className="space-y-2">
                <Label className="text-sm font-medium">Faixa</Label>
                <Select
                  value={filters.belt || "all"}
                  onValueChange={(v) => handleFilterChange("belt", v === "all" ? "" : v)}
                >
                  <SelectTrigger data-testid="select-belt-filter">
                    {filters.belt ? (
                      <div className="flex items-center gap-2">
                        <BeltBar
                          color={BELT_HEX[filters.belt] ?? "#6b7280"}
                          name={filters.belt}
                          width={28}
                          height={10}
                        />
                        <span className="capitalize">{filters.belt}</span>
                      </div>
                    ) : (
                      <SelectValue placeholder="Todas as faixas" />
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <span className="text-muted-foreground text-sm">Todas as faixas</span>
                    </SelectItem>
                    {BELT_OPTIONS.map((belt) => (
                      <SelectItem key={belt} value={belt}>
                        <div className="flex items-center gap-2">
                          <BeltBar
                            color={BELT_HEX[belt] ?? "#6b7280"}
                            name={belt}
                            width={28}
                            height={10}
                          />
                          <span className="capitalize">{belt}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>}

              {/* Data de Cadastro */}
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

              {/* Ordenação */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Ordenação</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Select
                    value={filters.sortBy}
                    onValueChange={(v) => handleFilterChange("sortBy", v as FilterOptions["sortBy"])}
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
                    {filters.sortOrder === "asc" ? (
                      <ArrowUp className="h-4 w-4" />
                    ) : (
                      <ArrowDown className="h-4 w-4" />
                    )}
                    {filters.sortOrder === "asc" ? "Crescente" : "Decrescente"}
                  </Button>
                </div>
              </div>
            </div>

            {/* Sticky footer — Apply button always visible */}
            <div className="shrink-0 border-t bg-background px-4 py-3 flex gap-2">
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  onClick={clearAllFilters}
                  className="flex-1 gap-1.5 text-muted-foreground"
                  data-testid="button-clear-filters-footer"
                >
                  <X className="h-4 w-4" />
                  Limpar filtros
                </Button>
              )}
              <Button
                className="flex-1"
                onClick={() => setIsOpen(false)}
                data-testid="button-apply-filters"
              >
                Aplicar
              </Button>
            </div>
          </SheetContent>
        </Sheet>

        {/* Tags de filtros ativos — scroll horizontal no mobile */}
        {hasActiveFilters && (
          <div className="flex-1 min-w-0 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <div className="flex items-center gap-1.5 whitespace-nowrap pb-0.5">
              {activeTags}
            </div>
          </div>
        )}

        {/* Search — apenas desktop, alinhado à direita */}
        {onSearch && (
          <div className="relative hidden md:block w-64 shrink-0 ml-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              ref={desktopSearchRef}
              placeholder="Buscar..."
              value={searchTerm ?? ""}
              onChange={(e) => onSearch(e.target.value)}
              className={`pl-9 h-9 ${searchTerm ? "pr-8" : ""}`}
              data-testid="input-search-students"
            />
            {searchTerm && (
              <button
                type="button"
                aria-label="Limpar busca"
                onClick={() => { onSearch(""); desktopSearchRef.current?.focus(); }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function applyFilters<
  T extends { active: boolean; createdAt: string; name: string; email?: string; belt?: string | null; phone?: string }
>(items: T[], filters: FilterOptions, searchTerm: string = ""): T[] {
  let result = [...items];

  if (searchTerm.trim()) {
    const raw = searchTerm.trim();
    const tokens = raw.toLowerCase().split(/\s+/).filter(Boolean);
    const digits = raw.replace(/\D/g, '');

    result = result.filter((item) => {
      const nameWords = item.name.toLowerCase().split(/\s+/);
      // Every token must match the start of at least one word in the name
      const nameMatch = tokens.every(t => nameWords.some(w => w.startsWith(t)));
      // Every token must appear somewhere in the email
      const emailMatch = item.email != null && tokens.every(t => item.email!.toLowerCase().includes(t));
      // Digit sequence must appear in the phone (strips formatting on both sides)
      const phoneMatch = digits.length > 0 && item.phone != null && item.phone.replace(/\D/g, '').includes(digits);
      return nameMatch || emailMatch || phoneMatch;
    });
  }

  if (filters.status !== "all") {
    result = result.filter((item) =>
      filters.status === "active" ? item.active : !item.active
    );
  }

  if (filters.belt) {
    const beltLower = filters.belt.toLowerCase();
    result = result.filter((item) => item.belt?.toLowerCase() === beltLower);
  }

  if (filters.dateFrom) {
    const fromDate = new Date(filters.dateFrom);
    result = result.filter((item) => new Date(item.createdAt) >= fromDate);
  }

  if (filters.dateTo) {
    const toDate = new Date(filters.dateTo);
    toDate.setHours(23, 59, 59, 999);
    result = result.filter((item) => new Date(item.createdAt) <= toDate);
  }

  result.sort((a, b) => {
    let comparison = 0;
    if (filters.sortBy === "name") {
      comparison = a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base", numeric: true });
    } else {
      comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }
    return filters.sortOrder === "asc" ? comparison : -comparison;
  });

  return result;
}
