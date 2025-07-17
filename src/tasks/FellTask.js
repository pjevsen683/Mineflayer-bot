const BaseTask = require('./BaseTask');
const { Vec3 } = require('vec3');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');

class FellTask extends BaseTask {
  constructor(bot, radius) {
    super(bot, `Fell trees in ${radius} block radius`, { radius });
    this.radius = radius;
    this.chestPosition = null;
    this.treesToFell = [];
    this.currentTree = null;
    this.axe = null;
    this.fellInterval = null;

    if (!this.bot.pathfinder) {
      this.bot.loadPlugin(pathfinder);
    }

    const defaultMove = new Movements(this.bot);
    this.bot.pathfinder.setMovements(defaultMove);
  }

  async run() {
    try {
      // Step 1: Find nearest chest
      console.log(`${this.bot.username}: Finding nearest chest...`);
      this.chestPosition = await this.findNearestChest();
      if (!this.chestPosition) {
        throw new Error('No chest found nearby');
      }
      console.log(`${this.bot.username}: Found chest at ${Math.round(this.chestPosition.x)}, ${Math.round(this.chestPosition.y)}, ${Math.round(this.chestPosition.z)}`);

      // Step 2: Get axe (check inventory first, then chest)
      console.log(`${this.bot.username}: Looking for axe...`);
      this.axe = await this.getAxe();
      if (!this.axe) {
        console.log(`${this.bot.username}: No axe found, will use current hand item for felling`);
      } else {
        console.log(`${this.bot.username}: Using axe: ${this.axe.name}`);
      }

      // Step 3: Find trees in radius
      console.log(`${this.bot.username}: Scanning for trees...`);
      this.treesToFell = await this.findTreesInRadius();
      console.log(`${this.bot.username}: Found ${this.treesToFell.length} trees to fell`);

      if (this.treesToFell.length === 0) {
        this.bot.chat('No trees found in the specified radius');
        return;
      }

      // Step 4: Start felling process
      this.bot.chat('Starting tree felling process...');
      await this.startFellingProcess();

    } catch (error) {
      throw error;
    }
  }

  async findNearestChest() {
    const chests = this.bot.findBlocks({
      matching: this.bot.registry.blocksByName.chest.id,
      maxDistance: 32
    });

    if (chests.length === 0) {
      return null;
    }

    // Find the closest chest
    let nearestChest = null;
    let minDistance = Infinity;
    
    for (const chestPos of chests) {
      const distance = this.bot.entity.position.distanceTo(chestPos);
      if (distance < minDistance) {
        minDistance = distance;
        nearestChest = chestPos;
      }
    }

    return nearestChest;
  }

  async getAxe() {
    // First, check bot's own inventory for an axe
    const inventoryAxe = this.bot.inventory.slots.find(item => item && this.isAxe(item));
    if (inventoryAxe) {
      console.log(`${this.bot.username}: Found axe in inventory: ${inventoryAxe.name}`);
      return inventoryAxe;
    }

    // If no axe in inventory, check chest
    console.log(`${this.bot.username}: No axe in inventory, checking chest...`);
    return await this.getAxeFromChest();
  }

