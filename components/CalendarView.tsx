
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Project, Task, TaskGroup, FilterType } from '../types';
import { addDays, differenceInDays, endOfWeek, eachWeekOfInterval, format, isToday, getYear, getMonth } from 'date-fns';
import { PlusIcon, GroupIcon, XIcon, LinkIcon } from './ui/Icons';
import Button from './ui/Button';
import AddTaskModal from './modals/AddTaskModal';
import { useNotifications } from '../../hooks/useNotifications';

interface CalendarViewProps {
    project: Project;
    onProjectUpdate: (updatedProject: Project) => void;
    isLocked: boolean;
    filter: FilterType;
}

interface DragState {
    task: Task;
    type: 'move' | 'resize-start' | 'resize-end';
    initialMouseX: number;
    initialMouseY: number;
    dayWidth: number;
    weekHeight: number;
    taskInitialStartDate: Date;
    taskInitialEndDate: Date;
    relatedTasks: {
        id: string;
        initialStart: Date;
        initialEnd: Date;
    }[];
}

const WEEK_DAYS = ['日', '一', '二', '三', '四', '五', '六'];

const parseISO = (str: string) => {
    if (str.length === 10) {
        const [y, m, d] = str.split('-').map(Number);
        return new Date(y, m - 1, d);
    }
    return new Date(str);
};

const startOfWeek = (date: Date, options?: any) => {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d;
};

const arrangeTasksInLanes = (tasks: Task[], weekStart: Date) => {
    const lanes: Task[][] = [];
    // Filter tasks that overlap with this week
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 0 });
    const weekTasks = tasks.filter(task => {
        const taskStart = parseISO(task.startDate);
        const taskEnd = parseISO(task.endDate);
        return Math.max(taskStart.getTime(), weekStart.getTime()) <= Math.min(taskEnd.getTime(), weekEnd.getTime());
    });

    const sortedTasks = [...weekTasks].sort((a, b) => {
        const diff = differenceInDays(parseISO(a.startDate), parseISO(b.startDate));
        if (diff !== 0) return diff;
        return differenceInDays(parseISO(b.endDate), parseISO(a.endDate));
    });

    sortedTasks.forEach(task => {
        let placed = false;
        const taskStart = parseISO(task.startDate);
        const taskEnd = parseISO(task.endDate);

        for (let i = 0; i < lanes.length; i++) {
            const lane = lanes[i];
            const hasOverlap = lane.some(existingTask => {
                const existingStart = parseISO(existingTask.startDate);
                const existingEnd = parseISO(existingTask.endDate);
                // Check for overlap specifically within the week context for visual lanes
                // We care about the intersection with the week
                const tStart = Math.max(taskStart.getTime(), weekStart.getTime());
                const tEnd = Math.min(taskEnd.getTime(), weekEnd.getTime());
                const eStart = Math.max(existingStart.getTime(), weekStart.getTime());
                const eEnd = Math.min(existingEnd.getTime(), weekEnd.getTime());
                
                return tStart <= eEnd && tEnd >= eStart;
            });

            if (!hasOverlap) {
                lane.push(task);
                placed = true;
                break;
            }
        }
        if (!placed) {
            lanes.push([task]);
        }
    });
    return lanes;
};

