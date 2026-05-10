import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarPlus, Clock, Users } from "lucide-react";
import { useState } from "react";
import { apiClient, type Class } from "@/lib/api";

const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export function ClassSchedule() {
  const [selectedWeek, setSelectedWeek] = useState("current");

  const { data: classes = [] } = useQuery<Class[]>({
    queryKey: ['classes'],
    queryFn: () => apiClient.getClasses(),
  });

  // Group active classes by dayOfWeek
  const byDay = classes.reduce<Record<number, Class[]>>((acc, cls) => {
    if (!acc[cls.dayOfWeek]) acc[cls.dayOfWeek] = [];
    acc[cls.dayOfWeek].push(cls);
    return acc;
  }, {});

  const days = [1, 2, 3, 4, 5, 6, 0].filter(d => byDay[d]?.length > 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle>Grade de Aulas</CardTitle>
            <CardDescription>Horários semanais das turmas</CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <Select value={selectedWeek} onValueChange={setSelectedWeek}>
              <SelectTrigger className="w-[150px]" data-testid="select-week">
                <SelectValue placeholder="Semana" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="previous">Semana Anterior</SelectItem>
                <SelectItem value="current">Semana Atual</SelectItem>
                <SelectItem value="next">Próxima Semana</SelectItem>
              </SelectContent>
            </Select>
            <Button data-testid="button-add-class">
              <CalendarPlus className="mr-2 h-4 w-4" />
              Adicionar Aula
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {days.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
            Nenhuma turma cadastrada ainda.
          </div>
        ) : (
          days.map(dayOfWeek => (
            <div key={dayOfWeek} className="space-y-3">
              <h3 className="font-semibold text-lg">{DAY_NAMES[dayOfWeek]}</h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {byDay[dayOfWeek].map(cls => (
                  <Card
                    key={cls.id}
                    className="hover-elevate cursor-pointer"
                    data-testid={`card-class-${cls.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <h4
                          className="font-medium leading-tight"
                          data-testid={`text-class-name-${cls.id}`}
                        >
                          {cls.classType?.name ?? 'Turma'}
                        </h4>

                        <div className="space-y-2 text-sm text-muted-foreground">
                          <div className="flex items-center space-x-2">
                            <Clock className="h-4 w-4" />
                            <span data-testid={`text-class-time-${cls.id}`}>
                              {cls.startTime} – {cls.endTime}
                              {cls.classType?.duration ? ` (${cls.classType.duration} min)` : ''}
                            </span>
                          </div>

                          {cls.classType?.maxCapacity && (
                            <div className="flex items-center space-x-2">
                              <Users className="h-4 w-4" />
                              <span data-testid={`text-class-capacity-${cls.id}`}>
                                Capacidade: {cls.classType.maxCapacity}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="pt-2 border-t">
                          <p
                            className="text-sm font-medium"
                            data-testid={`text-instructor-${cls.id}`}
                          >
                            {cls.instructor?.name ?? 'Instrutor'}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
