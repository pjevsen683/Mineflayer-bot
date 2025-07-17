const BaseTask = require('./BaseTask');

class FollowTask extends BaseTask {
  constructor(bot, targetPlayer, distance = 2) {
    super(bot, `Follow ${targetPlayer}`, { targetPlayer, distance });
    this.targetPlayer = targetPlayer;
    this.distance = distance;
    this.followInterval = null;
  }

  async run() {
    const target = this.bot.players[this.targetPlayer];
    if (!target || !target.entity) {
      throw new Error(`I cannot see ${this.targetPlayer}`);
    }

    this.bot.chat(`Following ${this.targetPlayer} at ${this.distance} block distance`);
    
    // Start following loop
    this.followInterval = setInterval(async () => {
      try {
        await this.checkPauseAndStop();
        await this.followTarget();
      } catch (error) {
        if (this.followInterval) {
          clearInterval(this.followInterval);
          this.followInterval = null;
        }
        throw error;
      }
    }, 2000); // Check every 2 seconds to reduce pathfinding conflicts

    // Keep the task running until stopped
    return new Promise((resolve, reject) => {
      this.resolveFollow = resolve;
      this.rejectFollow = reject;
    });
  }

  async followTarget() {
    const target = this.bot.players[this.targetPlayer];
    if (!target || !target.entity) {
      throw new Error(`Lost sight of ${this.targetPlayer}`);
    }

    const targetPos = target.entity.position;
    const botPos = this.bot.entity.position;
    const distance = botPos.distanceTo(targetPos);

    // Only move if we're too far away
    if (distance > this.distance) {
      try {
        // Use pathfinder to move towards the target
        const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
        
        if (!this.bot.pathfinder) {
          this.bot.loadPlugin(pathfinder);
        }

        const defaultMove = new Movements(this.bot);
        this.bot.pathfinder.setMovements(defaultMove);

        const goal = new goals.GoalNear(targetPos.x, targetPos.y, targetPos.z, this.distance);
        
        // Only start new pathfinding if not already moving
        if (!this.bot.pathfinder.isMoving()) {
          await this.bot.pathfinder.goto(goal);
        }
      } catch (error) {
        // If pathfinding fails, don't log every error to avoid spam
        if (!error.message.includes('goal was changed')) {
          console.log(`Pathfinding failed for ${this.bot.username}: ${error.message}`);
        }
        // Don't throw error here, just continue trying
      }
    }
  }

  stop() {
    if (this.followInterval) {
      clearInterval(this.followInterval);
      this.followInterval = null;
    }
    
    // Stop any current pathfinding
    if (this.bot.pathfinder) {
      this.bot.pathfinder.stop();
    }

    if (this.rejectFollow) {
      this.rejectFollow(new Error('Task was stopped'));
    }
    
    super.stop();
  }

  pause() {
    if (this.followInterval) {
      clearInterval(this.followInterval);
      this.followInterval = null;
    }
    
    // Stop any current pathfinding
    if (this.bot.pathfinder) {
      this.bot.pathfinder.stop();
    }
    
    return super.pause();
  }

  resume() {
    super.resume();
    
    // Restart the follow loop when resumed
    if (!this.followInterval && this.isRunning) {
      this.followInterval = setInterval(async () => {
        try {
          await this.checkPauseAndStop();
          await this.followTarget();
        } catch (error) {
          if (this.followInterval) {
            clearInterval(this.followInterval);
            this.followInterval = null;
          }
          if (this.rejectFollow) {
            this.rejectFollow(error);
          }
        }
      }, 2000); // Check every 2 seconds to reduce pathfinding conflicts
    }
  }
}

module.exports = FollowTask;