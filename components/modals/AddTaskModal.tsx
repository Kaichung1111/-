
import React, { useState } from 'react';
import { Task } from '../../types';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { useNotifications } from '../../hooks/useNotifications';
import { format } from 'date-fns';

interface AddTaskModalProps {
  onClose: () => void;
  onAddTask: (task: Omit<Task, 'id' | 'unitId'>) => void;
  initialStartDate?: Date;
  initialEndDate?: Date;
}

const AddTaskModal: React.FC<AddTaskModalProps> = ({ onClose, onAddTask, initialStartDate, initialEndDate }) => {
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState(format(initialStartDate || new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(initialEndDate || initialStartDate || new Date(), 'yyyy-MM-dd'));
  const { addNotification } = useNotifications();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
        addNotification('任務名稱不能為空', 'error');
        return;
    }
    if (startDate > endDate) {
        addNotification('結束日期不能早於開始日期', 'error');
        return;
    }
    onAddTask({ name, startDate, endDate });
    addNotification(`任務 "${name}" 已成功新增`, 'success');
    onClose();
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="新增任務">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          id="taskName"
          label="任務名稱"
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
                新增
            </Button>
        </div>
      </form>
    </Modal>
  );
};

export default AddTaskModal;
