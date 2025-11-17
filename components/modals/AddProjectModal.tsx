
import React, { useState } from 'react';
import { Project } from '../../types';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { useNotifications } from '../../hooks/useNotifications';
import { format } from 'date-fns';

interface AddProjectModalProps {
  onClose: () => void;
  onAddProject: (project: Omit<Project, 'id' | 'tasks' | 'units' | 'groups'>) => Promise<Project>;
}

const AddProjectModal: React.FC<AddProjectModalProps> = ({ onClose, onAddProject }) => {
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 30);
  const [endDate, setEndDate] = useState(format(futureDate, 'yyyy-MM-dd'));
  const { addNotification } = useNotifications();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
        addNotification('專案名稱不能為空', 'error');
        return;
    }
    await onAddProject({ name, startDate, endDate });
    addNotification(`專案 "${name}" 已成功建立`, 'success');
    onClose();
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="建立新專案">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          id="projectName"
          label="專案名稱"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Input
          id="startDate"
          label="開始日期"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          required
        />
        <Input
          id="endDate"
          label="結束日期"
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          min={startDate}
          required
        />
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button type="submit" variant="primary">
            建立
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default AddProjectModal;
