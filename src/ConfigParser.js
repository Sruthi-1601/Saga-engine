// ConfigParser.js
// Reads and validates the JSON config file.
// This is the engine/data boundary —
// everything above this is data, everything below is engine.

import MessageBus from './MessageBus.js';

const ConfigParser = {

  requiredFields: ['engine', 'mode', 'metadata', 'mechanics', 'content'],

  async load(configPath) {
    try {
      const response = await fetch(configPath);

      if (!response.ok) {
        throw new Error(`Could not load config file: ${configPath}`);
      }

      const config = await response.json();
      this.validate(config);

      MessageBus.emit('config:loaded', config);
      return config;

    } catch (error) {
      MessageBus.emit('config:error', { message: error.message });
      throw error;
    }
  },

  validate(config) {
    for (const field of this.requiredFields) {
      if (!config[field]) {
        throw new Error(`Missing required field: "${field}"`);
      }
    }

    if (config.engine !== 'saga') {
      throw new Error(`Invalid engine name: "${config.engine}". Must be "saga"`);
    }

    if (!config.content.questions || config.content.questions.length === 0) {
      throw new Error('Config must have at least one question');
    }

    config.content.questions.forEach((q, i) => {
      if (!q.question) throw new Error(`Question ${i + 1} missing "question" text`);
      if (!q.options)  throw new Error(`Question ${i + 1} missing "options" array`);
      if (!q.answer)   throw new Error(`Question ${i + 1} missing "answer"`);
    });
  }
};

export default ConfigParser;