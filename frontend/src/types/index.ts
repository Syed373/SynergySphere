// src/types/index.ts

export interface User {
    id: string;
    email: string;
    name: string;
    avatar_url?: string;
    created_at: Date;
    updated_at: Date;
  }
  
  export interface Project {
    id: string;
    name: string;
    description: string;
    owner_id: string;
    created_at: Date;
    updated_at: Date;
    members: ProjectMember[];
    tasks?: Task[];
  }
  
  export interface ProjectMember {
    id: string;
    project_id: string;
    user_id: string;
    user: User;
    role: 'owner' | 'member';
    joined_at: Date;
  }
  
  export interface Task {
    id: string;
    project_id: string;
    title: string;
    description: string;
    assignee_id?: string;
    assignee?: User;
    status: 'todo' | 'in_progress' | 'done';
    due_date?: Date;
    created_by: string;
    created_at: Date;
    updated_at: Date;
  }
  
  export interface CreateProjectData {
    name: string;
    description: string;
  }
  
  export interface CreateTaskData {
    title: string;
    description: string;
    assignee_id?: string;
    due_date?: Date;
    project_id: string;
  }
  
  export interface LoginData {
    email: string;
    password: string;
  }
  
  export interface RegisterData {
    name: string;
    email: string;
    password: string;
  }
  
  export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    message?: string;
    error?: string;
  }