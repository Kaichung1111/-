
import React, { useState, useCallback } from 'react';
import ProjectListView from './components/ProjectListView';
import Workspace from './components/Workspace';
import { NotificationProvider, useNotifications } from './hooks/useNotifications';
import { Notification } from './components/ui/Notification';

const AppContent: React.FC = () => {
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
    const { notifications, removeNotification } = useNotifications();

    const handleSelectProject = useCallback((projectId: string) => {
        setSelectedProjectId(projectId);
    }, []);

    const handleExitProject = useCallback(() => {
        setSelectedProjectId(null);
    }, []);

    return (
        <div className="min-h-screen font-sans">
            {selectedProjectId ? (
                <Workspace projectId={selectedProjectId} onExit={handleExitProject} />
            ) : (
                <ProjectListView onSelectProject={handleSelectProject} />
            )}
            <div className="fixed top-5 right-5 z-[100] space-y-2 no-print">
                {notifications.map((notification) => (
                    <Notification
                        key={notification.id}
                        {...notification}
                        onDismiss={() => removeNotification(notification.id)}
                    />
                ))}
            </div>
        </div>
    );
};


const App: React.FC = () => {
    return (
        <NotificationProvider>
            <AppContent />
        </NotificationProvider>
    );
}

export default App;