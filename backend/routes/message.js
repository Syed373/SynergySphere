const express = require('express');
const { body, param, query } = require('express-validator');
const Message = require('../models/Message');
const Project = require('../models/Project');
const Notification = require('../models/Notification');
const { handleValidationErrors, catchAsync, AppError } = require('../middleware/errorHandler');
const { requireProjectMember } = require('../middleware/auth');

const router = express.Router();

// Validation rules
const sendMessageValidation = [
  body('content')
    .trim()
    .isLength({ min: 1, max: 5000 })
    .withMessage('Message content must be between 1 and 5000 characters'),
  
  body('mentions')
    .optional()
    .isArray()
    .withMessage('Mentions must be an array'),
  
  body('mentions.*')
    .optional()
    .isMongoId()
    .withMessage('Invalid mention user ID'),
  
  body('parentMessage')
    .optional()
    .isMongoId()
    .withMessage('Invalid parent message ID')
];

const editMessageValidation = [
  body('content')
    .trim()
    .isLength({ min: 1, max: 5000 })
    .withMessage('Message content must be between 1 and 5000 characters')
];

const reactionValidation = [
  body('emoji')
    .trim()
    .isLength({ min: 1, max: 10 })
    .withMessage('Emoji must be between 1 and 10 characters'),
  
  body('action')
    .isIn(['add', 'remove'])
    .withMessage('Action must be add or remove')
];

// @route   GET /api/messages/project/:projectId
// @desc    Get messages for a project
// @access  Private (Project Member)
router.get('/project/:projectId',
  [
    param('projectId')
      .isMongoId()
      .withMessage('Invalid project ID'),
    
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    
    query('parentMessage')
      .optional()
      .isMongoId()
      .withMessage('Invalid parent message ID'),
    
    query('search')
      .optional()
      .isLength({ min: 2 })
      .withMessage('Search query must be at least 2 characters'),
    
    query('pinned')
      .optional()
      .isBoolean()
      .withMessage('Pinned filter must be boolean')
  ],
  handleValidationErrors,
  requireProjectMember,
  catchAsync(async (req, res) => {
    const { projectId } = req.params;
    const { 
      page = 1, 
      limit = 50, 
      parentMessage, 
      search, 
      pinned 
    } = req.query;

    const options = {
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      sort: { isPinned: -1, createdAt: -1 }
    };

    // Set filters
    if (parentMessage !== undefined) {
      options.parentMessage = parentMessage || null; // null for top-level messages
    }
    
    if (pinned !== undefined) {
      options.isPinned = pinned === 'true';
    }

    let messages;
    
    if (search) {
      // Search messages
      messages = await Message.find({
        project: projectId,
        isDeleted: false,
        content: { $regex: search, $options: 'i' }
      })
        .populate('author', 'name email avatar')
        .populate('mentions', 'name email avatar')
        .populate('readBy.user', 'name email avatar')
        .populate('pinnedBy', 'name email avatar')
        .sort(options.sort)
        .limit(options.limit)
        .skip(options.offset);
    } else {
      // Get messages using model method
      messages = await Message.getByProject(projectId, options);
    }

    // Mark messages as read by current user
    const unreadMessageIds = messages
      .filter(msg => !msg.readBy.some(read => read.user._id.toString() === req.user._id.toString()))
      .map(msg => msg._id);

    if (unreadMessageIds.length > 0) {
      await Message.updateMany(
        { _id: { $in: unreadMessageIds } },
        { 
          $addToSet: { 
            readBy: { 
              user: req.user._id, 
              readAt: new Date() 
            } 
          } 
        }
      );
    }

    // Get total count for pagination
    const totalQuery = { 
      project: projectId, 
      isDeleted: false 
    };
    
    if (parentMessage !== undefined) {
      totalQuery.parentMessage = parentMessage || null;
    }
    
    if (search) {
      totalQuery.content = { $regex: search, $options: 'i' };
    }
    
    if (pinned !== undefined) {
      totalQuery.isPinned = pinned === 'true';
    }

    const total = await Message.countDocuments(totalQuery);

    res.json({
      success: true,
      data: {
        messages,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalMessages: total,
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      }
    });
  })
);

