// --- КОНФИГУРАЦИЯ FIREBASE ---
const firebaseConfig = {
    apiKey: "AIzaSyAUmYh_E6KNfJxlCynjI3tYAlEMSc2tksE",
    authDomain: "alias-game-be13a.firebaseapp.com",
    projectId: "alias-game-be13a",
    storageBucket: "alias-game-be13a.appspot.com",
    messagingSenderId: "862586940030",
    appId: "1:862586940030:web:b1f1ffc8584e7ec2b8062f",
    databaseURL: "https://alias-game-be13a-default-rtdb.europe-west1.firebasedatabase.app",
};

// --- ИНИЦИАЛИЗАЦИЯ ---
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// --- ЭЛЕМЕНТЫ DOM ---
const screens = {
    home: document.getElementById('home-screen'),
    lobby: document.getElementById('lobby-screen'),
    game: document.getElementById('game-screen'),
    summary: document.getElementById('round-summary-screen'),
    gameOver: document.getElementById('game-over-screen'),
    message: document.getElementById('message-screen'),
};

const messageTitle = document.getElementById('message-title');
const messageText = document.getElementById('message-text');
const messageBackBtn = document.getElementById('message-back-btn');
const initialChoiceContainer = document.getElementById('initial-choice');
const createFormContainer = document.getElementById('create-form-container');
const joinFormContainer = document.getElementById('join-form-container');
const showCreateFormBtn = document.getElementById('show-create-form-btn');
const showJoinFormBtn = document.getElementById('show-join-form-btn');
const joinByLinkForm = document.getElementById('join-by-link-form');
const homeLogoBtn = document.getElementById('home-logo-btn');
const createRoomForm = document.getElementById('create-room-form');
const lobbyRoomName = document.getElementById('lobby-room-name');
const teamsContainer = document.getElementById('teams-container');
const startGameBtn = document.getElementById('start-game-btn');
const joinModal = document.getElementById('join-modal');
const joinForm = document.getElementById('join-form');
const nicknameInput = document.getElementById('nickname-input');
const wordCardContainer = document.getElementById('word-card-container');
const timerBar = document.getElementById('timer-bar');
const timerText = document.getElementById('timer-text');
const currentPlayerName = document.getElementById('current-player-name');
const currentTeamName = document.getElementById('current-team-name');
const gameScores = document.getElementById('game-scores');
const guessWordBtn = document.getElementById('guess-word-btn');
const skipWordBtn = document.getElementById('skip-word-btn');
const summaryScores = document.getElementById('summary-scores');
const summaryWordsList = document.getElementById('summary-words-list');
const nextRoundBtn = document.getElementById('next-round-btn');
const winnerTeamName = document.getElementById('winner-team-name');
const finalScores = document.getElementById('final-scores');
const playAgainBtn = document.getElementById('play-again-btn');
const inviteLink = document.getElementById('invite-link');
const copyLinkBtn = document.getElementById('copy-link-btn');
const inRoundWordsList = document.getElementById('in-round-words-list');
const closeSummaryBtn = document.getElementById('close-summary-btn');
const readyBtn = document.getElementById('ready-btn');
const readyCheckContainer = document.getElementById('ready-check-container');
const nextTeamName = document.getElementById('next-team-name');
const readyPlayersList = document.getElementById('ready-players-list');
const timerOptions = document.getElementById('timer-options');

// --- ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ---
let currentRoomId = null;
let roomUnsubscribe = null;
let presenceUnsubscribe = null;
let userPresenceRef = null;
let timerInterval = null;
let userId = localStorage.getItem('aliasUserId');
if (!userId) {
    userId = db.ref().push().key;
    localStorage.setItem('aliasUserId', userId);
}
console.log(`Твой уникальный ID игрока: ${userId}`);

// --- УТИЛИТЫ ---
function showScreen(screenId) {
    Object.values(screens).forEach(s => s && s.classList.add('hidden'));
    if (screens[screenId]) screens[screenId].classList.remove('hidden');
}

