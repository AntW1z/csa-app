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

// A push notification a moderator has drafted from the Manage dashboard,
// independent of any post — sent on demand (see src/notifications.ts),
// not automatically when an event is published.
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
