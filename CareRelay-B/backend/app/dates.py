"""Conservative source-date normalization; never infer dates from clinical narrative."""
import re
from datetime import date, datetime

MONTHS = {name.lower(): i for i, name in enumerate(
    ["January","February","March","April","May","June","July","August","September","October","November","December"], 1)}
MONTHS.update({name[:3]: number for name, number in list(MONTHS.items())})
DATE_ERROR = "Use YYYY-MM-DD, Month D, YYYY, or D Month YYYY. Ambiguous numeric dates are not accepted."


def normalize_date(value):
    if isinstance(value, datetime):
        raise ValueError("Use a calendar date, not a timestamp.")
    if isinstance(value, date):
        return value
    if not isinstance(value, str):
        raise ValueError(DATE_ERROR)
    value = value.strip()
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        return date.fromisoformat(value)
    match = re.fullmatch(r"([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})", value)
    if match:
        month, day, year = match.groups()
    else:
        match = re.fullmatch(r"(\d{1,2})\s+([A-Za-z]+),?\s+(\d{4})", value)
        if not match:
            raise ValueError(DATE_ERROR)
        day, month, year = match.groups()
    if month.lower() not in MONTHS:
        raise ValueError(DATE_ERROR)
    return date(int(year), MONTHS[month.lower()], int(day))


def date_headers(text):
    """Only the first ten non-empty lines, as bare dates or explicit source-date labels."""
    matches = []
    offset, examined = 0, 0
    for line in text.splitlines(keepends=True):
        content = line.strip()
        if content:
            examined += 1
            if examined > 10:
                break
            labeled = re.fullmatch(r"(?:date|encounter date|visit date|record date)\s*:\s*(.+)", content, re.I)
            raw = labeled.group(1).strip() if labeled else content
            try:
                normalized = normalize_date(raw)
            except ValueError:
                # A malformed explicit date is an input error, never silently ignored.
                if labeled:
                    raise ValueError("Invalid explicit source-date header. " + DATE_ERROR)
            else:
                start = offset + line.index(raw)
                matches.append({"date": normalized, "quote": raw, "start": start, "end": start + len(raw),
                                "line_start": offset, "line_end": offset + len(line.rstrip("\r\n"))})
        offset += len(line)
    return matches


def resolve_record_date(supplied, text):
    headers = date_headers(text)
    header_dates = {h["date"] for h in headers}
    if len(header_dates) > 1:
        raise ValueError("Conflicting source-date headers; correct the source before analysis.")
    header = headers[0] if headers else None
    if supplied is None:
        if header is None:
            raise ValueError("Provide a source date or one explicit date header; narrative dates are not inferred.")
        resolved = header["date"]
        origin = "source_header"
    else:
        resolved = normalize_date(supplied)
        if header and header["date"] != resolved:
            raise ValueError("Supplied date conflicts with the source-date header.")
        origin = "metadata_and_header" if header else "supplied_metadata"
    provenance = {"origin": origin, "quote": header["quote"] if header else None,
                  "start": header["start"] if header else None, "end": header["end"] if header else None}
    return resolved, provenance


def mask_headers(text):
    """Mask metadata for sentence extraction without changing any source offsets."""
    chars = list(text)
    for h in date_headers(text):
        for i in range(h["line_start"], h["line_end"]):
            chars[i] = " "
    for match in re.finditer(r"(?m)^\s*SYNTHETIC DEMONSTRATION RECORD[^\S\r\n]*$", text):
        for i in range(match.start(), match.end()):
            if chars[i] not in "\r\n":
                chars[i] = " "
    return "".join(chars)