const CalendarView: React.FC<CalendarViewProps> = ({ project, onProjectUpdate, isLocked, filter }) => {
    const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);
    const [modalDates, setModalDates] = useState<{ start: Date, end: Date } | null>(null);
    const [dragState, setDragState] = useState<DragState | null>(null);
    const [tempProject, setTempProject] = useState<Project | null>(null);
    const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
    const { addNotification } = useNotifications();
    const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
    const [editingTaskName, setEditingTaskName] = useState('');
    const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null);
    
    const ignoreClickRef = useRef(false);

    const displayProject = tempProject || project;

    const filteredTasks = useMemo(() => {
        let tasks = displayProject.tasks;
        if (filter.type === 'unit' && filter.value) {
            tasks = tasks.filter(t => t.unitId === filter.value);
        } else if (filter.type === 'group' && filter.value) {
            tasks = tasks.filter(t => t.groupId === filter.value);
        }
        return tasks;
    }, [displayProject.tasks, filter]);

    const unitColorMap = useMemo(() => {
        return displayProject.units.reduce((acc, unit) => {
            acc[unit.id] = unit.color;
            return acc;
        }, {} as Record<string, string>);
    }, [displayProject.units]);

    const weekRange = useMemo(() => {
        if (!displayProject.startDate || !displayProject.endDate) return [];
        
        const projectStart = parseISO(displayProject.startDate);
        const projectEnd = parseISO(displayProject.endDate);

        // Determine effective range including all tasks
        let minDate = projectStart;
        let maxDate = projectEnd;

        if (displayProject.tasks.length > 0) {
            const taskStarts = displayProject.tasks.map(t => parseISO(t.startDate).getTime());
            const taskEnds = displayProject.tasks.map(t => parseISO(t.endDate).getTime());
            minDate = new Date(Math.min(projectStart.getTime(), ...taskStarts));
            maxDate = new Date(Math.max(projectEnd.getTime(), ...taskEnds));
        }

        const start = startOfWeek(minDate, { weekStartsOn: 0 });
        const end = endOfWeek(maxDate, { weekStartsOn: 0 });

        return eachWeekOfInterval({ start, end }, { weekStartsOn: 0 });
    }, [displayProject.startDate, displayProject.endDate, displayProject.tasks]);

    const monthGroups = useMemo(() => {
        const groups: { id: string; year: number; month: number; weeks: Date[] }[] = [];
        weekRange.forEach(weekStart => {
            // Determine the month by looking at the majority of days or Thursday
            const thursday = addDays(weekStart, 3);
            const year = getYear(thursday);
            const month = getMonth(thursday);
            const id = `${year}-${month}`;

            let group = groups.find(g => g.id === id);
            if (!group) {
                group = { id, year, month, weeks: [] };
                groups.push(group);
            }
            group.weeks.push(weekStart);
        });
        return groups;
    }, [weekRange]);

    const handleAddTask = (task: Omit<Task, 'id' | 'unitId'>) => {
        const newTask: Task = {
            ...task,
            id: crypto.randomUUID(),
            unitId: project.units[0]?.id || null,
        };
        const updatedProject = { ...project, tasks: [...project.tasks, newTask] };
        onProjectUpdate(updatedProject);
    };

    const handleDragToCreate = (start: Date, end: Date) => {
        if (isLocked) return;
        const sortedDates = [start, end].sort((a, b) => a.getTime() - b.getTime());
        setModalDates({ start: sortedDates[0], end: sortedDates[1] });
        setIsAddTaskModalOpen(true);
    };

    const handleTaskDragStart = useCallback((taskProp: Task, type: DragState['type'], e: React.MouseEvent) => {
        if (isLocked) return;
        e.stopPropagation();
        ignoreClickRef.current = false;
        if (editingTaskId) return;

        const weekGridEl = (e.currentTarget as HTMLElement).closest('.task-week-grid');
        if (!weekGridEl) return;
        const weekRect = weekGridEl.getBoundingClientRect();
        const dayWidth = weekRect.width / 7;
        const weekHeight = weekRect.height;
        
        setTempProject(project);

        const task = project.tasks.find(t => t.id === taskProp.id) || taskProp;

        let relatedTasks: DragState['relatedTasks'] = [];
        if (task.groupId && type === 'move') {
            relatedTasks = project.tasks
                .filter(t => t.groupId === task.groupId)
                .map(t => ({
                    id: t.id,
                    initialStart: parseISO(t.startDate),
                    initialEnd: parseISO(t.endDate)
                }));
        } else {
            relatedTasks = [{
                id: task.id,
                initialStart: parseISO(task.startDate),
                initialEnd: parseISO(task.endDate)
            }];
        }

        setDragState({
            task,
            type,
            initialMouseX: e.clientX,
            initialMouseY: e.clientY,
            dayWidth,
            weekHeight: weekHeight > 0 ? weekHeight : 120,
            taskInitialStartDate: parseISO(task.startDate),
            taskInitialEndDate: parseISO(task.endDate),
            relatedTasks
        });
    }, [project, editingTaskId, isLocked]);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!dragState || !tempProject) return;

        const dx = e.clientX - dragState.initialMouseX;
        const dy = e.clientY - dragState.initialMouseY;
        
        if (Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
        ignoreClickRef.current = true;

        if (dragState.type === 'move') {
            const dayOffsetHorizontal = Math.round(dx / dragState.dayWidth);
            const weekOffsetVertical = dragState.weekHeight > 0 ? Math.round(dy / dragState.weekHeight) : 0;
            const totalDayOffset = dayOffsetHorizontal + (weekOffsetVertical * 7);
            
            const newTasks = [...tempProject.tasks];
            dragState.relatedTasks.forEach(related => {
                const newStart = addDays(related.initialStart, totalDayOffset);
                const duration = differenceInDays(related.initialEnd, related.initialStart);
                const newEnd = addDays(newStart, duration);
                const index = newTasks.findIndex(t => t.id === related.id);
                if (index !== -1) {
                    newTasks[index] = { 
                        ...newTasks[index], 
                        startDate: newStart.toISOString(), 
                        endDate: newEnd.toISOString() 
                    };
                }
            });
            setTempProject({ ...tempProject, tasks: newTasks });
        } else {
            const dayOffset = Math.round(dx / dragState.dayWidth);
            let newStartDate = new Date(dragState.taskInitialStartDate);
            let newEndDate = new Date(dragState.taskInitialEndDate);

            if (dragState.type === 'resize-start') {
                 newStartDate = addDays(dragState.taskInitialStartDate, dayOffset);
                 if (newStartDate > newEndDate) newStartDate = newEndDate;
            } else {
                 newEndDate = addDays(dragState.taskInitialEndDate, dayOffset);
                 if (newEndDate < newStartDate) newEndDate = newStartDate;
            }
            const updatedTask: Task = { ...dragState.task, startDate: newStartDate.toISOString(), endDate: newEndDate.toISOString() };
            setTempProject({ ...tempProject, tasks: tempProject.tasks.map(t => t.id === updatedTask.id ? updatedTask : t) });
        }
    }, [dragState, tempProject]);

    const handleMouseUp = useCallback(() => {
        if (dragState && tempProject) {
            onProjectUpdate(tempProject);
        }
        setDragState(null);
        setTempProject(null);
    }, [dragState, tempProject, onProjectUpdate]);

    useEffect(() => {
        if (dragState) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            document.body.style.userSelect = 'none';
            document.body.style.cursor = dragState.type === 'move' ? 'grabbing' : 'ew-resize';
        } else {
            document.body.style.userSelect = 'auto';
            document.body.style.cursor = 'default';
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            document.body.style.userSelect = 'auto';
            document.body.style.cursor = 'default';
        };
    }, [dragState, handleMouseMove, handleMouseUp]);

    const handleTaskClick = useCallback((taskId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (editingTaskId) return;
        if (ignoreClickRef.current) return;

        const newSelection = new Set(selectedTaskIds);
        if (e.ctrlKey || e.metaKey) {
            newSelection.has(taskId) ? newSelection.delete(taskId) : newSelection.add(taskId);
        } else {
            newSelection.clear();
            newSelection.add(taskId);
        }
        setSelectedTaskIds(newSelection);
    }, [selectedTaskIds, editingTaskId]);

    const handleDayMouseDown = (e: React.MouseEvent, day: Date, ref: React.MutableRefObject<Date | null>) => {
        if (editingTaskId) return;
        if (!e.ctrlKey && !e.metaKey) {
            setSelectedTaskIds(new Set());
        }
        if (!isLocked) {
            ref.current = day;
        }
    };

    const handleCreateGroup = () => {
        if (isLocked) return;
        const groupName = prompt("請輸入新群組的名稱：", "新任務群組");
        if (!groupName || groupName.trim() === '') return;
        const selectedTasks = Array.from(selectedTaskIds)
            .map(id => project.tasks.find(t => t.id === id)!)
            .filter(Boolean)
            .sort((a, b) => parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime());
        
        if (selectedTasks.length < 2) {
            addNotification("請至少選擇兩個任務來建立群組", "info");
            return;
        }
        const taskIds = selectedTasks.map(t => t.id);
        const intervals = selectedTasks.slice(0, -1).map((task, i) => 
            Math.max(0, differenceInDays(parseISO(selectedTasks[i+1].startDate), parseISO(task.endDate)))
        );
        const newGroupId = crypto.randomUUID();
        const cleanedGroups = project.groups.map(g => {
            const remainingTaskIds = g.taskIds.filter(id => !taskIds.includes(id));
            if (remainingTaskIds.length === 0) return null;
            if (remainingTaskIds.length !== g.taskIds.length) {
                const remainingTasks = remainingTaskIds
                    .map(id => project.tasks.find(t => t.id === id))
                    .filter((t): t is Task => !!t)
                    .sort((a, b) => parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime());
                const newIntervals = remainingTasks.length > 1 
                    ? remainingTasks.slice(0, -1).map((t, i) => Math.max(0, differenceInDays(parseISO(remainingTasks[i+1].startDate), parseISO(t.endDate))))
                    : [];
                return { ...g, taskIds: remainingTaskIds, intervals: newIntervals };
            }
            return g;
        }).filter((g): g is TaskGroup => g !== null);

        const newGroup = { id: newGroupId, name: groupName, taskIds, intervals };
        const updatedTasks = project.tasks.map(task => 
            taskIds.includes(task.id) ? { ...task, groupId: newGroupId } : task
        );
        onProjectUpdate({ ...project, tasks: updatedTasks, groups: [...cleanedGroups, newGroup] });
        addNotification(`群組 "${groupName}" 已成功建立`, 'success');
        setSelectedTaskIds(new Set());
    };

    const handleUnitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        if (isLocked) return;
        const newUnitId = e.target.value;
        if (!newUnitId) return;
        const updatedTasks = project.tasks.map(task =>
            selectedTaskIds.has(task.id) ? { ...task, unitId: newUnitId } : task
        );
        onProjectUpdate({ ...project, tasks: updatedTasks });
        addNotification(`已更新 ${selectedTaskIds.size} 個任務的執行單位`, 'info');
    };

    const handleEditStart = (task: Task) => {
        if (isLocked) return;
        setDragState(null);
        setSelectedTaskIds(new Set([task.id]));
        setEditingTaskId(task.id);
        setEditingTaskName(task.name);
    };

    const handleEditSave = () => {
        if (!editingTaskId) return;
        const trimmedName = editingTaskName.trim();
        if (!trimmedName) {
            setEditingTaskId(null);
            return;
        }
        const updatedTasks = project.tasks.map(t =>
            t.id === editingTaskId ? { ...t, name: trimmedName } : t
        );
        onProjectUpdate({ ...project, tasks: updatedTasks });
        setEditingTaskId(null);
    };

    const handleEditKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleEditSave();
        } else if (e.key === 'Escape') {
            setEditingTaskId(null);
        }
    };

    return (
        <div className="relative">
            <div className="bg-white shadow-lg rounded-lg overflow-hidden border-2 border-black">
                {/* Header Row */}
                <div className="flex border-b-2 border-black">
                     <div className="w-20 flex-shrink-0 border-r-2 border-black bg-gray-50"></div>
                     <div className="flex-grow grid grid-cols-7">
                        {WEEK_DAYS.map(day => (
                            <div key={day} className="text-center font-bold text-sm py-2 bg-gray-50 border-r-2 border-black last:border-r-0 text-gray-800">
                                {day}
                            </div>
                        ))}
                     </div>
                </div>

                {/* Body */}
                <div className="flex flex-col">
                    {monthGroups.length === 0 ? (
                        <div className="text-center py-20">
                            <h3 className="text-xl font-semibold text-gray-700">專案沒有設定有效期間</h3>
                            <p className="text-gray-500 mt-2">請確認專案的開始與結束日期。</p>
                        </div>
                    ) : (
                        monthGroups.map((group, groupIndex) => (
                            <div key={group.id} className={`flex ${groupIndex !== monthGroups.length - 1 ? 'border-b-2 border-black' : ''}`}>
                                {/* Left Sidebar: Year/Month */}
                                <div className="w-20 flex-shrink-0 border-r-2 border-black flex flex-col items-center justify-center bg-white p-2">
                                    <span className="text-sm text-gray-500 font-medium">{group.year}</span>
                                    <span className="text-xl font-bold text-gray-800 writing-mode-vertical">{group.month + 1}月</span>
                                </div>

                                {/* Right Side: Weeks */}
                                <div className="flex-grow flex flex-col">
                                    {group.weeks.map((weekStart, weekIndex) => (
                                        <WeekRow
                                            key={weekStart.toISOString()}
                                            weekStart={weekStart}
                                            tasks={filteredTasks}
                                            unitColorMap={unitColorMap}
                                            selectedTaskIds={selectedTaskIds}
                                            onDragToCreate={handleDragToCreate}
                                            onTaskDragStart={handleTaskDragStart}
                                            onTaskClick={handleTaskClick}
                                            onDayMouseDown={handleDayMouseDown}
                                            editingTaskId={editingTaskId}
                                            editingTaskName={editingTaskName}
                                            onEditStart={handleEditStart}
                                            onEditingTaskNameChange={setEditingTaskName}
                                            onEditSave={handleEditSave}
                                            onEditKeyDown={handleEditKeyDown}
                                            isLocked={isLocked}
                                            hoveredGroupId={hoveredGroupId}
                                            onTaskMouseEnter={(groupId) => groupId && setHoveredGroupId(groupId)}
                                            onTaskMouseLeave={() => setHoveredGroupId(null)}
                                            isLastWeek={weekIndex === group.weeks.length - 1}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {!isLocked && (
                <div className="fixed bottom-8 right-8 z-40 no-print">
                    <Button onClick={() => { setModalDates(null); setIsAddTaskModalOpen(true); }} variant="primary" className="rounded-full shadow-lg !p-4">
                        <PlusIcon className="w-6 h-6" />
                    </Button>
                </div>
            )}
            
            {selectedTaskIds.size > 0 && !isLocked && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-white/80 backdrop-blur-sm p-2 rounded-lg shadow-lg flex items-center gap-3 border border-gray-200 no-print">
                    <span className="text-sm font-medium text-gray-700 px-2">{`已選取 ${selectedTaskIds.size} 個任務`}</span>
                    {selectedTaskIds.size > 1 && (
                        <Button onClick={handleCreateGroup} variant="secondary" size="sm"><GroupIcon className="w-4 h-4 mr-1.5"/>建立時間關聯</Button>
                    )}
                    <select onChange={handleUnitChange} defaultValue="" className="text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white text-gray-800">
                        <option value="" disabled>變更執行單位...</option>
                        {project.units.map(unit => (
                            <option key={unit.id} value={unit.id}>{unit.name}</option>
                        ))}
                    </select>
                    <Button onClick={() => setSelectedTaskIds(new Set())} variant="icon" size="sm" title="取消選取">
                        <XIcon className="w-5 h-5 text-gray-500" />
                    </Button>
                </div>
            )}
            
            {isAddTaskModalOpen && (
                <AddTaskModal
                    onClose={() => setIsAddTaskModalOpen(false)}
                    onAddTask={handleAddTask}
                    initialStartDate={modalDates?.start}
                    initialEndDate={modalDates?.end}
                />
            )}
        </div>
    );
};

interface WeekRowProps {
    weekStart: Date;
    tasks: Task[];
    unitColorMap: Record<string, string>;
    selectedTaskIds: Set<string>;
    onDragToCreate: (start: Date, end: Date) => void;
    onTaskDragStart: (task: Task, type: 'move' | 'resize-start' | 'resize-end', e: React.MouseEvent) => void;
    onTaskClick: (taskId: string, e: React.MouseEvent) => void;
    onDayMouseDown: (e: React.MouseEvent, day: Date, ref: React.MutableRefObject<Date | null>) => void;
    editingTaskId: string | null;
    editingTaskName: string;
    onEditStart: (task: Task) => void;
    onEditingTaskNameChange: (name: string) => void;
    onEditSave: () => void;
    onEditKeyDown: (e: React.KeyboardEvent) => void;
    isLocked: boolean;
    hoveredGroupId: string | null;
    onTaskMouseEnter: (groupId: string | undefined) => void;
    onTaskMouseLeave: () => void;
    isLastWeek: boolean;
}

const WeekRow: React.FC<WeekRowProps> = ({ weekStart, tasks, unitColorMap, selectedTaskIds, onDragToCreate, onTaskDragStart, onTaskClick, onDayMouseDown, editingTaskId, editingTaskName, onEditStart, onEditingTaskNameChange, onEditSave, onEditKeyDown, isLocked, hoveredGroupId, onTaskMouseEnter, onTaskMouseLeave, isLastWeek }) => {
    const dragStartRef = useRef<Date | null>(null);
    
    const weekDays = useMemo(() => {
        // weekStart is already the start of the week from eachWeekOfInterval
        const start = startOfWeek(weekStart, { weekStartsOn: 0 });
        return Array.from({ length: 7 }, (_, i) => addDays(start, i));
    }, [weekStart]);

    const taskLanes = useMemo(() => arrangeTasksInLanes(tasks, weekStart), [tasks, weekStart]);

    const handleDayMouseUp = (day: Date) => {
        if(dragStartRef.current) {
            onDragToCreate(dragStartRef.current, day);
        }
        dragStartRef.current = null;
    };

    return (
        <div className={`relative grid grid-cols-7 border-black task-week-grid min-h-[120px] ${!isLastWeek ? 'border-b' : ''}`}>
            {/* Day Cells */}
            {weekDays.map((day) => (
                <div 
                    key={day.toISOString()} 
                    className={`relative border-r-2 border-black flex flex-col justify-start items-start p-1 last:border-r-0 ${!isLocked ? 'cursor-pointer' : ''}`}
                    onMouseDown={(e) => onDayMouseDown(e, day, dragStartRef)}
                    onMouseUp={() => { if(!isLocked) handleDayMouseUp(day); }}
                >
                    <span className={`text-2xl font-bold z-0 ${isToday(day) ? 'text-blue-600' : 'text-gray-200'}`}>
                        {format(day, 'd')}
                    </span>
                </div>
            ))}

            {/* Tasks Layer */}
            <div className="col-start-1 col-span-7 row-start-1 grid mt-8 gap-y-1 pointer-events-none"
                style={{
                    gridTemplateColumns: 'repeat(7, 1fr)',
                    gridAutoRows: 'min-content',
                    paddingBottom: '8px'
                }}
            >
                {taskLanes.map((lane, laneIndex) => (
                    <React.Fragment key={laneIndex}>
                        {lane.map(task => {
                            const taskStart = parseISO(task.startDate);
                            const taskEnd = parseISO(task.endDate);
                            const weekEnd = endOfWeek(weekStart, { weekStartsOn: 0 });
                            
                            // Determine grid column based on week intersection
                            const effectiveStart = taskStart < weekStart ? weekStart : taskStart;
                            const effectiveEnd = taskEnd > weekEnd ? weekEnd : taskEnd;
                            
                            const startDayIndex = differenceInDays(effectiveStart, weekStart);
                            const endDayIndex = differenceInDays(effectiveEnd, weekStart);
                            
                            const color = task.unitId ? unitColorMap[task.unitId] : '#a0aec0';
                            const isSelected = selectedTaskIds.has(task.id);
                            const isEditing = editingTaskId === task.id;
                            const isGrouped = !!task.groupId;
                            const isGroupHovered = hoveredGroupId && task.groupId === hoveredGroupId;

                            return (
                                <div
                                    key={task.id}
                                    className={`relative rounded-sm px-1.5 text-black text-sm font-medium pointer-events-auto group flex items-start py-1 transition-all duration-100 task-bar 
                                    ${isSelected ? 'ring-2 ring-blue-500 ring-offset-1 z-10' : ''} 
                                    ${isGroupHovered ? 'ring-2 ring-yellow-400 ring-offset-1 z-20 shadow-lg brightness-110' : ''} 
                                    ${isLocked ? 'cursor-default' : ''} border border-black/20 shadow-sm leading-tight`}
                                    onClick={(e) => onTaskClick(task.id, e)}
                                    onMouseDown={(e) => { if (!isEditing) onTaskDragStart(task, 'move', e); }}
                                    onDoubleClick={(e) => { e.stopPropagation(); onEditStart(task); }}
                                    onMouseEnter={() => onTaskMouseEnter(task.groupId)}
                                    onMouseLeave={onTaskMouseLeave}
                                    style={{
                                        backgroundColor: color,
                                        gridRowStart: laneIndex + 1,
                                        gridColumnStart: Math.max(1, startDayIndex + 1),
                                        gridColumnEnd: Math.min(8, endDayIndex + 2),
                                        marginLeft: '2px',
                                        marginRight: '2px',
                                        cursor: isLocked ? 'default' : (isEditing ? 'default' : 'move'),
                                    }}
                                    title={task.name}
                                >
                                    {isEditing ? (
                                        <textarea
                                            value={editingTaskName}
                                            onChange={(e) => onEditingTaskNameChange(e.target.value)}
                                            onBlur={onEditSave}
                                            onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) onEditKeyDown(e); }}
                                            autoFocus
                                            onMouseDown={e => e.stopPropagation()}
                                            className="w-full h-full bg-white/90 text-black text-sm px-1 rounded border-none focus:ring-1 focus:ring-blue-500 resize-none overflow-hidden min-h-[20px]"
                                            rows={Math.max(1, Math.ceil(editingTaskName.length / 10))}
                                        />
                                    ) : (
                                        <>
                                            {!isLocked && (
                                                <div 
                                                    className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize z-10"
                                                    onMouseDown={(e) => onTaskDragStart(task, 'resize-start', e)}
                                                />
                                            )}
                                            <div className="flex items-start w-full overflow-hidden">
                                                {isGrouped && <LinkIcon className="w-3 h-3 mr-1 mt-0.5 flex-shrink-0 text-black/70" />}
                                                <p className="pointer-events-none whitespace-normal break-words w-full text-[13px] font-semibold">{task.name}</p>
                                            </div>
                                            {!isLocked && (
                                                <div 
                                                    className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize z-10"
                                                    onMouseDown={(e) => onTaskDragStart(task, 'resize-end', e)}
                                                />
                                            )}
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
};

export default CalendarView;
