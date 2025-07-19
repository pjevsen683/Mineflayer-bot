class TaskManager {
  constructor(bot) {
    this.bot = bot;
    this.taskQueue = [];
    this.currentTask = null;
    this.isPaused = false;
    this.pausedTask = null;
  }

  addTask(task, priority = false) {
    if (priority) {
      // For "now" commands - pause current task and execute immediately
      if (this.currentTask) {
        this.pausedTask = this.currentTask;
        this.currentTask.pause();
        this.bot.chat(`Pausing current task to execute: ${task.name}`);
      }
      this.currentTask = task;
      this.executeCurrentTask();
    } else {
      // Regular task - add to queue
      this.taskQueue.push(task);
      this.bot.chat(`Task queued: ${task.name}`);
      if (!this.currentTask) {
        this.processNextTask();
      }
    }
  }

  processNextTask() {
    if (this.taskQueue.length === 0) {
      this.currentTask = null;
      return;
    }

    this.currentTask = this.taskQueue.shift();
    this.executeCurrentTask();
  }

  executeCurrentTask() {
    if (!this.currentTask) return;

    this.bot.chat(`Starting task: ${this.currentTask.name}`);
    
    this.currentTask.execute()
      .then(() => {
        this.bot.chat(`Task completed: ${this.currentTask.name}`);
        this.onTaskComplete();
      })
      .catch((error) => {
        if (this.currentTask){
          this.bot.chat(`Task failed: ${this.currentTask.name} - ${error.message}`);
        }
        this.onTaskComplete();
      });
  }

  onTaskComplete() {
    // Check if we need to resume a paused task
    if (this.pausedTask) {
      this.currentTask = this.pausedTask;
      this.pausedTask = null;
      this.bot.chat(`Resuming task: ${this.currentTask.name}`);
      this.currentTask.resume();
    } else {
      // Process next task in queue
      this.processNextTask();
    }
  }

  stopCurrentTask() {
    if (this.currentTask) {
      this.currentTask.stop();
      this.bot.chat(`Stopped task: ${this.currentTask.name}`);
      this.currentTask = null;
    }
    
    if (this.pausedTask) {
      this.bot.chat(`Cancelled paused task: ${this.pausedTask.name}`);
      this.pausedTask = null;
    }
  }

  clearQueue() {
    this.taskQueue = [];
    this.stopCurrentTask();
    this.bot.chat('Task queue cleared');
  }

  listTasks() {
    let message = 'Current tasks:\n';
    
    if (this.currentTask) {
      message += `• Currently executing: ${this.currentTask.name}\n`;
    }
    
    if (this.pausedTask) {
      message += `• Paused: ${this.pausedTask.name}\n`;
    }
    
    if (this.taskQueue.length > 0) {
      message += `• Queued (${this.taskQueue.length}):\n`;
      this.taskQueue.forEach((task, index) => {
        message += `  ${index + 1}. ${task.name}\n`;
      });
    } else if (!this.currentTask && !this.pausedTask) {
      message += '• No tasks in queue';
    }
    
    this.bot.chat(message);
  }

  getState() {
    return {
      taskQueue: this.taskQueue.map(task => task.serialize()),
      currentTask: this.currentTask ? this.currentTask.serialize() : null,
      pausedTask: this.pausedTask ? this.pausedTask.serialize() : null
    };
  }

  restoreState(state) {
    // This would be implemented to restore tasks from saved state
    // For now, we'll start fresh but the structure is ready
    this.taskQueue = [];
    this.currentTask = null;
    this.pausedTask = null;
  }
}

module.exports = TaskManager;