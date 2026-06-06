import cron from 'node-cron';
import prisma from '../lib/prisma.js';
import { sendEmail } from '../lib/email.js';

export const initAppraisalReminderJob = () => {
  // Run every day at 8:00 AM
  cron.schedule('0 8 * * *', async () => {
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
      // We are looking for people whose joining date anniversary is exactly 45 days from today.
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + 45);
      
      const targetMonth = targetDate.getMonth();
      const targetDay = targetDate.getDate();

      const facultyToRemind = users.filter((user) => {
        if (!user.joining_date) return false;
        const jDate = new Date(user.joining_date);
        return jDate.getMonth() === targetMonth && jDate.getDate() === targetDay;
      });

      console.log(`Found ${facultyToRemind.length} faculty members needing reminders.`);

      for (const faculty of facultyToRemind) {
        const subject = 'Annual Appraisal Application Reminder';
        const body = `
          <h2>Appraisal Reminder</h2>
          <p>Dear ${faculty.name},</p>
          <p>This is a reminder that your annual appraisal is due soon. Your joining date anniversary is exactly 45 days from today.</p>
          <p>Please log in to the Appraisal System to fill out and submit your application form.</p>
          <br/>
          <p>Best regards,<br/>Admin Team</p>
        `;
        await sendEmail(faculty.email, subject, body);
      }
    } catch (error) {
      console.error('Error in appraisal reminder job:', error);
    }
  });
};
