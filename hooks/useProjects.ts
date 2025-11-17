import { useState, useEffect, useCallback } from 'react';
import { Project, Task, ExecutingUnit, TaskGroup } from '../types';
import * as db from '../services/db';

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const allProjects = await db.getAllProjects();
      setProjects(allProjects);
    } catch (error) {
      console.error("Failed to fetch projects:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const addProject = useCallback(async (project: Omit<Project, 'id' | 'tasks' | 'units' | 'groups'>) => {
    const newProject: Project = {
      ...project,
      id: crypto.randomUUID(),
      tasks: [],
      units: [
        { id: 'w521', name: 'W521', color: '#3b82f6' },
        { id: 'w561t', name: 'W561T', color: '#10b981' },
        { id: 'w561b', name: 'W561B', color: '#f97316' },
        { id: 'w562t', name: 'W562T', color: '#8b5cf6' },
        { id: 'w562b', name: 'W562B', color: '#ec4899' },
      ],
      groups: [],
    };
    await db.saveProject(newProject);
    await fetchProjects();
    return newProject;
  }, [fetchProjects]);

  const addProjectFromTemplate = useCallback(async (templateProject: Project) => {
    const oldIdToNewIdMap = new Map<string, string>();

    const newTasks: Task[] = templateProject.tasks.map(task => {
        const newId = crypto.randomUUID();
        oldIdToNewIdMap.set(task.id, newId);
        return { ...task, id: newId };
    });

    const newGroups: TaskGroup[] = templateProject.groups.map(group => ({
        ...group,
        id: crypto.randomUUID(),
        taskIds: group.taskIds.map(oldId => oldIdToNewIdMap.get(oldId)!).filter(Boolean),
    }));

    const newProject: Project = {
        ...templateProject,
        id: crypto.randomUUID(),
        name: `${templateProject.name} (範本)`,
        tasks: newTasks,
        groups: newGroups,
    };

    await db.saveProject(newProject);
    await fetchProjects();
  }, [fetchProjects]);

  const importProject = useCallback(async (projectData: Project) => {
    if (!projectData.id || !projectData.name || projectData.tasks === undefined || projectData.units === undefined || projectData.groups === undefined) {
        throw new Error("無效的專案檔案格式。缺少 `tasks`、`units` 或 `groups` 欄位。");
    }
    // 為防止意外覆蓋，指派一個新的 ID
    const newProject = { ...projectData, id: crypto.randomUUID() };
    await db.saveProject(newProject);
    await fetchProjects();
    return newProject;
  }, [fetchProjects]);

  const removeProject = useCallback(async (projectId: string) => {
    await db.deleteProject(projectId);
    await fetchProjects();
  }, [fetchProjects]);

  const getProject = useCallback(async (projectId: string): Promise<Project | undefined> => {
    return await db.getProjectById(projectId);
  }, []);

  const updateProject = useCallback(async (project: Project) => {
    await db.saveProject(project);
    // Optimistically update local state for faster UI response
    setProjects(prevProjects => prevProjects.map(p => p.id === project.id ? project : p));
  }, []);

  return { projects, loading, addProject, addProjectFromTemplate, importProject, removeProject, getProject, updateProject, fetchProjects };
}