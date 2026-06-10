import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatMoneyFromMinorUnits(
  amount: number | null | undefined,
  currency = 'INR',
  locale?: string
) {
  const resolvedAmount = Number(amount ?? 0) / 100
  const resolvedLocale = locale || (currency === 'INR' ? 'en-IN' : 'en-US')

  try {
    return new Intl.NumberFormat(resolvedLocale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(resolvedAmount)
  } catch {
    return `${currency} ${resolvedAmount.toLocaleString(resolvedLocale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  }
}
