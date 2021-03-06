// ******************** CONSTANTS ******************** //
const KEY_ENTER = 13;
const KEY_ARROW_UP = 38;

// ******************** DOM ******************** //
const canvas = document.getElementById('canvas');
const clearButton = document.getElementById('clear-canvas');
const playersBox = document.getElementById('players');
const chatWindow = document.getElementById('chat-window');
const chatInput = document.getElementById('chat-input');
const chatSubmit = document.getElementById('chat-submit');
const wordBox = document.getElementById('word');
const timerBox = document.getElementById('timer');
const colorsBox = document.getElementById('colors');

const winAudio = new Audio('/audio/win.mp3');
const someoneGuessedAudio = new Audio('/audio/someone-guessed.mp3');
const context = canvas.getContext("2d");
const bufferCanvas = document.createElement('canvas');
const bufferContext = bufferCanvas.getContext('2d');
const colorDialog = document.createElement('input');
colorDialog.type = 'color';



// ******************** LOGIN ******************** //
const name = prompt('Please choose a name');
socket.emit('register', name);



// ******************** INITIAL STATE ******************** //
let state = {
  isDrawing: false,
  canDraw: false,
  color: 'black',
  prevX: 0,
  prevY: 0,
  width: 2,
  players: {
    allIds: [],
    byId: {}
  },
  activePlayer: null,
  word: '',
  timeLeft: 0,
  lastMessage: ''
};



// ******************** CANVAS RESIZE ******************** //
window.addEventListener('resize', resize, false);

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  context.drawImage(bufferCanvas, 0, 0);
}

resize();

// Buffer canvas - stores canvas during resize
bufferCanvas.width = canvas.width;
bufferCanvas.height = canvas.height;



// ******************** CHAT ******************** //
chatSubmit.addEventListener('click', sendMessage, false);
window.addEventListener('keydown', keyDown, false);
socket.on('chat-message', receiveMessage);

function keyDown(e) {
  chatInput.focus();

  if (e.keyCode === KEY_ENTER) {
    sendMessage();
  }

  if (e.keyCode === KEY_ARROW_UP) {
    lastMessage();
  }
}

function lastMessage() {
  chatInput.value = state.lastMessage;
  setTimeout(() => {
    chatInput.selectionStart = chatInput.selectionEnd = chatInput.value.length;
  }, 1)
}

function sendMessage() {
  const message = chatInput.value;
  state.lastMessage = message;
  appendMessage(state.players.byId[socket.id].name, message);
  chatInput.value = "";

  socket.emit('chat-message', message);
}

function receiveMessage({ id, message }) {
  appendMessage(state.players.byId[id].name, message);
}

function appendMessage(playername, msg) {
  const message = document.createElement('div');
  message.className = 'chat__message';
  message.innerHTML = `<b>${playername}</b>: ${msg}`;

  const viewportHeight = chatWindow.clientHeight;
  const scrollHeight = chatWindow.scrollHeight;
  const scrollTop = chatWindow.scrollTop;

  chatWindow.appendChild(message);

  // Scroll to end if at the end
  if (scrollTop >= (scrollHeight - viewportHeight - 20)) {
    chatWindow.scrollTop = chatWindow.scrollHeight;
  }
}



// ******************** DRAWING ******************** //
const throttledMouseMove = _.throttle(mouseMove, 10);

canvas.addEventListener('mousedown', mouseDown, false);
canvas.addEventListener('mouseup', mouseUp, false);
canvas.addEventListener('mouseout', mouseOut, false);
canvas.addEventListener('mousemove', throttledMouseMove, false);
colorsBox.addEventListener('click', pickColor, false);
colorDialog.addEventListener('change', selectColor, false);
socket.on('draw', draw);

function pickColor(e) {
  if (!e.target.classList.contains('color')) {
    return;
  }

  const color = e.target.className
    .split(' ')
    .filter((cls) => cls.includes('color--'))[0]
    .replace('color--', '');

  if (color === 'custom') {
    colorDialog.click();
    return;
  }

  state.color = color;
}

function selectColor() {
  state.color = colorDialog.value;
}

function mouseUp() {
  state.isDrawing = false;
}

function mouseOut() {
  state.isDrawing = false;
}

function mouseDown(e) {
  if (!state.canDraw) {
    return;
  }

  const { offsetX: x, offsetY: y } = e;
  state.isDrawing = true;

  const line = {
    line: {
      prevX: x,
      prevY: y,
      currX: x + 1,
      currY: y + 1
    },
    color: state.color,
    width: state.width
  };

  state.prevX = x;
  state.prevY = y;

  draw(line);
  socket.emit('draw', line);
}

