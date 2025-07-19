const BaseTask = require('./BaseTask');

class ComeTask extends BaseTask {
  constructor(bot, targetPlayer) {
    super(bot, `Come to ${targetPlayer}`);
    this.targetPlayer = targetPlayer;
  }

  async run() {
    try {
      console.log(`${this.bot.username}: Starting come task to ${this.targetPlayer}...`);
      
      // Check if target player exists and is visible
      const target = this.bot.players[this.targetPlayer];
      if (!target || !target.entity) {
        throw new Error(`I cannot see ${this.targetPlayer}`);
      }

      console.log(`${this.bot.username}: Target player found at ${Math.round(target.entity.position.x)}, ${Math.round(target.entity.position.y)}, ${Math.round(target.entity.position.z)}`);

      // Move to player's position
      await this.goToPlayer(target.entity.position);

      console.log(`${this.bot.username}: Come task completed successfully`);
      this.bot.chat(`I'm here, ${this.targetPlayer}!`);

    } catch (error) {
      console.log(`${this.bot.username}: Error in come task: ${error.message}`);
      throw error;
    }
  }

  async goToPlayer(playerPosition) {
    const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
    
    if (!this.bot.pathfinder) {
      this.bot.loadPlugin(pathfinder);
    }

    const defaultMove = new Movements(this.bot);
    this.bot.pathfinder.setMovements(defaultMove);

    // Go to within 2 blocks of the player
    const goal = new goals.GoalNear(playerPosition.x, playerPosition.y, playerPosition.z, 2);
    await this.bot.pathfinder.goto(goal);
  }

  stop() {
    // Stop any current pathfinding
    if (this.bot.pathfinder) {
      this.bot.pathfinder.stop();
    }
    
    super.stop();
  }

  pause() {
    // Stop pathfinding when paused
    if (this.bot.pathfinder) {
      this.bot.pathfinder.stop();
    }
    
    super.pause();
  }
}

module.exports = ComeTask; 