const FollowTask = require('./tasks/FollowTask');

class CommandParser {
  constructor(bot, taskManager) {
    this.bot = bot;
    this.taskManager = taskManager;
    this.botName = bot.username;
  }

  parseMessage(username, message) {
    // Make message case-insensitive
    const lowerMessage = message.toLowerCase().trim();
    
    // Check if message is directed at this bot
    if (!lowerMessage.startsWith(this.botName.toLowerCase() + ' ')) {
      return false;
    }

    // Remove bot name from message
    const command = lowerMessage.substring(this.botName.length + 1).trim();
    
    // Check if it's a priority command (ends with "now")
    const isPriority = command.endsWith(' now');
    const cleanCommand = isPriority ? command.slice(0, -4).trim() : command;

    try {
      const task = this.createTask(cleanCommand, username);
      if (task) {
        this.taskManager.addTask(task, isPriority);
        return true;
      }
    } catch (error) {
      this.bot.chat(`Error: ${error.message}`);
      return true;
    }

    // Handle special commands that don't create tasks
    if (this.handleSpecialCommands(cleanCommand, username)) {
      return true;
    }

    // Unknown command
    this.bot.chat(`I don't know that command: ${cleanCommand}`);
    return true;
  }

  createTask(command, username) {
    const parts = command.split(' ');
    const action = parts[0];

    switch (action) {
      case 'follow':
        return this.createFollowTask(parts, username);
      
      // Future tasks can be added here
      // case 'fell':
      //   return this.createFellTask(parts, username);
      
      default:
        return null;
    }
  }

  createFollowTask(parts, username) {
    if (parts.length < 2) {
      throw new Error('Follow command requires a target. Usage: follow <player> or follow me');
    }

    let targetPlayer;
    if (parts[1] === 'me') {
      targetPlayer = username;
    } else {
      targetPlayer = parts[1];
    }

    // Check if target player exists
    const target = this.bot.players[targetPlayer];
    if (!target || !target.entity) {
      throw new Error(`I cannot see ${targetPlayer}`);
    }

    return new FollowTask(this.bot, targetPlayer);
  }

  handleSpecialCommands(command, username) {
    switch (command) {
      case 'stop':
        this.taskManager.stopCurrentTask();
        return true;
      
      case 'clear':
      case 'clear queue':
        this.taskManager.clearQueue();
        return true;
      
      case 'tasks':
      case 'queue':
      case 'list':
        this.taskManager.listTasks();
        return true;
      
      case 'help':
        this.showHelp();
        return true;
      
      default:
        return false;
    }
  }

  showHelp() {
    const helpMessage = `Available commands:
• follow <player> - Follow a specific player
• follow me - Follow the command sender
• stop - Stop current task
• clear - Clear all tasks
• tasks - List current tasks
• help - Show this help message

Add "now" to any command to execute immediately (pausing current task).
Example: ${this.botName} follow me now`;
    
    this.bot.chat(helpMessage);
  }
}

module.exports = CommandParser;