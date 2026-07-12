// Event times are stored as ISO strings (see moderator's date/time picker),
// which sort correctly as plain strings — that's why Calendar's Firestore
// query can `orderBy('dateTime')` without a separate sort field. `allDay`
// distinguishes "no time was chosen" from an actual midnight-on-the-dot
// time, since the ISO string alone can't tell those apart.
export function formatEventTimeRange(start?: string, end?: string, allDay?: boolean): string {
  if (!start) return '';
  const s = new Date(start);
  if (isNaN(s.getTime())) return start;
  const e = end ? new Date(end) : null;
  const sameDay = !!e && s.toDateString() === e.toDateString();

  const dateFmt = (d: Date) => d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const timeFmt = (d: Date) => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

  if (allDay) {
    if (!e || sameDay) return dateFmt(s);
    return `${dateFmt(s)} – ${dateFmt(e)}`;
  }

  if (!e) return `${dateFmt(s)} · ${timeFmt(s)}`;
  if (sameDay) return `${dateFmt(s)} · ${timeFmt(s)}–${timeFmt(e)}`;
  return `${dateFmt(s)}, ${timeFmt(s)} – ${dateFmt(e)}, ${timeFmt(e)}`;
}

const pad = (n: number) => String(n).padStart(2, '0');
export const toDateString = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Resolves a post's actual start/end instant. For an all-day post, `end`
// is bumped to the end of that calendar day — the stored value is midnight
// at the *start* of the end date, which would otherwise make an all-day
// event look like it already ended as soon as the clock passed midnight.
export function getEventWindow(post: { dateTime?: string; endDateTime?: string; allDay?: boolean }): { start: Date; end: Date } | null {
  if (!post.dateTime) return null;
  const start = new Date(post.dateTime);
  if (isNaN(start.getTime())) return null;
  let end = post.endDateTime ? new Date(post.endDateTime) : new Date(start);
  if (isNaN(end.getTime())) end = new Date(start);
  if (post.allDay) end = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999);
  return { start, end };
}
