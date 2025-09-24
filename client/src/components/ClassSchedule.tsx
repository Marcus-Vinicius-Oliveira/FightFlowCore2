import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarPlus, Clock, Users, MapPin } from "lucide-react";

interface ClassScheduleItem {
  id: string;
  className: string;
  instructor: string;
  time: string;
  duration: number;
  capacity: number;
  enrolled: number;
  location: string;
  level: "beginner" | "intermediate" | "advanced";
}

interface DaySchedule {
  day: string;
  date: string;
  classes: ClassScheduleItem[];
}

export function ClassSchedule() {
  const [selectedWeek, setSelectedWeek] = useState("current");

  // TODO: Remove mock data - replace with real data from API
  const mockSchedule: DaySchedule[] = [
    {
      day: "Monday",
      date: "2024-09-23",
      classes: [
        {
          id: "1",
          className: "Jiu-Jitsu Fundamentals",
          instructor: "Professor Silva",
          time: "18:00",
          duration: 90,
          capacity: 20,
          enrolled: 15,
          location: "Main Dojo",
          level: "beginner"
        },
        {
          id: "2",
          className: "Advanced BJJ",
          instructor: "Professor Costa",
          time: "20:00",
          duration: 90,
          capacity: 15,
          enrolled: 12,
          location: "Main Dojo",
          level: "advanced"
        }
      ]
    },
    {
      day: "Tuesday",
      date: "2024-09-24",
      classes: [
        {
          id: "3",
          className: "Kids Karate",
          instructor: "Sensei Ana",
          time: "17:00",
          duration: 60,
          capacity: 25,
          enrolled: 22,
          location: "Studio A",
          level: "beginner"
        },
        {
          id: "4",
          className: "Muay Thai",
          instructor: "Kru João",
          time: "19:30",
          duration: 90,
          capacity: 18,
          enrolled: 16,
          location: "Studio B",
          level: "intermediate"
        }
      ]
    },
    {
      day: "Wednesday",
      date: "2024-09-25",
      classes: [
        {
          id: "5",
          className: "Jiu-Jitsu Open Mat",
          instructor: "Professor Silva",
          time: "18:30",
          duration: 120,
          capacity: 30,
          enrolled: 18,
          location: "Main Dojo",
          level: "intermediate"
        }
      ]
    },
    {
      day: "Thursday",
      date: "2024-09-26",
      classes: [
        {
          id: "6",
          className: "Women's Self Defense",
          instructor: "Professor Maria",
          time: "18:00",
          duration: 60,
          capacity: 15,
          enrolled: 8,
          location: "Studio A",
          level: "beginner"
        },
        {
          id: "7",
          className: "Competition Training",
          instructor: "Professor Costa",
          time: "20:00",
          duration: 120,
          capacity: 10,
          enrolled: 7,
          location: "Main Dojo",
          level: "advanced"
        }
      ]
    },
    {
      day: "Friday",
      date: "2024-09-27",
      classes: [
        {
          id: "8",
          className: "Mixed Martial Arts",
          instructor: "Coach Pedro",
          time: "19:00",
          duration: 90,
          capacity: 20,
          enrolled: 14,
          location: "Main Dojo",
          level: "intermediate"
        }
      ]
    },
    {
      day: "Saturday",
      date: "2024-09-28",
      classes: [
        {
          id: "9",
          className: "Family Class",
          instructor: "Professor Silva",
          time: "10:00",
          duration: 60,
          capacity: 25,
          enrolled: 20,
          location: "Main Dojo",
          level: "beginner"
        },
        {
          id: "10",
          className: "Sparring Session",
          instructor: "Professor Costa",
          time: "11:30",
          duration: 90,
          capacity: 16,
          enrolled: 11,
          location: "Main Dojo",
          level: "intermediate"
        }
      ]
    },
    {
      day: "Sunday",
      date: "2024-09-29",
      classes: [
        {
          id: "11",
          className: "Recovery & Mobility",
          instructor: "Coach Ana",
          time: "16:00",
          duration: 60,
          capacity: 20,
          enrolled: 13,
          location: "Studio A",
          level: "beginner"
        }
      ]
    }
  ];

  const getLevelBadge = (level: ClassScheduleItem["level"]) => {
    const variants = {
      beginner: "default",
      intermediate: "secondary",
      advanced: "destructive",
    } as const;

    const colors = {
      beginner: "text-green-600",
      intermediate: "text-blue-600", 
      advanced: "text-red-600",
    } as const;

    return (
      <Badge variant="outline" className={colors[level]} data-testid={`badge-level-${level}`}>
        {level.charAt(0).toUpperCase() + level.slice(1)}
      </Badge>
    );
  };

  const getCapacityStatus = (enrolled: number, capacity: number) => {
    const percentage = (enrolled / capacity) * 100;
    if (percentage >= 90) return { color: "text-red-600", text: "Almost Full" };
    if (percentage >= 70) return { color: "text-orange-600", text: "Filling Up" };
    return { color: "text-green-600", text: "Available" };
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle>Class Schedule</CardTitle>
            <CardDescription>
              Weekly schedule and class availability
            </CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <Select value={selectedWeek} onValueChange={setSelectedWeek}>
              <SelectTrigger className="w-[150px]" data-testid="select-week">
                <SelectValue placeholder="Select week" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="previous">Previous Week</SelectItem>
                <SelectItem value="current">Current Week</SelectItem>
                <SelectItem value="next">Next Week</SelectItem>
              </SelectContent>
            </Select>
            <Button data-testid="button-add-class">
              <CalendarPlus className="mr-2 h-4 w-4" />
              Add Class
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {mockSchedule.map((day) => (
          <div key={day.day} className="space-y-3">
            <div className="flex items-center space-x-2">
              <h3 className="font-semibold text-lg">{day.day}</h3>
              <span className="text-muted-foreground">{new Date(day.date).toLocaleDateString()}</span>
            </div>
            
            {day.classes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
                No classes scheduled
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {day.classes.map((classItem) => {
                  const capacityStatus = getCapacityStatus(classItem.enrolled, classItem.capacity);
                  
                  return (
                    <Card key={classItem.id} className="hover-elevate cursor-pointer" data-testid={`card-class-${classItem.id}`}>
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          <div className="flex items-start justify-between">
                            <h4 className="font-medium leading-tight" data-testid={`text-class-name-${classItem.id}`}>
                              {classItem.className}
                            </h4>
                            {getLevelBadge(classItem.level)}
                          </div>
                          
                          <div className="space-y-2 text-sm text-muted-foreground">
                            <div className="flex items-center space-x-2">
                              <Clock className="h-4 w-4" />
                              <span data-testid={`text-class-time-${classItem.id}`}>
                                {classItem.time} ({classItem.duration} min)
                              </span>
                            </div>
                            
                            <div className="flex items-center space-x-2">
                              <Users className="h-4 w-4" />
                              <span data-testid={`text-class-capacity-${classItem.id}`}>
                                {classItem.enrolled}/{classItem.capacity}
                              </span>
                              <span className={`text-xs ${capacityStatus.color}`}>
                                {capacityStatus.text}
                              </span>
                            </div>
                            
                            <div className="flex items-center space-x-2">
                              <MapPin className="h-4 w-4" />
                              <span data-testid={`text-class-location-${classItem.id}`}>
                                {classItem.location}
                              </span>
                            </div>
                          </div>
                          
                          <div className="pt-2 border-t">
                            <p className="text-sm font-medium" data-testid={`text-instructor-${classItem.id}`}>
                              {classItem.instructor}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}