// @route   POST /api/messages/project/:projectId
// @desc    Send a message to project
// @access  Private (Project Member)
router.post('/project/:projectId',
  [
    param('projectId')
      .isMongoId()
      .withMessage('Invalid project ID')
  ],
  sendMessageValidation,
  handleValidationErrors,
  requireProjectMember,
  catchAsync(async (req, res) => {
    const { projectId } = req.params;
    const { content, mentions = [], parentMessage } = req.body;

    // Validate parent message if provided
    if (parentMessage) {
      const parent = await Message.findOne({
        _id: parentMessage,
        project: projectId,
        isDeleted: false
      });
      
      if (!parent) {
        throw new AppError('Parent message not found', 404);
      }
    }

    // Validate mentions - ensure mentioned users are project members
    if (mentions.length > 0) {
      const project = await Project.findById(projectId);
      const validMentions = mentions.filter(userId => {
        return project.owner.toString() === userId || 
               project.members.some(member => member.user.toString() === userId);
      });
      
      if (validMentions.length !== mentions.length) {
        throw new AppError('Some mentioned users are not project members', 400);
      }
    }

    const message = new Message({
      content,
      project: projectId,
      author: req.user._id,
      parentMessage: parentMessage || null,
      mentions,
      readBy: [{
        user: req.user._id,
        readAt: new Date()
      }]
    });

    await message.save();

    // Populate the response
    await message.populate([
      { path: 'author', select: 'name email avatar' },
      { path: 'mentions', select: 'name email avatar' },
      { path: 'readBy.user', select: 'name email avatar' }
    ]);

    // Create notifications for mentions
    for (const mentionId of mentions) {
      if (mentionId !== req.user._id.toString()) {
        await Notification.createNotification({
          recipient: mentionId,
          sender: req.user._id,
          type: 'message_mention',
          title: 'Mentioned in Message',
          message: `${req.user.name} mentioned you in a project message`,
          data: { 
            project: projectId, 
            message: message._id 
          },
          actionUrl: `/projects/${projectId}/messages#message-${message._id}`,
          actionText: 'View Message'
        });
      }
    }

    // Get project members for real-time notification
    const project = await Project.findById(projectId).populate('members.user', '_id');
    const memberIds = project.members.map(m => m.user._id.toString());
    memberIds.push(project.owner.toString());

    // Emit real-time event to project room
    req.io.to(`project_${projectId}`).emit('new_message', {
      message,
      author: req.user
    });

    // Emit notification to mentioned users
    mentions.forEach(mentionId => {
      if (mentionId !== req.user._id.toString()) {
        req.io.to(`user_${mentionId}`).emit('message_mention', {
          message,
          mentionedBy: req.user
        });
      }
    });

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: { message }
    });
  })
);

// @route   GET /api/messages/:id
// @desc    Get message details
// @access  Private (Project Member)
router.get('/:id',
  [
    param('id')
      .isMongoId()
      .withMessage('Invalid message ID')
  ],
  handleValidationErrors,
  catchAsync(async (req, res) => {
    const message = await Message.findById(req.params.id)
      .populate('author', 'name email avatar')
      .populate('mentions', 'name email avatar')
      .populate('project', 'name members owner')
      .populate('readBy.user', 'name email avatar')
      .populate('pinnedBy', 'name email avatar')
      .populate({
        path: 'replies',
        populate: {
          path: 'author',
          select: 'name email avatar'
        }
      });

    if (!message) {
      throw new AppError('Message not found', 404);
    }

    // Check if user is project member
    const project = message.project;
    const isOwner = project.owner.toString() === req.user._id.toString();
    const isMember = project.members.some(member => 
      member.user.toString() === req.user._id.toString()
    );

    if (!isOwner && !isMember) {
      throw new AppError('Access denied - not a project member', 403);
    }

    // Mark as read by current user
    await message.markAsRead(req.user._id);

    res.json({
      success: true,
      data: { message }
    });
  })
);

// @route   PUT /api/messages/:id
// @desc    Edit message
// @access  Private (Message Author)
router.put('/:id',
  [
    param('id')
      .isMongoId()
      .withMessage('Invalid message ID')
  ],
  editMessageValidation,
  handleValidationErrors,
  catchAsync(async (req, res) => {
    const { content } = req.body;
    
    const message = await Message.findById(req.params.id)
      .populate('project', 'members owner');

    if (!message) {
      throw new AppError('Message not found', 404);
    }

    // Check if user is the author or project owner
    const isAuthor = message.author.toString() === req.user._id.toString();
    const isProjectOwner = message.project.owner.toString() === req.user._id.toString();

    if (!isAuthor && !isProjectOwner) {
      throw new AppError('Access denied - can only edit your own messages', 403);
    }

    // Edit message using model method
    await message.editContent(content);

    // Populate the response
    await message.populate([
      { path: 'author', select: 'name email avatar' },
      { path: 'mentions', select: 'name email avatar' }
    ]);

    // Emit real-time event
    req.io.to(`project_${message.project._id}`).emit('message_edited', {
      messageId: message._id,
      newContent: content,
      editedBy: req.user
    });

    res.json({
      success: true,
      message: 'Message edited successfully',
      data: { message }
    });
  })
);

