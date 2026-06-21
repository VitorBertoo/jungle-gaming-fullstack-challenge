import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format BigInt cents to a display string like "$12.34" */
export function formatCents(cents: bigint | number): string {
  const n = typeof cents === "bigint" ? cents : BigInt(Math.round(cents));
  const negative = n < 0n;
  const abs = negative ? -n : n;
  const dollars = abs / 100n;
  const remainder = abs % 100n;
  const formatted = `$${dollars}.${String(remainder).padStart(2, "0")}`;
  return negative ? `-${formatted}` : formatted;
}

/** Format a multiplier integer (e.g. 150) to display "1.50x" */
export function formatMultiplier(multiplierInt: number): string {
  const whole = Math.floor(multiplierInt / 100);
  const frac = String(multiplierInt % 100).padStart(2, "0");
  return `${whole}.${frac}x`;
}
