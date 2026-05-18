import { DashboardInfo } from "@/components/DashboardInfo";
import { DashboardStats } from "@/components/DashboardStats";
import { DashboardCharts } from "@/components/DashboardCharts";

export default function Dashboard() {
  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Painel da Academia</h1>
        <p className="text-muted-foreground mt-1 text-sm hidden sm:block">
          Visão geral das operações da sua academia de artes marciais
        </p>
      </div>

      <DashboardInfo />

      <DashboardStats />

      <div>
        <h2 className="text-lg font-semibold mb-3">Tendências</h2>
        <DashboardCharts />
      </div>
    </div>
  );
}
