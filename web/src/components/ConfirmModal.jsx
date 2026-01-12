import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirmar', type = 'danger' }) {
  if (!isOpen) return null;

  const colors = {
    danger: {
      bg: 'bg-red-500/20',
      border: 'border-red-500/50',
      icon: 'text-red-500',
      button: 'bg-red-600 hover:bg-red-700',
    },
    warning: {
      bg: 'bg-yellow-500/20',
      border: 'border-yellow-500/50',
      icon: 'text-yellow-500',
      button: 'bg-yellow-600 hover:bg-yellow-700',
    },
    info: {
      bg: 'bg-blue-500/20',
      border: 'border-blue-500/50',
      icon: 'text-blue-500',
      button: 'bg-blue-600 hover:bg-blue-700',
    },
  };

  const color = colors[type] || colors.danger;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-white transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon */}
        <div className={`w-16 h-16 mx-auto mb-4 rounded-full ${color.bg} ${color.border} border flex items-center justify-center`}>
          <AlertTriangle className={`w-8 h-8 ${color.icon}`} />
        </div>

        {/* Title */}
        <h3 className="text-xl font-bold text-white text-center mb-2">
          {title}
        </h3>

        {/* Message */}
        <p className="text-gray-400 text-center mb-6">
          {message}
        </p>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`flex-1 py-3 ${color.button} text-white font-semibold rounded-lg transition-all`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;
