import { format } from 'date-fns';

/**
 * Legacy Business Hours Logic
 * Moved from automation-service.ts to satisfy monolith dependencies.
 */
export const isWithinBusinessHoursLegacy = (settings: any): boolean => {
  if (!settings?.businessHours?.enabled) return true;

  const now = new Date();
  const dayName = format(now, 'EEEE').toLowerCase();
  const currentTime = format(now, 'HH:mm');

  const schedule = settings.businessHours.schedule?.find((s: any) => s.day.toLowerCase() === dayName);
  if (!schedule || !schedule.enabled) return false;

  return currentTime >= schedule.startTime && currentTime <= schedule.endTime;
};
