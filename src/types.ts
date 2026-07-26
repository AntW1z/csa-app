export type UserRole = 'user' | 'member' | 'moderator' | 'admin';

export type MembershipTerm = 'year' | 'semester';

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
  requestedAt?: any;
  createdAt: any;
  // Expo push token for this device, saved on sign-in — moderators' clients
  // read these directly to send push notifications on publish (see
  // src/notifications.ts), no backend involved.
  pushToken?: string;
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
  // At most one post is featured at a time — that's the one used as the
  // full-screen launch popup on Home. Moderators toggle this in Manage.
  featured?: boolean;
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

// Shown as an auto-advancing image strip at the top of Home. Either linked
// to an existing post (image + tap-to-open-detail both come from that post
// automatically) or a plain manually-added image with no tap behavior at
// all — purely decorative.
export interface CarouselItem {
  id: string;
  imageUrl: string;
  postId?: string;
  createdAt: any;
}

// What tapping a sponsor's card actually does — the URL itself is what
// determines whether an app or a browser/maps app opens (iOS/Android
// universal links handle that transparently), this only controls the CTA
// label/icon shown so a moderator can set expectations correctly (e.g. a
// boba shop's ordering app link vs. a restaurant with no app, just a map).
export type SponsorLinkType = 'website' | 'app' | 'directions';

// A small fixed set rather than freeform text, so the Sponsors tab can
// group sponsors into clean horizontally-scrolling rows per category
// instead of accumulating one-off category strings over time.
export type SponsorCategory = 'food' | 'services' | 'other';

// A sponsor shown on the Sponsors tab — moderator-managed, same
// public-read/moderator-write trust level as posts and the carousel.
export interface Sponsor {
  id: string;
  name: string;
  imageUrl: string;
  // Full writeup (services offered, why members should check them out,
  // hours, standing/year-round deals, etc.) — shown in the sponsor's
  // detail view. Sponsors get more room for this than events do, since
  // most of what a sponsor listing needs to communicate *is* this.
  description?: string;
  category?: SponsorCategory;
  link?: string;
  linkType?: SponsorLinkType;
  // A time-boxed offer ("BOGO this weekend!"), separate from the
  // evergreen `description` — a standing/year-round deal belongs in
  // description instead, since it never needs to appear/disappear.
  // promoStartDate/EndDate (YYYY-MM-DD) bound when this is actually live;
  // computed client-side (see src/utils.ts isPromoLive), nothing
  // automatically toggles it off — it just stops matching once the date
  // range passes, no moderator action needed at either end.
  promoText?: string;
  promoStartDate?: string;
  promoEndDate?: string;
  createdAt: any;
}
