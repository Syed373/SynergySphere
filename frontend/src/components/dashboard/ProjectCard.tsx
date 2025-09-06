'use client';

import Link from 'next/link';
import { Project } from '@/types';
import { formatDate, getInitials } from '@/lib/utils';
import { Calendar, Users, CheckSquare } from 'lucide-react';

interface ProjectCardProps {
  project: Project;
}

export default function ProjectCard({ project }: ProjectCardProps) {
  const taskStats = {
    total: project.tasks?.length || 0,
    completed: project.tasks?.filter(task => task.status === 'done').length || 0,
    inProgress: project.tasks?.filter(task => task.status === 'in_progress').length || 0,
  };

  const progressPercentage = taskStats.total > 0 
    ? Math.round((taskStats.completed / taskStats.total) * 100) 
    : 0;

  return (
    <Link href={`/project/${project.id}`}>
      <div className="card hover:shadow-md transition-shadow cursor-pointer">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-lg font-semibold text-gray-900 truncate">
            {project.name}
          </h3>
          <span className="text-sm text-gray-500">
            {formatDate(project.updated_at)}
          </span>
        </div>

        <p className="text-gray-600 text-sm mb-4 line-clamp-2">
          {project.description}
        </p>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>Progress</span>
            <span>{progressPercentage}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>

        {/* Stats */}
        <div className="flex justify-between items-center text-sm text-gray-600">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1">
              <CheckSquare className="h-4 w-4" />
              <span>{taskStats.completed}/{taskStats.total}</span>
            </div>
            <div className="flex items-center space-x-1">
              <Users className="h-4 w-4" />
              <span>{project.members.length}</span>
            </div>
          </div>

          {/* Member Avatars */}
          <div className="flex -space-x-2">
            {project.members.slice(0, 3).map((member) => (
              <div
                key={member.id}
                className="w-6 h-6 bg-gray-300 text-gray-700 rounded-full flex items-center justify-center text-xs font-medium border-2 border-white"
                title={member.user.name}
              >
                {getInitials(member.user.name)}
              </div>
            ))}
            {project.members.length > 3 && (
              <div className="w-6 h-6 bg-gray-100 text-gray-600 rounded-full flex items-center justify-center text-xs font-medium border-2 border-white">
                +{project.members.length - 3}
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}