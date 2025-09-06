const express = require('express');
const { body, param, query } = require('express-validator');
const Task = require('../models/Task');
const Project = require('../models/Project');
const Notification = require('../models/Notification');
const { handleValidationErrors, catchAsync, AppError } = require('../middleware/errorHandler');
const { requireProjectMember, requireProjectPermission } = require('../middleware/auth');

const router = express.Router();

// Validation rules
const createTaskValidation = [
  body('title')
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('Task title must be between 2 and 200 characters'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Task description cannot exceed 2000 characters'),
  
  body('project')
    .isMongoId()
    .withMessage('Valid project ID is required'),
  
  body('assignee')
    .optional()
    .isMongoId()
    .withMessage('Invalid assignee ID'),
  
  body('dueDate')
    .optional()
    .isISO8601()
    .withMessage('Due date must be a valid date'),
  
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Priority must be low, medium, high, or urgent'),
  
  body('estimatedHours')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Estimated hours must be a positive number'),
  
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  
  body('tags.*')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Each tag must be 50 characters or less')
];

const updateTaskValidation = [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('Task title must be between 2 and 200 characters'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Task description cannot exceed 2000 characters'),
  
  body('assignee')
    .optional()
    .isMongoId()
    .withMessage('Invalid assignee ID'),
  
  body('status')
    .optional()
    .isIn(['todo', 'in-progress', 'in-review', 'completed', 'cancelled'])
    .withMessage('Status must be todo, in-progress, in-review, completed, or cancelled'),
  
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Priority must be low, medium, high, or urgent'),
  
  body('dueDate')
    .optional()
    .isISO8601()
    .withMessage('Due date must be a valid date'),
  
  body('progress')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('Progress must be between 0 and 100'),
  
  body('actualHours')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Actual hours must be a positive number')
];

const commentValidation = [
  body('content')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Comment must be between 1 and 1000 characters'),
  
  body('mentions')
    .optional()
    .isArray()
    .withMessage('Mentions must be an array'),
  
  body('mentions.*')
    .optional()
    .isMongoId()
    .withMessage('Invalid mention user ID')
];

// @route   GET /api/tasks
// @desc    Get tasks with filters
// @access  Private
router.get('/',
  [
    query('project')
      .optional()
      .isMongoId()
      .withMessage('Invalid project ID'),
    
    query('assignee')
      .optional()
      .isMongoId()
      .withMessage('Invalid assignee ID'),
    
    query('status')
      .optional()
      .isIn(['todo', 'in-progress', 'in-review', 'completed', 'cancelled'])
      .withMessage('Invalid status filter'),
    
    query('priority')
      .optional()
      .isIn(['low', 'medium', 'high', 'urgent'])
      .withMessage('Invalid priority filter'),
    
    query('overdue')
      .optional()
      .isBoolean()
      .withMessage('Overdue filter must be boolean'),
    
    query('dueDateFrom')
      .optional()
      .isISO8601()
      .withMessage('Due date from must be a valid date'),
    
    query('dueDateTo')
      .optional()
      .isISO8601()
      .withMessage('Due date to must be a valid date'),
    
    query('search')
      .optional()
      .isLength({ min: 2 })
      .withMessage('Search query must be at least 2 characters'),
    
    query('sortBy')
      .optional()
      .isIn(['title', 'createdAt', 'updatedAt', 'dueDate', 'priority', 'status'])
      .withMessage('Invalid sort field'),
    
    query('sortOrder')
      .optional()
      .isIn(['asc', 'desc'])
      .withMessage('Sort order must be asc or desc'),
    
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100')
  ],
  handleValidationErrors,
  catchAsync(async (req, res) => {
    const {
      project,
      assignee,
      status,
      priority,
      overdue,
      dueDateFrom,
      dueDateTo,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      limit = 20
    } = req.query;

    // Build query
    const query = {};
    
    // If project filter is provided, check if user is a member
    if (project) {
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
      
      query.project = project;
    } else {
      // If no project filter, only show tasks from user's projects
      const userProjects = await Project.find({
        $or: [
          { owner: req.user._id },
          { 'members.user': req.user._id }
        ]
      }).select('_id');
      
      query.project = { $in: userProjects.map(p => p._id) };
    }

    // Apply filters
    if (assignee) query.assignee = assignee;
    if (status) query.status = status;
    if (priority) query.priority = priority;
    
    // Date filters
    if (dueDateFrom || dueDateTo) {
      query.dueDate = {};
      if (dueDateFrom) query.dueDate.$gte = new Date(dueDateFrom);
      if (dueDateTo) query.dueDate.$lte = new Date(dueDateTo);
    }
    
    // Overdue filter
    if (overdue === 'true') {
      query.dueDate = { $lt: new Date() };
      query.status = { $nin: ['completed', 'cancelled'] };
    }
    
    // Search filter
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute query with pagination
    const tasks = await Task.find(query)
      .populate('assignee', 'name email avatar')
      .populate('creator', 'name email avatar')
      .populate('project', 'name color')
      .populate('comments.author', 'name email avatar')
      .sort(sort)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Task.countDocuments(query);

    res.json({
      success: true,
      data: {
        tasks,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalTasks: total,
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      }
    });
  })
);

// @route   POST /api/tasks
// @desc    Create a new task
// @access  Private (Project Member with Create Permission)
router.post('/',
  createTaskValidation,
  handleValidationErrors,
  catchAsync(async (req, res) => {
    const { project: projectId, assignee, title, description, dueDate, priority, estimatedHours, tags } = req.body;

    // Check if user is project member with create permission
    const project = await Project.findById(projectId);
    if (!project) {
      throw new AppError('Project not found', 404);
    }

    const isOwner = project.owner.toString() === req.user._id.toString();
    const member = project.members.find(m => m.user.toString() === req.user._id.toString());
    
    if (!isOwner && (!member || !member.permissions.canCreateTasks)) {
      throw new AppError('Access denied - cannot create tasks in this project', 403);
    }

    // If assignee is provided, check if they're a project member
    if (assignee) {
      const isAssigneeOwner = project.owner.toString() === assignee;
      const isAssigneeMember = project.members.some(m => m.user.toString() === assignee);
      
      if (!isAssigneeOwner && !isAssigneeMember) {
        throw new AppError('Assignee must be a project member', 400);
      }
    }

    const task = new Task({
      title,
      description,
      project: projectId,
      creator: req.user._id,
      assignee,
      dueDate,
      priority,
      estimatedHours,
      tags
    });

    // Add initial activity log
    task.addActivity('created', req.user._id, `Task created by ${req.user.name}`);

    await task.save();

    // Populate the response
    await task.populate([
      { path: 'assignee', select: 'name email avatar' },
      { path: 'creator', select: 'name email avatar' },
      { path: 'project', select: 'name color' }
    ]);

    // Create notification for assignee if different from creator
    if (assignee && assignee !== req.user._id.toString()) {
      await Notification.createNotification({
        recipient: assignee,
        sender: req.user._id,
        type: 'task_assigned',
        title: 'New Task Assigned',
        message: `${req.user.name} assigned you task "${title}"`,
        data: { 
          project: projectId, 
          task: task._id 
        },
        actionUrl: `/projects/${projectId}/tasks/${task._id}`,
        actionText: 'View Task'
      });
    }

    // Notify project members about new task
    const memberIds = project.members.map(m => m.user._id);
    memberIds.push(project.owner);
    
    for (const memberId of memberIds) {
      if (memberId.toString() !== req.user._id.toString() && memberId.toString() !== assignee) {
        await Notification.createNotification({
          recipient: memberId,
          sender: req.user._id,
          type: 'task_created',
          title: 'New Task Created',
          message: `${req.user.name} created task "${title}" in project "${project.name}"`,
          data: { 
            project: projectId, 
            task: task._id 
          },
          priority: 'low'
        });
      }
    }

    // Emit real-time event
    req.io.to(`project_${projectId}`).emit('task_created', {
      task,
      createdBy: req.user
    });

    res.status(201).json({
      success: true,
      message: 'Task created successfully',
      data: { task }
    });
  })
);

// @route   GET /api/tasks/:id
// @desc    Get task details
// @access  Private (Project Member)
router.get('/:id',
  [
    param('id')
      .isMongoId()
      .withMessage('Invalid task ID')
  ],
  handleValidationErrors,
  catchAsync(async (req, res) => {
    const task = await Task.findById(req.params.id)
      .populate('assignee', 'name email avatar')
      .populate('creator', 'name email avatar')
      .populate('project', 'name color members owner')
      .populate('comments.author', 'name email avatar')
      .populate('watchers', 'name email avatar')
      .populate('dependencies.task', 'title status')
      .populate('attachments.uploadedBy', 'name email avatar');

    if (!task) {
      throw new AppError('Task not found', 404);
    }

    // Check if user is project member
    const project = task.project;
    const isOwner = project.owner.toString() === req.user._id.toString();
    const isMember = project.members.some(member => 
      member.user.toString() === req.user._id.toString()
    );

    if (!isOwner && !isMember) {
      throw new AppError('Access denied - not a project member', 403);
    }

    res.json({
      success: true,
      data: { task }
    });
  })
);

// @route   PUT /api/tasks/:id
// @desc    Update task
// @access  Private (Project Member with Edit Permission)
router.put('/:id',
  [
    param('id')
      .isMongoId()
      .withMessage('Invalid task ID')
  ],
  updateTaskValidation,
  handleValidationErrors,
  catchAsync(async (req, res) => {
    const task = await Task.findById(req.params.id).populate('project');
    
    if (!task) {
      throw new AppError('Task not found', 404);
    }

    const project = task.project;
    
    // Check permissions
    const isOwner = project.owner.toString() === req.user._id.toString();
    const member = project.members.find(m => m.user.toString() === req.user._id.toString());
    
    if (!isOwner && (!member || !member.permissions.canEditTasks)) {
      throw new AppError('Access denied - cannot edit tasks in this project', 403);
    }

    const updateData = req.body;
    const oldValues = {};

    // Track changes for activity log
    const changedFields = [];
    
    Object.keys(updateData).forEach(key => {
      if (task[key] !== updateData[key]) {
        oldValues[key] = task[key];
        changedFields.push(key);
      }
    });

    // Special handling for assignee change
    if (updateData.assignee && updateData.assignee !== task.assignee?.toString()) {
      // Check if new assignee is project member
      if (updateData.assignee) {
        const isNewAssigneeOwner = project.owner.toString() === updateData.assignee;
        const isNewAssigneeMember = project.members.some(m => m.user.toString() === updateData.assignee);
        
        if (!isNewAssigneeOwner && !isNewAssigneeMember) {
          throw new AppError('Assignee must be a project member', 400);
        }
      }

      // Use the model method for assignment
      await task.assignTo(updateData.assignee, req.user._id);
      delete updateData.assignee; // Remove from updateData as it's already handled
    }

    // Special handling for status change
    if (updateData.status && updateData.status !== task.status) {
      await task.updateStatus(updateData.status, req.user._id);
      delete updateData.status; // Remove from updateData as it's already handled
    }

    // Update other fields
    Object.assign(task, updateData);

    // Add activity log for changes
    if (changedFields.length > 0) {
      const description = `Updated ${changedFields.join(', ')}`;
      task.addActivity('updated', req.user._id, description, oldValues, updateData);
    }

    await task.save();

    // Populate the response
    await task.populate([
      { path: 'assignee', select: 'name email avatar' },
      { path: 'creator', select: 'name email avatar' },
      { path: 'project', select: 'name color' },
      { path: 'comments.author', select: 'name email avatar' }
    ]);

    // Create notifications for task updates
    const notifyUsers = [];
    
    // Notify assignee about changes (if not the one making changes)
    if (task.assignee && task.assignee._id.toString() !== req.user._id.toString()) {
      notifyUsers.push(task.assignee._id);
    }
    
    // Notify watchers
    task.watchers.forEach(watcherId => {
      if (watcherId.toString() !== req.user._id.toString()) {
        notifyUsers.push(watcherId);
      }
    });

    // Send notifications
    for (const userId of [...new Set(notifyUsers)]) {
      await Notification.createNotification({
        recipient: userId,
        sender: req.user._id,
        type: 'task_updated',
        title: 'Task Updated',
        message: `${req.user.name} updated task "${task.title}"`,
        data: { 
          project: task.project._id, 
          task: task._id 
        },
        actionUrl: `/projects/${task.project._id}/tasks/${task._id}`
      });
    }

    // Emit real-time event
    req.io.to(`project_${task.project._id}`).emit('task_updated', {
      task,
      updatedBy: req.user,
      changes: changedFields
    });

    res.json({
      success: true,
      message: 'Task updated successfully',
      data: { task }
    });
  })
);

// @route   DELETE /api/tasks/:id
// @desc    Delete task
// @access  Private (Project Member with Delete Permission)
router.delete('/:id',
  [
    param('id')
      .isMongoId()
      .withMessage('Invalid task ID')
  ],
  handleValidationErrors,
  catchAsync(async (req, res) => {
    const task = await Task.findById(req.params.id).populate('project');
    
    if (!task) {
      throw new AppError('Task not found', 404);
    }

    const project = task.project;
    
    // Check permissions
    const isOwner = project.owner.toString() === req.user._id.toString();
    const member = project.members.find(m => m.user.toString() === req.user._id.toString());
    
    if (!isOwner && (!member || !member.permissions.canDeleteTasks)) {
      throw new AppError('Access denied - cannot delete tasks in this project', 403);
    }

    // Remove task from dependencies of other tasks
    await Task.updateMany(
      { 'dependencies.task': task._id },
      { $pull: { dependencies: { task: task._id } } }
    );

    await task.deleteOne();

    // Emit real-time event
    req.io.to(`project_${project._id}`).emit('task_deleted', {
      taskId: task._id,
      deletedBy: req.user
    });

    res.json({
      success: true,
      message: 'Task deleted successfully'
    });
  })
);

// @route   POST /api/tasks/:id/comments
// @desc    Add comment to task
// @access  Private (Project Member)
router.post('/:id/comments',
  [
    param('id')
      .isMongoId()
      .withMessage('Invalid task ID')
  ],
  commentValidation,
  handleValidationErrors,
  catchAsync(async (req, res) => {
    const { content, mentions = [] } = req.body;
    
    const task = await Task.findById(req.params.id).populate('project');
    
    if (!task) {
      throw new AppError('Task not found', 404);
    }

    const project = task.project;
    
    // Check if user is project member
    const isOwner = project.owner.toString() === req.user._id.toString();
    const isMember = project.members.some(member => 
      member.user.toString() === req.user._id.toString()
    );

    if (!isOwner && !isMember) {
      throw new AppError('Access denied - not a project member', 403);
    }

    // Add comment using model method
    await task.addComment(req.user._id, content, mentions);

    // Populate the updated task
    await task.populate([
      { path: 'comments.author', select: 'name email avatar' },
      { path: 'comments.mentions', select: 'name email avatar' }
    ]);

    // Get the newly added comment
    const newComment = task.comments[task.comments.length - 1];

    // Create notifications
    const notifyUsers = new Set();
    
    // Notify task assignee
    if (task.assignee && task.assignee.toString() !== req.user._id.toString()) {
      notifyUsers.add(task.assignee.toString());
    }
    
    // Notify mentioned users
    mentions.forEach(userId => {
      if (userId !== req.user._id.toString()) {
        notifyUsers.add(userId);
      }
    });
    
    // Notify watchers
    task.watchers.forEach(watcherId => {
      if (watcherId.toString() !== req.user._id.toString()) {
        notifyUsers.add(watcherId.toString());
      }
    });

    // Send notifications
    for (const userId of notifyUsers) {
      await Notification.createNotification({
        recipient: userId,
        sender: req.user._id,
        type: 'task_comment',
        title: 'New Task Comment',
        message: `${req.user.name} commented on task "${task.title}"`,
        data: { 
          project: task.project._id, 
          task: task._id 
        },
        actionUrl: `/projects/${task.project._id}/tasks/${task._id}#comment-${newComment._id}`
      });
    }

    // Emit real-time event
    req.io.to(`project_${task.project._id}`).emit('task_comment_added', {
      taskId: task._id,
      comment: newComment,
      author: req.user
    });

    res.status(201).json({
      success: true,
      message: 'Comment added successfully',
      data: { 
        comment: newComment,
        task: task._id
      }
    });
  })
);

// @route   PUT /api/tasks/:id/status
// @desc    Update task status
// @access  Private (Project Member)
router.put('/:id/status',
  [
    param('id')
      .isMongoId()
      .withMessage('Invalid task ID'),
    
    body('status')
      .isIn(['todo', 'in-progress', 'in-review', 'completed', 'cancelled'])
      .withMessage('Status must be todo, in-progress, in-review, completed, or cancelled')
  ],
  handleValidationErrors,
  catchAsync(async (req, res) => {
    const { status } = req.body;
    
    const task = await Task.findById(req.params.id).populate('project');
    
    if (!task) {
      throw new AppError('Task not found', 404);
    }

    const project = task.project;
    
    // Check permissions
    const isOwner = project.owner.toString() === req.user._id.toString();
    const isMember = project.members.some(member => 
      member.user.toString() === req.user._id.toString()
    );
    const isAssignee = task.assignee && task.assignee.toString() === req.user._id.toString();

    if (!isOwner && !isMember && !isAssignee) {
      throw new AppError('Access denied', 403);
    }

    const oldStatus = task.status;
    
    // Update status using model method
    await task.updateStatus(status, req.user._id);

    // Populate for response
    await task.populate([
      { path: 'assignee', select: 'name email avatar' },
      { path: 'project', select: 'name' }
    ]);

    // Create notifications for status changes
    const notifyUsers = [];
    
    if (task.assignee && task.assignee._id.toString() !== req.user._id.toString()) {
      notifyUsers.push(task.assignee._id);
    }
    
    // Notify watchers
    task.watchers.forEach(watcherId => {
      if (watcherId.toString() !== req.user._id.toString()) {
        notifyUsers.push(watcherId);
      }
    });

    // Special notification for task completion
    if (status === 'completed') {
      const notificationType = 'task_completed';
      const message = `${req.user.name} completed task "${task.title}"`;
      
      for (const userId of [...new Set(notifyUsers)]) {
        await Notification.createNotification({
          recipient: userId,
          sender: req.user._id,
          type: notificationType,
          title: 'Task Completed',
          message,
          data: { 
            project: task.project._id, 
            task: task._id 
          }
        });
      }
    }

    // Emit real-time event
    req.io.to(`project_${task.project._id}`).emit('task_status_updated', {
      taskId: task._id,
      oldStatus,
      newStatus: status,
      updatedBy: req.user
    });

    res.json({
      success: true,
      message: `Task status updated to ${status}`,
      data: { 
        task: {
          _id: task._id,
          status: task.status,
          completedAt: task.completedAt
        }
      }
    });
  })
);

// @route   POST /api/tasks/:id/subtasks
// @desc    Add subtask
// @access  Private (Project Member)
router.post('/:id/subtasks',
  [
    param('id')
      .isMongoId()
      .withMessage('Invalid task ID'),
    
    body('title')
      .trim()
      .isLength({ min: 2, max: 200 })
      .withMessage('Subtask title must be between 2 and 200 characters')
  ],
  handleValidationErrors,
  catchAsync(async (req, res) => {
    const { title } = req.body;
    
    const task = await Task.findById(req.params.id).populate('project');
    
    if (!task) {
      throw new AppError('Task not found', 404);
    }

    // Check project membership
    const project = task.project;
    const isOwner = project.owner.toString() === req.user._id.toString();
    const isMember = project.members.some(member => 
      member.user.toString() === req.user._id.toString()
    );

    if (!isOwner && !isMember) {
      throw new AppError('Access denied - not a project member', 403);
    }

    // Add subtask using model method
    await task.addSubtask(title);

    const newSubtask = task.subtasks[task.subtasks.length - 1];

    // Emit real-time event
    req.io.to(`project_${task.project._id}`).emit('subtask_added', {
      taskId: task._id,
      subtask: newSubtask,
      addedBy: req.user
    });

    res.status(201).json({
      success: true,
      message: 'Subtask added successfully',
      data: { 
        subtask: newSubtask,
        taskId: task._id
      }
    });
  })
);

// @route   PUT /api/tasks/:id/subtasks/:subtaskId/toggle
// @desc    Toggle subtask completion
// @access  Private (Project Member)
router.put('/:id/subtasks/:subtaskId/toggle',
  [
    param('id')
      .isMongoId()
      .withMessage('Invalid task ID'),
    
    param('subtaskId')
      .isMongoId()
      .withMessage('Invalid subtask ID')
  ],
  handleValidationErrors,
  catchAsync(async (req, res) => {
    const task = await Task.findById(req.params.id).populate('project');
    
    if (!task) {
      throw new AppError('Task not found', 404);
    }

    // Check project membership
    const project = task.project;
    const isOwner = project.owner.toString() === req.user._id.toString();
    const isMember = project.members.some(member => 
      member.user.toString() === req.user._id.toString()
    );

    if (!isOwner && !isMember) {
      throw new AppError('Access denied - not a project member', 403);
    }

    // Toggle subtask using model method
    await task.toggleSubtask(req.params.subtaskId);

    const updatedSubtask = task.subtasks.id(req.params.subtaskId);

    // Emit real-time event
    req.io.to(`project_${task.project._id}`).emit('subtask_toggled', {
      taskId: task._id,
      subtaskId: req.params.subtaskId,
      completed: updatedSubtask.completed,
      toggledBy: req.user
    });

    res.json({
      success: true,
      message: 'Subtask updated successfully',
      data: { 
        subtask: updatedSubtask,
        taskProgress: task.subtaskProgress
      }
    });
  })
);

// @route   POST /api/tasks/:id/watch
// @desc    Watch/Unwatch task
// @access  Private (Project Member)
router.post('/:id/watch',
  [
    param('id')
      .isMongoId()
      .withMessage('Invalid task ID')
  ],
  handleValidationErrors,
  catchAsync(async (req, res) => {
    const task = await Task.findById(req.params.id).populate('project');
    
    if (!task) {
      throw new AppError('Task not found', 404);
    }

    // Check project membership
    const project = task.project;
    const isOwner = project.owner.toString() === req.user._id.toString();
    const isMember = project.members.some(member => 
      member.user.toString() === req.user._id.toString()
    );

    if (!isOwner && !isMember) {
      throw new AppError('Access denied - not a project member', 403);
    }

    const isWatching = task.watchers.includes(req.user._id);
    
    if (isWatching) {
      await task.removeWatcher(req.user._id);
    } else {
      await task.addWatcher(req.user._id);
    }

    res.json({
      success: true,
      message: isWatching ? 'Stopped watching task' : 'Now watching task',
      data: { 
        watching: !isWatching,
        watcherCount: task.watchers.length
      }
    });
  })
);

// @route   GET /api/tasks/overdue
// @desc    Get overdue tasks for user
// @access  Private
router.get('/overdue',
  catchAsync(async (req, res) => {
    // Get user's projects
    const userProjects = await Project.find({
      $or: [
        { owner: req.user._id },
        { 'members.user': req.user._id }
      ]
    }).select('_id');

    const overdueTasks = await Task.find({
      project: { $in: userProjects.map(p => p._id) },
      assignee: req.user._id,
      status: { $nin: ['completed', 'cancelled'] },
      dueDate: { $lt: new Date() }
    })
      .populate('project', 'name color')
      .sort({ dueDate: 1 })
      .limit(50);

    res.json({
      success: true,
      data: { tasks: overdueTasks }
    });
  })
);

module.exports = router;