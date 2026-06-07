import cron from 'node-cron';
import prisma from '../lib/prisma.js';
import { sendEmail } from '../lib/email.js';

export const initAppraisalReminderJob = () => {
  // Run every day at 8:00 AM and 10:00 PM
  cron.schedule('0 8,22 * * *', async () => {
    console.log('Running appraisal reminder job...');
    try {
      const users = await prisma.user.findMany({
        where: {
          is_active: true,
          joining_date: {
            not: null,
          }
        },
      });

      const today = new Date();
      
      // Calculate target dates for 90 days and 45 days from today
      const target45 = new Date(today);
      target45.setDate(today.getDate() + 45);
      const target90 = new Date(today);
      target90.setDate(today.getDate() + 90);

      // Find faculty for 45-day reminder
      const faculty45 = users.filter(user => {
        if (!user.joining_date) return false;
        const jDate = new Date(user.joining_date);
        return jDate.getMonth() === target45.getMonth() && jDate.getDate() === target45.getDate();
      });

      // Find faculty for 90-day reminder
      const faculty90 = users.filter(user => {
        if (!user.joining_date) return false;
        const jDate = new Date(user.joining_date);
        return jDate.getMonth() === target90.getMonth() && jDate.getDate() === target90.getDate();
      });

      console.log(`Found ${faculty90.length} faculty needing 90-day reminders, and ${faculty45.length} needing 45-day reminders.`);

      const sendReminder = async (faculty: any, days: number) => {
        const subject = `Annual Appraisal Application Reminder (${days} Days)`;
        const body = `
          <h2>Appraisal Reminder</h2>
          <p>Dear ${faculty.name},</p>
          <p>This is a reminder that your annual appraisal is due soon. Your joining date anniversary is exactly ${days} days from today.</p>
          <p>Please log in to the Appraisal System to fill out and submit your application form.</p>
          <br/>
          <p>Best regards,<br/>Admin Team</p>
        `;
        await sendEmail(faculty.email, subject, body);
      };

      for (const faculty of faculty90) {
        await sendReminder(faculty, 90);
      }

      for (const faculty of faculty45) {
        await sendReminder(faculty, 45);
      }
    } catch (error) {
      console.error('Error in appraisal reminder job:', error);
    }
  });
};