function mouseMove(e) {
  if (!state.canDraw || !state.isDrawing) {
    return;
  }

  const { offsetX: x, offsetY: y } = e;

  const line = {
    line: {
      prevX: state.prevX,
      prevY: state.prevY,
      currX: x,
      currY: y
    },
    color: state.color,
    width: state.width
  };

  state.prevX = x;
  state.prevY = y;

  draw(line);
  socket.emit('draw', line);
}

function draw({ line, color, width }) {
  const { prevX, prevY, currX, currY } = line;

  context.beginPath();
  context.moveTo(prevX, prevY);
  context.lineTo(currX, currY);
  context.strokeStyle = color;
  context.lineWidth = width;
  context.stroke();
  context.closePath();

  bufferContext.drawImage(canvas, 0, 0);
}



// ******************** CLEAR CANVAS ******************** //
socket.on('clear-canvas', clearCanvas);
clearButton.addEventListener('click', clear, false);

function clearCanvas() {
  context.fillStyle = 'white';
  context.fillRect(0, 0, canvas.width, canvas.height);
  bufferContext.drawImage(canvas, 0, 0);
}

function clear() {
  if (socket.id !== state.activePlayer) {
    return;
  }

  clearCanvas();
  socket.emit('clear-canvas', true);
}



// ******************** SCORE BOARD ******************** //
socket.on('init-state', initState);
socket.on('player-connected', playerConnected);
socket.on('player-disconnected', playerDisconnected);

function initState(newState) {
  state = {
    ...state,
    ...newState
  }
  updatePlayers();
  updateWord();
  updateTimer();
}

function playerConnected(player) {
  addPlayer(player);
  updatePlayers();
}

function playerDisconnected(id) {
  removePlayer(id);
  updatePlayers();
}

function addPlayer(player) {
  state.players = {
    allIds: [...state.players.allIds, player.id],
    byId: {
      ...state.players.byId,
      [player.id]: player
    }
  }
}

function removePlayer(id) {
  const index = state.players.allIds.indexOf(id);
  if (index === -1) {
    return;
  }

  const {[id]: _noop, ...rest} = state.players.byId;

  state.players = {
    allIds: [...state.players.allIds.slice(0, index), ...state.players.allIds.slice(index + 1)],
    byId: { ...rest }
  }
}

function updatePlayers() {
  const markup = state.players.allIds.map((id, index) => {
    const player = state.players.byId[id];
    const points = player.points;

    let icon = '';
    let active = '';
    if (id === state.activePlayer) {
      active = 'score__player--active';
      icon = '<i class="fa fa-pencil score__player-pencil"></i>';
    }

    let leader = '';
    if (index === 0) {
      leader = 'score__player--leader';
    }

    return `
      <div class="score__player ${active} ${leader}">
        ${icon}
        <span class="score__player-points">${points}</span>
        ${player.name} [${player.id}]
      </div>
    `
  });

  playersBox.innerHTML = markup.join('');
}



// ******************** WORD ******************** //
socket.on('new-word', newWord);
socket.on('word', drawWord);
socket.on('timer', timer);
socket.on('points', points);
socket.on('player-won', playerWon);

function updateWord() {
  let words;
  if (socket.id === state.activePlayer) {
    words = [state.word];
  } else {
    words = state.word
      .split(' ')
      .map((word) => `<span class="round__word-part">${word.split('').join(' ')}</span>`);
  }
  wordBox.innerHTML = words.join('');
}

function updateTimer() {
  timerBox.innerHTML = state.timeLeft;

  if (state.timeLeft < 15) {
    timerBox.classList.add('round__timer--red');
  } else {
    timerBox.classList.remove('round__timer--red');
  }
}

function newWord({ word, activePlayer, timeLeft }) {
  state.activePlayer = activePlayer;
  state.word = word;
  state.canDraw = false;
  state.timeLeft = timeLeft;
  updatePlayers();
  updateWord();
  updateTimer();
}

function drawWord({ word, timeLeft }) {
  state.activePlayer = socket.id;
  state.word = word;
  state.canDraw = true;
  state.timeLeft = timeLeft;
  updatePlayers();
  updateWord();
  updateTimer();
}

function timer(timeLeft) {
  state.timeLeft = timeLeft;
  updateTimer();
}

function points({ id, points }) {
  state.players.byId[id].points = points;
  state.players.allIds = state.players.allIds
    .sort((a, b) => state.players.byId[b].points - state.players.byId[a].points);

  updatePlayers();

  if (socket.id !== id) {
    someoneGuessedAudio.play();
  }
}

function playerWon(word) {
  state.word = word;
  updateWord();
  winAudio.play();
}
