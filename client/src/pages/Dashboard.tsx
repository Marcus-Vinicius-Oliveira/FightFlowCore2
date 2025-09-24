import { DashboardStats } from "@/components/DashboardStats";
import { StudentManagement } from "@/components/StudentManagement";
import { ClassManagement } from "@/components/ClassManagement";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Painel da Academia</h1>
        <p className="text-muted-foreground mt-2">
          Visão geral das operações da sua academia de artes marciais
        </p>
      </div>

      {/* Stats Overview */}
      <DashboardStats />

      {/* Management Tabs */}
      <Tabs defaultValue="students" className="space-y-6">
        <TabsList>
          <TabsTrigger value="students" data-testid="tab-students">Alunos</TabsTrigger>
          <TabsTrigger value="classes" data-testid="tab-classes">Aulas</TabsTrigger>
        </TabsList>
        
        <TabsContent value="students">
          <StudentManagement />
        </TabsContent>
        
        <TabsContent value="classes">
          <ClassManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
}