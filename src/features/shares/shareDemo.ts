import type { JSONContent } from '@tiptap/react';
export interface ShareReference {
  recordNo: string;
  title: string | null;
  occurredAt: string | null;
  unavailable: boolean;
}
export interface ShareReview {
  taskNo: string;
  status:
    'queued' | 'running' | 'approved' | 'rejected' | 'review_required' | 'failed' | 'cancelled';
  completedCount: number;
  totalCount: number;
  message: string;
  policyVersion: string;
}
export interface ShareRecord {
  review?: ShareReview | null;
  requestedVisibility?: 'private' | 'public';
  referenceNos?: string[];
  references?: ShareReference[];
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
export const initialRecords: ShareRecord[] = [
  {
    id: 'one',
    title: '把想法留下来，慢慢看见自己的成长',
    body: '以前总觉得，只有做成一件大事才值得记录。\n最近开始觉得，那些还没想清楚的念头、解决一个小问题的过程，也都值得被留下。\n\n不着急定义自己，先认真记录每一步。',
    date: '2026-11-02T09:30',
    tags: ['思考', '成长'],
    visibility: 'private',
    images: [],
  },
  {
    id: 'two',
    title: '一家独立书店的午后',
    body: '完成了这次书店空间摄影。想保留的不是整齐的书架，而是光线落进来的时候，那种让人愿意慢下来的感觉。\n从前期沟通、现场拍摄到最后选片，又积累了一点新的经验。',
    date: '2026-11-01T15:20',
    tags: ['摄影', '项目记录', '作品'],
    visibility: 'public',
    images: [
      'https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=900&q=85',
      'https://images.unsplash.com/photo-1491841550275-ad7854e35ca6?auto=format&fit=crop&w=600&q=85',
    ],
  },
  {
    id: 'three',
    title: '第一次独立带完一个项目',
    body: '今天项目正式交付了。最有收获的不是多学了一个工具，而是学会了把复杂的问题说清楚，让不同的人朝同一个方向前进。\n\n记住这次的三个关键词：明确边界、及时沟通、给变化留余地。',
    date: '2026-10-28T18:40',
    tags: ['工作', '项目记录', '成长'],
    visibility: 'private',
    images: [],
  },
  {
    id: 'four',
    title: '新的起点，开始一段新的工作旅程',
    body: '今天正式加入新的团队。带着好奇心出发，希望能做出一些真正有用的东西。',
    date: '2022-09-12T09:00',
    tags: ['工作', '成长'],
    visibility: 'private',
    images: [],
  },
  {
    id: 'draft',
    title: '关于自由职业的一些想法',
    body: '自由，也意味着主动安排自己的节奏。',
    date: '2026-11-02T08:00',
    tags: ['思考'],
    visibility: 'private',
    draft: true,
    images: [],
  },
];
