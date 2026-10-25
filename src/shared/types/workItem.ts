export type WorkItemType = 'module' | 'feature' | 'work' | 'subtask';
export type WorkItemStatus = '未开始' | '待开发' | '进行中' | '待验收' | '已完成';
export type WorkItemPriority = '' | '高' | '中' | '低';
export type RequirementStage = '草稿' | '已发布' | '已取消';

export interface WorkItemNode {
  id: string;
  type: WorkItemType;
  name: string;
  description?: string;
  acceptance?: string;
  status?: WorkItemStatus;
  role?: string;
  priority?: WorkItemPriority;
  startDate?: string | null;
  endDate?: string | null;
  dependency?: string;
  selected?: boolean;
  children?: WorkItemNode[];
}

export interface Requirement {
  id: string;
  title: string;
  description?: string;
  aiDescription?: string;
  updated: string;
  stage: RequirementStage;
  modules: number;
  items: number;
  currentDecompositionNo?: string;
}
