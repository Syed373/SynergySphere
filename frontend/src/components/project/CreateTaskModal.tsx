'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { taskSchema } from '@/lib/validations';
import { api } from '@/lib/api';
import { User, Task } from '@/types';
import { X, Calendar } from 'lucide-react';

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTaskCreated: () => void;
  projectId: string;
  projectMembers: User[];
  editTask?: Task | null;
}

type TaskFormData = {
  title: string;
  description: string;
  assignee_id?: string;
  due_date?: Date;
};

export default function CreateTaskModal({
  isOpen,
  onClose,
  onTaskCreated,
  projectId,
  projectMembers,
  editTask,
}: CreateTaskModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<TaskFormData>({
    resolver: zodResolver(taskSchema),
  });

  // Populate form when editing
  useEffect(() => {
    if (editTask) {
      setValue('title', editTask.title);
      setValue('description', editTask.description);
      setValue('assignee_id', editTask.assignee_id || '');
      if (editTask.due_date) {
        setValue('due_date', new Date(editTask.due_date));
      }
    }
  }, [editTask, setValue]);

  const onSubmit = async (data: TaskFormData) => {
    setIsLoading(true);
    setError('');

    try {
      const taskData = {
        ...data,
        assignee_id: data.assignee_id || undefined,
      };

      if (editTask) {
        await api.updateTask(editTask.id, taskData);
      } else {
        await api.createTask(projectId, taskData);
      }

      reset();
      onTaskCreated();
      onClose();
    } catch (err: any) {
      setError(err.message || `Failed to ${editTask ? 'update' : 'create'} task`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    reset();
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50" onClick={handleClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
              {editTask ? 'Edit Task' : 'Create New Task'}
            </h2>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="p-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                  Task Title
                </label>
                <input
                  id="title"
                  type="text"
                  className="input-field"
                  placeholder="Enter task title"
                  {...register('title')}
                />
                {errors.title && (
                  <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  id="description"
                  rows={4}
                  className="input-field resize-none"
                  placeholder="Describe the task"
                  {...register('description')}
                />
                {errors.description && (
                  <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="assignee_id" className="block text-sm font-medium text-gray-700 mb-1">
                  Assignee
                </label>
                <select
                  id="assignee_id"
                  className="input-field"
                  {...register('assignee_id')}
                >
                  <option value="">Unassigned</option>
                  {projectMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name} ({member.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="due_date" className="block text-sm font-medium text-gray-700 mb-1">
                  Due Date
                </label>
                <div className="relative">
                  <input
                    id="due_date"
                    type="date"
                    className="input-field pr-10"
                    {...register('due_date')}
                  />
                  <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                type="button"
                onClick={handleClose}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary"
              >
                {isLoading 
                  ? (editTask ? 'Updating...' : 'Creating...') 
                  : (editTask ? 'Update Task' : 'Create Task')
                }
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}