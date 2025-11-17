
import React, { useState, useRef } from 'react';
import { useProjects } from '../hooks/useProjects';
import ProjectCard from './ProjectCard';
import AddProjectModal from './modals/AddProjectModal';
import { PlusIcon, UploadIcon } from './ui/Icons';
import Button from './ui/Button';
import { useNotifications } from '../hooks/useNotifications';
import { Project } from '../types';

interface ProjectListViewProps {
    onSelectProject: (projectId: string) => void;
}

const ProjectListView: React.FC<ProjectListViewProps> = ({ onSelectProject }) => {
    const { projects, loading, addProject, removeProject, importProject } = useProjects();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const { addNotification } = useNotifications();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const text = e.target?.result as string;
                const projectData = JSON.parse(text) as Project;
                
                const importedProject = await importProject(projectData);
                addNotification(`專案 "${importedProject.name}" 已成功匯入`, 'success');

            } catch (error) {
                console.error("Failed to import project:", error);
                addNotification(`專案匯入失敗: ${error instanceof Error ? error.message : '未知錯誤'}`, 'error');
            } finally {
                if (event.target) {
                    event.target.value = '';
                }
            }
        };
        reader.readAsText(file);
    };

    if (loading) {
        return <div className="flex items-center justify-center h-screen">載入中...</div>;
    }

    return (
        <div className="p-4 sm:p-6 md:p-8">
            <header className="flex items-center justify-between mb-8">
                <h1 className="text-3xl font-bold text-gray-800">所有專案</h1>
                <div className="flex items-center gap-2">
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept=".json"
                        onChange={handleFileImport}
                    />
                    <Button onClick={handleImportClick} variant="secondary">
                        <UploadIcon className="w-5 h-5 mr-2" />
                        匯入專案
                    </Button>
                    <Button onClick={() => setIsModalOpen(true)} variant="primary">
                        <PlusIcon className="w-5 h-5 mr-2" />
                        建立新專案
                    </Button>
                </div>
            </header>
            
            {projects.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {projects.map(project => (
                        <ProjectCard
                            key={project.id}
                            project={project}
                            onSelect={() => onSelectProject(project.id)}
                            onDelete={() => removeProject(project.id)}
                        />
                    ))}
                </div>
            ) : (
                <div className="text-center py-16 border-2 border-dashed border-gray-300 rounded-lg">
                    <h2 className="text-xl font-medium text-gray-600">目前沒有任何專案</h2>
                    <p className="text-gray-500 mt-2">開始建立您的第一個專案吧！</p>
                    <Button onClick={() => setIsModalOpen(true)} variant="primary" className="mt-6">
                        <PlusIcon className="w-5 h-5 mr-2" />
                        建立第一個專案
                    </Button>
                </div>
            )}

            {isModalOpen && (
                <AddProjectModal
                    onClose={() => setIsModalOpen(false)}
                    onAddProject={addProject}
                />
            )}
        </div>
    );
};

export default ProjectListView;