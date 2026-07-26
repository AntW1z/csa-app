import { onSchedule } from 'firebase-functions/v2/scheduler';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { sendExpoPush } from './pushHelpers';

if (!getApps().length) initializeApp();

interface NotificationDoc {
  title: string;
  body: string;
  audience: 'everyone' | 'members';
  status: 'draft' | 'scheduled' | 'sent';
  eventDateTime?: string;
  reminderMinutesBefore?: number;
}

interface UserDoc {
  uid: string;
  role: string;
  pushToken?: string;
}

// A moderator schedules a reminder against a specific event from Manage >
// Notifications (eventDateTime + reminderMinutesBefore, denormalized from
// the linked post at schedule time). This runs every 15 minutes and fires
// any reminder whose target time (eventDateTime - reminderMinutesBefore)
// has arrived, flipping it to 'sent' so it never fires twice.
export const sendEventReminders = onSchedule('every 15 minutes', async () => {
  const db = getFirestore();
  const now = new Date();

  const scheduledSnap = await db.collection('notifications').where('status', '==', 'scheduled').get();

  const due = scheduledSnap.docs.filter((d) => {
    const n = d.data() as NotificationDoc;
    if (!n.eventDateTime || n.reminderMinutesBefore == null) return false;
    const fireAt = new Date(new Date(n.eventDateTime).getTime() - n.reminderMinutesBefore * 60000);
    return fireAt <= now;
  });

  if (due.length === 0) {
    console.log('No scheduled reminders due this run.');
    return;
  }

  const usersSnap = await db.collection('users').get();
  const users = usersSnap.docs.map((d) => d.data() as UserDoc);

  for (const notifDoc of due) {
    const notif = notifDoc.data() as NotificationDoc;
    const tokens = users
      .filter((u) => u.pushToken && (notif.audience === 'everyone' || u.role !== 'user'))
      .map((u) => u.pushToken as string);

    const reached = await sendExpoPush(tokens, notif.title, notif.body);
    console.log(`Reminder "${notif.title}" reached ${reached} device(s).`);
    await notifDoc.ref.update({ status: 'sent', sentAt: FieldValue.serverTimestamp() });
  }
});
