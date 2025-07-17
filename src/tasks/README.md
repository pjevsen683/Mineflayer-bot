# Task System

This directory contains all the task classes for the Minecraft Worker Bot system.

## Structure

- `BaseTask.js` - Abstract base class that all tasks inherit from
- `FollowTask.js` - Task for following players
- `FellTask.js` - Task for felling trees in a radius

## Adding New Tasks

To add a new task:

1. Create a new file in this directory (e.g., `MineTask.js`)
2. Extend the `BaseTask` class
3. Implement the required methods:
   - `constructor(bot, ...params)` - Initialize the task
   - `async run()` - Main task logic
   - `stop()` - Clean up when stopped
   - `pause()` - Handle pausing
   - `resume()` - Handle resuming

4. Add the task to the `CommandParser.createTask()` method in `index.js`
5. Update the help message to include the new command

## Example Task Structure

```javascript
const BaseTask = require('./BaseTask');

class MyTask extends BaseTask {
  constructor(bot, param1, param2) {
    super(bot, `My Task Description`, { param1, param2 });
    this.param1 = param1;
    this.param2 = param2;
  }

  async run() {
    // Main task logic here
    this.bot.chat('Starting my task...');
    
    // Your task implementation
    
    this.bot.chat('Task completed!');
  }

  stop() {
    // Clean up resources
    super.stop();
  }

  pause() {
    // Handle pausing
    return super.pause();
  }
}

module.exports = MyTask;
```

## Task Lifecycle

1. **Created** - Task is instantiated with parameters
2. **Queued** - Added to task queue (or executed immediately if priority)
3. **Executing** - `run()` method is called
4. **Paused** - Task is paused for priority command (optional)
5. **Resumed** - Task continues from where it left off (optional)
6. **Completed/Failed** - Task finishes, next task starts

## Best Practices

- Always call `await this.checkPauseAndStop()` in loops
- Provide clear feedback via `this.bot.chat()`
- Handle errors gracefully
- Clean up resources in `stop()` and `pause()`
- Use pathfinding for movement when possible
- Check for `this.shouldStop` in long-running operations 