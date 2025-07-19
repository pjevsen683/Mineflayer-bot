# Still work in progress. doesn't really work

# Minecraft Worker Bot System

A sophisticated Minecraft bot system built with Mineflayer that supports multiple worker bots with task queuing, priority commands, and state persistence.

## Features

- **Multiple Bot Management**: Spawn and manage multiple worker bots (worker1, worker2, etc.)
- **Task Queue System**: Queue tasks and execute them in order
- **Priority Commands**: Use "now" suffix to pause current tasks and execute immediately
- **Follow Task**: Bots can follow players at configurable distances
- **Case-Insensitive Commands**: All commands work regardless of case
- **Comprehensive Feedback**: Task status, errors, and completion messages
- **State Persistence**: Saves bot states and task queues between sessions
- **Error Handling**: Graceful handling of connection issues and task failures

## Installation

1. **Install Node.js** (version 14 or higher)

2. **Install dependencies**:
   ```bash
   npm install mineflayer mineflayer-pathfinder
   ```

3. **Configure the server**:
   Edit `config.json` to match your Minecraft server settings:
   ```json
   {
     "server": {
       "host": "localhost",
       "port": 25565,
       "version": "1.20.1"
     },
     "bots": {
       "count": 1,
       "states": {}
     }
   }
   ```

4. **Start the bot system**:
   ```bash
   node index.js
   ```

## Commands

### Bot Commands
- `worker1 follow me` - Follow the command sender
- `worker1 follow <player>` - Follow a specific player
- `worker1 stop` - Stop current task
- `worker1 clear` - Clear all tasks in queue
- `worker1 tasks` - List current tasks and queue
- `worker1 help` - Show help message

### Priority Commands
Add "now" to any command to execute immediately (pausing current task):
- `worker1 follow me now`
- `worker1 stop now`

### Bot Management Commands
- `spawn bot` - Create a new worker bot
- `despawn worker2` - Remove a specific bot
- `list bots` - Show all active bots

## Task System

### Current Tasks
1. **Follow Task**: Bots follow players at 2-block distance using pathfinding

### Adding New Tasks
The system is designed to be easily extensible. To add a new task:

1. Create a new task class that extends `BaseTask`
2. Implement the `run()` method
3. Add the task to the `CommandParser.createTask()` method
4. Add command parsing logic

Example structure for a new task:
```javascript
class FellTask extends BaseTask {
  constructor(bot, radius) {
    super(bot, `Fell trees in ${radius} block radius`, { radius });
  }

  async run() {
    // Implement tree felling logic
  }
}
```

## Configuration

### Server Settings
- `host`: Minecraft server hostname
- `port`: Server port (default: 25565)
- `version`: Minecraft version

### Bot Settings
- `count`: Number of bots to spawn on startup
- `states`: Saved bot states (auto-managed)

## Architecture

### Core Classes
- **TaskManager**: Handles task queue, pause/resume logic
- **BaseTask**: Abstract base class for all tasks
- **FollowTask**: Implements following with pathfinding
- **CommandParser**: Parses chat messages and creates tasks

### Task Lifecycle
1. **Queued**: Task added to queue
2. **Executing**: Currently running task
3. **Paused**: Task paused for priority command
4. **Completed/Failed**: Task finished, next task starts

### State Persistence
The system automatically saves:
- Number of active bots
- Task queue states
- Current and paused tasks

## Error Handling

The system handles various error scenarios:
- **Connection errors**: Automatic reconnection attempts
- **Task failures**: Graceful error reporting and queue continuation
- **Invalid commands**: Clear error messages
- **Player not found**: "I cannot see <player>" messages

## Examples

### Basic Usage
```
> worker1 follow me
worker1: Task queued: Follow PlayerName

> worker1 follow Steve
worker1: Task queued: Follow Steve

> worker1 tasks
worker1: Current tasks:
• Currently executing: Follow PlayerName
• Queued (1):
  1. Follow Steve

> worker1 stop now
worker1: Stopped task: Follow PlayerName
```

### Priority Commands
```
> worker1 follow me now
worker1: Pausing current task to execute: Follow PlayerName
worker1: Starting task: Follow PlayerName
```

### Bot Management
```
> spawn bot
worker1: Spawning worker2

> list bots
worker1: Active bots: worker1, worker2

> despawn worker2
worker1: Despawned worker2
```

## Troubleshooting

### Common Issues

1. **Bot can't connect**:
   - Check server host/port in config.json
   - Ensure server is running and accessible
   - Verify Minecraft version compatibility

2. **Pathfinding fails**:
   - Ensure mineflayer-pathfinder is installed
   - Check if bot has proper permissions
   - Verify target player is visible

3. **Commands not working**:
   - Check case sensitivity (commands are case-insensitive)
   - Ensure bot name is correct (worker1, worker2, etc.)
   - Verify command syntax

### Debug Mode
Add console logging by modifying the bot event handlers in `index.js`.

## Contributing

To add new features:
1. Create new task classes extending `BaseTask`
2. Add command parsing in `CommandParser`
3. Update help messages
4. Test thoroughly with various scenarios

## License

MIT License - feel free to modify and distribute. 