import { AUDIT_ACTIONS } from '@crossval/shared';
import { Schema, model, type Model } from 'mongoose';
import type { AuditEventAttrs } from './audit.interface';

/**
 * Append only. Nothing in the application updates or deletes a row here, which
 * is the point: the record of what happened has to survive the thing it
 * describes being changed.
 */
const auditEventSchema = new Schema<AuditEventAttrs>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    entityType: { type: String, enum: ['order', 'payment'], required: true },
    entityId: { type: Schema.Types.ObjectId, required: true },
    action: { type: String, enum: AUDIT_ACTIONS, required: true },
    summary: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed },
    at: { type: Date, required: true, default: () => new Date() },
  },
  { versionKey: false },
);

// The timeline on an order detail page, newest first. No TTL: an audit trail
// that expires is not an audit trail.
auditEventSchema.index({ entityType: 1, entityId: 1, at: -1 });

export const AuditEvent: Model<AuditEventAttrs> = model<AuditEventAttrs>(
  'AuditEvent',
  auditEventSchema,
);
