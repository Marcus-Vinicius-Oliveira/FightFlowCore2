import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Calendar, Clock, TrendingUp, Award, Users, CheckCircle2 } from "lucide-react";

interface AttendanceRecord {
  date: string;
  className: string;
  instructor: string;
  present: boolean;
  notes?: string;
}

interface UpcomingClass {
  id: string;
  name: string;
  instructor: string;
  time: string;
  date: string;
  location: string;
  duration: number;
}

export function StudentPortal() {
  // TODO: Remove mock data - replace with real data from API
  const studentInfo = {
    name: "Maria Santos",
    membershipPlan: "Monthly 3x/week",
    joinDate: "2024-01-15",
    nextPayment: "2024-10-01",
    paymentStatus: "paid",
    attendanceRate: 85,
    classesAttended: 34,
    totalClasses: 40,
    currentStreak: 5,
  };

  const upcomingClasses: UpcomingClass[] = [
    {
      id: "1",
      name: "Jiu-Jitsu Fundamentals",
      instructor: "Professor Silva",
      time: "18:00",
      date: "2024-09-24",
      location: "Main Dojo",
      duration: 90,
    },
    {
      id: "2",
      name: "Open Mat",
      instructor: "Professor Costa",
      time: "19:30", 
      date: "2024-09-25",
      location: "Main Dojo",
      duration: 120,
    },
    {
      id: "3",
      name: "Women's Self Defense",
      instructor: "Professor Maria",
      time: "18:00",
      date: "2024-09-26",
      location: "Studio A",
      duration: 60,
    }
  ];

  const recentAttendance: AttendanceRecord[] = [
    {
      date: "2024-09-20",
      className: "Jiu-Jitsu Fundamentals",
      instructor: "Professor Silva",
      present: true,
    },
    {
      date: "2024-09-18",
      className: "Open Mat",
      instructor: "Professor Costa", 
      present: true,
    },
    {
      date: "2024-09-16",
      className: "Women's Self Defense",
      instructor: "Professor Maria",
      present: false,
      notes: "Sick leave"
    },
    {
      date: "2024-09-13",
      className: "Jiu-Jitsu Fundamentals",
      instructor: "Professor Silva",
      present: true,
    },
    {
      date: "2024-09-11",
      className: "Open Mat",
      instructor: "Professor Costa",
      present: true,
    }
  ];

  const getPaymentBadge = (status: string) => {
    return status === "paid" ? (
      <Badge variant="default" className="text-green-600" data-testid="badge-payment-paid">
        Paid
      </Badge>
    ) : (
      <Badge variant="destructive" data-testid="badge-payment-overdue">
        Overdue
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short', 
      day: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div>
        <h1 className="text-3xl font-bold">Welcome back, {studentInfo.name}!</h1>
        <p className="text-muted-foreground mt-2">Here's your training overview and upcoming classes.</p>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Attendance Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-attendance-rate">
              {studentInfo.attendanceRate}%
            </div>
            <Progress value={studentInfo.attendanceRate} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Classes Attended</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-classes-attended">
              {studentInfo.classesAttended}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              of {studentInfo.totalClasses} this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Streak</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-current-streak">
              {studentInfo.currentStreak}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              consecutive classes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Next Payment</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-bold mb-1" data-testid="text-next-payment">
              {formatDate(studentInfo.nextPayment)}
            </div>
            {getPaymentBadge(studentInfo.paymentStatus)}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upcoming Classes */}
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Classes</CardTitle>
            <CardDescription>Your scheduled classes this week</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {upcomingClasses.map((classItem) => (
              <div key={classItem.id} className="flex items-center space-x-4 p-3 rounded-lg hover:bg-muted/50 transition-colors" data-testid={`upcoming-class-${classItem.id}`}>
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Calendar className="h-6 w-6 text-primary" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate" data-testid={`class-name-${classItem.id}`}>
                    {classItem.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {classItem.instructor} • {classItem.location}
                  </p>
                  <div className="flex items-center space-x-4 text-xs text-muted-foreground mt-1">
                    <span>{formatDate(classItem.date)}</span>
                    <span className="flex items-center">
                      <Clock className="h-3 w-3 mr-1" />
                      {classItem.time} ({classItem.duration} min)
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Recent Attendance */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Attendance</CardTitle>
            <CardDescription>Your attendance history</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentAttendance.map((record, index) => (
              <div key={index} className="flex items-center space-x-4 p-3 rounded-lg" data-testid={`attendance-record-${index}`}>
                <div className="flex-shrink-0">
                  {record.present ? (
                    <CheckCircle2 className="h-6 w-6 text-green-600" />
                  ) : (
                    <div className="h-6 w-6 rounded-full border-2 border-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate" data-testid={`attendance-class-${index}`}>
                    {record.className}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {record.instructor} • {formatDate(record.date)}
                  </p>
                  {record.notes && (
                    <p className="text-xs text-orange-600 mt-1">{record.notes}</p>
                  )}
                </div>
                <div className="flex-shrink-0">
                  <Badge 
                    variant={record.present ? "default" : "secondary"}
                    className={record.present ? "text-green-600" : "text-muted-foreground"}
                    data-testid={`attendance-status-${index}`}
                  >
                    {record.present ? "Present" : "Absent"}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Membership Info */}
      <Card>
        <CardHeader>
          <CardTitle>Membership Information</CardTitle>
          <CardDescription>Your current membership details</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Plan</p>
            <p className="text-lg font-semibold" data-testid="text-membership-plan">
              {studentInfo.membershipPlan}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Member Since</p>
            <p className="text-lg font-semibold" data-testid="text-join-date">
              {formatDate(studentInfo.joinDate)}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Payment Status</p>
            <div className="mt-1">
              {getPaymentBadge(studentInfo.paymentStatus)}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}