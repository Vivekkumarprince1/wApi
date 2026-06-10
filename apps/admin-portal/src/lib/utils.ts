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

export function triggerDownload(data: Blob | string, filename: string, mimeType = 'text/csv;charset=utf-8;') {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