// @route   DELETE /api/messages/:id
// @desc    Delete message (soft delete)
// @access  Private (Message Author or Project Owner)
router.delete('/:id',
  [
    param('id')
      .isMongoId()
      .withMessage('Invalid message ID')
  ],
  handleValidationErrors,
  catchAsync(async (req, res) => {
    const message = await Message.findById(req.params.id)
      .populate('project', 'members owner');

    if (!message) {
      throw new AppError('Message not found', 404);
    }

    // Check if user is the author or project owner
    const isAuthor = message.author.toString() === req.user._id.toString();
    const isProjectOwner = message.project.owner.toString() === req.user._id.toString();

    if (!isAuthor && !isProjectOwner) {
      throw new AppError('Access denied - can only delete your own messages', 403);
    }

    // Soft delete the message
    await message.softDelete();

    // Emit real-time event
    req.io.to(`project_${message.project._id}`).emit('message_deleted', {
      messageId: message._id,
      deletedBy: req.user
    });

    res.json({
      success: true,
      message: 'Message deleted successfully'
    });
  })
);

// @route   POST /api/messages/:id/reactions
// @desc    Add or remove reaction from message
// @access  Private (Project Member)
router.post('/:id/reactions',
  [
    param('id')
      .isMongoId()
      .withMessage('Invalid message ID')
  ],
  reactionValidation,
  handleValidationErrors,
  catchAsync(async (req, res) => {
    const { emoji, action } = req.body;
    
    const message = await Message.findById(req.params.id)
      .populate('project', 'members owner');

    if (!message) {
      throw new AppError('Message not found', 404);
    }

    // Check if user is project member
    const project = message.project;
    const isOwner = project.owner.toString() === req.user._id.toString();
    const isMember = project.members.some(member => 
      member.user.toString() === req.user._id.toString()
    );

    if (!isOwner && !isMember) {
      throw new AppError('Access denied - not a project member', 403);
    }

    if (action === 'add') {
      await message.addReaction(emoji, req.user._id);
    } else {
      await message.removeReaction(emoji, req.user._id);
    }

    // Get updated reactions
    const updatedReaction = message.reactions.find(r => r.emoji === emoji);

    // Emit real-time event
    req.io.to(`project_${message.project._id}`).emit('message_reaction', {
      messageId: message._id,
      emoji,
      action,
      user: req.user,
      reactionCount: updatedReaction ? updatedReaction.count : 0
    });

    res.json({
      success: true,
      message: `Reaction ${action}ed successfully`,
      data: { 
        emoji,
        count: updatedReaction ? updatedReaction.count : 0
      }
    });
  })
);

// @route   POST /api/messages/:id/pin
// @desc    Pin or unpin message
// @access  Private (Project Owner or Admin)
router.post('/:id/pin',
  [
    param('id')
      .isMongoId()
      .withMessage('Invalid message ID')
  ],
  handleValidationErrors,
  catchAsync(async (req, res) => {
    const message = await Message.findById(req.params.id)
      .populate('project', 'members owner');

    if (!message) {
      throw new AppError('Message not found', 404);
    }

    // Check if user has permission to pin messages
    const project = message.project;
    const isOwner = project.owner.toString() === req.user._id.toString();
    const member = project.members.find(m => m.user.toString() === req.user._id.toString());
    const isAdmin = member && member.role === 'admin';

    if (!isOwner && !isAdmin) {
      throw new AppError('Access denied - only project owners and admins can pin messages', 403);
    }

    const wasPinned = message.isPinned;
    
    if (wasPinned) {
      await message.unpin();
    } else {
      await message.pin(req.user._id);
    }

    // Populate for response
    await message.populate('pinnedBy', 'name email avatar');

    // Emit real-time event
    req.io.to(`project_${message.project._id}`).emit('message_pin_toggled', {
      messageId: message._id,
      isPinned: !wasPinned,
      pinnedBy: !wasPinned ? req.user : null
    });

    res.json({
      success: true,
      message: `Message ${wasPinned ? 'unpinned' : 'pinned'} successfully`,
      data: { 
        isPinned: !wasPinned,
        pinnedAt: message.pinnedAt,
        pinnedBy: message.pinnedBy
      }
    });
  })
);