  async getAxeFromChest() {
    // Go to chest
    const goal = new goals.GoalNear(this.chestPosition.x, this.chestPosition.y, this.chestPosition.z, 2);
    await this.bot.pathfinder.goto(goal);

    // Open chest
    const chest = this.bot.blockAt(this.chestPosition);
    if (!chest) {
      console.log(`${this.bot.username}: Chest not found at position`);
      return null;
    }

    console.log("Chest found");
    const chestBlock = await this.bot.openChest(chest);
    await new Promise(resolve => setTimeout(resolve, 250));
    
    // Find axes in chest
    const axes = [];
    for (const item of chestBlock.containerItems()) {
      console.log("Item", item.name);
      if (this.isAxe(item)) {
        axes.push(item);
      }
    }

    if (axes.length === 0) {
      chestBlock.close();
      console.log(`${this.bot.username}: No axes found in chest`);
      return null;
    }

    // Get the worst axe (lowest durability)
    axes.sort((a, b) => (a.durability || 0) - (b.durability || 0));
    const worstAxe = axes[0];

    // Move axe to bot's inventory
    console.log("Withdrawing axe", worstAxe.name);
    await chestBlock.withdraw(worstAxe.type, null, 1);
    await new Promise(resolve => setTimeout(resolve, 250));

    // Check for dirt in chest and take up to 1 stack
    console.log("Looking for dirt items", chestBlock.containerItems().map(item => item.name));
    const dirtItems = chestBlock.containerItems().filter(item => item.name === 'dirt');
    console.log("Dirt items", dirtItems.length);
    if (dirtItems.length > 0) {
      const totalDirt = dirtItems.reduce((sum, item) => sum + item.count, 0);
      const dirtToTake = Math.min(64, totalDirt); // Take up to 1 stack (64 items)
      console.log("Dirt to take", dirtToTake);
      
      if (dirtToTake > 0) {
        await chestBlock.withdraw(dirtItems[0].type, null, dirtToTake);
        console.log(`${this.bot.username}: Got ${dirtToTake} dirt from chest for building`);
        await new Promise(resolve => setTimeout(resolve, 250));
      }
    }
    
    // Close chest
    chestBlock.close();

    console.log(`${this.bot.username}: Got axe from chest: ${worstAxe.name}`);
    return worstAxe;
  }

  isAxe(item) {
    if (!item) return false;
    const axeNames = ['wooden_axe', 'stone_axe', 'iron_axe', 'golden_axe', 'diamond_axe', 'netherite_axe'];
    return axeNames.includes(item.name);
  }

  async findTreesInRadius() {
    const trees = [];
    const center = this.chestPosition;
    const visitedTrees = new Set();
    
    // Scan in a radius around the chest
    for (let x = -this.radius; x <= this.radius; x++) {
      for (let z = -this.radius; z <= this.radius; z++) {
        for (let y = 0; y < 20; y++) { // Check up to 20 blocks high
          const pos = center.offset(x, y, z);
          const block = this.bot.blockAt(pos);
          
          if (this.isLog(block)) {
            // Check if it's part of a tree (has leaves nearby)
            if (this.isPartOfTree(pos)) {
              // Find the bottom log of this tree
              const bottomLog = this.findBottomLog(pos);
              const treeKey = `${bottomLog.x},${bottomLog.y},${bottomLog.z}`;
              
              // Only add if we haven't seen this tree before
              if (!visitedTrees.has(treeKey)) {
                visitedTrees.add(treeKey);
                trees.push(bottomLog);
              }
            }
          }
        }
      }
    }

    return trees;
  }

  findBottomLog(startPos) {
    // Use a flood fill approach to find all connected logs and determine the lowest ones
    const visited = new Set();
    const queue = [startPos];
    const allLogs = [];
    
    // First, find all connected logs
    while (queue.length > 0) {
      const pos = queue.shift();
      const key = `${pos.x},${pos.y},${pos.z}`;
      
      if (visited.has(key)) continue;
      visited.add(key);
      
      const block = this.bot.blockAt(pos);
      if (block && this.isLog(block)) {
        allLogs.push(pos);
        
        // Check all adjacent blocks (including diagonals)
        const directions = [
          { x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 },
          { x: 0, y: 1, z: 0 }, { x: 0, y: -1, z: 0 },
          { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: -1 },
          // Diagonal connections (for trees that grow diagonally)
          { x: 1, y: 1, z: 0 }, { x: -1, y: 1, z: 0 },
          { x: 0, y: 1, z: 1 }, { x: 0, y: 1, z: -1 },
          { x: 1, y: 0, z: 1 }, { x: -1, y: 0, z: 1 },
          { x: 1, y: 0, z: -1 }, { x: -1, y: 0, z: -1 }
        ];
        
        for (const dir of directions) {
          const newPos = pos.offset(dir.x, dir.y, dir.z);
          const newBlock = this.bot.blockAt(newPos);
          if (newBlock && this.isLog(newBlock)) {
            queue.push(newPos);
          }
        }
      }
    }
    
    // Find the lowest Y coordinate among all logs
    if (allLogs.length === 0) return startPos;
    
    const lowestY = Math.min(...allLogs.map(pos => pos.y));
    const bottomLogs = allLogs.filter(pos => pos.y === lowestY);
    
    // Return the first bottom log (they should all be equivalent)
    return bottomLogs[0];
  }

