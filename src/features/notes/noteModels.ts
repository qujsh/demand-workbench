import type { NoteLocation } from './api/amapSdk';
import type { JSONContent } from '@tiptap/react';
export interface NoteReference {
  recordNo: string;
  title: string | null;
  occurredAt: string | null;
  unavailable: boolean;
}
export interface NoteReview {
  taskNo: string;
  status:
    'queued' | 'running' | 'approved' | 'rejected' | 'review_required' | 'failed' | 'cancelled';
  completedCount: number;
  totalCount: number;
  message: string;
  policyVersion: string;
}
export interface NoteRecord {
  location?: NoteLocation | null;
  review?: NoteReview | null;
  requestedVisibility?: 'private' | 'public';
  referenceNos?: string[];
  references?: NoteReference[];
  id: string;
  title: string;
  body: string;
  document?: JSONContent;
  date: string;
  tags: string[];
  visibility: 'private' | 'public';
  draft?: boolean;
  deleted?: boolean;
  images: string[];
  mediaNos?: string[];
  imageCount?: number;
  version?: number;
  draftVersion?: number | null;
  timelineDate?: string;
}
