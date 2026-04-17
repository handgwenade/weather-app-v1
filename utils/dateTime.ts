type DateInput = string | Date | null | undefined;

const TIME_24_HOUR_OPTIONS: Intl.DateTimeFormatOptions = {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
};

const MONTH_DAY_TIME_24_HOUR_OPTIONS: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
};

function getValidDate(value: DateInput) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function isSameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export function formatTime24Hour(value: DateInput) {
  const date = getValidDate(value);

  if (!date) {
    return null;
  }

  return date.toLocaleTimeString("en-US", TIME_24_HOUR_OPTIONS);
}

export function formatMonthDayTime24Hour(value: DateInput) {
  const date = getValidDate(value);

  if (!date) {
    return null;
  }

  return date.toLocaleString("en-US", MONTH_DAY_TIME_24_HOUR_OPTIONS);
}

export function buildFutureTimeLabels24Hour(
  count: number,
  stepHours = 1,
  startDate: Date = new Date(),
) {
  const roundedStartDate = new Date(startDate);
  roundedStartDate.setMinutes(0, 0, 0);

  return Array.from({ length: count }, (_, index) => {
    const nextLabelDate = new Date(roundedStartDate);
    nextLabelDate.setHours(roundedStartDate.getHours() + index * stepHours);
    return formatTime24Hour(nextLabelDate) ?? "--";
  });
}

export function formatUpdatedTimeLabel(params: {
  sourceTimestamp: string | null;
  fallbackLabel: string | null;
  includePrefix?: boolean;
  emptyLabel?: string;
}) {
  const {
    sourceTimestamp,
    fallbackLabel,
    includePrefix = true,
    emptyLabel = "Updated",
  } = params;

  const prefix = includePrefix ? "Updated " : "";
  const sourceDate = getValidDate(sourceTimestamp);

  if (sourceDate) {
    const formatted = isSameDay(sourceDate, new Date())
      ? formatTime24Hour(sourceDate)
      : formatMonthDayTime24Hour(sourceDate);

    if (formatted) {
      return `${prefix}${formatted}`;
    }
  }

  if (fallbackLabel) {
    return `${prefix}${fallbackLabel}`;
  }

  return emptyLabel;
}
