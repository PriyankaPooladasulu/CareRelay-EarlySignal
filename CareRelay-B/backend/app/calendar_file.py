"""Minimal RFC 5545 all-day administrative reminder; no invitation or booking."""
from datetime import timedelta


def escape_text(value):
    return value.replace("\\", "\\\\").replace("\r\n", "\n").replace("\r", "\n").replace("\n", "\\n").replace(";", "\\;").replace(",", "\\,")


def fold_line(line):
    # RFC 5545 folding counts UTF-8 octets, including the continuation space.
    lines, current = [], ""
    for char in line:
        if len((current + char).encode("utf-8")) > 75:
            lines.append(current)
            current = " "
        current += char
    lines.append(current)
    return "\r\n".join(lines)


def create_calendar(action, now):
    lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//CareRelay//Synthetic Reminder 0.9//EN",
             "CALSCALE:GREGORIAN", "BEGIN:VEVENT", f"UID:{action.id}@carerelay.local",
             "DTSTAMP:" + now.strftime("%Y%m%dT%H%M%SZ"),
             "DTSTART;VALUE=DATE:" + action.reminder_date.strftime("%Y%m%d"),
             "DTEND;VALUE=DATE:" + (action.reminder_date + timedelta(days=1)).strftime("%Y%m%d"),
             "SUMMARY:" + escape_text(action.summary), "DESCRIPTION:" + escape_text(action.description),
             "TRANSP:TRANSPARENT", "END:VEVENT", "END:VCALENDAR"]
    return "\r\n".join(fold_line(line) for line in lines) + "\r\n"
