import { prisma } from '../db/prisma.js';
import { validate } from 'temporary-email-address-validator'; 

interface AbuseScore {
  score: number; // 0-100, higher = more suspicious
  reasons: string[];
  shouldBlock: boolean;
}

/**
 * Extract domain from email
 */
function getEmailDomain(email: string): string {
  const parts = email.split('@');
  return parts.length === 2 ? parts[1].toLowerCase() : '';
}

/**
 * Check if email is from a temporary email service
 * validate() returns true for valid emails, false for disposable/temporary emails
 */
function isTemporaryEmail(email: string): boolean {
  try {
    const isValid = validate(email);
    // If validation returns false, it's a disposable/temporary email
    return isValid === false;
  } catch (error) {
    // Fallback to false if validation fails
    console.error('Error checking disposable email:', error);
    return false;
  }
}

/**
 * Detect suspicious patterns and return abuse score
 */
export async function detectAbuse(
  email: string,
  ipAddress: string
): Promise<AbuseScore> {
  const reasons: string[] = [];
  let score = 0;

  // Check for temporary email
  if (isTemporaryEmail(email)) {
    score += 30;
    reasons.push('Email appears to be from a temporary email service');
  }

  // Check recent signup attempts from same IP
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentAttempts = await prisma.signupAttempt.count({
      where: {
        ipAddress,
        createdAt: {
          gte: oneHourAgo,
        },
      },
    });

    if (recentAttempts >= 3) {
      score += 25;
      reasons.push(`Multiple signup attempts from same IP (${recentAttempts} in last hour)`);
    } else if (recentAttempts >= 2) {
      score += 10;
      reasons.push(`Multiple signup attempts from same IP (${recentAttempts} in last hour)`);
    }
  } catch (error) {
    console.error('Error checking recent signup attempts:', error);
    // Continue with other checks if this fails
  }

  // Check for multiple accounts from same domain
  try {
    const domain = getEmailDomain(email);
    if (domain) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      // Count signup attempts with same domain in last hour
      const recentSignups = await prisma.user.findMany({
        where: {
          email: {
            endsWith: `@${domain}`,
          },
          createdAt: {
            gte: oneHourAgo,
          },
        },
      });

      if (recentSignups.length >= 5) {
        score += 35;
        reasons.push(`Multiple accounts created from same domain (${recentSignups.length} in last hour)`);
      } else if (recentSignups.length >= 3) {
        score += 15;
        reasons.push(`Multiple accounts created from same domain (${recentSignups.length} in last hour)`);
      }
    }
  } catch (error) {
    console.error('Error checking domain-based signups:', error);
    // Continue with other checks if this fails
  }

  // Check for email pattern similarity (simple heuristic)
  const emailPrefix = email.split('@')[0];
  if (emailPrefix.match(/^\d+$/) && emailPrefix.length > 6) {
    // Email prefix is all numbers and long (suspicious)
    score += 10;
    reasons.push('Email has suspicious pattern (numeric prefix)');
  }

  // Determine if should block (score >= 50)
  const shouldBlock = score >= 50;

  // Log high scores for monitoring
  if (score >= 30) {
    console.warn(`[ABUSE DETECTION] High abuse score: ${score}`, {
      email,
      ipAddress,
      reasons,
    });
  }

  return {
    score,
    reasons,
    shouldBlock,
  };
}

/**
 * Record a signup attempt
 */
export async function recordSignupAttempt(
  email: string,
  ipAddress: string,
  success: boolean
): Promise<void> {
  try {
    await prisma.signupAttempt.create({
      data: {
        email,
        ipAddress,
        success,
      },
    });
  } catch (error) {
    console.error('Error recording signup attempt:', error);
    // Don't throw - this is non-critical logging
  }
}

