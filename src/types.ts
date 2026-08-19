export type UserRole = 'user' | 'member' | 'moderator' | 'admin';

export type MembershipTerm = 'year' | 'semester';

// '4+' covers 5th-years, grad students, anyone past standard undergrad
// year 4 — kept as one bucket rather than trying to enumerate every case.
export type StudentYear = '1' | '2' | '3' | '4' | '4+';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  memberRequestStatus: 'none' | 'pending';
  // Set by the moderator/admin at approval time (not chosen by the
  // requester) — dues are paid per semester or per year, so this is what
  // lets a semester-only reset skip full-year members.
  membershipTerm?: MembershipTerm;
  // Asked as a mandatory step right after signup (see AccountSetupGate) —
  // only ever missing on accounts created before this existed, in which
  // case event check-in asks for it there instead as a fallback.
  year?: StudentYear;
  // True only on a brand-new profile doc (set at creation in AuthContext),
  // cleared once AccountSetupGate is completed. Deliberately a persisted
  // Firestore field, not local component state — local state resets on
  // every app launch, which meant force-quitting mid-setup (or just
  // switching tabs to dodge it) let someone skip it permanently. Checked
  // at the root layout, above the tab navigator, so it blocks the whole
  // app (including the tab bar) rather than just one screen.
  needsSetup?: boolean;
  requestedAt?: any;
  createdAt: any;
  // Expo push token for this device, saved on sign-in — moderators' clients
  // read these directly to send push notifications on publish (see
  // src/notifications.ts), no backend involved.
  pushToken?: string;
  // In-app opt-out, separate from the OS permission — there's no API to
  // revoke OS notification permission from inside an app, so this is what
  // actually lets someone turn sends off after already granting it.
  // undefined defaults to true (enabled) so existing accounts aren't
  // silently opted out by a missing field — always check `!== false`,
  // never truthiness, when reading this.
  notificationsEnabled?: boolean;
  // IDs of PushMessage docs this user has opened in their in-app inbox —
  // small enough not to worry about unbounded growth at club scale, and
  // storing it here (rather than on the notification doc) means marking
  // something read never needs new Firestore permissions beyond the
  // self-write a user already has on their own profile.
  readNotificationIds?: string[];
  // IDs of PushMessage docs this user has removed from their own inbox —
  // per-user, like deleting an email from your own mailbox, not the
  // underlying sent message (which moderators still see in Manage > Logs).
  deletedNotificationIds?: string[];
}

export type PostType = 'event' | 'announcement' | 'collab';
export type Visibility = 'everyone' | 'members';

export interface Post {
  id: string;
  type: PostType;
  // undefined defaults to 'published' — every post created before this
  // field existed should stay visible, not silently vanish. A draft is
  // only ever visible to moderators (see Events tab filtering); everyone
  // else only sees 'published' ones.
  status?: 'draft' | 'published';
  title: string;
  description: string;
  // ISO 8601 strings from the moderator dashboard's date/time picker — chosen
  // because ISO strings also sort correctly as plain strings, which is what
  // lets Calendar's Firestore query do orderBy('dateTime') directly.
  dateTime?: string;
  endDateTime?: string;
  // True when only dates (not times) were picked — e.g. a multi-day promo
  // running Aug 23-25 with no specific start/end time attached.
  allDay?: boolean;
  locationText?: string;
  visibility: Visibility;
  imageUrl?: string;
  // Auto-generated (see generateCheckInCode in moderator.tsx) when a
  // moderator turns on "Require check-in" in the New/Edit Post form — not
  // typed by anyone, so there's nothing for a moderator to get wrong.
  // Always exactly 6 digits. Attendees type it back in to check in from
  // PostDetailModal. Absent means check-in isn't required/available for
  // this post — mainly used on events, but not restricted to
  // type === 'event' since nothing about it assumes that.
  checkInCode?: string;
  // One entry per checked-in attendee, appended via a transaction (not
  // arrayUnion — see PostDetailModal for why) — embedded
  // directly on the post rather than a separate collection/subcollection,
  // since club-scale attendance numbers are small and this keeps per-event
  // stats (headcount + year breakdown) a single-document read. year is
  // snapshotted at check-in time (not a live reference) so a stats page
  // doesn't shift retroactively if someone updates their year later.
  // checkedInAt is a client-generated ISO string, not serverTimestamp() —
  // Firestore doesn't support server timestamp sentinels inside objects
  // added via arrayUnion.
  checkIns?: { uid: string; name: string; year?: StudentYear; checkedInAt: string }[];
  // Every non-all-day event automatically gets a "starting now" push when
  // its start time arrives — always on, not configurable. Off by default
  // is the *additional* early reminder ("starting in N mins"), which a
  // moderator opts into per-event and picks a lead time for (0-60 min).
  // Both flags below are set by the scheduled Cloud Function
  // (functions/src/eventReminders.ts) once each has actually fired, to
  // guarantee each notification only ever goes out once.
  remindBeforeEnabled?: boolean;
  remindBeforeMinutes?: number;
  startNotificationSent?: boolean;
  reminderSent?: boolean;
  createdBy: string;
  createdAt: any;
}

