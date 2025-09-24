import { DashboardStats } from '../DashboardStats';

export default function DashboardStatsExample() {
  return (
    <div className="p-8 space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Academy Overview</h2>
        <p className="text-muted-foreground">Your academy performance at a glance</p>
      </div>
      <DashboardStats />
    </div>
  );
}