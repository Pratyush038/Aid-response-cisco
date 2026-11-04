import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatRounded(value: number, fractionDigits = 0) {
  if (fractionDigits <= 0) {
    return Math.round(value).toString();
  }

  return Number(value.toFixed(fractionDigits)).toString();
}
