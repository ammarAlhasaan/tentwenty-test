import 'express-session';
import type { User } from './auth.service.js';

declare module 'express-session' {
  interface SessionData {
    userId: number;
  }
}

declare global {
  namespace Express {
    interface Request {
      // Set by SessionAuthGuard; present on any route that guard protects.
      authUser?: User;
    }
  }
}
