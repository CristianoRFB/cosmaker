export type ScheduleBlockType = 'pause' | 'leave' | 'vacation' | 'other';
export type ScheduleRiskLevel = 'high' | 'medium' | 'planning' | 'clear' | 'unknown';

export interface MemberCapacity {
  memberId: string;
  memberName: string;
  memberEmail: string;
  weeklyHoursByWeekday: Record<string, number>;
  workdayStartMinute: number;
  workdayEndMinute: number;
  timezone: string;
  weeklyHours: number;
}

export interface ProductionSlot {
  id: string;
  atelierId: string;
  date: string;
  orderId: string;
  stageId: string;
  stageName: string;
  assignedTo: string;
  assignedName: string;
  startAt: string;
  endAt: string;
  timezone: string;
  plannedHours: number;
  status: 'scheduled' | 'cancelled';
}

export interface ScheduleBlock {
  id: string;
  groupId: string;
  atelierId: string;
  memberId: string;
  memberName: string;
  date: string;
  endDate: string;
  startMinute: number;
  endMinute: number;
  allDay: boolean;
  timezone?: string;
  type: ScheduleBlockType;
  title: string;
  status: 'active' | 'cancelled';
}

export interface ScheduleOrderStage {
  id: string;
  orderId: string;
  character: string;
  clientName: string;
  status: string;
  progress: number;
  deadline: string | null;
  assignedTo: string | null;
  scheduledHours: number;
  riskLevel: ScheduleRiskLevel;
  riskReasons: string[];
}

export interface ScheduleWorkspace {
  fromDate: string;
  toDate: string;
  members: MemberCapacity[];
  slots: ProductionSlot[];
  blocks: ScheduleBlock[];
  stages: ScheduleOrderStage[];
  events: import('./event').AtelierEvent[];
  capacityByDate: Array<{ memberId: string; date: string; capacityHours: number; allocatedHours: number; blockedHours: number }>;
}
