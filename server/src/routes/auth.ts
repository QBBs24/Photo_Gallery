import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { generateToken, authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, email, password, passwordConfirm } = req.body;

    if (!username || !email || !password || !passwordConfirm) {
      return res.status(400).json({
        error: 'Please fill in all registration fields (Username, Email, Password, Confirm Password).',
      });
    }

    if (password !== passwordConfirm) {
      return res.status(400).json({
        error: 'The passwords you entered do not match. Please ensure both fields are identical.',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: 'Password must be at least 6 characters in length.',
      });
    }

    const trimmedUsername = username.trim();
    const normalizedEmail = email.trim().toLowerCase();

    // Check unique username or email
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ username: trimmedUsername }, { email: normalizedEmail }],
      },
    });

    if (existing) {
      if (existing.username.toLowerCase() === trimmedUsername.toLowerCase()) {
        return res.status(409).json({
          error: `The username '${trimmedUsername}' is already taken. Please choose another.`,
        });
      }
      return res.status(409).json({
        error: `An account with the email '${normalizedEmail}' already exists. Please log in instead.`,
      });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await prisma.user.create({
      data: {
        username: trimmedUsername,
        email: normalizedEmail,
        passwordHash,
      },
    });

    const token = generateToken({
      id: user.id,
      username: user.username,
      email: user.email,
    });

    res.status(201).json({
      success: true,
      message: 'Account successfully registered.',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: 'An unexpected server error occurred during registration. Please try again.',
    });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { identifier, password } = req.body; // identifier can be username or email

    if (!identifier || !password) {
      return res.status(400).json({
        error: 'Please enter both your username or email, and your password.',
      });
    }

    const lookup = identifier.trim();

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: { equals: lookup, mode: 'insensitive' } },
          { email: { equals: lookup.toLowerCase(), mode: 'insensitive' } },
        ],
      },
    });

    if (!user) {
      return res.status(401).json({
        error: 'Invalid credentials. No user was found matching that username or email.',
      });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        error: 'Invalid password. Please verify your password and try again.',
      });
    }

    const token = generateToken({
      id: user.id,
      username: user.username,
      email: user.email,
    });

    res.json({
      success: true,
      message: 'Welcome back! You have successfully logged in.',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'An unexpected server error occurred during login. Please try again.',
    });
  }
});

// POST /api/auth/forgot-password (Request reset token)
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Please provide your account email address.' });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (!user) {
      // Security best practice: don't reveal email existence, but in user prompt for natural language UX:
      return res.status(404).json({
        error: `No registered account found with email '${email}'. Please verify your address.`,
      });
    }

    // Generate random 32-char hex token
    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour validity

    await prisma.passwordResetToken.create({
      data: {
        token,
        userId: user.id,
        expiresAt,
      },
    });

    res.json({
      success: true,
      message: 'A password reset token has been generated.',
      resetToken: token, // Returned for UI display / direct flow
    });
  } catch (error: any) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      error: 'An error occurred while creating the password reset request.',
    });
  }
});

// POST /api/auth/reset-password (Confirm reset token & set new password)
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, newPassword, confirmPassword } = req.body;

    if (!token || !newPassword || !confirmPassword) {
      return res.status(400).json({
        error: 'Please provide the reset token, your new password, and password confirmation.',
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        error: 'New passwords do not match. Please ensure both fields are identical.',
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        error: 'The new password must be at least 6 characters long.',
      });
    }

    const resetRecord = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!resetRecord || resetRecord.usedAt) {
      return res.status(400).json({
        error: 'The password reset token is invalid or has already been used.',
      });
    }

    if (resetRecord.expiresAt < new Date()) {
      return res.status(400).json({
        error: 'This password reset token has expired. Please request a new one.',
      });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetRecord.userId },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetRecord.id },
        data: { usedAt: new Date() },
      }),
    ]);

    res.json({
      success: true,
      message: 'Your password has been successfully reset! You can now log in with your new credentials.',
    });
  } catch (error: any) {
    console.error('Password reset error:', error);
    res.status(500).json({
      error: 'An unexpected server error occurred while resetting the password.',
    });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated.' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        username: true,
        email: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User profile not found.' });
    }

    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve profile.' });
  }
});

export default router;
