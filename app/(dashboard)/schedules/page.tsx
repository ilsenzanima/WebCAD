import { getSchedules } from "@/app/actions/schedules";
import SchedulesClient from "@/app/ui/dashboard/SchedulesClient";

export const metadata = {
  title: "Pagamenti - Finanza Privata",
  description: "Scadenziario dei pagamenti programmati",
};

export default async function SchedulesPage() {
  const schedules = await getSchedules().catch(() => []);

  return <SchedulesClient initialSchedules={schedules} />;
}
