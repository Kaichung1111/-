
export interface ExecutingUnit {
  id: string;
  name: string;
  color: string;
}

export interface Task {
  id: string;
  name: string;
  startDate: string; // ISO string format
  endDate: string; // ISO string format
  unitId: string | null;
  groupId?: string;
}

export interface TaskGroup {
  id: string;
  name: string;
  taskIds: string[]; // Ordered list of task IDs
  intervals: number[]; // Interval days between tasks, length is taskIds.length - 1
}

export interface Project {
  id: string;
  name: string;
  startDate: string; // ISO string format
  endDate: string; // ISO string format
  tasks: Task[];
  units: ExecutingUnit[];
  groups: TaskGroup[];
}

export type ViewMode = 'calendar' | 'group';
