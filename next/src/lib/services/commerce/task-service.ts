/**
 * TASK SERVICE
 * 
 * Manages CRM follow-up tasks.
 */

import { Task } from "@/lib/models/commerce/Task";
import { Types } from "mongoose";

export class TaskService {
  /**
   * Create a follow-up task
   */
  static async createTask(workspaceId: string | Types.ObjectId, taskData: any, userId: string) {
    return await Task.create({
      workspace: workspaceId,
      ...taskData,
      createdBy: userId
    });
  }

  /**
   * Complete a task
   */
  static async completeTask(workspaceId: string, taskId: string, userId: string) {
    return await Task.findOneAndUpdate(
      { _id: taskId, workspace: workspaceId },
      { 
        $set: { 
            status: 'completed',
            completedAt: new Date(),
            completedBy: userId
        } 
      },
      { returnDocument: 'after' }
    );
  }

  /**
   * Get pending tasks for a deal
   */
  static async getDealTasks(workspaceId: string, dealId: string) {
    return await Task.find({
      workspace: workspaceId,
      deal: dealId,
      status: 'pending'
    }).sort({ dueDate: 1 });
  }
}
