
import React from 'react';
import { Project, Task, TaskGroup } from '../types';
import { parseISO, format } from 'date-fns';
import { TrashIcon, EditIcon } from './ui/Icons';
import Button from './ui/Button';

interface GroupRelationshipViewProps {
    project: Project;
    onProjectUpdate: (updatedProject: Project) => void;
}

const GroupRelationshipView: React.FC<GroupRelationshipViewProps> = ({ project, onProjectUpdate }) => {
    
    const taskMap = new Map(project.tasks.map(task => [task.id, task]));

    const handleDeleteGroup = (groupId: string) => {
        const updatedGroups = project.groups.filter(g => g.id !== groupId);
        const updatedTasks = project.tasks.map(task => 
            task.groupId === groupId ? { ...task, groupId: undefined } : task
        );
        onProjectUpdate({ ...project, groups: updatedGroups, tasks: updatedTasks });
    };

    return (
        <div>
            <h2 className="text-2xl font-bold mb-4 text-gray-700">群組關係視圖</h2>
            {project.groups.length === 0 ? (
                <div className="text-center py-16 border-2 border-dashed border-gray-300 rounded-lg">
                    <h2 className="text-xl font-medium text-gray-600">沒有已建立的任務群組</h2>
                    <p className="text-gray-500 mt-2">在月曆視圖中選取多個任務以建立時間關聯群組。</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {project.groups.map(group => (
                        <GroupCard key={group.id} group={group} allTasks={taskMap} onDelete={() => handleDeleteGroup(group.id)} />
                    ))}
                </div>
            )}
        </div>
    );
};

interface GroupCardProps {
    group: TaskGroup;
    allTasks: Map<string, Task>;
    onDelete: () => void;
}

const GroupCard: React.FC<GroupCardProps> = ({ group, allTasks, onDelete }) => {
    const groupTasks = group.taskIds.map(id => allTasks.get(id)).filter((t): t is Task => !!t);

    if (groupTasks.length === 0) return null;
    
    const color = groupTasks[0].unitId ? project.units.find(u => u.id === groupTasks[0].unitId)?.color : '#9ca3af';

    return (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="p-4 border-l-4" style={{ borderColor: color }}>
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold">{group.name}</h3>
                        <Button variant="icon" size="sm"><EditIcon className="w-4 h-4 text-gray-500" /></Button>
                    </div>
                    <Button onClick={onDelete} variant="icon" title="刪除群組">
                        <TrashIcon className="w-5 h-5 text-gray-500 hover:text-red-500"/>
                    </Button>
                </div>
                <div className="space-y-2">
                    {groupTasks.map((task, index) => (
                        <div key={task.id}>
                            <div className="flex items-center gap-4 p-2 rounded-md bg-gray-50">
                                <span className="text-sm font-bold text-gray-500 w-6 text-center">{index + 1}</span>
                                <div className="flex-grow">
                                    <p className="font-semibold">{task.name}</p>
                                    <p className="text-xs text-gray-500">
                                        {format(parseISO(task.startDate), 'yyyy/MM/dd')} - {format(parseISO(task.endDate), 'yyyy/MM/dd')}
                                    </p>
                                </div>
                                <Button variant="ghost" size="sm">解除關聯</Button>
                            </div>
                            {index < groupTasks.length - 1 && (
                                <div className="flex items-center my-1 ml-3.5">
                                    <div className="w-px h-6 bg-gray-300"></div>
                                    <div className="ml-4 text-xs text-gray-600 bg-gray-200 px-2 py-0.5 rounded-full cursor-pointer hover:bg-gray-300">
                                        間隔 {group.intervals[index] || 0} 天
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
// Dummy project data for GroupCard to compile, it will be passed from the parent.
const project: Project = { id: '', name: '', startDate: '', endDate: '', tasks: [], units: [], groups: [] };


export default GroupRelationshipView;
