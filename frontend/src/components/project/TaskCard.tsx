'use client';

import { Task } from '@/types';
import { formatDate, getStatusColor, getInitials, isOverdue } from '@/lib/utils';
import { Calendar, User, Clock, MoreVertical } from 'lucide-react';
import { useState } from 'react';

interface TaskCardProps {
  task: Task;
  onStatusChange: (taskId: string, status: Task['status']) => void;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
}

export default function TaskCard({ task, onStatusChange, onEdit, onDelete }: TaskCardProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleStatusChange = (newStatus: Task['status']) => {
    onStatusChange(task.id, newStatus);
  };

  const statusOptions: { value: Task['status']; label: string; color: string }[] = [
    { value: 'todo', label: 'To Do', color: 'bg-gray-100 text-gray-800' },
    { value: 'in_progress', label: 'In Progress', color: 'bg-blue-100 text-blue-800' },
    { value: 'done', label: 'Done', color: 'bg-green-100 text-green-800' },
  ];

  return (
    <div className="card hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-3">
        <h3 className="font-semibold text-gray-900 flex-1">{task.title}</h3>
        <div className="relative">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          
          {isMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setIsMenuOpen(false)}
              />
              <div className="absolute right-0 mt-1 w-32 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
                <button
                  onClick={() => {
                    onEdit(task);
                    setIsMenuOpen(false);
                  }}
                  className="block w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Edit
                </button>
                <button
                  onClick={() => {
                    onDelete(task.id);
                    setIsMenuOpen(false);
                  }}
                  className="block w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-gray-100"
                >
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <p className="text-gray-600 text-sm mb-4 line-clamp-3">{task.description}</p>

      {/* Status Dropdown */}
      <div className="mb-4">
        <select
          value={task.status}
          onChange={(e) => handleStatusChange(e.target.value as Task['status'])}
          className={`status-badge ${getStatusColor(task.status)} border-0 text-xs font-medium cursor-pointer`}
        >
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex justify-between items-center text-sm text-gray-500">
        <div className="flex items-center space-x-3">
          {/* Assignee */}
          {task.assignee ? (
            <div className="flex items-center space-x-1">
              <User className="h-4 w-4" />
              <span className="w-6 h-6 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center text-xs font-medium">
                {getInitials(task.assignee.name)}
              </span>
            </div>
          ) : (
            <span className="text-gray-400">Unassigned</span>
          )}
        </div>

        {/* Due Date */}
        {task.due_date && (
          <div className={`flex items-center space-x-1 ${
            isOverdue(task.due_date) && task.status !== 'done' 
              ? 'text-red-600' 
              : 'text-gray-500'
          }`}>
            <Calendar className="h-4 w-4" />
            <span>{formatDate(task.due_date)}</span>
            {isOverdue(task.due_date) && task.status !== 'done' && (
              <Clock className="h-4 w-4 text-red-500" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
