// main.js — SAGA Engine entry point

import MessageBus   from './MessageBus.js';
import ConfigParser  from './ConfigParser.js';
import GameRuntime   from './GameRuntime.js';
import NeuronRush    from './NeuronRush.js';

window.MessageBus = MessageBus;

// Called when player clicks an answer option
window.sagaSubmit = function(answer, optionIndex) {
  MessageBus.emit('answer:submit', { answer, optionIndex });
};

// Called when player selects a mode on home screen
window.sagaSelectMode = function(mode) {
  if (mode === 'QuestPath' || mode === 'MirrorMatch') {
    alert(`${mode} is coming on March 21! Play NeuronRush for now.`);
    return;
  }
};

// Called when Start button is clicked
window.sagaStartGame = function() {
  MessageBus.emit('game:begin', {});
};

// Called from end screen "Change mode" button
window.sagaGoHome = function() {
  NeuronRush.renderHome(NeuronRush.configData);
};

async function boot() {
  GameRuntime.init();
  NeuronRush.init();
  await ConfigParser.load('./saga-config.json');
}

boot().catch(err => console.error('Boot failed:', err));
