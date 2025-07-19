const mineflayer = require('mineflayer');
const fs = require('fs');
const path = require('path');
const TaskManager = require('./src/TaskManager');
const CommandParser = require('./src/CommandParser');

// Load configuration
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

// Bot management
const bots = new Map();
let botCounter = 1;











// Bot Management Functions
function spawnBot(botName) {
  if (bots.has(botName)) {
    console.log(`Bot ${botName} already exists`);
    return;
  }

  const bot = mineflayer.createBot({
    host: config.server.host,
    port: config.server.port,
    version: config.server.version,
    username: botName,
    auth: 'offline'
  });

  const taskManager = new TaskManager(bot);
  const commandParser = new CommandParser(bot, taskManager, botName);

  // Attach taskManager to bot for state saving
  bot.taskManager = taskManager;

  // Bot event handlers
  bot.on('spawn', () => {
    console.log(`${botName} spawned successfully`);
    bot.chat('Hello! I am ready to work.');
  });

  bot.on('chat', (username, message) => {
    // Ignore own messages and invalid messages
    if (username === botName || !username || !message) return;
    
    // Debug logging
    console.log(`${botName} received message from ${username}: "${message}"`);
    
    // Handle bot management commands
    if (message.toLowerCase().startsWith('spawn bot')) {
      const newBotName = `worker${botCounter}`;
      botCounter++;
      spawnBot(newBotName);
      bot.chat(`Spawning ${newBotName}`);
      return;
    }

    if (message.toLowerCase().startsWith('despawn ')) {
      const targetBot = message.split(' ')[1];
      if (bots.has(targetBot)) {
        bots.get(targetBot).quit();
        bots.delete(targetBot);
        bot.chat(`Despawned ${targetBot}`);
      } else {
        bot.chat(`Bot ${targetBot} not found`);
      }
      return;
    }

    if (message.toLowerCase() === 'list bots') {
      const botList = Array.from(bots.keys()).join(', ');
      bot.chat(`Active bots: ${botList}`);
      return;
    }

    // Parse commands for this bot
    commandParser.parseMessage(username, message);
  });

  bot.on('error', (err) => {
    console.log(`${botName} error:`, err);
  });

  bot.on('kicked', (reason) => {
    console.log(`${botName} was kicked:`, reason);
  });

  bot.on('end', () => {
    console.log(`${botName} disconnected`);
    bots.delete(botName);
  });

  bots.set(botName, bot);
  return bot;
}

// Initialize bots
function initializeBots() {
  const botCount = config.bots.count || 1;
  
  for (let i = 1; i <= botCount; i++) {
    const botName = `worker${i}`;
    spawnBot(botName);
  }
  
  console.log(`Initialized ${botCount} bot(s)`);
}

// Save bot states
function saveBotStates() {
  const states = {};
  bots.forEach((bot, name) => {
    if (bot.taskManager) {
      states[name] = bot.taskManager.getState();
    }
  });
  
  config.bots.states = states;
  config.bots.count = bots.size;
  
  fs.writeFileSync('config.json', JSON.stringify(config, null, 2));
}

// Load bot states
function loadBotStates() {
  if (config.bots.states) {
    Object.keys(config.bots.states).forEach(botName => {
      const state = config.bots.states[botName];
      // Restore state when bot is ready
      // This would be implemented in the bot's spawn event
    });
  }
}

// Handle process exit
process.on('SIGINT', () => {
  console.log('Saving bot states and shutting down...');
  saveBotStates();
  
  bots.forEach((bot, name) => {
    console.log(`Disconnecting ${name}...`);
    bot.quit();
  });
  
  process.exit(0);
});

// Start the bot system
console.log('Starting Minecraft Worker Bot System...');
initializeBots();
