import { DashboardStats } from "@/components/DashboardStats";
import { StudentManagement } from "@/components/StudentManagement";
import { ClassSchedule } from "@/components/ClassSchedule";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Academy Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Overview of your martial arts academy operations
        </p>
      </div>

      {/* Stats Overview */}
      <DashboardStats />

      {/* Management Tabs */}
      <Tabs defaultValue="students" className="space-y-6">
        <TabsList>
          <TabsTrigger value="students" data-testid="tab-students">Students</TabsTrigger>
          <TabsTrigger value="classes" data-testid="tab-classes">Classes</TabsTrigger>
        </TabsList>
        
        <TabsContent value="students">
          <StudentManagement />
        </TabsContent>
        
        <TabsContent value="classes">
          <ClassSchedule />
        </TabsContent>
      </Tabs>
    </div>
  );
}