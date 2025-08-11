'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CheckCircle, AlertTriangle, Info, X, AlertCircle } from 'lucide-react';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  duration?: number;
  actions?: Array<{
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary';
  }>;
}

interface NotificationContextType {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id'>) => string;
  removeNotification: (id: string) => void;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}

interface NotificationProviderProps {
  children: ReactNode;
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = useCallback((notification: Omit<Notification, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newNotification: Notification = {
      ...notification,
      id,
      duration: notification.duration ?? 5000
    };

    setNotifications(prev => [...prev, newNotification]);

    // Auto-remove after duration
    if (newNotification.duration && newNotification.duration > 0) {
      setTimeout(() => {
        removeNotification(id);
      }, newNotification.duration);
    }

    return id;
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  return (
    <NotificationContext.Provider value={{
      notifications,
      addNotification,
      removeNotification,
      clearAll
    }}>
      {children}
      <NotificationContainer />
    </NotificationContext.Provider>
  );
}

function NotificationContainer() {
  const { notifications, removeNotification } = useNotifications();

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {notifications.map(notification => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onClose={() => removeNotification(notification.id)}
        />
      ))}
    </div>
  );
}

interface NotificationItemProps {
  notification: Notification;
  onClose: () => void;
}

function NotificationItem({ notification, onClose }: NotificationItemProps) {
  const getIcon = () => {
    switch (notification.type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-400" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-400" />;
      case 'info':
        return <Info className="w-5 h-5 text-blue-400" />;
    }
  };

  const getBackgroundColor = () => {
    switch (notification.type) {
      case 'success':
        return 'bg-green-900/20 border-green-700/50';
      case 'error':
        return 'bg-red-900/20 border-red-700/50';
      case 'warning':
        return 'bg-yellow-900/20 border-yellow-700/50';
      case 'info':
        return 'bg-blue-900/20 border-blue-700/50';
    }
  };

  return (
    <div className={`${getBackgroundColor()} border rounded-lg p-4 backdrop-blur-sm shadow-lg animate-in slide-in-from-right-full duration-300`}>
      <div className="flex items-start gap-3">
        {getIcon()}
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-white mb-1">
            {notification.title}
          </h4>
          <p className="text-sm text-gray-300">
            {notification.message}
          </p>
          {notification.actions && notification.actions.length > 0 && (
            <div className="flex gap-2 mt-3">
              {notification.actions.map((action, index) => (
                <button
                  key={index}
                  onClick={action.onClick}
                  className={`px-3 py-1 text-xs rounded transition-colors ${
                    action.variant === 'primary'
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-gray-600 hover:bg-gray-700 text-white'
                  }`}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// Convenience hooks for different notification types
export function useLlamaCppNotifications() {
  const { addNotification } = useNotifications();

  const notifySuccess = useCallback((title: string, message: string, actions?: Notification['actions']) => {
    return addNotification({ type: 'success', title, message, actions });
  }, [addNotification]);

  const notifyError = useCallback((title: string, message: string, actions?: Notification['actions']) => {
    return addNotification({ type: 'error', title, message, duration: 8000, actions });
  }, [addNotification]);

  const notifyWarning = useCallback((title: string, message: string, actions?: Notification['actions']) => {
    return addNotification({ type: 'warning', title, message, duration: 6000, actions });
  }, [addNotification]);

  const notifyInfo = useCallback((title: string, message: string, actions?: Notification['actions']) => {
    return addNotification({ type: 'info', title, message, actions });
  }, [addNotification]);

  const notifyModelDownloadStarted = useCallback((modelName: string) => {
    return notifyInfo(
      'Download Started',
      `Downloading ${modelName}. This may take several minutes depending on your connection.`
    );
  }, [notifyInfo]);

  const notifyModelDownloadComplete = useCallback((modelName: string) => {
    return notifySuccess(
      'Download Complete',
      `${modelName} has been downloaded successfully and is ready to use.`,
      [{
        label: 'Use Model',
        onClick: () => {
          // This would trigger model selection
          console.log('Switch to downloaded model');
        },
        variant: 'primary'
      }]
    );
  }, [notifySuccess]);

  const notifyModelDownloadFailed = useCallback((modelName: string, error: string) => {
    return notifyError(
      'Download Failed',
      `Failed to download ${modelName}: ${error}`,
      [{
        label: 'Retry',
        onClick: () => {
          // This would trigger retry logic
          console.log('Retry download');
        },
        variant: 'primary'
      }, {
        label: 'Manual Download',
        onClick: () => {
          window.open('https://huggingface.co/models?library=gguf', '_blank');
        },
        variant: 'secondary'
      }]
    );
  }, [notifyError]);

  const notifyLlamaSwapStarted = useCallback(() => {
    return notifySuccess(
      'Llama-swap Started',
      'The model proxy server is now running and ready to serve models.'
    );
  }, [notifySuccess]);

  const notifyLlamaSwapStopped = useCallback(() => {
    return notifyInfo(
      'Llama-swap Stopped',
      'The model proxy server has been stopped. Models are no longer available.'
    );
  }, [notifyInfo]);

  const notifyLlamaSwapError = useCallback((error: string) => {
    return notifyError(
      'Llama-swap Error',
      `Failed to start the model proxy server: ${error}`,
      [{
        label: 'Troubleshoot',
        onClick: () => {
          window.open('/docs/LLAMACPP_SETUP_GUIDE.md#troubleshooting-setup-issues', '_blank');
        },
        variant: 'primary'
      }]
    );
  }, [notifyError]);

  const notifyModelConfigured = useCallback((modelName: string) => {
    return notifySuccess(
      'Model Configured',
      `Parameters for ${modelName} have been updated successfully.`
    );
  }, [notifySuccess]);

  const notifyModelDeleted = useCallback((modelName: string) => {
    return notifyWarning(
      'Model Deleted',
      `${modelName} has been removed from your system.`
    );
  }, [notifyWarning]);

  const notifyInsufficientResources = useCallback((modelName: string, requiredRAM: string) => {
    return notifyWarning(
      'Insufficient Resources',
      `${modelName} requires approximately ${requiredRAM} of RAM. Consider using a smaller model or closing other applications.`,
      [{
        label: 'View Alternatives',
        onClick: () => {
          // This would show smaller model options
          console.log('Show smaller models');
        },
        variant: 'primary'
      }]
    );
  }, [notifyWarning]);

  return {
    notifySuccess,
    notifyError,
    notifyWarning,
    notifyInfo,
    notifyModelDownloadStarted,
    notifyModelDownloadComplete,
    notifyModelDownloadFailed,
    notifyLlamaSwapStarted,
    notifyLlamaSwapStopped,
    notifyLlamaSwapError,
    notifyModelConfigured,
    notifyModelDeleted,
    notifyInsufficientResources
  };
}
