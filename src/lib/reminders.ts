import type { ObjectId } from "mongodb";

export type ReminderRepeat = "once" | "daily" | "weekly" | "monthly";

export type ReminderDoc = {
  _id?: ObjectId;
  userId: ObjectId;
  title: string;
  message: string;
  time: string;
  repeat: ReminderRepeat;
  enabled: boolean;
  /** ISO timestamp of the last successfully sent email */
  last_sent_at?: Date;
  created_at?: Date;
  updated_at?: Date;
};

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
const WEEKDAY_SHORT = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function to24HourTime(hour: number, minute: number) {
  return `${pad(hour)}:${pad(minute)}`;
}

export function to12HourTime(time24: string) {
  const [hourValue, minuteValue] = time24.split(":").map(Number);
  const suffix = hourValue >= 12 ? "PM" : "AM";
  const hour12 = hourValue % 12 || 12;
  return `${hour12}:${pad(minuteValue)} ${suffix}`;
}

export function buildReminderTimeValue(input: {
  repeat: ReminderRepeat;
  date?: string;
  time: string;
  weekday?: number;
  dayOfMonth?: number;
}) {
  if (input.repeat === "once") {
    return `${input.date || new Date().toISOString().substring(0, 10)}|${input.time}`;
  }

  if (input.repeat === "weekly") {
    return `W${input.weekday ?? 0}|${input.time}`;
  }

  if (input.repeat === "monthly") {
    return `M${input.dayOfMonth ?? 1}|${input.time}`;
  }

  return input.time;
}

export function parseReminderTimeValue(repeat: ReminderRepeat, time: string) {
  if (repeat === "once") {
    const [date = "", clock = "00:00"] = time.split("|");
    return { date, clock };
  }

  if (repeat === "weekly") {
    const [dayPart = "W0", clock = "00:00"] = time.split("|");
    const weekday = Number(dayPart.slice(1));
    return { weekday: Number.isFinite(weekday) ? weekday : 0, clock };
  }

  if (repeat === "monthly") {
    const [dayPart = "M1", clock = "00:00"] = time.split("|");
    const dayOfMonth = Number(dayPart.slice(1));
    return { dayOfMonth: Number.isFinite(dayOfMonth) ? dayOfMonth : 1, clock };
  }

  return { clock: time };
}

export function formatReminderSchedule(reminder: Pick<ReminderDoc, "repeat" | "time">) {
  const parts = parseReminderTimeValue(reminder.repeat, reminder.time);

  if (reminder.repeat === "once") {
    if (!parts.date) return `Once · ${to12HourTime(parts.clock)}`;
    const dateLabel = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(
      new Date(`${parts.date}T00:00:00`)
    );
    return `Once · ${dateLabel} · ${to12HourTime(parts.clock)}`;
  }

  if (reminder.repeat === "weekly") {
    const weekday = WEEKDAY_NAMES[parts.weekday ?? 0] || WEEKDAY_NAMES[0];
    return `Every week · ${weekday} · ${to12HourTime(parts.clock)}`;
  }

  if (reminder.repeat === "monthly") {
    const day = parts.dayOfMonth ?? 1;
    const suffix = day % 10 === 1 && day !== 11 ? "st" : day % 10 === 2 && day !== 12 ? "nd" : day % 10 === 3 && day !== 13 ? "rd" : "th";
    return `Every month · ${day}${suffix} · ${to12HourTime(parts.clock)}`;
  }

  return `Every day · ${to12HourTime(parts.clock)}`;
}

export function formatReminderCompactSchedule(reminder: Pick<ReminderDoc, "repeat" | "time">) {
  const parts = parseReminderTimeValue(reminder.repeat, reminder.time);

  if (reminder.repeat === "once") {
    const dateLabel = parts.date
      ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(`${parts.date}T00:00:00`))
      : "Once";
    return `${dateLabel} · ${to12HourTime(parts.clock)}`;
  }

  if (reminder.repeat === "weekly") {
    return `${WEEKDAY_SHORT[parts.weekday ?? 0] || "sun"} · ${to12HourTime(parts.clock)}`;
  }

  if (reminder.repeat === "monthly") {
    return `day ${parts.dayOfMonth ?? 1} · ${to12HourTime(parts.clock)}`;
  }

  return `Every day · ${to12HourTime(parts.clock)}`;
}

export function getZonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  }).formatToParts(date);

  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    weekday: String(map.weekday || "sun").toLowerCase(),
  };
}

function dateKey(parts: { year: number; month: number; day: number }) {
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

function timeKey(hour: number, minute: number) {
  return hour * 60 + minute;
}

export function getReminderOccurrence(reminder: Pick<ReminderDoc, "repeat" | "time">, timeZone: string, now = new Date()) {
  const current = getZonedParts(now, timeZone);
  const currentDateKey = dateKey(current);
  const currentMinutes = timeKey(current.hour, current.minute);
  const parts = parseReminderTimeValue(reminder.repeat, reminder.time);

  if (reminder.repeat === "once") {
    const scheduledParts = parts.date ? getZonedParts(new Date(`${parts.date}T00:00:00`), timeZone) : null;
    const [scheduledHour = 0, scheduledMinute = 0] = parts.clock.split(":").map(Number);
    if (!scheduledParts) return { due: false, occurrenceKey: `once:${reminder.time}` };
    const scheduledDateKey = dateKey(scheduledParts);
    const due = currentDateKey > scheduledDateKey || (currentDateKey === scheduledDateKey && currentMinutes >= timeKey(scheduledHour, scheduledMinute));
    return { due, occurrenceKey: `once:${scheduledDateKey}|${parts.clock}` };
  }

  const [scheduledHour = 0, scheduledMinute = 0] = parts.clock.split(":").map(Number);
  const scheduledMinutes = timeKey(scheduledHour, scheduledMinute);

  if (reminder.repeat === "daily") {
    return {
      due: currentMinutes >= scheduledMinutes,
      occurrenceKey: `daily:${currentDateKey}`,
    };
  }

  if (reminder.repeat === "weekly") {
    const weekday = WEEKDAY_SHORT[parts.weekday ?? 0] || "sun";
    return {
      due: current.weekday.startsWith(weekday) && currentMinutes >= scheduledMinutes,
      occurrenceKey: `weekly:${currentDateKey}`,
    };
  }

  const dayOfMonth = parts.dayOfMonth ?? 1;
  return {
    due: current.day === dayOfMonth && currentMinutes >= scheduledMinutes,
    occurrenceKey: `monthly:${currentDateKey}`,
  };
}

export function getReminderLocalScheduleLabel(reminder: Pick<ReminderDoc, "repeat" | "time">) {
  return formatReminderSchedule(reminder);
}

export function getWeekdayOptions() {
  return WEEKDAY_NAMES.map((label, value) => ({ value, label }));
}

export function getMonthDayOptions() {
  return Array.from({ length: 31 }, (_, index) => index + 1);
}
