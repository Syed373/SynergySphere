const express = require('express');
const { body, param, query } = require('express-validator');
const Notification = require('../models/Notification');
const { handleValidationErrors, catchAsync, AppError } = require('../middleware/errorHandler');

const router = express.Router();

// @route   GET /api/notifications
// @desc    Get user's notifications
// @access  Private
router.get('/',
  [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    
    query('isRead')
      .optional()
      .isBoolean()
      .withMessage('isRead filter must be boolean'),
    
    query('type')
      .optional()
      .isIn([
        'task_assigned', 'task_updated', 'task_completed', 'task_due_soon',
        'task_overdue', 'task_comment', 'project_invitation', 'project_updated',
        'member_added', 'member_removed', 'message_mention', 'deadline_reminder',
        'system_announcement'
      ])
      .withMessage('Invalid notification type'),
    
    query('priority')
      .optional()
      .isIn(['low', 'medium', 'high', 'urgent'])
      .withMessage('Invalid priority filter')
  ],
  handleValidationErrors,
  catchAsync(async (req, res) => {
    const { 
      page = 1, 
      limit = 50, 
      isRead, 
      type, 
      priority 
    } = req.query;

    const options = {
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit)
    };

    // Apply filters
    if (isRead !== undefined) options.isRead = isRead === 'true';
    if (type) options.type = type;
    if (priority) options.priority = priority;

    const notifications = await Notification.getForUser(req.user._id, options);
    
    // Get total count for pagination
    const queryFilter = { 
      recipient: req.user._id,
      $or: [
        { expiresAt: null },
        { expiresAt: { $gt: new Date() } }
      ]
    };
    
    if (isRead !== undefined) queryFilter.isRead = isRead === 'true';
    if (type) queryFilter.type = type;
    if (priority) queryFilter.priority = priority;

    const total = await Notification.countDocuments(queryFilter);

    res.json({
      success: true,
      data: {
        notifications,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalNotifications: total,
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      }
    });
  })
);

// @route   GET /api/notifications/unread/count
// @desc    Get unread notification count
// @access  Private
router.get('/unread/count',
  catchAsync(async (req, res) => {
    const unreadCount = await Notification.getUnreadCountForUser(req.user._id);
    
    res.json({
      success: true,
      data: { unreadCount }
    });
  })
);

// @route   GET /api/notifications/unread/count/:projectId
// @desc    Get unread notification count for specific project
// @access  Private
router.get('/unread/count/:projectId',
  [
    param('projectId')
      .isMongoId()
      .withMessage('Invalid project ID')
  ],
  handleValidationErrors,
  catchAsync(async (req, res) => {
    const { projectId } = req.params;
    const unreadCount = await Notification.getUnreadCountForUser(req.user._id, projectId);
    
    res.json({
      success: true,
      data: { unreadCount }
    });
  })
);

// @route   GET /api/notifications/:id
// @desc    Get notification details
// @access  Private (Notification Recipient)
router.get('/:id',
  [
    param('id')
      .isMongoId()
      .withMessage('Invalid notification ID')
  ],
  handleValidationErrors,
  catchAsync(async (req, res) => {
    const notification = await Notification.findById(req.params.id)
      .populate('sender', 'name email avatar')
      .populate('data.project', 'name')
      .populate('data.task', 'title')
      .populate('data.message', 'content');

    if (!notification) {
      throw new AppError('Notification not found', 404);
    }

    // Check if user is the recipient
    if (notification.recipient.toString() !== req.user._id.toString()) {
      throw new AppError('Access denied - not your notification', 403);
    }

    // Mark as read if not already read
    if (!notification.isRead) {
      await notification.markAsRead();
    }

    res.json({
      success: true,
      data: { notification }
    });
  })
);

// @route   PUT /api/notifications/:id/read
// @desc    Mark notification as read
// @access  Private (Notification Recipient)
router.put('/:id/read',
  [
    param('id')
      .isMongoId()
      .withMessage('Invalid notification ID')
  ],
  handleValidationErrors,
  catchAsync(async (req, res) => {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      throw new AppError('Notification not found', 404);
    }

    // Check if user is the recipient
    if (notification.recipient.toString() !== req.user._id.toString()) {
      throw new AppError('Access denied - not your notification', 403);
    }

    await notification.markAsRead();

    // Emit real-time event to update UI
    req.io.to(`user_${req.user._id}`).emit('notification_read', {
      notificationId: notification._id
    });

    res.json({
      success: true,
      message: 'Notification marked as read',
      data: { 
        isRead: true,
        readAt: notification.readAt
      }
    });
  })
);

// @route   PUT /api/notifications/:id/unread
// @desc    Mark notification as unread
// @access  Private (Notification Recipient)
router.put('/:id/unread',
  [
    param('id')
      .isMongo