import type { AuditAction } from '@crossval/shared';
import type { Types } from 'mongoose';

export type AuditEntityType = 'order' | 'payment';

export type AuditEventAttrs = {
  userId: Types.ObjectId;
  entityType: AuditEntityType;
  entityId: Types.ObjectId;
  action: AuditAction;
  /** Written for a person to read in the timeline, not for querying. */
  summary: string;
  metadata?: Record<string, unknown>;
  at: Date;
};