function showMessageScreen(title, text) {
    messageTitle.textContent = title;
    messageText.textContent = text;
    showScreen('message');
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// --- УПРАВЛЕНИЕ ПРИСУТСТВИЕМ ИГРОКА ---
function setupOnDisconnect() {
    if (!currentRoomId) return;
    const amOnline = db.ref('.info/connected');
    userPresenceRef = db.ref(`rooms/${currentRoomId}/presences/${userId}`);

    amOnline.on('value', (snapshot) => {
        if (snapshot.val()) {
            userPresenceRef.onDisconnect().remove();
        }
    });
}

function cleanupPresence() {
    if (userPresenceRef) {
        userPresenceRef.remove();
        userPresenceRef = null;
    }
}

// --- ФУНКЦИИ РЕНДЕРА ---
function renderLobby(roomData) {
    if (!roomData) return;
    lobbyRoomName.textContent = roomData.title;
    inviteLink.textContent = window.location.href;
    teamsContainer.innerHTML = '';
    
    let currentPlayerTeamId = null;

    if (roomData.teams) {
        Object.values(roomData.teams).forEach(team => {
            if (team.players && team.players[userId]) {
                currentPlayerTeamId = Object.keys(roomData.teams).find(key => roomData.teams[key] === team);
            }
        });
    }

    const isAllTeamsReady = roomData.teams ? Object.values(roomData.teams).every(team => (team.players ? Object.keys(team.players).length : 0) >= 2) : false;
    startGameBtn.disabled = !isAllTeamsReady || roomData.hostId !== userId;
    
    if (roomData.hostId !== userId) {
        startGameBtn.textContent = 'Ожидание старта от хоста';
    } else if (!isAllTeamsReady) {
        startGameBtn.textContent = 'В каждой команде нужно мин. 2 игрока';
    } else {
        startGameBtn.textContent = 'Начать игру';
    }
    
    if (roomData.teams) {
        Object.entries(roomData.teams).forEach(([teamId, team]) => {
            const teamElement = document.createElement('div');
            teamElement.className = 'bg-gray-700 p-4 rounded-lg flex flex-col';
            
            const isPlayerInThisTeam = team.players && team.players[userId];
            const teamNameHTML = `<h4 class="font-bold text-lg text-truncate ${isPlayerInThisTeam ? 'editable-team-name' : ''}" data-action="edit-team-name" data-team-id="${teamId}">${team.name} <span class="font-normal text-gray-400">(${Object.keys(team.players || {}).length}/${roomData.settings.maxPlayersPerTeam})</span></h4>`;

            let playersHtml = '<ul class="space-y-2 mt-2 flex-grow">';
            const players = team.players || {};
            if (Object.keys(players).length > 0) {
                Object.entries(players).forEach(([pId, p]) => {
                    const isHost = pId === roomData.hostId;
                    playersHtml += `<li class="text-white flex items-center text-truncate"><span class="w-2 h-2 bg-green-400 rounded-full mr-3 flex-shrink-0"></span>${isHost ? '👑 ' : ''}${p.nick}</li>`;
                });
            } else {
                playersHtml += '<li class="text-gray-400">Пусто</li>';
            }
            playersHtml += '</ul>';
            
            let buttonHtml = '';
            const playerCount = Object.keys(players).length;
            const maxPlayers = roomData.settings.maxPlayersPerTeam;
            if (teamId !== currentPlayerTeamId && playerCount < maxPlayers) {
                buttonHtml = `<button class="join-team-btn" data-team-id="${teamId}" data-action="switch-team">Присоединиться</button>`;
            }

            teamElement.innerHTML = teamNameHTML + playersHtml + buttonHtml;
            teamsContainer.appendChild(teamElement);
        });
    }
}

function renderGame(roomData) {
    if (!roomData.game) return;
    const { game, teams } = roomData;
    const currentTeam = teams[game.currentTeamId];
    if (!currentTeam || !currentTeam.players || !currentTeam.players[game.currentPlayerId]) return;
    const currentPlayer = currentTeam.players[game.currentPlayerId];
    
    const amIExplaining = game.currentPlayerId === userId;
    currentPlayerName.textContent = `${currentPlayer.nick}${amIExplaining ? ' (ты)' : ''}`;
    currentTeamName.textContent = currentTeam.name;
    gameScores.innerHTML = Object.values(teams).map(t => `<p class="text-sm text-gray-400">${t.name}: <span class="font-bold text-white">${t.score}</span></p>`).join('');
    
    if (amIExplaining) {
        const currentWord = game.wordQueue[game.currentWordIndex] || "Слова закончились!";
        const existingCard = wordCardContainer.querySelector('.word-card');
        if (!existingCard || existingCard.dataset.word !== currentWord) {
             renderNewWordCard(currentWord);
        }
    } else {
        renderHiddenWordCard(currentPlayer.nick);
    }
    
    inRoundWordsList.innerHTML = (game.roundHistory || [])
        .filter(item => item.guessed)
        .map(item => `<span class="guessed-word-badge">${item.word}</span>`).join('');

    guessWordBtn.disabled = !amIExplaining;
    skipWordBtn.disabled = !amIExplaining;
}

function renderNewWordCard(word) {
    const existingCard = wordCardContainer.querySelector('.word-card, .word-card-hidden');
    if (existingCard) {
        existingCard.classList.add('card-exit');
        existingCard.addEventListener('animationend', () => {
            wordCardContainer.innerHTML = `<div class="word-card card-enter" data-word="${word}"><h3>${word}</h3></div>`;
        }, { once: true });
    } else {
        wordCardContainer.innerHTML = `<div class="word-card card-enter" data-word="${word}"><h3>${word}</h3></div>`;
    }
}

function renderHiddenWordCard(explainerNick) {
    wordCardContainer.innerHTML = `<div class="word-card-hidden"><h3>${explainerNick} объясняет слово...</h3><p class="text-sm mt-2">Угадывайте!</p></div>`;
}

function renderRoundSummary(roomData) {
    const { game, teams, hostId } = roomData;
    summaryScores.innerHTML = Object.values(teams).map(t => `<p>${t.name}: <span class="font-bold">${t.score}</span></p>`).join('');
    summaryWordsList.innerHTML = (game.roundHistory || []).map(item =>
        `<div class="flex justify-between items-center ${item.guessed ? 'text-green-400' : 'text-yellow-400'}">
            <span>${item.word}</span>
            <span>${item.guessed ? '+1' : 'пропуск'}</span>
        </div>`
    ).join('');

    const nextPlayerIndex = (game.currentPlayerIndex + 1) % game.playerOrder.length;
    const nextPlayerInfo = game.playerOrder[nextPlayerIndex];
    const nextTeam = teams[nextPlayerInfo.teamId];
    const nextTeamPlayers = nextTeam.players || {};

    nextTeamName.textContent = nextTeam.name;

    const readyPlayers = game.readyCheck ? Object.keys(game.readyCheck) : [];
    
    readyPlayersList.innerHTML = Object.entries(nextTeamPlayers).map(([pId, p]) => 
        `<span>${p.nick} ${readyPlayers.includes(pId) ? '✅' : '...'}</span>`
    ).join(', ');

    const amIOnNextTeam = nextTeam.players && nextTeam.players[userId];
    if (amIOnNextTeam && !readyPlayers.includes(userId)) {
        readyBtn.classList.remove('hidden');
    } else {
        readyBtn.classList.add('hidden');
    }

    const allNextTeamPlayersReady = Object.keys(nextTeamPlayers).every(pId => readyPlayers.includes(pId));
    
    nextRoundBtn.style.display = 'block';
    if (hostId !== userId) {
        nextRoundBtn.disabled = true;
        nextRoundBtn.textContent = 'Ожидание старта от хоста';
    } else {
        nextRoundBtn.disabled = !allNextTeamPlayersReady;
        nextRoundBtn.textContent = allNextTeamPlayersReady ? 'Начать следующий раунд' : 'Ожидание готовности игроков';
    }
}

function renderGameOver(roomData) {
    let winner = null;
    let maxScore = -1;
    Object.values(roomData.teams).forEach(team => {
        if (team.score > maxScore) { maxScore = team.score; winner = team; }
    });
    winnerTeamName.textContent = winner ? winner.name : 'Никто';
    finalScores.innerHTML = Object.values(roomData.teams).map(t => `<p>${t.name}: <span class="font-bold">${t.score}</span></p>`).join('');
    playAgainBtn.style.display = roomData.hostId === userId ? 'block' : 'none';
}

// --- ИГРОВАЯ ЛОГИКА И УПРАВЛЕНИЕ КОМНАТОЙ ---
async function handleCreateRoom(event) {
    event.preventDefault();
    const roomName = document.getElementById('room-name').value.trim();
    const hostName = document.getElementById('host-name').value.trim();
    const timerValue = document.querySelector('input[name="timer"]:checked').value;
    const teamsCount = document.getElementById('teams-count').value;
    const winningScore = document.getElementById('winning-score').value;

    if (!roomName || !hostName || !winningScore) return alert('Пожалуйста, заполните все поля!');
    
    const newRoomRef = db.ref('rooms').push();
    const roomId = newRoomRef.key;
    
    const initialTeams = {};
    for (let i = 1; i <= teamsCount; i++) {
        initialTeams[`team${i}`] = { name: `Команда ${i}`, players: {}, score: 0 };
    }
    initialTeams.team1.players[userId] = { nick: hostName };

    const newRoomData = { 
        id: roomId, 
        title: roomName, 
        hostId: userId, 
        status: 'lobby', 
        settings: { 
            timer: parseInt(timerValue, 10),
            winningScore: parseInt(winningScore, 10) || 20,
            maxTeams: 5, 
            maxPlayersPerTeam: 5 
        }, 
        teams: initialTeams, 
        presences: { [userId]: true },
        createdAt: firebase.database.ServerValue.TIMESTAMP 
    };
    await newRoomRef.set(newRoomData);
    window.location.hash = roomId;
    router();
}

async function handleJoinRoom(event) {
    event.preventDefault();
    const nick = nicknameInput.value.trim();
    if (!nick || !currentRoomId) return;
    const roomRef = db.ref(`rooms/${currentRoomId}`);
    const snapshot = await roomRef.once('value');
    const roomData = snapshot.val();
    if (!roomData) { alert("Комната не найдена!"); window.location.hash = ''; return; }
    let teamToJoinId = null;
    let minPlayers = Infinity;
    Object.entries(roomData.teams).forEach(([teamId, team]) => {
        const playerCount = team.players ? Object.keys(team.players).length : 0;
        if (playerCount < minPlayers && playerCount < roomData.settings.maxPlayersPerTeam) {
            minPlayers = playerCount; teamToJoinId = teamId;
        }
    });
    if (teamToJoinId) {
        const updates = {};
        updates[`/teams/${teamToJoinId}/players/${userId}`] = { nick };
        updates[`/presences/${userId}`] = true;
        
        await roomRef.update(updates);

        setupOnDisconnect();
        joinModal.classList.add('hidden');
    } else { alert("В комнате нет свободных мест!"); }
}

async function handleSwitchTeam(targetTeamId) {
    if (!currentRoomId || !userId) return;
    const roomRef = db.ref(`rooms/${currentRoomId}`);
    
    roomRef.transaction(room => {
        if (!room) return room;

        let oldTeamId = null;
        let playerNick = null;

        if (room.teams) {
            for (const teamId in room.teams) {
                if (room.teams[teamId].players && room.teams[teamId].players[userId]) {
                    oldTeamId = teamId;
                    playerNick = room.teams[teamId].players[userId].nick;
                    break;
                }
            }
        }
        
        const targetTeam = room.teams[targetTeamId];
        const targetTeamPlayerCount = targetTeam.players ? Object.keys(targetTeam.players).length : 0;
        
        if (targetTeamPlayerCount >= room.settings.maxPlayersPerTeam) {
            return; 
        }

        if (oldTeamId) {
            delete room.teams[oldTeamId].players[userId];
        }

        if (!room.teams[targetTeamId].players) {
            room.teams[targetTeamId].players = {};
        }
        if(playerNick) {
             room.teams[targetTeamId].players[userId] = { nick: playerNick };
        }
       
        return room;
    });
}
function handleStartGame() {
    const roomRef = db.ref(`rooms/${currentRoomId}`);
    roomRef.once('value', (snapshot) => {
        const roomData = snapshot.val();
        const playerOrder = [];
        const teamIds = Object.keys(roomData.teams);
        let maxPlayers = 0;
        teamIds.forEach(tId => maxPlayers = Math.max(maxPlayers, Object.keys(roomData.teams[tId].players || {}).length));
        for (let i = 0; i < maxPlayers; i++) {
            teamIds.forEach(tId => {
                const teamPlayers = Object.keys(roomData.teams[tId].players || {});
                if (teamPlayers[i]) {
                    playerOrder.push({ teamId: tId, playerId: teamPlayers[i] });
                }
            });
        }
        if (Object.values(roomData.teams).some(team => (team.players ? Object.keys(team.players).length : 0) < 2)) {
             alert("В каждой команде должно быть минимум 2 игрока для старта.");
             return;
        }
        roomRef.update({
            'status': 'playing',
            'game': {
                wordQueue: shuffleArray([...WORDS_DATABASE]),
                currentWordIndex: 0,
                playerOrder: playerOrder,
                currentPlayerIndex: 0,
                roundHistory: [],
                currentTeamId: playerOrder[0].teamId,
                currentPlayerId: playerOrder[0].playerId,
                roundStartTime: firebase.database.ServerValue.TIMESTAMP,
            }
        });
    });
}
function handleWordAction(isGuessed) {
    const roomRef = db.ref(`rooms/${currentRoomId}`);
    roomRef.transaction(room => {
        if (room && room.game) {
            const word = room.game.wordQueue[room.game.currentWordIndex];
            if (!room.game.roundHistory) room.game.roundHistory = [];
            room.game.roundHistory.push({ word: word, guessed: isGuessed });
            if (isGuessed) {
                if(!room.teams[room.game.currentTeamId].score) room.teams[room.game.currentTeamId].score = 0;
                room.teams[room.game.currentTeamId].score++;
            }
            room.game.currentWordIndex++;
        }
        return room;
    });
}

function handleEndRound() {
    db.ref(`rooms/${currentRoomId}`).transaction(room => {
        if (room) {
            room.status = 'round-over';
            if (room.game) {
                room.game.readyCheck = {};
            }
        }
        return room;
    });
}

function handleNextRound() {
    const roomRef = db.ref(`rooms/${currentRoomId}`);
    roomRef.transaction(room => {
        if (room && room.game) {
            const winner = Object.values(room.teams).find(t => t.score >= (room.settings.winningScore || 20));
            if (winner) {
                room.status = 'finished';
                return room;
            }
            const newPlayerIndex = (room.game.currentPlayerIndex + 1) % room.game.playerOrder.length;
            const nextPlayer = room.game.playerOrder[newPlayerIndex];
            room.status = 'playing';
            room.game.currentPlayerIndex = newPlayerIndex;
            room.game.currentTeamId = nextPlayer.teamId;
            room.game.currentPlayerId = nextPlayer.playerId;
            room.game.roundHistory = [];
            room.game.readyCheck = {};
            room.game.roundStartTime = firebase.database.ServerValue.TIMESTAMP;
        }
        return room;
    });
}
function handlePlayAgain() {
    const roomRef = db.ref(`rooms/${currentRoomId}`);
    roomRef.transaction(room => {
        if (room) {
            room.status = 'lobby';
            room.game = null;
            Object.keys(room.teams).forEach(teamId => {
                room.teams[teamId].score = 0;
            });
        }
        return room;
    });
}

// --- ГЛАВНЫЙ РОУТЕР И СЛУШАТЕЛЬ ---
function router() {
    if (roomUnsubscribe) {
        try { roomUnsubscribe(); } catch (e) { console.warn('Ошибка при отписке комнаты:', e); }
        roomUnsubscribe = null;
    }
     if (presenceUnsubscribe) {
        try { presenceUnsubscribe(); } catch (e) { console.warn('Ошибка при отписке присутствия:', e); }
        presenceUnsubscribe = null;
    }
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    cleanupPresence();
    
    currentRoomId = window.location.hash.substring(1);

    if (!currentRoomId) {
        showScreen('home');
        initialChoiceContainer.classList.remove('hidden');
        createFormContainer.classList.add('hidden');
        joinFormContainer.classList.add('hidden');
        return;
    }
    
    console.log(`Подключаемся к комнате: ${currentRoomId}`);

    const roomRef = db.ref(`rooms/${currentRoomId}`);
    const presencesRef = db.ref(`rooms/${currentRoomId}/presences`);

    const mainListener = (snapshot) => {
        if (!snapshot.exists()) {
            if (document.visibilityState === 'visible') {
                showMessageScreen("Комната не найдена", "Возможно, хост покинул лобби или комната была удалена.");
            }
            window.location.hash = '';
            return;
        }
        const roomData = snapshot.val();
        
        switch (roomData.status) {
            case 'lobby':
                showScreen('lobby');
                renderLobby(roomData);
                const isPlayerInRoom = roomData.teams && Object.values(roomData.teams).some(t => t.players && t.players[userId]);
                if (!isPlayerInRoom) {
                    joinModal.classList.remove('hidden');
                } else {
                    setupOnDisconnect();
                    joinModal.classList.add('hidden');
                }
                break;
            case 'playing':
                showScreen('game');
                renderGame(roomData);
                if (timerInterval) clearInterval(timerInterval);
                const roundDuration = roomData.settings.timer * 1000;
                db.ref(`.info/serverTimeOffset`).once('value', (offsetSnap) => {
                    const offset = offsetSnap.val() || 0;
                    timerInterval = setInterval(() => {
                        db.ref(`rooms/${currentRoomId}`).once('value', (currentSnapshot) => {
                            const currentRoomData = currentSnapshot.val();
                            if (!currentRoomData || !currentRoomData.game || !currentRoomData.game.roundStartTime) {
                                clearInterval(timerInterval);
                                return;
                            }
                            const timePassed = Date.now() + offset - currentRoomData.game.roundStartTime;
                            const timeLeft = Math.max(0, roundDuration - timePassed);
                            timerBar.style.width = `${(timeLeft / roundDuration) * 100}%`;
                            timerText.textContent = new Date(timeLeft).toISOString().substr(14, 5);
                            if (timeLeft <= 0) {
                                clearInterval(timerInterval);
                                if (currentRoomData.game.currentPlayerId === userId) {
                                    handleEndRound();
                                }
                            }
                        });
                    }, 200);
                });
                break;
            case 'round-over':
                showScreen('summary');
                renderRoundSummary(roomData);
                break;
            case 'finished':
                showScreen('gameOver');
                renderGameOver(roomData);
                break;
        }
    };

    const presenceListener = (presenceSnapshot) => {
        const presences = presenceSnapshot.val() || {};
        roomRef.once('value', roomSnapshot => {
            if (!roomSnapshot.exists()) return;
            const roomData = roomSnapshot.val();
            let updates = {};
            let playerRemoved = false;

            if (roomData.teams) {
                Object.entries(roomData.teams).forEach(([teamId, team]) => {
                    if (team.players) {
                        Object.keys(team.players).forEach(playerId => {
                            if (!presences[playerId]) {
                                console.log(`Игрок ${team.players[playerId].nick} отсутствует, удаляем...`);
                                updates[`/teams/${teamId}/players/${playerId}`] = null;
                                playerRemoved = true;
                            }
                        });
                    }
                });
            }

            if (!presences[roomData.hostId]) {
                const presentPlayers = Object.keys(presences);
                if (presentPlayers.length > 0) {
                    const newHostId = presentPlayers[0];
                    console.log(`Хост вышел, назначаем нового: ${newHostId}`);
                    updates[`/hostId`] = newHostId;
                } else {
                     console.log("Все игроки вышли, удаляем комнату.");
                     roomRef.remove();
                     return;
                }
            }

            if (Object.keys(updates).length > 0) {
                roomRef.update(updates).then(() => {
                    if (roomData.status === 'playing' && playerRemoved) {
                        roomRef.once('value', updatedSnapshot => {
                            const updatedRoomData = updatedSnapshot.val();
                            if(!updatedRoomData) return;
                            const isGameStillValid = Object.values(updatedRoomData.teams).every(team => (team.players ? Object.keys(team.players).length : 0) >= 2);
                            if (!isGameStillValid) {
                                console.log("Недостаточно игроков, игра остановлена.");
                                roomRef.child('status').set('lobby');
                                showMessageScreen("Игра остановлена", "Один из игроков вышел, и в команде стало меньше двух человек. Возвращаемся в лобби.");
                            }
                        });
                    }
                });
            }
        });
    };

    roomRef.on('value', mainListener, (error) => console.error("Ошибка Firebase:", error));
    presencesRef.on('value', presenceListener, (error) => console.error("Ошибка присутствия:", error));

    roomUnsubscribe = () => {
        try { roomRef.off('value', mainListener); } catch (e) { console.warn('Ошибка при off() комнаты:', e); }
    };
    presenceUnsubscribe = () => {
        try { presencesRef.off('value', presenceListener); } catch (e) { console.warn('Ошибка при off() присутствия:', e); }
    }
}

// --- НАЗНАЧЕНИЕ ОБРАБОТЧИКОВ ---
document.addEventListener('DOMContentLoaded', () => {
    timerOptions.addEventListener('change', (e) => {
        if(e.target.name === 'timer') {
            document.querySelectorAll('.timer-option-label').forEach(label => {
                label.style.borderColor = 'transparent';
            });
            e.target.closest('.timer-option-label').style.borderColor = '#6366f1';
        }
    });
    
    document.querySelectorAll('input[name="timer"]').forEach(radio => {
        if(radio.checked) {
             radio.closest('.timer-option-label').style.borderColor = '#6366f1';
        }
    });

    showCreateFormBtn.addEventListener('click', () => {
        initialChoiceContainer.classList.add('hidden');
        createFormContainer.classList.remove('hidden');
        joinFormContainer.classList.add('hidden');
    });
    showJoinFormBtn.addEventListener('click', () => {
        initialChoiceContainer.classList.add('hidden');
        createFormContainer.classList.add('hidden');
        joinFormContainer.classList.remove('hidden');
    });

    joinByLinkForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const link = document.getElementById('join-link-input').value;
        try {
            const url = new URL(link);
            if (url.hash) {
                window.location.hash = url.hash.substring(1);
                router();
            }
        } catch (error) {
            alert("Неверный формат ссылки!");
        }
    });

    homeLogoBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (currentRoomId) {
            if (confirm("Вы уверены, что хотите выйти на главный экран? Вы покинете комнату.")) {
                
                if (roomUnsubscribe) { roomUnsubscribe(); roomUnsubscribe = null; }
                if (presenceUnsubscribe) { presenceUnsubscribe(); presenceUnsubscribe = null; }
                
                const roomRef = db.ref(`rooms/${currentRoomId}`);
                const snapshot = await roomRef.once('value');

                if (snapshot.exists()) {
                    const roomData = snapshot.val();
                    let playerTeamId = null;
                    if (roomData.teams) {
                        for (const [teamId, team] of Object.entries(roomData.teams)) {
                            if (team.players && team.players[userId]) {
                                playerTeamId = teamId;
                                break;
                            }
                        }
                    }
                    const updates = {};
                    if (playerTeamId) {
                        updates[`/teams/${playerTeamId}/players/${userId}`] = null;
                    }
                    updates[`/presences/${userId}`] = null;
                    await roomRef.update(updates);
                }

                window.location.hash = '';
                router();
            }
        } else {
            window.location.hash = '';
            router();
        }
    });
    
    messageBackBtn.addEventListener('click', () => {
        window.location.hash = '';
        router();
    });

    copyLinkBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(window.location.href).then(() => {
            copyLinkBtn.textContent = 'Скопировано!';
            setTimeout(() => { copyLinkBtn.textContent = 'Копировать'; }, 2000);
        });
    });

    teamsContainer.addEventListener('click', (e) => {
        const target = e.target.closest('[data-action]');
        if (!target) return;
        
        const action = target.dataset.action;
        const teamId = target.dataset.teamId;

        if (action === 'edit-team-name') {
            const h4 = e.target.closest('h4');
            if(!h4) return;
            const currentName = h4.innerText.split('(')[0].trim();
            const newName = prompt('Введите новое название команды (макс. 20 символов):', currentName);
            if (newName && newName.trim() !== '') {
                db.ref(`rooms/${currentRoomId}/teams/${teamId}/name`).set(newName.trim().substring(0, 20));
            }
        } else if (action === 'switch-team') {
            handleSwitchTeam(teamId);
        }
    });

    closeSummaryBtn.addEventListener('click', () => {
        db.ref(`rooms/${currentRoomId}/status`).set('lobby');
    });

    readyBtn.addEventListener('click', () => {
        db.ref(`rooms/${currentRoomId}/game/readyCheck/${userId}`).set(true);
    });

    if (createRoomForm) createRoomForm.addEventListener('submit', handleCreateRoom);
    if (joinForm) joinForm.addEventListener('submit', handleJoinRoom);
    if (startGameBtn) startGameBtn.addEventListener('click', handleStartGame);
    if (guessWordBtn) guessWordBtn.addEventListener('click', () => handleWordAction(true));
    if (skipWordBtn) skipWordBtn.addEventListener('click', () => handleWordAction(false));
    if (nextRoundBtn) nextRoundBtn.addEventListener('click', handleNextRound);
    if (playAgainBtn) playAgainBtn.addEventListener('click', handlePlayAgain);

    window.addEventListener('hashchange', router);
    router(); 
});

