
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Project, Task, TaskGroup } from '../types';
import { addDays, differenceInDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, format, isSameMonth, isToday, parseISO } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { PlusIcon, GroupIcon, XIcon, LinkIcon } from './ui/Icons';
import Button from './ui/Button';
import AddTaskModal from './modals/AddTaskModal';
import { useNotifications } from '../hooks/useNotifications';

interface CalendarViewProps {
    project: Project;
    onProjectUpdate: (updatedProject: Project) => void;
    isLocked: boolean;
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
    // For group dragging: store initial state of all related tasks
    relatedTasks: {
        id: string;
        initialStart: Date;
        initialEnd: Date;
    }[];
}

const WEEK_DAYS = ['日', '一', '二', '三', '四', '五', '六'];

const arrangeTasksInLanes = (tasks: Task[]) => {
    const lanes: Task[][] = [];
    const sortedTasks = [...tasks].sort((a, b) => {
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
                return Math.max(taskStart.getTime(), existingStart.getTime()) <= Math.min(taskEnd.getTime(), existingEnd.getTime());
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


const CalendarView: React.FC<CalendarViewProps> = ({ project, onProjectUpdate, isLocked }) => {
    const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);
    const [modalDates, setModalDates] = useState<{ start: Date, end: Date } | null>(null);
    const [dragState, setDragState] = useState<DragState | null>(null);
    const [tempProject, setTempProject] = useState<Project | null>(null);
    const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
    const { addNotification } = useNotifications();
    const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
    const [editingTaskName, setEditingTaskName] = useState('');
    const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null);
    
    // Ref to distinguish between click and drag
    const ignoreClickRef = useRef(false);

    const displayProject = tempProject || project;

    const unitColorMap = useMemo(() => {
        return displayProject.units.reduce((acc, unit) => {
            acc[unit.id] = unit.color;
            return acc;
        }, {} as Record<string, string>);
    }, [displayProject.units]);

    const months = useMemo(() => {
        if (!displayProject.startDate || !displayProject.endDate) return [];
        const projectStart = parseISO(displayProject.startDate);
        const projectEnd = parseISO(displayProject.endDate);

        const minDate = displayProject.tasks.length > 0
            ? new Date(Math.min(projectStart.getTime(), ...displayProject.tasks.map(t => parseISO(t.startDate).getTime())))
            : projectStart;
        const maxDate = displayProject.tasks.length > 0
            ? new Date(Math.max(projectEnd.getTime(), ...displayProject.tasks.map(t => parseISO(t.endDate).getTime())))
            : projectEnd;
        
        const monthsInRange: Date[] = [];
        let currentMonth = startOfMonth(minDate);
        while (currentMonth <= maxDate) {
            monthsInRange.push(currentMonth);
            currentMonth = addDays(endOfMonth(currentMonth), 1);
        }
        if (monthsInRange.length === 0) {
            monthsInRange.push(startOfMonth(new Date()));
        }
        return monthsInRange;
    }, [displayProject.tasks, displayProject.startDate, displayProject.endDate]);

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
        
        // Reset the click ignore flag on mouse down
        ignoreClickRef.current = false;

        if (editingTaskId) return;

        const weekGridEl = (e.currentTarget as HTMLElement).closest('.task-week-grid');
        if (!weekGridEl) return;
        const weekRect = weekGridEl.getBoundingClientRect();
        const dayWidth = weekRect.width / 7;
        const weekHeight = weekRect.height;
        
        setTempProject(project);

        // Look up the task in the latest project state to ensure we have the latest groupId.
        const task = project.tasks.find(t => t.id === taskProp.id) || taskProp;

        // Prepare related tasks for group dragging
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
            weekHeight: weekHeight > 0 ? weekHeight : 120, // Fallback
            taskInitialStartDate: parseISO(task.startDate),
            taskInitialEndDate: parseISO(task.endDate),
            relatedTasks
        });
    }, [project, editingTaskId, isLocked]);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!dragState || !tempProject) return;

        const dx = e.clientX - dragState.initialMouseX;
        const dy = e.clientY - dragState.initialMouseY;
        
        // Add a small threshold to detect drag vs click
        if (Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
        
        // If we moved beyond threshold, consider it a drag
        ignoreClickRef.current = true;

        if (dragState.type === 'move') {
            const dayOffsetHorizontal = Math.round(dx / dragState.dayWidth);
            const weekOffsetVertical = dragState.weekHeight > 0 ? Math.round(dy / dragState.weekHeight) : 0;
            const totalDayOffset = dayOffsetHorizontal + (weekOffsetVertical * 7);
            
            const newTasks = [...tempProject.tasks];

            // Apply offset to all related tasks (Group Dragging)
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

        } else { // Resizing (Only applies to the single task dragged)
            const dayOffset = Math.round(dx / dragState.dayWidth);
            let newStartDate = new Date(dragState.taskInitialStartDate);
            let newEndDate = new Date(dragState.taskInitialEndDate);

            if (dragState.type === 'resize-start') {
                 newStartDate = addDays(dragState.taskInitialStartDate, dayOffset);
                 if (newStartDate > newEndDate) newStartDate = newEndDate;
            } else { // 'resize-end'
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
        
        // If a drag occurred, ignore this click to prevent accidental selection toggling
        if (ignoreClickRef.current) {
            return;
        }

        const newSelection = new Set(selectedTaskIds);
        if (e.ctrlKey || e.metaKey) {
            newSelection.has(taskId) ? newSelection.delete(taskId) : newSelection.add(taskId);
        } else {
            newSelection.clear();
            newSelection.add(taskId);
        }
        setSelectedTaskIds(newSelection);
    }, [selectedTaskIds, editingTaskId]);

    const handleDayMouseDown = (e: React.MouseEvent) => {
        if (editingTaskId) return;
        if (!e.ctrlKey && !e.metaKey) {
            setSelectedTaskIds(new Set());
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
        
        // Clean up old groups: remove selected tasks from them and recalculate intervals for remaining tasks
        const cleanedGroups = project.groups.map(g => {
            const remainingTaskIds = g.taskIds.filter(id => !taskIds.includes(id));
            if (remainingTaskIds.length === 0) return null;

            if (remainingTaskIds.length !== g.taskIds.length) {
                const remainingTasks = remainingTaskIds
                    .map(id => project.tasks.find(t => t.id === id))
                    .filter((t): t is Task => !!t)
                    .sort((a, b) => parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime());
                
                // Calculate new intervals only if there are 2+ tasks remaining
                const newIntervals = remainingTasks.length > 1 
                    ? remainingTasks.slice(0, -1).map((t, i) => 
                        Math.max(0, differenceInDays(parseISO(remainingTasks[i+1].startDate), parseISO(t.endDate)))
                      )
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

    const handleTaskMouseEnter = useCallback((groupId: string | undefined) => {
        if (groupId) setHoveredGroupId(groupId);
    }, []);

    const handleTaskMouseLeave = useCallback(() => {
        setHoveredGroupId(null);
    }, []);

    return (
        <div className="relative">
            <h2 className="text-2xl font-bold mb-4 text-gray-700 no-print">月曆檢視</h2>
            
            <div className="hidden print-week-header grid-cols-7">
                {WEEK_DAYS.map(day => (
                    <div key={day} className="text-center font-bold text-sm py-2 text-black border-b-2 border-black">{day}</div>
                ))}
            </div>

            <div className="space-y-8">
                {months.map(month => (
                    <MonthGrid
                        key={month.toISOString()}
                        month={month}
                        project={displayProject}
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
                        onTaskMouseEnter={handleTaskMouseEnter}
                        onTaskMouseLeave={handleTaskMouseLeave}
                    />
                ))}
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

interface MonthGridProps {
    month: Date;
    project: Project;
    unitColorMap: Record<string, string>;
    selectedTaskIds: Set<string>;
    onDragToCreate: (start: Date, end: Date) => void;
    onTaskDragStart: (task: Task, type: 'move' | 'resize-start' | 'resize-end', e: React.MouseEvent) => void;
    onTaskClick: (taskId: string, e: React.MouseEvent) => void;
    onDayMouseDown: (e: React.MouseEvent) => void;
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
}

const MonthGrid: React.FC<MonthGridProps> = ({ month, project, unitColorMap, selectedTaskIds, onDragToCreate, onTaskDragStart, onTaskClick, onDayMouseDown, editingTaskId, editingTaskName, onEditStart, onEditingTaskNameChange, onEditSave, onEditKeyDown, isLocked, hoveredGroupId, onTaskMouseEnter, onTaskMouseLeave }) => {
    const dragStartRef = useRef<Date | null>(null);

    const days = useMemo(() => {
        const monthStart = startOfMonth(month);
        const monthEnd = endOfMonth(month);
        const startDate = startOfWeek(monthStart);
        const endDate = endOfWeek(monthEnd);
        return eachDayOfInterval({ start: startDate, end: endDate });
    }, [month]);

    const weeks = useMemo(() => {
        return Array.from({ length: days.length / 7 }, (_, i) => days.slice(i * 7, i * 7 + 7));
    }, [days]);

    const handleDayMouseUp = (day: Date) => {
        if(dragStartRef.current) {
            onDragToCreate(dragStartRef.current, day);
        }
        dragStartRef.current = null;
    };

    return (
        <div className="bg-white p-4 rounded-lg shadow print-container">
            <h3 className="text-xl font-semibold text-center mb-4">{format(month, 'yyyy年 MMMM', { locale: zhTW })}</h3>
            <div className="grid grid-cols-7 border-t border-l border-gray-200 no-print-local-header">
                {WEEK_DAYS.map(day => (
                    <div key={day} className="text-center font-medium text-sm py-2 bg-gray-50 border-r border-b border-gray-200">{day}</div>
                ))}
            </div>
            <div className="border-l border-gray-200">
                {weeks.map((week, weekIndex) => {
                    const weekTasks = project.tasks.filter(task => {
                        const taskStart = parseISO(task.startDate);
                        const taskEnd = parseISO(task.endDate);
                        const weekStart = week[0];
                        const weekEnd = week[6];
                        return Math.max(taskStart.getTime(), weekStart.getTime()) <= Math.min(taskEnd.getTime(), weekEnd.getTime());
                    });
                    
                    const taskLanes = arrangeTasksInLanes(weekTasks);
                    
                    return (
                       <div key={weekIndex} className="relative grid grid-cols-7 border-b border-gray-200 task-week-grid">
                            {week.map((day) => (
                                <div 
                                    key={day.toISOString()} 
                                    className={`relative p-1 border-r border-gray-200 ${!isSameMonth(day, month) ? 'bg-gray-50' : 'bg-white'} ${!isLocked ? 'cursor-pointer' : ''}`}
                                    onMouseDown={(e) => { if(!isLocked) { onDayMouseDown(e); dragStartRef.current = day; } }}
                                    onMouseUp={() => { if(!isLocked) handleDayMouseUp(day); }}
                                >
                                    <span className={`absolute top-1 right-1 text-xs font-semibold ${!isSameMonth(day, month) ? 'text-gray-400' : 'text-gray-600'} ${isToday(day) ? 'bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center' : ''}`}>
                                        {format(day, 'd')}
                                    </span>
                                </div>
                            ))}
                         
                            <div className="col-start-1 col-span-7 row-start-1 grid mt-7 gap-y-1"
                                style={{
                                    gridTemplateColumns: 'repeat(7, 1fr)',
                                    gridAutoRows: 'min-content',
                                }}
                            >
                                {taskLanes.map((lane, laneIndex) => (
                                    <React.Fragment key={laneIndex}>
                                        {lane.map(task => {
                                            const taskStart = parseISO(task.startDate);
                                            const taskEnd = parseISO(task.endDate);
                                            const startDayIndex = Math.max(0, differenceInDays(taskStart, week[0]));
                                            const endDayIndex = Math.min(6, differenceInDays(taskEnd, week[0]));
                                            const color = task.unitId ? unitColorMap[task.unitId] : '#a0aec0';

                                            const isSelected = selectedTaskIds.has(task.id);
                                            const isEditing = editingTaskId === task.id;
                                            const isGrouped = !!task.groupId;
                                            const isGroupHovered = hoveredGroupId && task.groupId === hoveredGroupId;

                                            return (
                                                <div
                                                    key={task.id}
                                                    className={`relative rounded px-2 text-white text-sm font-medium pointer-events-auto group flex items-start py-0.5 transition-all duration-100 task-bar ${isSelected ? 'ring-2 ring-blue-500 ring-offset-1' : ''} ${isGroupHovered ? 'ring-2 ring-yellow-400 ring-offset-1 z-20 shadow-lg brightness-110' : ''} ${isLocked ? 'cursor-default' : ''}`}
                                                    onClick={(e) => onTaskClick(task.id, e)}
                                                    onMouseDown={(e) => { if (!isEditing) onTaskDragStart(task, 'move', e); }}
                                                    onDoubleClick={(e) => { e.stopPropagation(); onEditStart(task); }}
                                                    onMouseEnter={() => onTaskMouseEnter(task.groupId)}
                                                    onMouseLeave={onTaskMouseLeave}
                                                    style={{
                                                        backgroundColor: color,
                                                        gridRowStart: laneIndex + 1,
                                                        gridColumnStart: startDayIndex + 1,
                                                        gridColumnEnd: endDayIndex + 2,
                                                        marginLeft: '2px',
                                                        marginRight: '2px',
                                                        cursor: isLocked ? 'default' : (isEditing ? 'default' : 'move'),
                                                    }}
                                                    title={task.name}
                                                >
                                                    {isEditing ? (
                                                        <input
                                                            type="text"
                                                            value={editingTaskName}
                                                            onChange={(e) => onEditingTaskNameChange(e.target.value)}
                                                            onBlur={onEditSave}
                                                            onKeyDown={onEditKeyDown}
                                                            autoFocus
                                                            onMouseDown={e => e.stopPropagation()}
                                                            className="w-full h-full bg-white/90 text-black text-sm px-1 rounded border-none focus:ring-1 focus:ring-blue-500"
                                                        />
                                                    ) : (
                                                        <>
                                                            {!isLocked && (
                                                                <div 
                                                                    className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize z-10"
                                                                    onMouseDown={(e) => onTaskDragStart(task, 'resize-start', e)}
                                                                />
                                                            )}
                                                            <div className="flex items-center w-full overflow-hidden">
                                                                {isGrouped && <LinkIcon className="w-3 h-3 mr-1 flex-shrink-0 text-white/80" />}
                                                                <p className="pointer-events-none whitespace-normal break-words w-full truncate">{task.name}</p>
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
                })}
            </div>
        </div>
    );
}

export default CalendarView;
