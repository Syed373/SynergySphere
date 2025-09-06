// src/app/project/[id]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { Project, Task, User } from '@/types';
import { formatDate, getInitials } from '@/lib/utils';
import Navbar from '@/components/ui/Navbar';
import TaskCard from '@/components/project/TaskCard';
import CreateTaskModal from '@/components/project/CreateTaskModal';
import { 
  ArrowLeft, 
  Plus, 
  Users, 
  Calendar, 
  CheckSquare, 
  Clock,
  MoreVertical,
  UserPlus,
  Settings
} from 'lucide-react';

export default function ProjectDetailPage() {
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [activeTab, setActiveTab] = useState<'board' | 'list'>('board');
  const [error, setError] = useState('');

  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const projectId = params.id as string;

  // Load project data
  const loadProject = async () => {
    try {
      setIsLoading(true);
      const [projectResponse, tasksResponse] = await Promise.all([
        api.getProject(projectId),
        api.getTasks(projectId)
      ]);

      if (projectResponse.success) {
        //@ts-ignore
        setProject(projectResponse.data);
      }
      
      if (tasksResponse.success) {
        //@ts-ignore
        setTasks(tasksResponse.data || []);
      }
    } catch (err: any) {
      setError('Failed to load project data');
      console.error('Error loading project:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      loadProject();
    }
  }, [projectId]);

  // Handle task status change
  const handleTaskStatusChange = async (taskId: string, status: Task['status']) => {
    try {
      const response = await api.updateTask(taskId, { status });
      if (response.success) {
        setTasks(tasks.map(task => 
          task.id === taskId ? { ...task, status } : task
        ));
      }
    } catch (err: any) {
      console.error('Error updating task:', err);
      setError('Failed to update task');
    }
  };

  // Handle task deletion
  const handleTaskDelete = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    
    try {
      await api.deleteTask(taskId);
      setTasks(tasks.filter(task => task.id !== taskId));
    } catch (err: any) {
      console.error('Error deleting task:', err);
      setError('Failed to delete task');
    }
  };

  // Handle task editing
  const handleTaskEdit = (task: Task) => {
    setEditingTask(task);
    setIsTaskModalOpen(true);
  };

  // Handle modal close
  const handleTaskModalClose = () => {
    setIsTaskModalOpen(false);
    setEditingTask(null);
  };

  // Organize tasks by status
  const tasksByStatus = {
    todo: tasks.filter(task => task.status === 'todo'),
    in_progress: tasks.filter(task => task.status === 'in_progress'),
    done: tasks.filter(task => task.status === 'done'),
  };

  // Calculate project stats
  const stats = {
    totalTasks: tasks.length,
    completedTasks: tasksByStatus.done.length,
    inProgressTasks: tasksByStatus.in_progress.length,
    todoTasks: tasksByStatus.todo.length,
    completionPercentage: tasks.length > 0 
      ? Math.round((tasksByStatus.done.length / tasks.length) * 100) 
      : 0
  };

  const projectMembers = project?.members.map(member => member.user) || [];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading project...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Project not found</h2>
            <button
              onClick={() => router.push('/dashboard')}
              className="btn-primary"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center mb-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="mr-4 p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-3xl font-bold text-gray-900">{project.name}</h1>
          </div>
          
          <p className="text-gray-600 mb-6">{project.description}</p>

          {/* Project Info */}
          <div className="flex flex-wrap items-center gap-6 text-sm text-gray-600">
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4" />
              <span>Created {formatDate(project.created_at)}</span>
            </div>
            
            <div className="flex items-center space-x-2">
              <Users className="h-4 w-4" />
              <span>{project.members.length} member{project.members.length !== 1 ? 's' : ''}</span>
            </div>

            <div className="flex items-center space-x-2">
              <CheckSquare className="h-4 w-4" />
              <span>{stats.completedTasks}/{stats.totalTasks} tasks completed</span>
            </div>

            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4" />
              <span>{stats.completionPercentage}% complete</span>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
            <button
              onClick={() => setError('')}
              className="ml-4 text-red-600 hover:text-red-800 font-medium"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">To Do</p>
                <p className="text-2xl font-bold text-gray-900">{stats.todoTasks}</p>
              </div>
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                <div className="w-4 h-4 bg-gray-500 rounded"></div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">In Progress</p>
                <p className="text-2xl font-bold text-blue-600">{stats.inProgressTasks}</p>
              </div>
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <div className="w-4 h-4 bg-blue-600 rounded"></div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-green-600">{stats.completedTasks}</p>
              </div>
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <div className="w-4 h-4 bg-green-600 rounded"></div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Progress</p>
                <p className="text-2xl font-bold text-purple-600">{stats.completionPercentage}%</p>
              </div>
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <div className="w-4 h-4 bg-purple-600 rounded"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 sm:mb-0">Tasks</h2>
          
          <div className="flex items-center space-x-3">
            {/* View Toggle */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setActiveTab('board')}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  activeTab === 'board'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Board
              </button>
              <button
                onClick={() => setActiveTab('list')}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  activeTab === 'list'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                List
              </button>
            </div>

            <button
              onClick={() => setIsTaskModalOpen(true)}
              className="btn-primary inline-flex items-center"
            >
              <Plus className="h-5 w-5 mr-2" />
              Add Task
            </button>
          </div>
        </div>

        {/* Tasks Display */}
        {activeTab === 'board' ? (
          /* Kanban Board */
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* To Do Column */}
            <div className="bg-white rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900 flex items-center">
                  <div className="w-3 h-3 bg-gray-400 rounded-full mr-2"></div>
                  To Do ({tasksByStatus.todo.length})
                </h3>
              </div>
              <div className="space-y-3">
                {tasksByStatus.todo.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onStatusChange={handleTaskStatusChange}
                    onEdit={handleTaskEdit}
                    onDelete={handleTaskDelete}
                  />
                ))}
                {tasksByStatus.todo.length === 0 && (
                  <p className="text-gray-400 text-sm">No tasks</p>
                )}
              </div>
            </div>

            {/* In Progress Column */}
            <div className="bg-white rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900 flex items-center">
                  <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                  In Progress ({tasksByStatus.in_progress.length})
                </h3>
              </div>
              <div className="space-y-3">
                {tasksByStatus.in_progress.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onStatusChange={handleTaskStatusChange}
                    onEdit={handleTaskEdit}
                    onDelete={handleTaskDelete}
                  />
                ))}
                {tasksByStatus.in_progress.length === 0 && (
                  <p className="text-gray-400 text-sm">No tasks</p>
                )}
              </div>
            </div>

            {/* Done Column */}
            <div className="bg-white rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900 flex items-center">
                  <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                  Done ({tasksByStatus.done.length})
                </h3>
              </div>
              <div className="space-y-3">
                {tasksByStatus.done.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onStatusChange={handleTaskStatusChange}
                    onEdit={handleTaskEdit}
                    onDelete={handleTaskDelete}
                  />
                ))}
                {tasksByStatus.done.length === 0 && (
                  <p className="text-gray-400 text-sm">No tasks</p>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* List View */
          <div className="bg-white rounded-lg shadow-sm">
            {tasks.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 mb-4">No tasks yet</p>
                <button
                  onClick={() => setIsTaskModalOpen(true)}
                  className="btn-primary inline-flex items-center"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Create Your First Task
                </button>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {tasks.map(task => (
                  <div key={task.id} className="p-4">
                    <TaskCard
                      task={task}
                      onStatusChange={handleTaskStatusChange}
                      onEdit={handleTaskEdit}
                      onDelete={handleTaskDelete}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Team Members Section */}
        <div className="mt-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Team Members</h2>
            <button className="btn-secondary inline-flex items-center">
              <UserPlus className="h-5 w-5 mr-2" />
              Add Member
            </button>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {project.members.map(member => (
              <div key={member.id} className="card">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-medium">
                    {getInitials(member.user.name)}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">{member.user.name}</h3>
                    <p className="text-sm text-gray-600">{member.user.email}</p>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mt-1 ${
                      member.role === 'owner' 
                        ? 'bg-purple-100 text-purple-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {member.role === 'owner' ? 'Owner' : 'Member'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Create/Edit Task Modal */}
      <CreateTaskModal
        isOpen={isTaskModalOpen}
        onClose={handleTaskModalClose}
        onTaskCreated={loadProject}
        projectId={projectId}
        projectMembers={projectMembers}
        editTask={editingTask}
      />
    </div>
  );
}