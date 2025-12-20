import express from 'express';
import { prisma } from '../db/prisma.js';

const router = express.Router();

// Join waitlist
router.post('/', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if email already exists in waitlist
    const existing = await prisma.waitlist.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      // Send newsletter welcome email even if already in waitlist (resend functionality)
      try {
        const { sendNewsletterWelcomeEmail, isEmailConfigured } = await import('../services/emailService.js');
        
        if (isEmailConfigured()) {
          await sendNewsletterWelcomeEmail({
            email: normalizedEmail,
          });
        }
      } catch (emailError: any) {
        console.error('Error sending newsletter welcome email:', emailError);
        // Don't fail the request if email fails, but log it
      }

      return res.status(200).json({
        message: 'Email already in waitlist',
        email: normalizedEmail,
      });
    }

    // Add email to waitlist
    const waitlistEntry = await prisma.waitlist.create({
      data: {
        email: normalizedEmail,
      },
    });

    // Send newsletter welcome email
    try {
      const { sendNewsletterWelcomeEmail, isEmailConfigured } = await import('../services/emailService.js');
      
      if (isEmailConfigured()) {
        await sendNewsletterWelcomeEmail({
          email: normalizedEmail,
        });
      } else {
        console.warn('Email service not configured. Newsletter welcome email not sent.');
      }
    } catch (emailError: any) {
      console.error('Error sending newsletter welcome email:', emailError);
      // Don't fail the request if email fails, but log it
    }

    res.status(201).json({
      message: 'Successfully added to waitlist',
      email: waitlistEntry.email,
    });
  } catch (error: any) {
    console.error('Error adding to waitlist:', error);
    res.status(500).json({
      error: 'Failed to add email to waitlist',
      message: error.message,
    });
  }
});

// Get all waitlist entries (admin only - optional, for future use)
router.get('/', async (req, res) => {
  try {
    const waitlist = await prisma.waitlist.findMany({
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      count: waitlist.length,
      entries: waitlist,
    });
  } catch (error: any) {
    console.error('Error fetching waitlist:', error);
    res.status(500).json({
      error: 'Failed to fetch waitlist',
      message: error.message,
    });
  }
});

export default router;






