import type { AuditAction, AuditEvent as AuditEventDto } from '@crossval/shared';
import type { ClientSession, Types } from 'mongoose';
import { AuditEvent } from './audit.model';
import type { AuditEntityType } from './audit.interface';

type RecordInput = {
  userId: Types.ObjectId;
  entityType: AuditEntityType;
  entityId: Types.ObjectId;
  action: AuditAction;
  summary: string;
  metadata?: Record<string, unknown>;
};

/**
 * Takes an optional session so an audit row commits with the change it
 * describes: if the write rolls back, the log entry goes with it.
 */
const record = async (input: RecordInput, session?: ClientSession): Promise<void> => {
  await AuditEvent.create([{ ...input, at: new Date() }], session ? { session } : {});
};

const listForEntity = async (
  entityType: AuditEntityType,
  entityId: Types.ObjectId,
  userId: Types.ObjectId,
): Promise<AuditEventDto[]> => {
  const events = await AuditEvent.find({ entityType, entityId, userId }).sort({ at: -1 }).lean();

  return events.map((event) => ({
    id: event._id.toString(),
    action: event.action,
    summary: event.summary,
    at: event.at.toISOString(),
    actor: null,
  }));
};

export const auditService = {
  record,
  listForEntity,
};
