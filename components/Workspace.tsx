
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Project, ViewMode, Task } from '../types';
import { useProjects } from '../hooks/useProjects';
import { ArrowLeftIcon, CogIcon, DownloadIcon, PrinterIcon, UploadIcon, CalendarIcon, GroupIcon, LockClosedIcon, LockOpenIcon } from './ui/Icons';
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
        const unitNameMap = new Map(project.units.map(u => [u.name, u.id]));
    
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
        // FIX: Explicitly typed the 'file' parameter as 'File' to prevent TypeScript from inferring it as 'unknown', which would cause an error when accessing 'file.name'.
        const filePromises = Array.from(files).map((file: File) => {
            return new Promise<void>((resolve, reject) => {
                 if (file.name.endsWith('.md')) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const content = e.target?.result;
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
            <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 p-3 flex items-center justify-between sticky top-0 z-30 no-print">
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
                <div className="flex items-center gap-2">
                     <SegmentedControl options={viewOptions} value={viewMode} onChange={(val) => setViewMode(val as ViewMode)} />
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
                {project.tasks.length === 0 ? (
                    <div className="text-center py-20">
                        <h2 className="text-2xl font-semibold text-gray-700">歡迎來到您的新專案！</h2>
                        <p className="text-gray-500 mt-2">開始新增任務來建立您的排程吧。</p>
                        {/* The Add Task button is now in the CalendarView, but we could add one here too */}
                    </div>
                ) : (
                    <>
                        {viewMode === 'calendar' && <CalendarView project={project} onProjectUpdate={handleProjectUpdate} isLocked={isLocked} />}
                        {viewMode === 'group' && <GroupRelationshipView project={project} onProjectUpdate={handleProjectUpdate} isLocked={isLocked} />}
                    </>
                )}
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