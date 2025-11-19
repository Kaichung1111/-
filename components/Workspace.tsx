
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Project, ViewMode, Task, FilterType } from '../types';
import { useProjects } from '../hooks/useProjects';
import { ArrowLeftIcon, CogIcon, DownloadIcon, PrinterIcon, UploadIcon, CalendarIcon, GroupIcon, LockClosedIcon, LockOpenIcon, FilterIcon } from './ui/Icons';
import CalendarView from './CalendarView';
import GroupRelationshipView from './GroupRelationshipView';
import Button from './ui/Button';
import SegmentedControl from './ui/SegmentedControl';
import ManageUnitsModal from './modals/ManageUnitsModal';
import { useNotifications } from '../hooks/useNotifications';
import saveAs from 'file-saver';


interface WorkspaceProps {
    projectId: string;
    onExit: () => void;
}

const Workspace: React.FC<WorkspaceProps> = ({ projectId, onExit }) => {
    const { getProject, updateProject } = useProjects();
    const [project, setProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<ViewMode>('calendar');
    const [isUnitsModalOpen, setIsUnitsModalOpen] = useState(false);
    const [isLocked, setIsLocked] = useState(false);
    const [filter, setFilter] = useState<FilterType>({ type: 'all', value: null });
    const { addNotification } = useNotifications();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchProjectData = useCallback(async () => {
        setLoading(true);
        const fetchedProject = await getProject(projectId);
        if (fetchedProject) {
            setProject(fetchedProject);
        }
        setLoading(false);
    }, [getProject, projectId]);

    useEffect(() => {
        fetchProjectData();
    }, [fetchProjectData]);

    const handleProjectUpdate = useCallback(async (updatedProject: Project) => {
        await updateProject(updatedProject);
        setProject(updatedProject); // Update local state immediately
    }, [updateProject]);
    
    const handleExportSchedule = () => {
        if (!project) return;
        try {
            const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json;charset=utf-8" });
            saveAs(blob, `${project.name}-排程.json`);
            addNotification('排程已成功匯出', 'success');
        } catch (error) {
            console.error('Export failed:', error);
            addNotification('排程匯出失敗', 'error');
        }
    };

    const handleImportMDClick = () => {
        if (isLocked) {
            addNotification('專案已鎖定，無法匯入', 'info');
            return;
        }
        fileInputRef.current?.click();
    };

    const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (isLocked) return;
        const files = event.target.files;
        if (!files || !project) return;
    
        const newTasks: Task[] = [];
        const unitNameMap = new Map<string, string>(project.units.map(u => [u.name, u.id] as [string, string]));
    
        const parseMD = (content: string, fileName: string): Omit<Task, 'id'> | null => {
            const parts = content.split('---');
            const name = (parts.length > 2 ? parts[2] : '').trim() || fileName.replace(/\.md$/, '');

            if (!name) return null;
    
            const frontmatter = parts[1] || '';
            const lines = frontmatter.split('\n');
            let scheduled: string | null = null;
            let unitId: string | null = null;
    
            lines.forEach(line => {
                const lineParts = line.split(':');
                const key = lineParts[0]?.trim();
                const value = lineParts.slice(1).join(':').trim();
                
                if (key === 'scheduled') {
                    scheduled = value;
                } else if (key === 'priority') {
                    const match = value.match(/\(([^)]+)\)/); // e.g., "汽機股(W561T)" -> "W561T"
                    if (match && match[1]) {
                        const foundId = unitNameMap.get(match[1]);
                        if (foundId) {
                            unitId = foundId;
                        }
                    }
                }
            });
    
            if (!scheduled) return null;
    
            return {
                name,
                startDate: scheduled,
                endDate: scheduled, // Assume task is for a single day from MD
                unitId: unitId || (project.units[0]?.id || null),
            };
        };
    
        let importedCount = 0;
        const filePromises = Array.from(files).map((file: File) => {
            return new Promise<void>((resolve, reject) => {
                 if (file.name.endsWith('.md')) {
                    const reader = new FileReader();
                    reader.onload = () => {
                        const content = reader.result;
                        if (typeof content === 'string') {
                            const parsedTask = parseMD(content, file.name);
                            if (parsedTask) {
                                newTasks.push({ ...parsedTask, id: crypto.randomUUID() });
                                importedCount++;
                            }
                        }
                        resolve();
                    };
                    reader.onerror = (e) => {
                        console.error("Error reading file:", file.name, e);
                        reject();
                    };
                    reader.readAsText(file);
                } else {
                    resolve();
                }
            });
        });
    
        await Promise.all(filePromises);

        if (newTasks.length > 0) {
            const updatedProject = { ...project, tasks: [...project.tasks, ...newTasks] };
            handleProjectUpdate(updatedProject);
            addNotification(`成功匯入 ${importedCount} 個任務`, 'success');
        } else {
            addNotification('未找到可匯入的有效任務', 'info');
        }
    
        // Reset file input to allow re-uploading the same file
        if (event.target) {
            event.target.value = '';
        }
    };
    
    const toggleLock = () => {
        setIsLocked(!isLocked);
        addNotification(isLocked ? '已解除編輯鎖定' : '已鎖定專案，禁止編輯', 'info');
    };

    const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        if (value === 'all') {
            setFilter({ type: 'all', value: null });
        } else if (value.startsWith('unit:')) {
            setFilter({ type: 'unit', value: value.replace('unit:', '') });
        } else if (value.startsWith('group:')) {
            setFilter({ type: 'group', value: value.replace('group:', '') });
        }
    };

    if (loading) {
        return <div className="flex h-screen items-center justify-center">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
            <p className="ml-4 text-lg">正在載入專案資料...</p>
        </div>;
    }

    if (!project) {
        return <div className="text-center p-8">專案不存在或載入失敗。</div>;
    }

    const viewOptions = [
        { label: '月曆', value: 'calendar', icon: CalendarIcon },
        { label: '群組檢視', value: 'group', icon: GroupIcon },
    ];

    return (
        <div className="flex flex-col h-screen bg-gray-100">
            <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 p-3 flex items-center justify-between sticky top-0 z-50 no-print">
                <div className="flex items-center gap-4">
                    <Button onClick={onExit} variant="ghost" size="sm">
                        <ArrowLeftIcon className="w-5 h-5" />
                        返回
                    </Button>
                    <h1 className="text-xl font-bold">{project.name}</h1>
                    <span className="bg-gray-200 text-gray-800 text-xs font-semibold px-2.5 py-1 rounded-full">
                        {project.tasks.length} 個任務
                    </span>
                </div>
                <div className="flex items-center gap-4">
                     <SegmentedControl options={viewOptions} value={viewMode} onChange={(val) => setViewMode(val as ViewMode)} />
                     
                     {viewMode === 'calendar' && (
                        <div className="flex items-center gap-2 border-l pl-4 border-gray-300">
                            <FilterIcon className="w-5 h-5 text-gray-500" />
                            <select 
                                onChange={handleFilterChange} 
                                className="border-gray-300 rounded-md shadow-sm text-sm py-1.5 pl-3 pr-8 focus:border-blue-500 focus:ring-blue-500 bg-white text-gray-800"
                                value={filter.type === 'all' ? 'all' : `${filter.type}:${filter.value}`}
                            >
                                <option value="all">顯示全部任務</option>
                                <optgroup label="依執行單位">
                                    {project.units.map(unit => (
                                        <option key={unit.id} value={`unit:${unit.id}`}>{unit.name}</option>
                                    ))}
                                </optgroup>
                                {project.groups.length > 0 && (
                                    <optgroup label="依任務群組">
                                        {project.groups.map(group => (
                                            <option key={group.id} value={`group:${group.id}`}>{group.name}</option>
                                        ))}
                                    </optgroup>
                                )}
                            </select>
                        </div>
                     )}
                </div>
                <div className="flex items-center gap-2">
                    <Button 
                        onClick={toggleLock} 
                        variant={isLocked ? "danger" : "secondary"} 
                        size="sm"
                        title={isLocked ? "點擊解鎖" : "點擊鎖定"}
                        className={isLocked ? "ring-2 ring-red-300" : ""}
                    >
                        {isLocked ? <LockClosedIcon className="w-5 h-5 mr-2" /> : <LockOpenIcon className="w-5 h-5 mr-2" />}
                        {isLocked ? "已鎖定" : "編輯中"}
                    </Button>
                    <div className="w-px h-6 bg-gray-300 mx-1"></div>
                    
                    <Button onClick={() => !isLocked && setIsUnitsModalOpen(true)} variant="secondary" size="sm" disabled={isLocked}>
                        <CogIcon className="w-5 h-5 mr-2" />
                        管理單位
                    </Button>
                    
                    <Button onClick={handleExportSchedule} variant="secondary" size="sm">
                        <UploadIcon className="w-5 h-5 mr-2" />
                        匯出排程
                    </Button>
                    
                    <input type="file" ref={fileInputRef} onChange={handleFileImport} multiple accept=".md" className="hidden" disabled={isLocked} />
                    <Button onClick={handleImportMDClick} variant="secondary" size="sm" disabled={isLocked}>
                        <DownloadIcon className="w-5 h-5 mr-2" />
                        匯入MD
                    </Button>
                    
                    <Button onClick={() => window.print()} variant="secondary" size="sm">
                        <PrinterIcon className="w-5 h-5 mr-2" />
                        列印功能
                    </Button>
                </div>
            </header>

            <main className="flex-grow overflow-auto p-4">
                <>
                    {viewMode === 'calendar' && <CalendarView project={project} onProjectUpdate={handleProjectUpdate} isLocked={isLocked} filter={filter} />}
                    {viewMode === 'group' && <GroupRelationshipView project={project} onProjectUpdate={handleProjectUpdate} isLocked={isLocked} />}
                </>
            </main>

            {isUnitsModalOpen && !isLocked && (
                <ManageUnitsModal
                    project={project}
                    onProjectUpdate={handleProjectUpdate}
                    onClose={() => setIsUnitsModalOpen(false)}
                />
            )}
        </div>
    );
};

export default Workspace;
