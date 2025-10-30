const UNITS: Array<{ unit: Intl.RelativeTimeFormatUnit; ms: number }> = [
  { unit: "year", ms: 1000 * 60 * 60 * 24 * 365 },
  { unit: "month", ms: 1000 * 60 * 60 * 24 * 30 },
  { unit: "week", ms: 1000 * 60 * 60 * 24 * 7 },
  { unit: "day", ms: 1000 * 60 * 60 * 24 },
  { unit: "hour", ms: 1000 * 60 * 60 },
  { unit: "minute", ms: 1000 * 60 },
  { unit: "second", ms: 1000 },
];

const rtf =
  typeof Intl !== "undefined"
    ? new Intl.RelativeTimeFormat("en", { numeric: "auto" })
    : null;

export function formatDistanceToNow(value: string | number | Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "some time";

  const diffMs = date.getTime() - Date.now();

  if (!rtf) {
    const minutes = Math.round(Math.abs(diffMs) / (1000 * 60));
    return `${minutes} min`;
  }

  for (const { unit, ms } of UNITS) {
    if (Math.abs(diffMs) >= ms || unit === "second") {
      const delta = diffMs / ms;
      return rtf.format(Math.round(delta), unit);
    }
  }

  return rtf.format(0, "second");
}