  isLog(block) {
    if (!block) return false;
    return block.name.endsWith('_log');
  }

  isPartOfTree(logPos) {
    // Check if there are leaves within 5 blocks of the log
    for (let x = -5; x <= 5; x++) {
      for (let y = -5; y <= 5; y++) {
        for (let z = -5; z <= 5; z++) {
          const checkPos = logPos.offset(x, y, z);
          const block = this.bot.blockAt(checkPos);
          if (block && this.isLeaf(block)) {
            return true;
          }
        }
      }
    }
    return false;
  }

  isLeaf(block) {
    if (!block) return false;
    return block.name.endsWith('_leaves');
  }

  async startFellingProcess() {
    // Sort trees by distance from chest (closest first)
    this.treesToFell.sort((a, b) => {
      const distA = a.distanceTo(this.chestPosition);
      const distB = b.distanceTo(this.chestPosition);
      return distA - distB;
    });
    this.treesToFell = this.treesToFell.slice(0, 1);

    // Process trees one by one
    for (const treePos of this.treesToFell) {
      if (this.shouldStop) break;
      
      try {
        await this.checkPauseAndStop();
        
        console.log(`${this.bot.username}: Felling tree at ${Math.round(treePos.x)}, ${Math.round(treePos.y)}, ${Math.round(treePos.z)}`);
        
        // Go to tree
        await this.goToTree(treePos);
        
        // Fell the tree
        await this.fellTree(treePos);
        
        // Return to chest and deposit logs
        await this.depositLogs();
        
        console.log(`${this.bot.username}: Completed tree at ${Math.round(treePos.x)}, ${Math.round(treePos.y)}, ${Math.round(treePos.z)}`);
        
      } catch (error) {
        this.bot.chat(`Error felling tree: ${error.message}`);
        throw error;
      }
    }
    
    this.bot.chat('Tree felling task completed!');
  }

  async goToTree(treePos) {

    const goal = new goals.GoalNear(treePos.x, treePos.y, treePos.z, 2);
    await this.bot.pathfinder.goto(goal);
  }

  async fellTree(treePos) {
    // Find all logs in the tree
    const treeLogs = this.findTreeLogs(treePos);
    
    // Fell logs from top to bottom
    treeLogs.sort((a, b) => a.y - b.y);
    console.log("Tree logs", treeLogs);

    let firstLog = treeLogs[0];
    let groundLevel = firstLog.y;
    
    for (const logPos of treeLogs) {
      if (this.shouldStop) break;
      
      await this.checkPauseAndStop();
      
      const block = this.bot.blockAt(logPos);
      if (block && this.isLog(block)) {
        try {

          // Check if we can reach the log
          if (!await this.canReachBlock(logPos)) {
            await this.buildUpToReach(logPos, groundLevel);
          }
          
          // Equip axe if we have one
          const axeSlot = this.bot.inventory.slots.findIndex(item => item && this.isAxe(item));
          if (axeSlot !== -1) {
            const axe = this.bot.inventory.slots[axeSlot];
            if (axe && this.isAxe(axe)) {
              try {
                await this.bot.equip(axe, 'hand');
                //console.log(`${this.bot.username}: Equipped axe for felling`);
              } catch (equipError) {
                //console.log(`${this.bot.username}: Could not equip axe: ${equipError.message}`);
                // Continue without equipping - will use current hand item
              }
            }
          } else {
            console.log(`${this.bot.username}: No axe available, using current hand item`);
          }
          
          // Break the log
          await this.bot.dig(block);
          await new Promise(resolve => setTimeout(resolve, 250));
          
          
        } catch (error) {
          console.log(`${this.bot.username}: Error breaking log: ${error.message}`);
        }
      }
    }

    // remove placed blocks
    await this.cleanupPlacedBlocks();

    // Pick up items after breaking
    await this.pickupItems();

  }

