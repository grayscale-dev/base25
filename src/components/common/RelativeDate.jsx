import { cn } from "@/lib/utils";

function parseDateValue(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export function formatRelativeDateValue(value, { now = new Date() } = {}) {
  const date = parseDateValue(value);
  if (!date) return "Unknown";

  const nowDate = now instanceof Date ? now : new Date(now);
  const diffMs = date.getTime() - nowDate.getTime();
  const absMs = Math.abs(diffMs);
  const absMinutes = Math.floor(absMs / 60000);
  const absHours = Math.floor(absMinutes / 60);
  const absDays = Math.floor(absHours / 24);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "always" });
  const oneDayMs = 24 * 60 * 60 * 1000;
  const sevenDaysMs = 7 * oneDayMs;

  if (absMs < 60 * 60 * 1000) {
    const signedMinutes = diffMs >= 0 ? absMinutes : -absMinutes;
    return rtf.format(signedMinutes, "minute");
  }

  if (absMs <= oneDayMs) {
    const signedHours = diffMs >= 0 ? absHours : -absHours;
    return rtf.format(signedHours, "hour");
  }

  if (absMs <= sevenDaysMs) {
    const signedDays = diffMs >= 0 ? absDays : -absDays;
    return rtf.format(signedDays, "day");
  }

  return date.toLocaleDateString();
}

export function formatExactDateTimeValue(value) {
  const date = parseDateValue(value);
  if (!date) return "Unknown";
  return date.toLocaleString();
}

export default function RelativeDate({ value, className, fallback = "Unknown" }) {
  const date = parseDateValue(value);
  if (!date) {
    return <span className={className}>{fallback}</span>;
  }

  const text = formatRelativeDateValue(date);
  const title = formatExactDateTimeValue(date);

  return (
    <time dateTime={date.toISOString()} title={title} className={cn(className)}>
      {text}
    </time>
  );
}
