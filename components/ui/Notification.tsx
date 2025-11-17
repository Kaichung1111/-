
import React from 'react';
import { CheckCircleIcon, XCircleIcon, InfoCircleIcon, XIcon } from './Icons';

type NotificationType = 'success' | 'error' | 'info';

interface NotificationProps {
  message: string;
  type: NotificationType;
  onDismiss: () => void;
}

export const Notification: React.FC<NotificationProps> = ({ message, type, onDismiss }) => {
  const styles = {
    success: {
      bg: 'bg-green-50 border-green-400',
      iconColor: 'text-green-500',
      Icon: CheckCircleIcon,
    },
    error: {
      bg: 'bg-red-50 border-red-400',
      iconColor: 'text-red-500',
      Icon: XCircleIcon,
    },
    info: {
      bg: 'bg-blue-50 border-blue-400',
      iconColor: 'text-blue-500',
      Icon: InfoCircleIcon,
    },
  };

  const { bg, iconColor, Icon } = styles[type];

  return (
    <div
      className={`max-w-sm w-full rounded-lg shadow-lg pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden border ${bg}`}
    >
      <div className="p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <Icon className={`h-6 w-6 ${iconColor}`} />
          </div>
          <div className="ml-3 w-0 flex-1 pt-0.5">
            <p className="text-sm font-medium text-gray-900">{message}</p>
          </div>
          <div className="ml-4 flex-shrink-0 flex">
            <button
              onClick={onDismiss}
              className="inline-flex rounded-md bg-transparent text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <span className="sr-only">Close</span>
              <XIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
