// Firebase Auth's own error.message is developer-facing junk like
// "Firebase: Error (auth/invalid-credential)." — this maps the codes users
// can actually hit in sign-in/sign-up/reauth to plain-language copy.
// Note: modern Firebase Auth deliberately returns the same
// auth/invalid-credential code for both "wrong password" and "no account
// with that email" (email enumeration protection) — there's no way to
// tell those apart client-side, so both get one combined message.
export function getAuthErrorMessage(code?: string): string {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Incorrect email or password.';
    case 'auth/invalid-email':
      return 'Enter a valid email address.';
    case 'auth/missing-password':
      return 'Enter a password.';
    case 'auth/too-many-requests':
      return 'Too many attempts — please wait a moment and try again.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Contact a moderator for help.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists — try signing in instead.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.';
    case 'auth/network-request-failed':
      return 'Network error — check your connection and try again.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

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

// Applies a moderator's manual drag-to-reorder position, lowest first.
// Items with no `order` yet (added before reordering existed, or never
// dragged) sort after every ordered item but keep their relative fetch
// order among themselves (a stable sort, since they all compare equal at
// +Infinity) — so nothing jumps around until a moderator actually drags.
export function sortByOrder<T extends { order?: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));
}

const pad = (n: number) => String(n).padStart(2, '0');
export const toDateString = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// A sponsor's promo is "live" purely based on today falling within its
// date range — no moderator toggle to remember, it just stops matching
// once the range passes. All three fields have to be set: a promo with
// text but no dates isn't schedulable, so it's treated as not live.
export function isPromoLive(sponsor: { promoText?: string; promoStartDate?: string; promoEndDate?: string }): boolean {
  if (!sponsor.promoText || !sponsor.promoStartDate || !sponsor.promoEndDate) return false;
  const today = toDateString(new Date());
  return today >= sponsor.promoStartDate && today <= sponsor.promoEndDate;
}

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
