var debug = require('debug')('draw-my-thing:server');

let tmp = new Date();
setInterval(() => {
  let ms = new Date() - tmp - 1000;
  if (ms >= 100 ) {
    console.log('Event loop blocked for ' + ms + ' ms');
  }
  tmp = new Date();
}, 1000);

var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var socketio = require('socket.io');

var app = express();
var http = require('http').Server(app);
var io = socketio(http);

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => {
  res.render('index');
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});



// ******************** INITIAL STATE ******************** //
const words = [
  'vanilla',
  'ice cream',
  'jelly',
  "biscuits",
  "pasta",
  "pizza",
  "torch",
  "taxi",
  "trunk",
  "yard",
  "gasoline",
  "flat",
  "scarf",
  "chicken",
  "cock",
  "boat",
  "car",
  "gun",
  "sword",
  "shield",
  "protein",
  "dwarf",
  "elf",
  "deer",
  "printer",
  "Picture",
  "ball",
  "flash",
  "bat",
  "wall",
  "lemon",
  "bandage",
  "bank",
  "battery",
  "death",
  "damage",
  "elbow",
  "electric,",
  "factory",
  "famous",
  "gate",
  "garbage",
  "handsome",
  "harvest",
  "insect",
  "ill",
  "jewel",
  "jacket",
  "kiss",
  "knife",
  "lazy",
  "league",
  "money",
  "mustache",
  "naked",
  "needle",
  "orphan",
  "obey",
  "pants",
  "pain",
  "quest",
  "robber",
  "rock",
  "sandwitch",
  "sadness",
  "train",
  "target",
  "uniform",
  "unite",
  "vacation",
  "victim",
  "weight",
  "western",
  "yawn",
  "young",
];
let players = {
  byId: {},
  allIds: []
};
let word = '';
let currentPlayer = null;
let gameRunning = false;

const state = {
  roudTime: 200, //s
  timer: null,
  answered: []
}



io.on('connection', (socket) => {
  const playerId = socket.id;

  // ******************** DISCONNECT ******************** //
  socket.on('disconnect', disconnect);

  function disconnect() {
    const player = players.byId[playerId];

    if (!player) {
      return;
    }

    removePlayer(playerId);
    socket.broadcast.emit('player-disconnected', player.id);

    if (players.allIds.length === 0) {
      gameRunning = false;
    }

    if (playerId === currentPlayer) {
      nextRound();
    }

    console.log('User ' + player.name + ' disconnected');
    console.log('Number of players: ' + players.allIds.length);
  }


  // ******************** REGISTER / START GAME ******************** //
  socket.on('register', connect);

  function connect(name) {
    const player = {
      id: socket.id,
      name,
      points: 0
    };

    addPlayer(player);
    socket.broadcast.emit('player-connected', players.byId[socket.id]);
    socket.emit('init-state', { players, ...getGuessingWord() });

    startGame();

    console.log('User ' + name + ' connected');
    console.log('Number of players: ' + players.allIds.length);
  }

  function addPlayer(player) {
    players = {
      allIds: [...players.allIds, player.id],
      byId: {
        ...players.byId,
        [player.id]: player
      },
    }
  }

  function removePlayer(id) {
    const index = players.allIds.indexOf(id);

    if (index === -1) {
      return;
    }

    const {[id]: _noop, ...rest} = players.byId;

    players = {
      allIds: [...players.allIds.slice(0, index), ...players.allIds.slice(index + 1)],
      byId: { ...rest }
    }
  }



  // ******************** GAME ******************** //
  function pickNextPlayer() {
    let nextIndex = 0;
    if (currentPlayer) {
      nextIndex = players.allIds.indexOf(currentPlayer) + 1;
    }

    if (nextIndex >= players.allIds.length) {
      nextIndex = 0;
    }

    currentPlayer = players.allIds[nextIndex];
  }

  function pickNextWord() {
    word = words[Math.floor(Math.random() * words.length)];
  }

  function startGame() {
    if (gameRunning) {
      return;
    }
    gameRunning = true;

    nextRound();
  }

  function getGuessingWord() {
    return {
      word: word.replace(/[^\s]/g, '_'),
      activePlayer: currentPlayer,
      timeLeft: state.timeLeft
    };
  }

  function nextRound() {
    clearInterval(state.timer);
    state.timeLeft = state.roudTime;
    state.answered = [];

    if (players.allIds.length === 0) {
      return;
    }

    pickNextPlayer();
    pickNextWord();

    debug(`New round, word: ${word}, player: ${players.byId[currentPlayer].name}`);

    const newWord = getGuessingWord();

    const guessedWord = {
      word,
      timeLeft: state.timeLeft
    }

    // Send word mask to everyone else
    io.emit('new-word', newWord);
    // Send the word to current player
    io.to(currentPlayer).emit('word', guessedWord);
    // Clear canvas
    io.emit('clear-canvas');

    state.timer = setInterval(() => {
      if (state.timeLeft === 0) {
        nextRound();
      }

      updateTimer();
    }, 1000);
  }

  function updateTimer() {
    state.timeLeft = state.timeLeft - 1;
    io.emit('timer', state.timeLeft);
  }



  // ******************** DRAWING ******************** //
  socket.on('draw', (payload) => {
    socket.broadcast.emit('draw', payload);
  });

  socket.on('clear-canvas', () => {
    if (playerId === currentPlayer) {
      socket.broadcast.emit('clear-canvas');
    }
  });

  socket.on('chat-message', (message) => {
    debug('Chat message', message, word);

    // Mask the aswer if the message contains it
    if (message.toLowerCase().includes(word.toLowerCase())) {
      message = message.replace(word, '*'.repeat(word.length));

      if (playerId !== currentPlayer && !state.answered.includes(playerId)) {
        wordGuessed();
      }
    }

    socket.broadcast.emit('chat-message', {
      id: socket.id,
      message
    });
  });

  function wordGuessed() {
    const bonus = state.answered.length ? 0 : 20;

    state.answered = [...state.answered, playerId];
    players = {
      allIds: players.allIds.sort((a, b) => players.byId[b].points - players.byId[a].points),
      byId: {
        ...players.byId,
        [playerId]: {
          ...players.byId[playerId],
          points: players.byId[playerId].points + state.timeLeft + bonus
        }
      }
    }

    io.emit('points', {
      id: playerId,
      points: players.byId[playerId].points
    });

    socket.emit('player-won', word);

    if (state.answered.length === (players.allIds.length - 1)) {
      nextRound();
    }
  }
});











/**
 * Get port from environment and store in Express.
 */

var port = process.env.PORT || '3000';
app.set('port', port);

/**
 * Listen on provided port, on all network interfaces.
 */

http.listen(port);
http.on('error', onError);
http.on('listening', onListening);

/**
 * Event listener for HTTP server "error" event.
 */

function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  var bind = typeof port === 'string'
    ? 'Pipe ' + port
    : 'Port ' + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
}

/**
 * Event listener for HTTP server "listening" event.
 */

function onListening() {
  var addr = http.address();
  var bind = typeof addr === 'string'
    ? 'pipe ' + addr
    : 'port ' + addr.port;
  debug('Listening on ' + bind);
}
