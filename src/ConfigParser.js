// ConfigParser.js — Reads and validates saga-config.json
import MessageBus from './MessageBus.js';

const ConfigParser = {
  required: ['engine', 'mode', 'metadata', 'mechanics', 'content'],

  async load(path) {
    try {
      console.log('[ConfigParser] Loading:', path);
      const res = await fetch(path);
      if (!res.ok) throw new Error(`Cannot load config. Status: ${res.status}`);
      const config = await res.json();
      console.log('[ConfigParser] Config loaded OK');
      return config;
    } catch (err) {
      console.error('[ConfigParser] Error:', err.message);
      MessageBus.emit('config:error', { message: err.message });
      throw err;
    }
  }
};

export default ConfigParser;