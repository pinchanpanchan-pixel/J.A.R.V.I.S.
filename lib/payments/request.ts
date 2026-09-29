import "server-only";
import { z } from "zod";

export const CheckoutBody = z.object({
  plan: z.enum(["pro_lite", "pro", "founder"]),
  period: z.enum(["monthly", "yearly", "lifetime"]),
  code: z.string().max(40).nullable().optional(),
});

export function periodEnd(period: "monthly" | "yearly" | "lifetime"): string | null {
  if (period === "lifetime") return null;
  const d = new Date();
  if (period === "monthly") d.setMonth(d.getMonth() + 1);
  else d.setFullYear(d.getFullYear() + 1);
  return d.toISOString();
}
