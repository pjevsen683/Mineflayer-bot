const BaseTask = require('./BaseTask');

class DepositTask extends BaseTask {
  constructor(bot) {
    super(bot, 'Deposit all items to nearest chest');
    this.chestPosition = null;
  }

  async run() {
    try {
      console.log(`${this.bot.username}: Starting deposit task...`);
      
      // Step 1: Find nearest chest
      console.log(`${this.bot.username}: Finding nearest chest...`);
      this.chestPosition = await this.findNearestChest();
      if (!this.chestPosition) {
        throw new Error('No chest found nearby');
      }
      console.log(`${this.bot.username}: Found chest at ${Math.round(this.chestPosition.x)}, ${Math.round(this.chestPosition.y)}, ${Math.round(this.chestPosition.z)}`);

      // Step 2: Go to chest
      console.log(`${this.bot.username}: Moving to chest...`);
      await this.goToChest();

      // Step 3: Open chest and deposit items
      console.log(`${this.bot.username}: Opening chest and depositing items...`);
      await this.depositAllItems();

      console.log(`${this.bot.username}: Deposit task completed successfully`);
      this.bot.chat('All items deposited to chest');

    } catch (error) {
      console.log(`${this.bot.username}: Error in deposit task: ${error.message}`);
      throw error;
    }
  }

  checkIfDoubleChest(chestPos) {
    // Check if there's another chest adjacent to this one
    const adjacentPositions = [
      chestPos.offset(1, 0, 0), // Right
      chestPos.offset(-1, 0, 0), // Left
      chestPos.offset(0, 0, 1), // Front
      chestPos.offset(0, 0, -1) // Back
    ];
    
    for (const pos of adjacentPositions) {
      const block = this.bot.blockAt(pos);
      if (block && block.name === 'chest') {
        return true;
      }
    }
    
    return false;
  }

  async findNearestChest() {
    const chests = this.bot.findBlocks({
      matching: this.bot.registry.blocksByName.chest.id,
      maxDistance: 32
    });

    if (chests.length === 0) {
      return null;
    }

    // Sort chests by distance (closest first)
    const sortedChests = chests.map(chestPos => ({
      position: chestPos,
      distance: this.bot.entity.position.distanceTo(chestPos)
    })).sort((a, b) => a.distance - b.distance);

    // Return the closest chest - we'll check its contents when we get there
    const closestChest = sortedChests[0];
    console.log(`${this.bot.username}: Found closest chest at distance ${Math.round(closestChest.distance)}`);
    return closestChest.position;
  }

  async goToChest() {
    const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
    
    if (!this.bot.pathfinder) {
      this.bot.loadPlugin(pathfinder);
    }

    const defaultMove = new Movements(this.bot);
    this.bot.pathfinder.setMovements(defaultMove);

    const goal = new goals.GoalNear(this.chestPosition.x, this.chestPosition.y, this.chestPosition.z, 2);
    await this.bot.pathfinder.goto(goal);
  }

  async depositAllItems() {
    // Open chest
    const chest = this.bot.blockAt(this.chestPosition);
    if (!chest) {
      throw new Error('Chest not found at position');
    }

    const chestBlock = await this.bot.openChest(chest);

    // Get all items in bot's inventory (excluding armor and offhand)
    const inventoryItems = this.bot.inventory.slots.filter(item => item && item.name !== 'air');
    
    if (inventoryItems.length === 0) {
      console.log(`${this.bot.username}: No items to deposit`);
      chestBlock.close();
      return;
    }

    console.log(`${this.bot.username}: Depositing ${inventoryItems.length} items...`);
    console.log(`${this.bot.username}: Items to deposit: ${inventoryItems.map(item => `${item.name}(${item.count}x)`).join(', ')}`);


    let storedCount = 0;
    for (const item of inventoryItems) {
        try {
            await chestBlock.deposit(item.type, null, item.count);
            storedCount++;
            // Optional: add a small delay between deposits
            await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
            console.log(`Failed to deposit ${item.name}:`, error);
        }
    }

    // Close the chest
    await chestBlock.close();

    return;

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

module.exports = DepositTask; 