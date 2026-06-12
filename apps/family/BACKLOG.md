# Backlog

## Recurrence (parseIcs)

`DAILY` and `WEEKLY` rules (with `INTERVAL`, `COUNT`, `UNTIL`, `BYDAY`) are
expanded into the agenda window. Not yet handled:

- `MONTHLY` / `YEARLY` rules emit only their base occurrence.
- `EXDATE` (excluded dates) and `RECURRENCE-ID` overrides are ignored.
- `BYMONTHDAY` / `BYSETPOS` and other refinements.

If these matter, the cleanest path is to swap the hand-rolled expander for a
dedicated RRULE library and keep the rest of `parseIcs` as-is.

## Other ideas

- Weather header (one call to a free API, cached) — high value on a kitchen board.
- Per-source toggles / a "today only" vs "week" layout switch.
- Web admin page to edit `data/manual/events.json` from a browser.
- Promote the shared kiosk bits (cache/fallback service, fit-scale/burn-in hooks,
  Pi packaging) into a `packages/runtime` once a third dashboard appears.
