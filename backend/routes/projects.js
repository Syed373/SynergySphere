const express = require('express');
const router = express.Router();

// Placeholder for project controllers
const projectController = {
  getAllProjects: (req, res) => {
    res.status(200).json({ message: 'Get all projects' });
  },
  getProjectById: (req, res) => {
    res.status(200).json({ message: `Get project by ID: ${req.params.id}` });
  },
  createProject: (req, res) => {
    res.status(201).json({ message: 'Create new project' });
  },
  updateProject: (req, res) => {
    res.status(200).json({ message: `Update project by ID: ${req.params.id}` });
  },
  deleteProject: (req, res) => {
    res.status(200).json({ message: `Delete project by ID: ${req.params.id}` });
  },
};

// Project routes
router.get('/', projectController.getAllProjects);
router.get('/:id', projectController.getProjectById);
router.post('/', projectController.createProject);
router.put('/:id', projectController.updateProject);
router.delete('/:id', projectController.deleteProject);

module.exports = router;
