import { Schema, model, type Model } from 'mongoose';
import type { SessionAttrs, UserAttrs } from './auth.interface';

const userSchema = new Schema<UserAttrs>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // Never returned by default; login has to ask for it explicitly.
    passwordHash: { type: String, required: true, select: false },
  },
  { timestamps: true },
);

const sessionSchema = new Schema<SessionAttrs>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    // Only the hash is stored, so a database leak does not hand over live refresh tokens.
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

// Serves logout-everywhere and the reuse check on refresh.
sessionSchema.index({ userId: 1 });

// MongoDB removes expired sessions on its own; nothing needs to sweep them.
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const User: Model<UserAttrs> = model<UserAttrs>('User', userSchema);
export const Session: Model<SessionAttrs> = model<SessionAttrs>('Session', sessionSchema);
