class BaseTask {
  constructor(bot, name, params = {}) {
    this.bot = bot;
    this.name = name;
    this.params = params;
    this.isRunning = false;
    this.isPaused = false;
    this.shouldStop = false;
    this.pauseResolve = null;
  }

  async execute() {
    this.isRunning = true;
    this.shouldStop = false;
    
    try {
      await this.run();
    } finally {
      this.isRunning = false;
      this.isPaused = false;
    }
  }

  async run() {
    // To be implemented by subclasses
    throw new Error('run() method must be implemented by subclasses');
  }

  pause() {
    if (!this.isRunning) return;
    
    this.isPaused = true;
    // Create a promise that will be resolved when resume() is called
    return new Promise((resolve) => {
      this.pauseResolve = resolve;
    });
  }

  resume() {
    if (!this.isPaused) return;
    
    this.isPaused = false;
    if (this.pauseResolve) {
      this.pauseResolve();
      this.pauseResolve = null;
    }
  }

  stop() {
    this.shouldStop = true;
    this.resume(); // Resume if paused so it can exit cleanly
  }

  async checkPauseAndStop() {
    if (this.shouldStop) {
      throw new Error('Task was stopped');
    }
    
    if (this.isPaused) {
      await this.pause();
    }
  }

  serialize() {
    return {
      name: this.name,
      params: this.params,
      type: this.constructor.name
    };
  }

  static deserialize(bot, data) {
    // This would be implemented to recreate tasks from saved state
    // For now, return null to indicate task couldn't be restored
    return null;
  }
}

module.exports = BaseTask;