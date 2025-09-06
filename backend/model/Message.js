const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  content: {
    type: String,
    required: [true, 'Message content is required'],
    trim: true,
    maxlength: [5000, 'Message content cannot exceed 5000 characters']
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: [true, 'Message must belong to a project']
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Message author is required']
  },
  parentMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null // For threaded replies
  },
  mentions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
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
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  reactions: [{
    emoji: {
      type: String,
      required: true
    },
    users: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    count: {
      type: Number,
      default: 0
    }
  }],
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: {
    type: Date,
    default: null
  },
  editHistory: [{
    content: String,
    editedAt: {
      type: Date,
      default: Date.now
    }
  }],
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date,
    default: null
  },
  isSystemMessage: {
    type: Boolean,
    default: false
  },
  systemMessageType: {
    type: String,
    enum: ['task_created', 'task_updated', 'member_added', 'member_removed', 'project_updated'],
    default: null
  },
  readBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }],
  isPinned: {
    type: Boolean,
    default: false
  },
  pinnedAt: {
    type: Date,
    default: null
  },
  pinnedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true,
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      if (ret.isDeleted) {
        ret.content = '[Message deleted]';
        ret.attachments = [];
      }
      return ret;
    }
  },
  toObject: { virtuals: true }
});

// Virtual for reply count
messageSchema.virtual('replyCount', {
  ref: 'Message',
  localField: '_id',
  foreignField: 'parentMessage',
  count: true
});

// Virtual for replies
messageSchema.virtual('replies', {
  ref: 'Message',
  localField: '_id',
  foreignField: 'parentMessage'
});

// Indexes for better performance
messageSchema.index({ project: 1, createdAt: -1 });
messageSchema.index({ author: 1 });
messageSchema.index({ parentMessage: 1 });
messageSchema.index({ mentions: 1 });
messageSchema.index({ isDeleted: 1 });
messageSchema.index({ isPinned: 1 });

// Pre-save middleware to extract mentions from content
messageSchema.pre('save', function(next) {
  if (this.isModified('content')) {
    // Extract @mentions from message content
    const mentionRegex = /@(\w+)/g;
    const mentions = [];
    let match;
    
    while ((match = mentionRegex.exec(this.content)) !== null) {
      mentions.push(match[1]); // username without @
    }
    
    // Note: In a real application, you'd want to resolve usernames to user IDs
    // For now, we'll handle mentions in the API layer
  }
  next();
});

// Post-save middleware to update project statistics
messageSchema.post('save', async function(doc) {
  try {
    const Project = mongoose.model('Project');
    await Project.findByIdAndUpdate(doc.project, {
      $inc: { 'statistics.totalMessages': 1 },
      $set: { 'statistics.lastActivity': new Date() }
    });
  } catch (error) {
    console.error('Error updating project message statistics:', error);
  }
});

// Method to add reaction
messageSchema.methods.addReaction = function(emoji, userId) {
  let existingReaction = this.reactions.find(r => r.emoji === emoji);
  
  if (existingReaction) {
    // Check if user already reacted with this emoji
    if (!existingReaction.users.includes(userId)) {
      existingReaction.users.push(userId);
      existingReaction.count += 1;
    }
  } else {
    // Create new reaction
    this.reactions.push({
      emoji,
      users: [userId],
      count: 1
    });
  }
  
  return this.save();
};

// Method to remove reaction
messageSchema.methods.removeReaction = function(emoji, userId) {
  const reaction = this.reactions.find(r => r.emoji === emoji);
  
  if (reaction) {
    reaction.users = reaction.users.filter(user => user.toString() !== userId.toString());
    reaction.count = reaction.users.length;
    
    // Remove reaction if no users left
    if (reaction.count === 0) {
      this.reactions = this.reactions.filter(r => r.emoji !== emoji);
    }
  }
  
  return this.save();
};

// Method to edit message
messageSchema.methods.editContent = function(newContent) {
  // Store edit history
  this.editHistory.push({
    content: this.content,
    editedAt: new Date()
  });
  
  this.content = newContent;
  this.isEdited = true;
  this.editedAt = new Date();
  
  return this.save();
};

// Method to mark as read by user
messageSchema.methods.markAsRead = function(userId) {
  const existingRead = this.readBy.find(read => read.user.toString() === userId.toString());
  
  if (!existingRead) {
    this.readBy.push({
      user: userId,
      readAt: new Date()
    });
    return this.save();
  }
  
  return Promise.resolve(this);
};

// Method to pin message
messageSchema.methods.pin = function(userId) {
  this.isPinned = true;
  this.pinnedAt = new Date();
  this.pinnedBy = userId;
  return this.save();
};

// Method to unpin message
messageSchema.methods.unpin = function() {
  this.isPinned = false;
  this.pinnedAt = null;
  this.pinnedBy = null;
  return this.save();
};

// Method to soft delete message
messageSchema.methods.softDelete = function() {
  this.isDeleted = true;
  this.deletedAt = new Date();
  return this.save();
};

// Static method to get messages by project
messageSchema.statics.getByProject = function(projectId, options = {}) {
  const query = { 
    project: projectId,
    isDeleted: false
  };
  
  if (options.parentMessage !== undefined) {
    query.parentMessage = options.parentMessage;
  }
  
  if (options.isPinned !== undefined) {
    query.isPinned = options.isPinned;
  }
  
  return this.find(query)
    .populate('author', 'name email avatar')
    .populate('mentions', 'name email avatar')
    .populate('readBy.user', 'name email avatar')
    .populate('pinnedBy', 'name email avatar')
    .sort(options.sort || { isPinned: -1, createdAt: -1 })
    .limit(options.limit || 50)
    .skip(options.offset || 0);
};

// Static method to get unread messages for user
messageSchema.statics.getUnreadForUser = function(userId, projectId = null) {
  const query = {
    isDeleted: false,
    'readBy.user': { $ne: userId },
    author: { $ne: userId } // Don't include user's own messages
  };
  
  if (projectId) {
    query.project = projectId;
  }
  
  return this.find(query)
    .populate('author', 'name email avatar')
    .populate('project', 'name')
    .sort({ createdAt: -1 });
};

module.exports = mongoose.model('Message', messageSchema);