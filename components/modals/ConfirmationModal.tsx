
import React from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';

interface ConfirmationModalProps {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ title, message, onConfirm, onCancel }) => {
  return (
    <Modal isOpen={true} onClose={onCancel} title={title}>
      <p className="text-gray-600">{message}</p>
      <div className="flex justify-end gap-2 pt-6">
        <Button variant="secondary" onClick={onCancel}>
          取消
        </Button>
        <Button variant="danger" onClick={onConfirm}>
          確認
        </Button>
      </div>
    </Modal>
  );
};

export default ConfirmationModal;
