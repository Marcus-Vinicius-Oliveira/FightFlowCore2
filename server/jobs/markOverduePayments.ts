import { eq, and, lt } from "drizzle-orm";
import { db } from "../db";
import { payments } from "@shared/schema";
import { log } from "../vite";

const INTERVAL_MS = 60 * 60 * 1000; // 1 hora

export async function markOverduePayments(): Promise<number> {
  const result = await db
    .update(payments)
    .set({ status: 'overdue' })
    .where(and(eq(payments.status, 'pending'), lt(payments.dueDate, new Date())));
  return result.rowCount ?? 0;
}

export function startOverduePaymentsJob(): void {
  const run = () =>
    markOverduePayments()
      .then(count => { if (count > 0) log(`[overdue-job] ${count} pagamento(s) marcado(s) como overdue`); })
      .catch(err => console.error('[overdue-job] erro:', err));

  run(); // executa imediatamente no boot
  setInterval(run, INTERVAL_MS);
}