  findTreeLogs(startPos) {
    const logs = [];
    const visited = new Set();
    const queue = [startPos];
    
    while (queue.length > 0) {
      const pos = queue.shift();
      const key = `${pos.x},${pos.y},${pos.z}`;
      
      if (visited.has(key)) continue;
      visited.add(key);
      
      const block = this.bot.blockAt(pos);
      if (block && this.isLog(block)) {
        logs.push(pos);
        
        // Check adjacent blocks for more logs
        const directions = [
          { x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 },
          { x: 0, y: 1, z: 0 }, { x: 0, y: -1, z: 0 },
          { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: -1 }
        ];
        
        for (const dir of directions) {
          const newPos = pos.offset(dir.x, dir.y, dir.z);
          const newBlock = this.bot.blockAt(newPos);
          if (newBlock && this.isLog(newBlock)) {
            queue.push(newPos);
          }
        }
      }
    }
    
    return logs;
  }

  async depositLogs() {
    // Go back to chest
    if (!this.bot.pathfinder) {
      this.bot.loadPlugin(pathfinder);
    }

    const defaultMove = new Movements(this.bot);
    this.bot.pathfinder.setMovements(defaultMove);

    const goal = new goals.GoalNear(this.chestPosition.x, this.chestPosition.y, this.chestPosition.z, 2);
    await this.bot.pathfinder.goto(goal);

    // Open chest
    const chest = this.bot.blockAt(this.chestPosition);
    const chestBlock = await this.bot.openChest(chest);

    // Deposit all logs
    const logs = this.bot.inventory.items().filter(item => this.isLog({ name: item.name }));
    
    if (logs.length > 0) {
      for (const log of logs) {
        try {
          await this.bot.moveSlotItem(log.slot, 0, chestBlock);
        } catch (error) {
          console.log(`${this.bot.username}: Error depositing log: ${error.message}`);
        }
      }
      console.log(`${this.bot.username}: Deposited ${logs.length} logs`);
    } else {
      console.log(`${this.bot.username}: No logs to deposit`);
    }

    // Close chest
    chestBlock.close();
  }

  async pickupItems() {
    try {
      // Find items on the ground near the bot
      const items = Object.values(this.bot.entities).filter(entity => 
        entity.type === 'object' && 
        entity.position.distanceTo(this.bot.entity.position) <= 3
      );

      if (items.length > 0) {
        console.log(`${this.bot.username}: Picking up ${items.length} items`);
        
        // Pick up each item
        for (const item of items) {
          try {
            await this.bot.pathfinder.goto(new goals.GoalBlock(
              item.position.x,
              item.position.y,
              item.position.z
            ));
            await new Promise(resolve => setTimeout(resolve, 250));
          } catch (error) {
            // If pathfinding fails, try to pick up from current position
            console.log(`${this.bot.username}: Could not pathfind to item: ${error.message}`);
          }
        }
      }
    } catch (error) {
      console.log(`${this.bot.username}: Error picking up items: ${error.message}`);
    }
  }

  async canReachBlock(blockPos) {
    const botPos = this.bot.entity.position;
    console.log("Can i reach?", botPos, blockPos);
    const distance = botPos.distanceTo(blockPos);
    
    // Check if block is within reach (4 blocks horizontally, 1 block vertically)
    const horizontalDistance = Math.sqrt(
      Math.pow(blockPos.x - botPos.x, 2) + 
      Math.pow(blockPos.z - botPos.z, 2)
    );
    const verticalDistance = blockPos.y - botPos.y;
    
    return horizontalDistance <= 4 && verticalDistance <= 4;
  }

