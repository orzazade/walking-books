/** Utilities for parsing and displaying partner location operating hours. */

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

type DayKey = (typeof DAY_KEYS)[number];

export interface HoursStatus {
  isOpen: boolean;
  /** e.g. "Open until 10 PM" or "Closed · Opens Mon 9 AM" */
  label: string;
  /** Today's hours string, e.g. "9 AM – 10 PM", or null if closed today */
  todayHours: string | null;
}

function parseTime(timeStr: string): { hour: number; minute: number } | null {
  const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  return { hour: parseInt(match[1], 10), minute: parseInt(match[2], 10) };
}

function formatHour(hour: number, minute: number): string {
  const h = hour % 24;
  const period = h >= 12 ? "PM" : "AM";
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return minute === 0 ? `${display} ${period}` : `${display}:${String(minute).padStart(2, "0")} ${period}`;
}

function formatRange(open: string, close: string): string | null {
  const o = parseTime(open);
  const c = parseTime(close);
  if (!o || !c) return null;
  return `${formatHour(o.hour, o.minute)} – ${formatHour(c.hour, c.minute)}`;
}

const DAY_LABELS: Record<DayKey, string> = {
  sun: "Sun",
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
};

/**
 * Determine the current open/closed status of a location.
 * @param operatingHours Record like { mon: "09:00-22:00", ... }
 * @param now Optional Date for testing (defaults to current time)
 */
export function getHoursStatus(
  operatingHours: Record<string, string> | null | undefined,
  now?: Date,
): HoursStatus | null {
  if (!operatingHours || typeof operatingHours !== "object") return null;

  const date = now ?? new Date();
  const dayIndex = date.getDay(); // 0=Sun
  const dayKey = DAY_KEYS[dayIndex];
  const currentMinutes = date.getHours() * 60 + date.getMinutes();

  const todayRange = operatingHours[dayKey];
  if (todayRange) {
    const [openStr, closeStr] = todayRange.split("-");
    const open = parseTime(openStr);
    const close = parseTime(closeStr);

    if (open && close) {
      const openMin = open.hour * 60 + open.minute;
      // Handle midnight (00:00) as end-of-day
      const closeMin = close.hour === 0 && close.minute === 0 ? 24 * 60 : close.hour * 60 + close.minute;

      if (currentMinutes >= openMin && currentMinutes < closeMin) {
        return {
          isOpen: true,
          label: `Open until ${formatHour(close.hour === 0 ? 0 : close.hour, close.minute)}`,
          todayHours: formatRange(openStr, closeStr),
        };
      }

      // Before opening today
      if (currentMinutes < openMin) {
        return {
          isOpen: false,
          label: `Opens ${formatHour(open.hour, open.minute)}`,
          todayHours: formatRange(openStr, closeStr),
        };
      }
    }
  }

  // Closed today or after hours — find next open day
  for (let offset = 1; offset <= 7; offset++) {
    const nextDayIndex = (dayIndex + offset) % 7;
    const nextKey = DAY_KEYS[nextDayIndex];
    const nextRange = operatingHours[nextKey];
    if (nextRange) {
      const [nextOpenStr] = nextRange.split("-");
      const nextOpen = parseTime(nextOpenStr);
      if (nextOpen) {
        const nextLabel = offset === 1 ? "tomorrow" : DAY_LABELS[nextKey];
        return {
          isOpen: false,
          label: `Closed · Opens ${nextLabel} ${formatHour(nextOpen.hour, nextOpen.minute)}`,
          todayHours: null,
        };
      }
    }
  }

  return null;
}
