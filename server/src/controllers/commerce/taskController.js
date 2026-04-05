const { Task, Deal, Contact } = require('../../models');
const { validationResult } = require('express-validator');
const mongoose = require('mongoose');

/**
 * Create a new task
 */
async function createTask(req, res, next) {
  try {
    const workspace = req.user.workspace;
    const { 
      title, 
      description, 
      dueDate, 
      priority, 
      assignee, 
      relatedDeal, 
      relatedContact 
    } = req.body;

    const task = new Task({
      workspace,
      title,
      description,
      dueDate,
      priority,
      assignee: assignee || req.user._id,
      relatedDeal,
      relatedContact
    });

    await task.save();

    res.status(201).json({
      success: true,
      data: task
    });
  } catch (err) {
    next(err);
  }
}

/**
 * List tasks for a workspace with filters
 */
async function listTasks(req, res, next) {
  try {
    const workspace = req.user.workspace;
    const { status, priority, assignee, dealId, contactId, overdue } = req.query;

    const filter = { workspace };

    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (assignee) filter.assignee = assignee;
    if (dealId) filter.relatedDeal = dealId;
    if (contactId) filter.relatedContact = contactId;

    if (overdue === 'true') {
      filter.dueDate = { $lt: new Date() };
      filter.status = { $ne: 'Completed' };
    }

    const tasks = await Task.find(filter)
      .populate('assignee', 'name email')
      .populate('relatedDeal', 'title')
      .populate('relatedContact', 'name phone')
      .sort({ dueDate: 1, createdAt: -1 });

    res.json({
      success: true,
      count: tasks.length,
      data: tasks
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get a single task by ID
 */
async function getTask(req, res, next) {
  try {
    const workspace = req.user.workspace;
    const task = await Task.findOne({ _id: req.params.id, workspace })
      .populate('assignee', 'name email')
      .populate('relatedDeal', 'title')
      .populate('relatedContact', 'name phone');

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.json({
      success: true,
      data: task
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Update a task
 */
async function updateTask(req, res, next) {
  try {
    const workspace = req.user.workspace;
    const updates = req.body;

    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, workspace },
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.json({
      success: true,
      data: task
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Toggle task status (Pending <-> Completed)
 */
async function toggleTaskStatus(req, res, next) {
  try {
    const workspace = req.user.workspace;
    const task = await Task.findOne({ _id: req.params.id, workspace });

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    task.status = task.status === 'Completed' ? 'Pending' : 'Completed';
    await task.save();

    res.json({
      success: true,
      data: task
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Delete a task
 */
async function deleteTask(req, res, next) {
  try {
    const workspace = req.user.workspace;
    const task = await Task.findOneAndDelete({ _id: req.params.id, workspace });

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.json({
      success: true,
      message: 'Task deleted successfully'
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createTask,
  listTasks,
  getTask,
  updateTask,
  toggleTaskStatus,
  deleteTask
};
