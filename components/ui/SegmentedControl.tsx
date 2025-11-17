
import React from 'react';

interface SegmentedControlOption {
    label: string;
    value: string;
    icon?: React.ComponentType<{ className?: string }>;
}

interface SegmentedControlProps {
    options: SegmentedControlOption[];
    value: string;
    onChange: (value: string) => void;
}

const SegmentedControl: React.FC<SegmentedControlProps> = ({ options, value, onChange }) => {
    return (
        <div className="flex items-center bg-gray-200 rounded-lg p-1">
            {options.map((option) => (
                <button
                    key={option.value}
                    onClick={() => onChange(option.value)}
                    className={`flex items-center justify-center px-4 py-1.5 text-sm font-semibold rounded-md transition-colors duration-200
                        ${value === option.value
                            ? 'bg-white text-blue-600 shadow'
                            : 'bg-transparent text-gray-600 hover:bg-gray-300/50'
                        }`}
                >
                    {option.icon && <option.icon className="w-5 h-5 mr-2" />}
                    {option.label}
                </button>
            ))}
        </div>
    );
};

export default SegmentedControl;
