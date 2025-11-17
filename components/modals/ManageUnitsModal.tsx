import React, { useState } from 'react';
import { Project, ExecutingUnit } from '../../types';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { TrashIcon, PlusIcon } from '../ui/Icons';

interface ManageUnitsModalProps {
    project: Project;
    onProjectUpdate: (updatedProject: Project) => void;
    onClose: () => void;
}

const ManageUnitsModal: React.FC<ManageUnitsModalProps> = ({ project, onProjectUpdate, onClose }) => {
    const [units, setUnits] = useState<ExecutingUnit[]>(project.units);
    const [newUnitName, setNewUnitName] = useState('');
    const [newUnitColor, setNewUnitColor] = useState('#4f46e5');

    const handleUpdateUnit = (id: string, field: 'name' | 'color', value: string) => {
        setUnits(units.map(unit => unit.id === id ? { ...unit, [field]: value } : unit));
    };

    const handleAddUnit = () => {
        if (!newUnitName.trim()) return;
        const newUnit: ExecutingUnit = {
            id: crypto.randomUUID(),
            name: newUnitName,
            color: newUnitColor,
        };
        setUnits([...units, newUnit]);
        setNewUnitName('');
        setNewUnitColor('#4f46e5');
    };

    const handleDeleteUnit = (id: string) => {
        setUnits(units.filter(unit => unit.id !== id));
    };
    
    const handleSaveChanges = () => {
        const updatedProject = { ...project, units };
        onProjectUpdate(updatedProject);
        onClose();
    };

    return (
        <Modal isOpen={true} onClose={onClose} title="管理執行單位">
            <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                {units.map(unit => (
                    <div key={unit.id} className="flex items-center gap-2 p-2 bg-gray-100 rounded-md">
                        <input
                            type="color"
                            value={unit.color}
                            onChange={(e) => handleUpdateUnit(unit.id, 'color', e.target.value)}
                            className="w-8 h-8 rounded-md border-none cursor-pointer"
                            style={{backgroundColor: unit.color}}
                        />
                        <input
                            type="text"
                            value={unit.name}
                            onChange={(e) => handleUpdateUnit(unit.id, 'name', e.target.value)}
                            className="flex-grow px-2 py-1 border border-gray-300 rounded-md bg-white text-gray-900"
                        />
                        <Button variant="icon" onClick={() => handleDeleteUnit(unit.id)}>
                            <TrashIcon className="w-5 h-5 text-gray-500 hover:text-red-500" />
                        </Button>
                    </div>
                ))}
            </div>

            <div className="mt-6 pt-4 border-t">
                <h4 className="font-semibold mb-2">新增單位</h4>
                <div className="flex items-center gap-2">
                    <input
                        type="color"
                        value={newUnitColor}
                        onChange={(e) => setNewUnitColor(e.target.value)}
                        className="w-8 h-8 rounded-md border-none cursor-pointer"
                        style={{backgroundColor: newUnitColor}}
                    />
                    <input
                        type="text"
                        placeholder="單位名稱"
                        value={newUnitName}
                        onChange={(e) => setNewUnitName(e.target.value)}
                        className="flex-grow px-2 py-1 border border-gray-300 rounded-md bg-white text-gray-900"
                    />
                    <Button variant="secondary" size="sm" onClick={handleAddUnit}>
                        <PlusIcon className="w-5 h-5"/>
                    </Button>
                </div>
            </div>

            <div className="flex justify-end gap-2 pt-6">
                <Button type="button" variant="secondary" onClick={onClose}>取消</Button>
                <Button type="button" variant="primary" onClick={handleSaveChanges}>儲存變更</Button>
            </div>
        </Modal>
    );
};

export default ManageUnitsModal;