  async buildUpToReach(blockPos, groundLevel) {
    console.log(`${this.bot.username}: Building up to reach log at ${Math.round(blockPos.x)}, ${Math.round(blockPos.y)}, ${Math.round(blockPos.z)}`);

    const botPos = this.bot.entity.position;
    const targetY = blockPos.y - 3; // Build up to three blocks below the target
    
    // Find dirt in inventory
    const dirtSlot = this.bot.inventory.slots.findIndex(item => 
      item && item.name === 'dirt'
    );
    
    if (dirtSlot === -1) {
      console.log(`${this.bot.username}: No dirt available for building up`);
      return;
    }
    
    // Get dirt item
    const dirt = this.bot.inventory.slots[dirtSlot];
    
    if (!dirt) {
      console.log(`${this.bot.username}: Dirt item is undefined`);
      return;
    }
    
    console.log(`${this.bot.username}: Using dirt item: ${dirt.name} (count: ${dirt.count})`);
    
    // Store placed blocks for cleanup
    this.placedBlocks = this.placedBlocks || [];
    
    // Build two-step ladder
    let currentY = Math.floor(botPos.y);
    let step = 0; // 0 = first step, 1 = second step
    
    while (currentY < targetY) {
      try {

        let groundBlock = this.bot.blockAt(new Vec3(blockPos.x, groundLevel-1, blockPos.z));
        while (groundBlock && groundBlock.name === 'air') {
          groundLevel--;
          groundBlock = this.bot.blockAt(new Vec3(blockPos.x, groundLevel-1, blockPos.z));
        }
        console.log("Ground level", groundLevel);
        console.log("Ground block", groundBlock);
        console.log("Ground block position", groundBlock.position);

        // go to under blockPos 
        const goal = new goals.GoalNear(groundBlock.position.x, groundBlock.position.y, groundBlock.position.z, 1);
        await this.bot.pathfinder.goto(goal);
        await new Promise(resolve => setTimeout(resolve, 250));

        // start jump
        this.bot.setControlState("jump", true);

        // wait untill bot is high enough
        while (true) {
          let positionBelow = this.bot.entity.position.offset(0, -0.6, 0);
          let blockBelow = this.bot.blockAt(positionBelow);
          if (blockBelow && blockBelow.name === 'air') {
            break;
          }
          await this.bot.waitForTicks(1);
        }

        // place dirt
        const faceVector = {x:0, y:1, z:0};
        console.log("Placing dirt", groundBlock.position, faceVector);
        await this.bot.placeBlock(groundBlock, faceVector);
        this.placedBlocks.push(this.bot.blockAt(new Vec3(groundBlock.position.x, groundBlock.position.y+1, groundBlock.position.z)));
        
        // stop jump
        this.bot.setControlState("jump", false);

        // wait untill dirt is placed
        await new Promise(resolve => setTimeout(resolve, 250));
        
        currentY++;
        
      } catch (error) {
        console.log(`${this.bot.username}: Error building ladder: ${error.message}`);
        throw error;
        break;
      }
    }
    
    console.log(`${this.bot.username}: Finished building two-step ladder`);
    this.bot.setControlState("jump", false);
  }

  async cleanupPlacedBlocks() {
    if (!this.placedBlocks || this.placedBlocks.length === 0) {
      console.log(`${this.bot.username}: No placed blocks to clean up`);
      return;
    }
    
    console.log(`${this.bot.username}: Cleaning up ${this.placedBlocks.length} placed blocks`);
    
    // Sort blocks from highest to lowest for efficient cleanup
    this.placedBlocks.sort((a, b) => b.y - a.y);
    
    for (const block of this.placedBlocks) {
      try {
          await this.bot.dig(block);
          console.log(`${this.bot.username}: Removed dirt block at ${block.x}, ${block.y}, ${block.z}`);
      } catch (error) {
        console.log(`${this.bot.username}: Error removing dirt block: ${error.message}`);
      }
    }
    
    this.placedBlocks = [];
    console.log(`${this.bot.username}: Finished cleaning up placed blocks`);
  }
  
  stop() {
    if (this.fellInterval) {
      clearInterval(this.fellInterval);
      this.fellInterval = null;
    }
    
    // Stop any current pathfinding
    if (this.bot.pathfinder) {
      this.bot.pathfinder.stop();
    }
    
    // Clean up placed blocks
    this.cleanupPlacedBlocks();
    
    super.stop();
  }

  pause() {
    if (this.fellInterval) {
      clearInterval(this.fellInterval);
      this.fellInterval = null;
    }
    
    // Stop any current pathfinding
    if (this.bot.pathfinder) {
      this.bot.pathfinder.stop();
    }
    
    return super.pause();
  }
}

module.exports = FellTask; 