const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Notification recipient is required']
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  type: {
    type: String,
    enum: [
      'task_assigned',
      'task_updated',
      'task_completed',
      'task_due_soon',
      'task_overdue',
      'task_comment',
      'project_invitation',
      'project_updated',
      'member_added',
      'member_removed',
      'message_mention',
      'deadline_reminder',
      'system_announcement'
    ],
    required: [true, 'Notification type is required']
  },
  title: {
    type: String,
    required: [true, 'Notification title is required'],
    trim: true,
    maxlength: [200, 'Notification title cannot exceed 200 characters']
  },
  message: {
    type: String,
    required: [true, 'Notification message is required'],
    trim: true,
    maxlength: [1000, 'Notification message cannot exceed 1000 characters']
  },
  data: {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      default: null
    },
    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      default: null
    },
    message: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null
    },
    // Additional data specific to notification type
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date,
    default: null
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  actionUrl: {
    type: String,
    default: null
  },
  actionText: {
    type: String,
    default: null
  },
  expiresAt: {
    type: Date,
    default: null
  },
  channels: {
    inApp: {
      type: Boolean,
      default: true
    },
    email: {
      type: Boolean,
      default: false
    },
    push: {
      type: Boolean,
      default: false
    }
  },
  emailSent: {
    type: Boolean,
    default: false
  },
  emailSentAt: {
    type: Date,
    default: null
  },
  pushSent: {
    type: Boolean,
    default: false
  },
  pushSentAt: {
    type: Date,
    default: null
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
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ type: 1 });
notificationSchema.index({ priority: 1 });
notificationSchema.index({ expiresAt: 1 });
notificationSchema.index({ 'data.project': 1 });
notificationSchema.index({ 'data.task': 1 });

// Virtual for time ago
notificationSchema.virtual('timeAgo').get(function() {
  const now = new Date();
  const diffMs = now - this.createdAt;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return this.createdAt.toLocaleDateString();
});

// Virtual for is expired
notificationSchema.virtual('isExpired').get(function() {
  return this.expiresAt && new Date() > this.expiresAt;
});

// Pre-save middleware to set default expiration
notificationSchema.pre('save', function(next) {
  // Set default expiration to 30 days from now if not set
  if (!this.expiresAt) {
    this.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }
  next();
});

// Method to mark as read
notificationSchema.methods.markAsRead = function() {
  if (!this.isRead) {
    this.isRead = true;
    this.readAt = new Date();
    return this.save();
  }
  return Promise.resolve(this);
};

// Method to mark as unread
notificationSchema.methods.markAsUnread = function() {
  if (this.isRead) {
    this.isRead = false;
    this.readAt = null;
    return this.save();
  }
  return Promise.resolve(this);
};

// Static method to create notification
notificationSchema.statics.createNotification = async function(notificationData) {
  const {
    recipient,
    sender,
    type,
    title,
    message,
    data = {},
    priority = 'medium',
    actionUrl = null,
    actionText = null,
    channels = { inApp: true, email: false, push: false },
    expiresAt = null
  } = notificationData;

  // Check user's notification preferences
  const User = mongoose.model('User');
  const user = await User.findById(recipient);
  
  if (!user) {
    throw new Error('Recipient user not found');
  }

  // Apply user preferences to channels
  const finalChannels = {
    inApp: channels.inApp,
    email: channels.email && user.preferences.notifications.email,
    push: channels.push && user.preferences.notifications.push
  };

  // Create notification
  const notification = new this({
    recipient,
    sender,
    type,
    title,
    message,
    data,
    priority,
    actionUrl,
    actionText,
    channels: finalChannels,
    expiresAt
  });

  await notification.save();

  // Populate references for better response
  await notification.populate([
    { path: 'recipient', select: 'name email avatar' },
    { path: 'sender', select: 'name email avatar' },
    { path: 'data.project', select: 'name' },
    { path: 'data.task', select: 'title' }
  ]);

  return notification;
};

// Static method to get notifications for user
notificationSchema.statics.getForUser = function(userId, options = {}) {
  const query = { 
    recipient: userId,
    $or: [
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } }
    ]
  };
  
  if (options.isRead !== undefined) {
    query.isRead = options.isRead;
  }
  
  if (options.type) {
    query.type = options.type;
  }
  
  if (options.priority) {
    query.priority = options.priority;
  }
  
  return this.find(query)
    .populate('sender', 'name email avatar')
    .populate('data.project', 'name')
    .populate('data.task', 'title')
    .sort({ priority: -1, createdAt: -1 })
    .limit(options.limit || 50)
    .skip(options.offset || 0);
};

// Static method to mark all as read for user
notificationSchema.statics.markAllAsReadForUser = function(userId, projectId = null) {
  const query = { 
    recipient: userId, 
    isRead: false 
  };
  
  if (projectId) {
    query['data.project'] = projectId;
  }
  
  return this.updateMany(query, {
    $set: {
      isRead: true,
      readAt: new Date()
    }
  });
};

// Static method to get unread count for user
notificationSchema.statics.getUnreadCountForUser = function(userId, projectId = null) {
  const query = { 
    recipient: userId, 
    isRead: false,
    $or: [
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } }
    ]
  };
  
  if (projectId) {
    query['data.project'] = projectId;
  }
  
  return this.countDocuments(query);
};

// Static method to clean up expired notifications
notificationSchema.statics.cleanupExpired = function() {
  return this.deleteMany({
    expiresAt: { $lt: new Date() }
  });
};

// Static method to get notifications by type
notificationSchema.statics.getByType = function(type, options = {}) {
  const query = { type };
  
  if (options.recipient) {
    query.recipient = options.recipient;
  }
  
  if (options.dateRange) {
    query.createdAt = {
      $gte: options.dateRange.start,
      $lte: options.dateRange.end
    };
  }
  
  return this.find(query)
    .populate('recipient', 'name email')
    .populate('sender', 'name email')
    .sort({ createdAt: -1 });
};

module.exports = mongoose.model('Notification', notificationSchema);