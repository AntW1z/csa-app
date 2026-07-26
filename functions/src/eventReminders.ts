import { onSchedule } from 'firebase-functions/v2/scheduler';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { sendExpoPush } from './pushHelpers';

if (!getApps().length) initializeApp();

// How far ahead to look for events that need a reminder. The function runs
// every 15 minutes, so this window just needs to be wider than that
// interval to guarantee nothing slips through between runs.
const REMINDER_WINDOW_MINUTES = 60;

interface PostDoc {
  title: string;
  dateTime?: string;
  allDay?: boolean;
  visibility: 'everyone' | 'members';
  reminderSent?: boolean;
}

interface UserDoc {
  uid: string;
  role: string;
  pushToken?: string;
}

// Sends a "starting soon" push ~1hr before an event's start time, once per
// event (guarded by reminderSent). All-day events have no meaningful
// "starting soon" moment, so they're skipped entirely.
export const sendEventReminders = onSchedule('every 15 minutes', async () => {
  const db = getFirestore();
  const now = new Date();
  const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_MINUTES * 60 * 1000);

  // A single-field range query (both clauses on dateTime) doesn't need a
  // composite index — only combining a range on one field with equality/
  // order on a different field does.
  const postsSnap = await db
    .collection('posts')
    .where('dateTime', '>', now.toISOString())
    .where('dateTime', '<=', windowEnd.toISOString())
    .get();

  const due = postsSnap.docs.filter((d) => {
    const post = d.data() as PostDoc;
    return !post.allDay && !post.reminderSent;
  });

  if (due.length === 0) {
    console.log('No events due for a reminder this run.');
    return;
  }

  const usersSnap = await db.collection('users').get();
  const users = usersSnap.docs.map((d) => d.data() as UserDoc);

  for (const postDoc of due) {
    const post = postDoc.data() as PostDoc;
    const tokens = users
      .filter((u) => u.pushToken && (post.visibility === 'everyone' || u.role !== 'user'))
      .map((u) => u.pushToken as string);

    const reached = await sendExpoPush(tokens, 'Starting soon', `${post.title} starts in about an hour`);
    console.log(`Reminder for "${post.title}" reached ${reached} device(s).`);
    await postDoc.ref.update({ reminderSent: true });
  }
});