// @route   GET /api/messages/:id/replies
// @desc    Get replies to a message
// @access  Private (Project Member)
router.get('/:id/replies',
  [
    param('id')
      .isMongoId()
      .withMessage('Invalid message ID'),
    
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('Limit must be between 1 and 50')
  ],
  handleValidationErrors,
  catchAsync(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;
    
    const parentMessage = await Message.findById(req.params.id)
      .populate('project', 'members owner');

    if (!parentMessage) {
      throw new AppError('Parent message not found', 404);
    }

    // Check if user is project member
    const project = parentMessage.project;
    const isOwner = project.owner.toString() === req.user._id.toString();
    const isMember = project.members.some(member => 
      member.user.toString() === req.user._id.toString()
    );

    if (!isOwner && !isMember) {
      throw new AppError('Access denied - not a project member', 403);
    }

    const replies = await Message.find({
      parentMessage: req.params.id,
      isDeleted: false
    })
      .populate('author', 'name email avatar')
      .populate('mentions', 'name email avatar')
      .populate('readBy.user', 'name email avatar')
      .sort({ createdAt: 1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Message.countDocuments({
      parentMessage: req.params.id,
      isDeleted: false
    });

    res.json({
      success: true,
      data: {
        replies,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalReplies: total,
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      }
    });
  })
);

// @route   GET /api/messages/unread/count
// @desc    Get unread message count for user
// @access  Private
router.get('/unread/count',
  catchAsync(async (req, res) => {
    // Get user's projects
    const userProjects = await Project.find({
      $or: [
        { owner: req.user._id },
        { 'members.user': req.user._id }
      ]
    }).select('_id');

    const unreadCount = await Message.countDocuments({
      project: { $in: userProjects.map(p => p._id) },
      isDeleted: false,
      'readBy.user': { $ne: req.user._id },
      author: { $ne: req.user._id } // Don't count user's own messages
    });

    res.json({
      success: true,
      data: { unreadCount }
    });
  })
);

// @route   PUT /api/messages/project/:projectId/read-all
// @desc    Mark all messages in project as read
// @access  Private (Project Member)
router.put('/project/:projectId/read-all',
  [
    param('projectId')
      .isMongoId()
      .withMessage('Invalid project ID')
  ],
  handleValidationErrors,
  requireProjectMember,
  catchAsync(async (req, res) => {
    const { projectId } = req.params;

    const result = await Message.updateMany(
      {
        project: projectId,
        isDeleted: false,
        'readBy.user': { $ne: req.user._id },
        author: { $ne: req.user._id }
      },
      {
        $addToSet: {
          readBy: {
            user: req.user._id,
            readAt: new Date()
          }
        }
      }
    );

    res.json({
      success: true,
      message: 'All messages marked as read',
      data: { 
        markedAsRead: result.modifiedCount 
      }
    });
  })
);

// @route   GET /api/messages/search
// @desc    Search messages across all user's projects
// @access  Private
router.get('/search',
  [
    query('q')
      .notEmpty()
      .withMessage('Search query is required')
      .isLength({ min: 2 })
      .withMessage('Search query must be at least 2 characters'),
    
    query('project')
      .optional()
      .isMongoId()
      .withMessage('Invalid project ID'),
    
    query('author')
      .optional()
      .isMongoId()
      .withMessage('Invalid author ID'),
    
    query('dateFrom')
      .optional()
      .isISO8601()
      .withMessage('Date from must be a valid date'),
    
    query('dateTo')
      .optional()
      .isISO8601()
      .withMessage('Date to must be a valid date'),
    
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('Limit must be between 1 and 50')
  ],
  handleValidationErrors,
  catchAsync(async (req, res) => {
    const { 
      q, 
      project, 
      author, 
      dateFrom, 
      dateTo, 
      page = 1, 
      limit = 20 
    } = req.query;

    // Get user's projects if no specific project is provided
    let projectIds = [];
    
    if (project) {
      // Verify user has access to this project
      const projectDoc = await Project.findById(project);
      if (!projectDoc) {
        throw new AppError('Project not found', 404);
      }
      
      const isOwner = projectDoc.owner.toString() === req.user._id.toString();
      const isMember = projectDoc.members.some(member => 
        member.user.toString() === req.user._id.toString()
      );
      
      if (!isOwner && !isMember) {
        throw new AppError('Access denied - not a project member', 403);
      }
      
      projectIds = [project];
    } else {
      const userProjects = await Project.find({
        $or: [
          { owner: req.user._id },
          { 'members.user': req.user._id }
        ]
      }).select('_id');
      
      projectIds = userProjects.map(p => p._id);
    }

    // Build search query
    const query = {
      project: { $in: projectIds },
      isDeleted: false,
      content: { $regex: q, $options: 'i' }
    };

    if (author) query.author = author;
    
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) query.createdAt.$lte = new Date(dateTo);
    }

    const messages = await Message.find(query)
      .populate('author', 'name email avatar')
      .populate('project', 'name')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Message.countDocuments(query);

    res.json({
      success: true,
      data: {
        messages,
        searchQuery: q,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalResults: total,
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      }
    });
  })
);

module.exports = router;