import React, { useState } from 'react';
import { Project } from '../types';
import { DownloadIcon, TrashIcon, ArrowRightIcon } from './ui/Icons';
import ConfirmationModal from './modals/ConfirmationModal';
import { useNotifications } from '../hooks/useNotifications';
import Button from './ui/Button';
import saveAs from 'file-saver';

interface ProjectCardProps {
    project: Project;
    onSelect: () => void;
    onDelete: () => void;
}

const ProjectCard: React.FC<ProjectCardProps> = ({ project, onSelect, onDelete }) => {
    const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
    const { addNotification } = useNotifications();
    
    const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('zh-TW');

    const handleExport = () => {
        try {
            const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json;charset=utf-8" });
            saveAs(blob, `${project.name}.json`);
            addNotification('專案已成功匯出', 'success');
        } catch (error) {
            console.error('Export failed:', error);
            addNotification('專案匯出失敗', 'error');
        }
    };

    const handleDelete = () => {
        onDelete();
        addNotification(`專案 "${project.name}" 已刪除`, 'info');
        setIsConfirmingDelete(false);
    };

    return (
        <>
            <div className="bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300 flex flex-col">
                <div className="p-5 flex-grow">
                    <h3 className="text-xl font-bold text-gray-900 truncate">{project.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">
                        {formatDate(project.startDate)} - {formatDate(project.endDate)}
                    </p>
                    <div className="mt-4">
                        <span className="inline-block bg-gray-200 text-gray-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                            {project.tasks.length} 個任務
                        </span>
                    </div>
                </div>
                <div className="bg-gray-50 p-4 border-t border-gray-200 flex items-center justify-between">
                     <div className="flex items-center gap-2">
                        <Button onClick={handleExport} variant="icon" title="匯出專案">
                            <DownloadIcon className="w-5 h-5 text-gray-500 hover:text-gray-800" />
                        </Button>
                        <Button onClick={() => setIsConfirmingDelete(true)} variant="icon" title="刪除專案">
                            <TrashIcon className="w-5 h-5 text-gray-500 hover:text-red-600" />
                        </Button>
                    </div>
                    <Button onClick={onSelect} variant="primary" size="sm">
                        進入專案
                        <ArrowRightIcon className="w-4 h-4 ml-2" />
                    </Button>
                </div>
            </div>

            {isConfirmingDelete && (
                <ConfirmationModal
                    title="確認刪除"
                    message={`您確定要刪除專案 "${project.name}" 嗎？此操作無法復原。`}
                    onConfirm={handleDelete}
                    onCancel={() => setIsConfirmingDelete(false)}
                />
            )}
        </>
    );
};

export default ProjectCard;