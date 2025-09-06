const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Project name is required'],
    trim: true,
    maxlength: [100, 'Project name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Project description cannot exceed 1000 characters']
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Project owner is required']
  },
  members: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['owner', 'admin', 'member', 'viewer'],
      default: 'member'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    permissions: {
      canCreateTasks: {
        type: Boolean,
        default: true
      },
      canEditTasks: {
        type: Boolean,
        default: true
      },
      canDeleteTasks: {
        type: Boolean,
        default: false
      },
      canManageMembers: {
        type: Boolean,
        default: false
      },
      canEditProject: {
        type: Boolean,
        default: false
      }
    }
  }],
  status: {
    type: String,
    enum: ['planning', 'active', 'on-hold', 'completed', 'archived'],
    default: 'planning'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  startDate: {
    type: Date,
    default: null
  },
  dueDate: {
    type: Date,
    default: null
  },
  completedAt: {
    type: Date,
    default: null
  },
  tags: [{
    type: String,
    trim: true
  }],
  color: {
    type: String,
    default: '#3B82F6', // Default blue color
    match: [/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Please enter a valid hex color']
  },
  settings: {
    isPublic: {
      type: Boolean,
      default: false
    },
    allowGuestAccess: {
      type: Boolean,
      default: false
    },
    notifications: {
      taskUpdates: {
        type: Boolean,
        default: true
      },
      memberChanges: {
        type: Boolean,
        default: true
      },
      deadlines: {
        type: Boolean,
        default: true
      }
    }
  },
  progress: {
    totalTasks: {
      type: Number,
      default: 0
    },
    completedTasks: {
      type: Number,
      default: 0
    },
    percentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    }
  },
  statistics: {
    totalMessages: {
      type: Number,
      default: 0
    },
    totalFiles: {
      type: Number,
      default: 0
    },
    lastActivity: {
      type: Date,
      default: Date.now
    }
  }
}, {
  timestamps: true,
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      return ret;
    }
  },
  toObject: { virtuals: true }
});

// Virtual for project tasks
projectSchema.virtual('tasks', {
  ref: 'Task',
  localField: '_id',
  foreignField: 'project'
});

// Virtual for project messages
projectSchema.virtual('messages', {
  ref: 'Message',
  localField: '_id',
  foreignField: 'project'
});

// Indexes for better performance
projectSchema.index({ owner: 1 });
projectSchema.index({ 'members.user': 1 });
projectSchema.index({ status: 1 });
projectSchema.index({ createdAt: -1 });

// Pre-save middleware to update progress
projectSchema.pre('save', function(next) {
  if (this.progress.totalTasks > 0) {
    this.progress.percentage = Math.round((this.progress.completedTasks / this.progress.totalTasks) * 100);
  } else {
    this.progress.percentage = 0;
  }
  next();
});

// Method to add a member to the project
projectSchema.methods.addMember = function(userId, role = 'member', permissions = {}) {
  const existingMember = this.members.find(member => member.user.toString() === userId.toString());
  
  if (existingMember) {
    throw new Error('User is already a member of this project');
  }

  const defaultPermissions = {
    canCreateTasks: role !== 'viewer',
    canEditTasks: role !== 'viewer',
    canDeleteTasks: ['owner', 'admin'].includes(role),
    canManageMembers: ['owner', 'admin'].includes(role),
    canEditProject: ['owner', 'admin'].includes(role)
  };

  this.members.push({
    user: userId,
    role,
    permissions: { ...defaultPermissions, ...permissions }
  });

  return this.save();
};

// Method to remove a member from the project
projectSchema.methods.removeMember = function(userId) {
  if (this.owner.toString() === userId.toString()) {
    throw new Error('Cannot remove project owner');
  }

  this.members = this.members.filter(member => member.user.toString() !== userId.toString());
  return this.save();
};

// Method to update member role
projectSchema.methods.updateMemberRole = function(userId, newRole) {
  const member = this.members.find(member => member.user.toString() === userId.toString());
  
  if (!member) {
    throw new Error('User is not a member of this project');
  }

  if (this.owner.toString() === userId.toString() && newRole !== 'owner') {
    throw new Error('Cannot change owner role');
  }

  member.role = newRole;
  
  // Update permissions based on role
  const rolePermissions = {
    owner: { canCreateTasks: true, canEditTasks: true, canDeleteTasks: true, canManageMembers: true, canEditProject: true },
    admin: { canCreateTasks: true, canEditTasks: true, canDeleteTasks: true, canManageMembers: true, canEditProject: true },
    member: { canCreateTasks: true, canEditTasks: true, canDeleteTasks: false, canManageMembers: false, canEditProject: false },
    viewer: { canCreateTasks: false, canEditTasks: false, canDeleteTasks: false, canManageMembers: false, canEditProject: false }
  };

  member.permissions = { ...member.permissions, ...rolePermissions[newRole] };
  return this.save();
};

// Method to check if user has specific permission
projectSchema.methods.hasPermission = function(userId, permission) {
  if (this.owner.toString() === userId.toString()) {
    return true; // Owner has all permissions
  }

  const member = this.members.find(member => member.user.toString() === userId.toString());
  if (!member) {
    return false;
  }

  return member.permissions[permission] || false;
};

// Method to update progress
projectSchema.methods.updateProgress = async function() {
  const Task = mongoose.model('Task');
  const tasks = await Task.find({ project: this._id });
  
  this.progress.totalTasks = tasks.length;
  this.progress.completedTasks = tasks.filter(task => task.status === 'completed').length;
  
  if (this.progress.totalTasks > 0) {
    this.progress.percentage = Math.round((this.progress.completedTasks / this.progress.totalTasks) * 100);
  } else {
    this.progress.percentage = 0;
  }

  this.statistics.lastActivity = new Date();
  return this.save();
};

module.exports = mongoose.model('Project', projectSchema);