const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Task title is required'],
    trim: true,
    maxlength: [200, 'Task title cannot exceed 200 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [2000, 'Task description cannot exceed 2000 characters']
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: [true, 'Task must belong to a project']
  },
  assignee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Task creator is required']
  },
  status: {
    type: String,
    enum: ['todo', 'in-progress', 'in-review', 'completed', 'cancelled'],
    default: 'todo'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  tags: [{
    type: String,
    trim: true
  }],
  dueDate: {
    type: Date,
    default: null
  },
  startDate: {
    type: Date,
    default: null
  },
  completedAt: {
    type: Date,
    default: null
  },
  estimatedHours: {
    type: Number,
    min: 0,
    default: null
  },
  actualHours: {
    type: Number,
    min: 0,
    default: null
  },
  progress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  dependencies: [{
    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task'
    },
    type: {
      type: String,
      enum: ['blocks', 'blocked-by', 'relates-to'],
      default: 'blocks'
    }
  }],
  subtasks: [{
    title: {
      type: String,
      required: true,
      trim: true
    },
    completed: {
      type: Boolean,
      default: false
    },
    completedAt: {
      type: Date,
      default: null
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  attachments: [{
    name: {
      type: String,
      required: true
    },
    url: {
      type: String,
      required: true
    },
    size: {
      type: Number,
      required: true
    },
    type: {
      type: String,
      required: true
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  comments: [{
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    content: {
      type: String,
      required: true,
      trim: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    editedAt: {
      type: Date,
      default: null
    },
    mentions: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }]
  }],
  watchers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  activity: [{
    type: {
      type: String,
      enum: ['created', 'updated', 'assigned', 'status_changed', 'comment_added', 'attachment_added', 'due_date_changed'],
      required: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    description: {
      type: String,
      required: true
    },
    oldValue: mongoose.Schema.Types.Mixed,
    newValue: mongoose.Schema.Types.Mixed,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  isArchived: {
    type: Boolean,
    default: false
  },
  position: {
    type: Number,
    default: 0 // For ordering tasks in kanban boards
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

// Indexes for better performance
taskSchema.index({ project: 1, status: 1 });
taskSchema.index({ assignee: 1, status: 1 });
taskSchema.index({ dueDate: 1 });
taskSchema.index({ priority: 1 });
taskSchema.index({ createdAt: -1 });
taskSchema.index({ 'activity.timestamp': -1 });

// Virtual for overdue status
taskSchema.virtual('isOverdue').get(function() {
  return this.dueDate && this.status !== 'completed' && new Date() > this.dueDate;
});

// Virtual for days until due
taskSchema.virtual('daysUntilDue').get(function() {
  if (!this.dueDate) return null;
  const today = new Date();
  const dueDate = new Date(this.dueDate);
  const diffTime = dueDate - today;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for completion percentage based on subtasks
taskSchema.virtual('subtaskProgress').get(function() {
  if (this.subtasks.length === 0) return this.progress;
  const completedSubtasks = this.subtasks.filter(subtask => subtask.completed).length;
  return Math.round((completedSubtasks / this.subtasks.length) * 100);
});

// Pre-save middleware to update completedAt when status changes to completed
taskSchema.pre('save', function(next) {
  if (this.isModified('status')) {
    if (this.status === 'completed' && !this.completedAt) {
      this.completedAt = new Date();
    } else if (this.status !== 'completed') {
      this.completedAt = null;
    }
  }
  next();
});

// Post-save middleware to update project progress
taskSchema.post('save', async function(doc) {
  try {
    const Project = mongoose.model('Project');
    const project = await Project.findById(doc.project);
    if (project) {
      await project.updateProgress();
    }
  } catch (error) {
    console.error('Error updating project progress:', error);
  }
});

// Method to add activity log entry
taskSchema.methods.addActivity = function(type, user, description, oldValue = null, newValue = null) {
  this.activity.push({
    type,
    user,
    description,
    oldValue,
    newValue,
    timestamp: new Date()
  });
  return this;
};

// Method to add comment
taskSchema.methods.addComment = function(authorId, content, mentions = []) {
  this.comments.push({
    author: authorId,
    content,
    mentions,
    createdAt: new Date()
  });
  return this.save();
};

// Method to add attachment
taskSchema.methods.addAttachment = function(name, url, size, type, uploadedBy) {
  this.attachments.push({
    name,
    url,
    size,
    type,
    uploadedBy,
    uploadedAt: new Date()
  });
  return this.save();
};

// Method to add subtask
taskSchema.methods.addSubtask = function(title) {
  this.subtasks.push({
    title,
    completed: false,
    createdAt: new Date()
  });
  return this.save();
};

// Method to toggle subtask completion
taskSchema.methods.toggleSubtask = function(subtaskId) {
  const subtask = this.subtasks.id(subtaskId);
  if (!subtask) {
    throw new Error('Subtask not found');
  }
  
  subtask.completed = !subtask.completed;
  subtask.completedAt = subtask.completed ? new Date() : null;
  
  return this.save();
};

// Method to update status with activity logging
taskSchema.methods.updateStatus = function(newStatus, userId, description = null) {
  const oldStatus = this.status;
  this.status = newStatus;
  
  const statusDescription = description || `Status changed from ${oldStatus} to ${newStatus}`;
  this.addActivity('status_changed', userId, statusDescription, oldStatus, newStatus);
  
  return this.save();
};

// Method to assign task
taskSchema.methods.assignTo = function(assigneeId, assignedBy, description = null) {
  const oldAssignee = this.assignee;
  this.assignee = assigneeId;
  
  const assignDescription = description || `Task assigned to user`;
  this.addActivity('assigned', assignedBy, assignDescription, oldAssignee, assigneeId);
  
  // Add assignee to watchers if not already there
  if (assigneeId && !this.watchers.includes(assigneeId)) {
    this.watchers.push(assigneeId);
  }
  
  return this.save();
};

// Method to add watcher
taskSchema.methods.addWatcher = function(userId) {
  if (!this.watchers.includes(userId)) {
    this.watchers.push(userId);
  }
  return this.save();
};

// Method to remove watcher
taskSchema.methods.removeWatcher = function(userId) {
  this.watchers = this.watchers.filter(watcher => watcher.toString() !== userId.toString());
  return this.save();
};

// Static method to get tasks by project
taskSchema.statics.getByProject = function(projectId, options = {}) {
  const query = { project: projectId };
  
  if (options.status) {
    query.status = options.status;
  }
  
  if (options.assignee) {
    query.assignee = options.assignee;
  }
  
  if (options.priority) {
    query.priority = options.priority;
  }
  
  if (options.dueDateRange) {
    query.dueDate = {
      $gte: options.dueDateRange.start,
      $lte: options.dueDateRange.end
    };
  }
  
  return this.find(query)
    .populate('assignee', 'name email avatar')
    .populate('creator', 'name email avatar')
    .populate('comments.author', 'name email avatar')
    .sort(options.sort || { position: 1, createdAt: -1 });
};

// Static method to get overdue tasks
taskSchema.statics.getOverdueTasks = function(projectId = null) {
  const query = {
    dueDate: { $lt: new Date() },
    status: { $nin: ['completed', 'cancelled'] }
  };
  
  if (projectId) {
    query.project = projectId;
  }
  
  return this.find(query)
    .populate('assignee', 'name email')
    .populate('project', 'name')
    .sort({ dueDate: 1 });
};

module.exports = mongoose.model('Task', taskSchema);