// One entry per moderation action, for accountability — who approved/denied
// a request, created/edited/deleted a post, cleared memberships, etc.
// `message` is pre-formatted human-readable text rather than a code +
// separate lookup table, since every entry is written and read in the same
// place (Manage) and there's no other consumer that needs it structured.
export interface LogEntry {
  id: string;
  message: string;
  actorName: string;
  actorUid: string;
  createdAt: any;
}

// A push notification, either drafted by a moderator from Manage >
// Notifications and sent on demand (see src/notifications.ts), or created
// directly by the scheduled Cloud Function for an automatic per-event
// reminder (functions/src/eventReminders.ts) — the two share this
// collection so both show up in the same sent-history and in-app inbox.
// createdBy is a moderator's uid for the former, the sentinel 'system' for
// the latter (there's no human actor to log against).
export interface PushMessage {
  id: string;
  title: string;
  body: string;
  audience: Visibility;
  status: 'draft' | 'sent';
  sentAt?: any;
  createdBy: string;
  createdAt: any;
}

// A bug report or suggestion submitted from the "What is CSA?" info popup
// in Profile — visible to every moderator (not admin-only), since triaging
// these is routine moderator work rather than sensitive account data.
// Everything in the collection is implicitly unresolved — resolving one
// deletes it (see Manage > Feedback) rather than just flagging it, so
// nothing ever needs a status field to track.
export interface Feedback {
  id: string;
  message: string;
  submittedByUid: string;
  submittedByName: string;
  submittedByEmail: string;
  createdAt: any;
}

// Shown as an auto-advancing image strip at the top of Home. Either linked
// to an existing post (image + tap-to-open-detail both come from that post
// automatically) or a plain manually-added image with no tap behavior at
// all — purely decorative.
export interface CarouselItem {
  id: string;
  imageUrl: string;
  postId?: string;
  // Manual drag-to-reorder position, lowest first. Items without this
  // (added before reordering existed) just sort after ordered ones in
  // their original createdAt order — see resolveOrder in moderator.tsx.
  order?: number;
  createdAt: any;
}

// A small fixed set rather than freeform text, so the Sponsors tab can
// group sponsors into clean horizontally-scrolling rows per category
// instead of accumulating one-off category strings over time.
export type SponsorCategory = 'food' | 'services' | 'other';

// One button on a sponsor's detail view — label is fully custom (e.g.
// "Order on the app", "View menu", "Get directions"), since the URL itself
// already determines whether an app or a browser/maps app opens
// (iOS/Android universal links handle that transparently). A sponsor can
// have any number of these — a boba shop might link both their ordering
// app and their Instagram, for instance.
//
// 'link' (default, and the only kind before this existed) opens `url`
// as-is. 'directions' is a guided alternative for the common "send them to
// this address" case — the moderator just types a plain address into
// `url` instead of hand-building a maps deep link, and the app resolves it
// to Apple Maps (iOS) or Google Maps (Android/web) at open time. See
// resolveLinkUrl in src/utils.ts.
export interface SponsorLink {
  label: string;
  url: string;
  type?: 'link' | 'directions';
}

// 'information' is the evergreen brand profile (category, links, optional
// limited-time offer) — everything that existed before. 'event' is a
// one-off happening (a tabling event, a collab) with its own date, that
// can optionally reference an 'information' sponsor for the same brand
// instead of duplicating a description — like a YouTube video crediting
// the channel it belongs to, rather than re-describing the channel every
// time. Missing/unrecognized values resolve to 'information' (see
// resolveKind in app/(tabs)/sponsors.tsx) so nothing existing disappears.
export type SponsorKind = 'information' | 'event';

// A sponsor (or sponsor event) shown on the Sponsors tab — moderator-
// managed, same public-read/moderator-write trust level as posts and the
// carousel.
export interface Sponsor {
  id: string;
  kind: SponsorKind;
  name: string;
  imageUrl: string;
  // Full writeup (services offered, why members should check them out,
  // hours, standing/year-round deals, etc.) — shown in the sponsor's
  // detail view. Sponsors get more room for this than events do, since
  // most of what a sponsor listing needs to communicate *is* this.
  description?: string;
  // 'information' kind only:
  category?: SponsorCategory;
  // Shared by both kinds — an event can link out too (tickets, RSVP, the
  // sponsor's own site), same as an information sponsor's CTA buttons.
  links?: SponsorLink[];
  // 'event' kind only:
  eventDate?: string;
  // Optional — when set, the event spans a period (eventDate through
  // eventEndDate) rather than a single day. Left unset for a one-day
  // event, so nothing has to change for events created before this
  // existed.
  eventEndDate?: string;
  // References another Sponsor doc (an 'information'-kind one) — shown as
  // a small tappable brand row on the event's detail view, jumping
  // straight to that sponsor's own page.
  linkedSponsorId?: string;
  // Manual drag-to-reorder position within its own kind (and, for
  // information sponsors, within its category), lowest first. See
  // CarouselItem.order for the same fallback-sort pattern.
  order?: number;
  createdAt: any;
}
