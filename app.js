/* ============================================================
   MINDSPARK
   Complete Application Controller
   File: js/app.js
   ============================================================ */

(function () {
    "use strict";

    /* ------------------------------------------------------------
       BASIC HELPERS
    ------------------------------------------------------------ */

    const $ = (id) => document.getElementById(id);

    const $$ = (selector) =>
        Array.from(document.querySelectorAll(selector));

    function safeText(id, value) {
        const el = $(id);
        if (el) el.textContent = value;
    }

    function show(id) {
        $$(".screen").forEach((screen) => {
            screen.classList.remove("active");
        });

        const target = $(id);

        if (!target) {
            console.warn("MindSpark: screen not found:", id);
            return;
        }

        target.classList.add("active");

        window.scrollTo({
            top: 0,
            behavior: "instant"
        });

        if (id === "settings") {
            mfUpdateUI();
        }

        if (id === "home") {
            updateHomeStats();
        }
    }

    function firstExisting(ids) {
        for (const id of ids) {
            const el = $(id);
            if (el) return el;
        }
        return null;
    }

    /* ------------------------------------------------------------
       GLOBAL STATE
    ------------------------------------------------------------ */

    const state = {
        score: 0,
        bestScore: Number(localStorage.getItem("mindspark_best") || 0),
        gamesPlayed: Number(localStorage.getItem("mindspark_games") || 0),
        streak: Number(localStorage.getItem("mindspark_streak") || 0),

        sound:
            localStorage.getItem("mindspark_sound") !== "off",

        vibration:
            localStorage.getItem("mindspark_vibration") !== "off",

        music:
            localStorage.getItem("mindspark_music") !== "off",

        currentGame: null,
        paused: false,

        memory: {
            cards: [],
            first: null,
            second: null,
            locked: false,
            moves: 0,
            matches: 0,
            timer: 0,
            interval: null
        },

        math: {
            answer: null,
            score: 0,
            question: 0,
            total: 10,
            timeLeft: 30,
            interval: null
        },

        chess: {
            selected: null,
            board: [],
            turn: "white"
        },

        carrom: {
            score: 0,
            target: 10
        }
    };

    /* ------------------------------------------------------------
       SAVE DATA
    ------------------------------------------------------------ */

    function saveState() {
        localStorage.setItem(
            "mindspark_best",
            String(state.bestScore)
        );

        localStorage.setItem(
            "mindspark_games",
            String(state.gamesPlayed)
        );

        localStorage.setItem(
            "mindspark_streak",
            String(state.streak)
        );
    }

    function saveSettings() {
        localStorage.setItem(
            "mindspark_sound",
            state.sound ? "on" : "off"
        );

        localStorage.setItem(
            "mindspark_vibration",
            state.vibration ? "on" : "off"
        );

        localStorage.setItem(
            "mindspark_music",
            state.music ? "on" : "off"
        );
    }

    /* ------------------------------------------------------------
       SOUND
    ------------------------------------------------------------ */

    let audioContext = null;

    function getAudioContext() {
        if (!audioContext) {
            try {
                audioContext =
                    new (window.AudioContext ||
                        window.webkitAudioContext)();
            } catch (e) {
                return null;
            }
        }

        return audioContext;
    }

    function beep(
        frequency= 500,
        duration = 0.08,
        type = "sine",
        volume = 0.04
    ) {
        if (!state.sound) return;

        const ctx = getAudioContext();

        if (!ctx) return;

        try {
            const oscillator = ctx.createOscillator();
            const gain = ctx.createGain();

            oscillator.type = type;
            oscillator.frequency.value = frequency;

            gain.gain.value = volume;

            oscillator.connect(gain);
            gain.connect(ctx.destination);

            oscillator.start();

            gain.gain.exponentialRampToValueAtTime(
                0.001,
                ctx.currentTime + duration
            );

            oscillator.stop(ctx.currentTime + duration);
        } catch (e) {
            /* Audio is optional */
        }
    }

    function successSound() {
        beep(700, 0.08, "sine", 0.05);

        setTimeout(() => {
            beep(1000, 0.12, "sine", 0.05);
        }, 70);
    }

    function errorSound() {
        beep(180, 0.15, "sawtooth", 0.025);
    }

    function clickSound() {
        beep(420, 0.04, "sine", 0.025);
    }

    /* ------------------------------------------------------------
       VIBRATION
    ------------------------------------------------------------ */

    function vibrate(pattern = 30) {
        if (!state.vibration) return;

        if ("vibrate" in navigator) {
            try {
                navigator.vibrate(pattern);
            } catch (e) {}
        }
    }

    /* ------------------------------------------------------------
       BUTTON SYSTEM
    ------------------------------------------------------------ */

    function bind(id, callback) {
        const el = $(id);

        if (!el) return;

        el.addEventListener("click", function (event) {
            event.preventDefault();

            clickSound();

            try {
                callback(event);
            } catch (error) {
                console.error(
                    "MindSpark button error:",
                    id,
                    error
                );
            }
        });
    }

    /* ------------------------------------------------------------
       NAVIGATION
    ------------------------------------------------------------ */

    function setupNavigation() {
        bind("homeBtn", () => show("home"));
        bind("backHome", () => show("home"));
        bind("backHomeBtn", () => show("home"));
        bind("settingsBtn", () => show("settings"));
        bind("closeSettings", () => show("home"));

        bind("memoryBtn", () => startMemory());
        bind("memoryGame", () => startMemory());

        bind("mathBtn", () => startMathRush());
        bind("mathRushBtn", () => startMathRush());

        bind("chessBtn", () => startChess());
        bind("chessGame", () => startChess());

        bind("carromBtn", () => startCarrom());
        bind("carromGame", () => startCarrom());

        bind("pauseBtn", pauseGame);
        bind("resumeBtn", resumeGame);
        bind("quitBtn", quitGame);
        bind("exitGame", quitGame);
    }

    /* ------------------------------------------------------------
       HOME
    ------------------------------------------------------------ */

    function updateHomeStats() {
        safeText("bestScore", state.bestScore);
        safeText("gamesPlayed", state.gamesPlayed);
        safeText("streak", state.streak);

        safeText("homeBest", state.bestScore);
        safeText("homeGames", state.gamesPlayed);
        safeText("homeStreak", state.streak);
    }

    /* ------------------------------------------------------------
       SETTINGS
    ------------------------------------------------------------ */

    function mfUpdateUI() {
        const soundToggle = firstExisting([
            "soundToggle",
            "soundSwitch"
        ]);

        const vibrationToggle = firstExisting([
            "vibrationToggle",
            "vibrationSwitch"
        ]);

        const musicToggle = firstExisting([
            "musicToggle",
            "musicSwitch"
          ]);

        if (soundToggle) {
            if (
                soundToggle.type === "checkbox"
            ) {
                soundToggle.checked = state.sound;
            } else {
                soundToggle.classList.toggle(
                    "on",
                    state.sound
                );
            }
        }

        if (vibrationToggle) {
            if (
                vibrationToggle.type === "checkbox"
            ) {
                vibrationToggle.checked =
                    state.vibration;
            } else {
                vibrationToggle.classList.toggle(
                    "on",
                    state.vibration
                );
            }
        }

        if (musicToggle) {
            if (
                musicToggle.type === "checkbox"
            ) {
                musicToggle.checked = state.music;
            } else {
                musicToggle.classList.toggle(
                    "on",
                    state.music
                );
            }
        }
    }

    function setupSettings() {
        const sound = firstExisting([
            "soundToggle",
            "soundSwitch"
        ]);

        const vibration = firstExisting([
            "vibrationToggle",
            "vibrationSwitch"
        ]);

        const music = firstExisting([
            "musicToggle",
            "musicSwitch"
        ]);

        if (sound) {
            sound.addEventListener("change", () => {
                if (sound.type === "checkbox") {
                    state.sound = sound.checked;
                } else {
                    state.sound = !state.sound;
                }

                saveSettings();
                mfUpdateUI();
            });

            if (sound.type !== "checkbox") {
                sound.addEventListener("click", () => {
                    state.sound = !state.sound;
                    saveSettings();
                    mfUpdateUI();
                });
            }
        }

        if (vibration) {
            vibration.addEventListener("change", () => {
                if (vibration.type === "checkbox") {
                    state.vibration =
                        vibration.checked;
                } else {
                    state.vibration =
                        !state.vibration;
                }

                saveSettings();
                mfUpdateUI();
            });

            if (vibration.type !== "checkbox") {
                vibration.addEventListener(
                    "click",
                    () => {
                        state.vibration =
                            !state.vibration;

                        saveSettings();
                        mfUpdateUI();
                    }
                );
            }
        }

        if (music) {
            music.addEventListener("change", () => {
                if (music.type === "checkbox") {
                    state.music = music.checked;
                } else {
                    state.music = !state.music;
                }

                saveSettings();
                mfUpdateUI();
            });

            if (music.type !== "checkbox") {
                music.addEventListener(
                    "click",
                    () => {
                        state.music = !state.music;

                        saveSettings();
                        mfUpdateUI();
                    }
                );
            }
        }

        bind("resetStats", resetStats);
        bind("clearData", resetStats);
    }

    function resetStats() {
        if (
            !confirm(
                "Reset all MindSpark progress and statistics?"
            )
        ) {
            return;
        }

        state.bestScore = 0;
        state.gamesPlayed = 0;
        state.streak = 0;

        saveState();
        updateHomeStats();
        mfUpdateUI();

        alert("MindSpark statistics have been reset.");
    }

    /* ============================================================
       MEMORY MATCH
       ============================================================ */

    const memorySymbols = [
        "🧠",
        "🚀",
        "⭐",
        "🔥",
        "⚡",
        "🌙",
        "🎯",
        "💎"
    ];

    function startMemory() {
        stopMemoryTimer();

        state.currentGame = "memory";
        state.paused = false;

        state.memory.first = null;
        state.memory.second = null;
        state.memory.locked = false;
        state.memory.moves = 0;
        state.memory.matches = 0;
        state.memory.timer = 0;

        const game =
            firstExisting([
                "memoryGameScreen",
                "memory",
                "memoryGame"
            ]);

        if (game && game.classList.contains("screen")) {
            show(game.id);
        } else if ($("memoryGameScreen")) {
            show("memoryGameScreen");
        }

        const board =
            firstExisting([
                "memoryBoard",
                "memoryGrid",
                "memoryCards"
            ]);

        if (!board) {
            console.warn(
                "MindSpark: Memory board not found."
            );
            return;
        }

        board.innerHTML = "";

        let cards = [
            ...memorySymbols,
            ...memorySymbols
        ];

        cards = shuffle(cards);

        state.memory.cards = cards;

        cards.forEach((symbol, index) => {
            const card =
                document.createElement("button");

            card.type = "button";
            card.className = "memory-card";
            card.dataset.index = index;

            card.innerHTML = 
                <span class="memory-card-inner">
                    <span class="memory-front">?</span>
                    <span class="memory-back">${symbol}</span>
                </span>
            ;

            card.addEventListener("click", () => {
                flipMemoryCard(card, index);
            });

            board.appendChild(card);
        });

        updateMemoryUI();
        startMemoryTimer();
    }

    function flipMemoryCard(card, index) {
        if (state.memory.locked) return;

        if (
            state.memory.first &&
            state.memory.first.index === index
        ) {
            return;
        }

        if (
            card.classList.contains("matched") ||
            card.classList.contains("flipped")
        ) {
            return;
        }

        card.classList.add("flipped");

        const current = {
            card,
            index,
            symbol: state.memory.cards[index]
        };

        if (!state.memory.first) {
            state.memory.first = current;
            return;
        }

        state.memory.second = current;

        state.memory.moves++;

        updateMemoryUI();

        if (
            state.memory.first.symbol ===
            state.memory.second.symbol
        ) {
            card.classList.add("matched");

            state.memory.first.card.classList.add(
                "matched"
            );

            state.memory.matches++;

            successSound();
            vibrate([30, 50, 30]);

            state.memory.first = null;
            state.memory.second = null;

            updateMemoryUI();

            if (
                state.memory.matches ===
                memorySymbols.length
            ) {
                finishMemory();
            }
        } else {
            errorSound();
            vibrate(25);

            state.memory.locked = true;

            setTimeout(() => {
                if (state.memory.first) {
                    state.memory.first.card.classList.remove(
                        "flipped"
                    );
                }

                if (state.memory.second) {
                    state.memory.second.card.classList.remove(
                        "flipped"
                    );
                }

                state.memory.first = null;
                state.memory.second = null;
                state.memory.locked = false;
            }, 700);
        }
    }

    function updateMemoryUI() {
        safeText(
            "memoryMoves",
            state.memory.moves
        );

        safeText(
            "memoryMatches",
            state.memory.matches
        );

        safeText(
            "memoryTimer",
            formatTime(state.memory.timer)
        );

        safeText(
            "memoryScore",
            Math.max(
                0,
                1000 -
                    state.memory.moves * 10 -
                    state.memory.timer * 3
            )
        );
    }

    function startMemoryTimer() {
        stopMemoryTimer();

        state.memory.interval =
            setInterval(() => {
                if (state.paused) return;

                state.memory.timer++;

                updateMemoryUI();
            }, 1000);
    }

    function stopMemoryTimer() {
        if (state.memory.interval) {
            clearInterval(
                state.memory.interval
            );

            state.memory.interval = null;
        }
    }

    function finishMemory() {
        stopMemoryTimer();

        const score = Math.max(
            100,
            1000 -
                state.memory.moves * 10 -
                state.memory.timer * 3
        );

        completeGame(score);

        setTimeout(() => {
            alert(
                "Memory complete!\nScore: " +
                    score +
                    "\nMoves: " +
                    state.memory.moves
            );
        }, 150);
    }

    /* ============================================================
       MATH RUSH
       ============================================================ */

    function startMathRush() {
        stopMathTimer();

        state.currentGame = "math";
        state.paused = false;

        state.math.score = 0;
        state.math.question = 0;
        state.math.total = 10;
        state.math.timeLeft = 30;

        showGameScreen(
            [
                "mathRush",
                "mathGameScreen",
                "mathGame"
            ]
        );

        createMathQuestion();
        startMathTimer();
    }

    function createMathQuestion() {
        const level =
            Math.min(
                10,
                Math.floor(
                    state.math.question / 2
                ) + 1
            );

        let a =
            Math.floor(
                Math.random() *
                    (10 * level)
            ) + 1;

        let b =
            Math.floor(
                Math.random() *
                    (10 * level)
            ) + 1;

        const operations = [
            "+",
            "-",
            "×"
        ];

        const operation =
            operations[
                Math.floor(
                    Math.random() *
                        operations.length
                )
            ];

        let answer;

        if (operation === "+") {
            answer = a + b;
        } else if (operation === "-") {
            if (b > a) {
                [a, b] = [b, a];
            }

            answer = a - b;
        } else {
            answer = a * b;
        }

        state.math.answer = answer;

        safeText(
            "mathQuestion",
            ${a} ${operation} ${b} = ?
        );

        safeText(
            "mathScore",
            state.math.score
        );

        safeText(
            "mathProgress",
            ${Math.min(
                state.math.question + 1,
                state.math.total
            )}/${state.math.total}
        );

        safeText(
            "mathTimer",
            state.math.timeLeft
        );

        const input =
            firstExisting([
                "mathAnswer",
                "mathInput",
                "answerInput"
            ]);

        if (input) {
            input.value = "";
            input.focus();
        }

        createMathChoices(answer);
    }

    function createMathChoices(answer) {
        const container =
            firstExisting([
                "mathChoices",
                "answerChoices","mathOptions"
            ]);

        if (!container) return;

        container.innerHTML = "";

        const choices = new Set();

        choices.add(answer);

        while (choices.size < 4) {
            const variation =
                Math.floor(
                    Math.random() * 21
                ) - 10;

            const choice =
                answer + variation;

            if (choice >= 0) {
                choices.add(choice);
            }
        }

        shuffle(
            Array.from(choices)
        ).forEach((choice) => {
            const button =
                document.createElement("button");

            button.type = "button";
            button.className = "math-choice";
            button.textContent = choice;

            button.addEventListener(
                "click",
                () => checkMathAnswer(choice)
            );

            container.appendChild(button);
        });
    }

    function checkMathAnswer(value) {
        if (state.currentGame !== "math") {
            return;
        }

        if (Number(value) === state.math.answer) {
            state.math.score += 100;

            successSound();
            vibrate(30);
        } else {
            state.math.score = Math.max(
                0,
                state.math.score - 25
            );

            errorSound();
            vibrate(80);
        }

        state.math.question++;

        if (
            state.math.question >=
            state.math.total
        ) {
            finishMath();
            return;
        }

        createMathQuestion();
    }

    function submitMathAnswer() {
        const input =
            firstExisting([
                "mathAnswer",
                "mathInput",
                "answerInput"
            ]);

        if (!input) return;

        checkMathAnswer(
            Number(input.value)
        );
    }

    function startMathTimer() {
        stopMathTimer();

        state.math.interval =
            setInterval(() => {
                if (state.paused) return;

                state.math.timeLeft--;

                safeText(
                    "mathTimer",
                    state.math.timeLeft
                );

                if (
                    state.math.timeLeft <=
                    0
                ) {
                    finishMath();
                }
            }, 1000);
    }

    function stopMathTimer() {
        if (state.math.interval) {
            clearInterval(
                state.math.interval
            );

            state.math.interval = null;
        }
    }

    function finishMath() {
        stopMathTimer();

        const score =
            state.math.score +
            state.math.timeLeft * 5;

        completeGame(score);

        setTimeout(() => {
            alert(
                "Math Rush complete!\nScore: " +
                    score
            );
        }, 150);
    }

    /* ============================================================
       CHESS
       ============================================================ */

    const chessPieces = {
        r: "♜",
        n: "♞",
        b: "♝",
        q: "♛",
        k: "♚",
        p: "♟",
        R: "♖",
        N: "♘",
        B: "♗",
        Q: "♕",
        K: "♔",
        P: "♙"
    };

    function startChess() {
        state.currentGame = "chess";
        state.paused = false;

        showGameScreen([
            "chessGameScreen",
            "chessGame",
            "chess"
        ]);

        state.chess.selected = null;
        state.chess.turn = "white";

        createChessBoard();
    }

    function createChessBoard() {
        const board =
            firstExisting([
                "chessBoard",
                "board"
            ]);

        if (!board) return;

        board.innerHTML = "";

        state.chess.board = [
            [
                "r",
                "n",
                "b",
                "q",
                "k",
                "b",
                "n",
                "r"
            ],
          [
                "p",
                "p",
                "p",
                "p",
                "p",
                "p",
                "p",
                "p"
            ],
            [
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                ""
            ],
            [
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                ""
            ],
            [
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                ""
            ],
            [
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                ""
            ],
            [
                "P",
                "P",
                "P",
                "P",
                "P",
                "P",
                "P",
                "P"
            ],
            [
                "R",
                "N",
                "B",
                "Q",
                "K",
                "B",
                "N",
                "R"
            ]
        ];

        for (let row = 0; row < 8; row++) {
            for (
                let col = 0;
                col < 8;
                col++
            ) {
                const square =
                    document.createElement(
                        "button"
                    );

                square.type = "button";

                square.className =
                    "chess-square " +
                    ((row + col) % 2 === 0
                        ? "light"
                        : "dark");

                square.dataset.row = row;
                square.dataset.col = col;

                const piece =
                    state.chess.board[row][col];

                square.textContent =
                    chessPieces[piece] || "";

                square.addEventListener(
                    "click",
                    () =>
                        handleChessSquare(
                            row,
                            col
                        )
                );

                board.appendChild(square);
            }
        }

        updateChessStatus();
    }

    function handleChessSquare(row, col) {
        const piece =
            state.chess.board[row][col];

        if (!state.chess.selected) {
            if (!piece) return;

            const isWhite =
                piece === piece.toUpperCase();

            if (
                (state.chess.turn === "white" &&
                    !isWhite) ||
                (state.chess.turn === "black" &&
                    isWhite)
            ) {
                return;
            }

            state.chess.selected = {
                row,
                col
            };

            highlightChessSelection();
            return;
        }

        const selected =
            state.chess.selected;

        if (
            selected.row === row &&
            selected.col === col
        ) {
            state.chess.selected = null;
            createChessBoard();
            return;
        }

        const movingPiece =
            state.chess.board[
                selected.row
            ][selected.col];

        const targetPiece =
            state.chess.board[row][col];

        if (
            targetPiece &&
            isSameChessColor(
                movingPiece,
                targetPiece
            )
        ) {
            state.chess.selected = {
                row,
                col
            };

            highlightChessSelection();
            return;
        }

        if (
            isLegalBasicChessMove(
                selected.row,
                selected.col,
                row,
                col,
                movingPiece
            )
        ) {
            state.chess.board[row][col] =
                movingPiece;

            state.chess.board[
                selected.row
            ][selected.col] = "";

            state.chess.turn =
                state.chess.turn === "white"
                    ? "black"
                    : "white";

            state.chess.selected = null;

            successSound();
            vibrate(20);

            createChessBoard();

            setTimeout(() => {
                if (
                    state.chess.turn ===
                    "black"
                ) {
                    makeSimpleChessMove();
                }
            }, 300);
        }
    }

    function highlightChessSelection() {
        const board =
            firstExisting([
                "chessBoard",
                "board"
            ]);

        if (!board) return;

        $$(".chess-square").forEach(
            (square) => {
                square.classList.remove(
                    "selected"
                );
            }
        );

        const selected =
            state.chess.selected;

        if (!selected) return;

        const index =
            selected.row * 8 +
            selected.col;

        const square =
            board.children[index];

        if (square) {
            square.classList.add(
                "selected"
            );
        }
    }

    function isSameChessColor(a, b) {
        if (!a || !b) return false;

        return (
            (a === a.toUpperCase()) ===
            (b === b.toUpperCase())
        );
    }

    function isLegalBasicChessMove(
        fromRow,
        fromCol,
        toRow,
        toCol,
        piece
    ) {
        const dr =
            Math.abs(toRow - fromRow);

        const dc =
            Math.abs(toCol - fromCol);

        const target =
            state.chess.board[toRow][toCol];

        if (
            target &&
            isSameChessColor(piece, target)
        ) {
            return false;
        }

        const lower = piece.toLowerCase();

        if (lower === "p") {
            const direction =
                piece === "P" ? -1 : 1;

            const startRow =
                piece === "P" ? 6 : 1;

            if (
                dc === 0 &&
                !target &&
                toRow - fromRow ===
                    direction
            ) {
                return true;
            }

            if (
                dc === 0 &&
                !target &&
                fromRow === startRow &&
                toRow - fromRow ===
                    direction * 2
            ) {
                return true;
            }

            if (
                dc === 1 &&
                dr === 1 &&
                target
            ) {
                return true;
            }

            return false;
        }

        if (lower === "n") {
            return (
                (dr === 2 && dc === 1) ||
                (dr === 1 && dc === 2)
            );
        }

        if (lower === "k") {
            return dr <= 1 && dc <= 1;
        }

        if (lower === "b") {
            return dr === dc;
        }

        if (lower === "r") {
            return dr === 0 || dc === 0;
        }

        if (lower === "q") {
            return (
                dr === dc ||
                dr === 0 ||
                dc === 0
            );
        }

        return false;
    }

    function makeSimpleChessMove() {
        const moves = [];

        for (let r = 0; r < 8; r++) {
            for (
                let c = 0;
                c < 8;
                c++
            ) {
                const piece =
                    state.chess.board[r][c];

                if (!piece) continue;

                if (piece !== piece.toLowerCase()) {
                    continue;
                }

                for (
                    let tr = 0;
                    tr < 8;
                    tr++
                ) {
                    for (
                        let tc = 0;
                        tc < 8;
                        tc++) {
                        if (
                            isLegalBasicChessMove(
                                r,
                                c,
                                tr,
                                tc,
                                piece
                            )
                        ) {
                            moves.push({
                                from: [r, c],
                                to: [tr, tc]
                            });
                        }
                    }
                }
            }
        }

        if (!moves.length) {
            completeGame(500);
            return;
        }

        const move =
            moves[
                Math.floor(
                    Math.random() *
                        moves.length
                )
            ];

        state.chess.board[
            move.to[0]
        ][move.to[1]] =
            state.chess.board[
                move.from[0]
            ][move.from[1]];

        state.chess.board[
            move.from[0]
        ][move.from[1]] = "";

        state.chess.turn = "white";

        createChessBoard();
    }

    function updateChessStatus() {
        safeText(
            "chessTurn",
            state.chess.turn === "white"
                ? "Your turn"
                : "Computer turn"
        );
    }

    /* ============================================================
       CARROM
       ============================================================ */

    function startCarrom() {
        state.currentGame = "carrom";
        state.paused = false;

        state.carrom.score = 0;

        showGameScreen([
            "carromGameScreen",
            "carromGame",
            "carrom"
        ]);

        createCarromBoard();
    }

    function createCarromBoard() {
        const board =
            firstExisting([
                "carromBoard",
                "carromCanvas"
            ]);

        if (!board) return;

        if (board.tagName === "CANVAS") {
            drawCarromCanvas(board);

            board.onclick = () => {
                playCarromShot(
                    board,
                    Math.random() * board.width,
                    Math.random() * board.height
                );
            };
        }

        safeText(
            "carromScore",
            state.carrom.score
        );
    }

    function drawCarromCanvas(canvas) {
        const ctx =
            canvas.getContext("2d");

        if (!ctx) return;

        ctx.clearRect(
            0,
            0,
            canvas.width,
            canvas.height
        );

        const width = canvas.width;
        const height = canvas.height;

        ctx.strokeRect(
            10,
            10,
            width - 20,
            height - 20
        );

        ctx.beginPath();

        ctx.arc(
            width / 2,
            height / 2,
            Math.min(width, height) *
                0.08,
            0,
            Math.PI * 2
        );

        ctx.stroke();

        ctx.fillStyle = "#222";

        for (let i = 0; i < 9; i++) {
            const angle =
                (Math.PI * 2 * i) / 9;

            const x =
                width / 2 +
                Math.cos(angle) *
                    width *
                    0.23;

            const y =
                height / 2 +
                Math.sin(angle) *
                    height *
                    0.23;

            ctx.beginPath();

            ctx.arc(
                x,
                y,
                Math.min(width, height) *
                    0.025,
                0,
                Math.PI * 2
            );

            ctx.fill();
        }
    }

    function playCarromShot(
        canvas,
        x,
        y
    ) {
        state.carrom.score +=
            Math.floor(
                Math.random() * 3
            ) + 1;

        successSound();
        vibrate(20);

        safeText(
            "carromScore",
            state.carrom.score
        );

        if (
            state.carrom.score >=
            state.carrom.target
        ) {
            completeGame(
                state.carrom.score * 50
            );

            setTimeout(() => {
                alert(
                    "Carrom challenge complete!"
                );
            }, 150);
        } else {
            drawCarromCanvas(canvas);
        }
    }

    /* ============================================================
       GAME SCREEN HELPER
    ============================================================ */

    function showGameScreen(ids) {
        for (const id of ids) {
            if ($(id)) {
                show(id);
                return;
            }
        }

        const gameScreen =
            $$(".screen").find(
                (screen) =>
                    screen.id !== "home" &&
                    screen.id !== "settings"
            );

        if (gameScreen) {
            show(gameScreen.id);
        }
    }

    /* ============================================================
       PAUSE / RESUME / QUIT
    ============================================================ */

    function pauseGame() {
        if (!state.currentGame) return;

        state.paused = true;

        const pause =
            firstExisting([
                "pauseOverlay",
                "pauseScreen",
                "pauseMenu"
            ]);

        if (pause) {
            pause.classList.add("active");
            pause.classList.remove("hidden");
        }
    }

    function resumeGame() {
        state.paused = false;

        const pause =
            firstExisting([
                "pauseOverlay",
                "pauseScreen",
                "pauseMenu"
            ]);

        if (pause) {
            pause.classList.remove("active");
            pause.classList.add("hidden");
        }
    }

    function quitGame() {
        stopMemoryTimer();
        stopMathTimer();

        state.currentGame = null;
        state.paused = false;

        resumeGame();
        show("home");
    }

    /* ============================================================
       GAME COMPLETION
    ============================================================ */

    function completeGame(score) {
        score = Math.max(
            0,
            Math.round(score || 0)
        );

        state.score = score;

        state.gamesPlayed++;

        if (score > state.bestScore) {
            state.bestScore = score;
        }

        state.streak++;

        saveState();
        updateHomeStats();

        safeText(
            "finalScore",
            score
        );

        safeText(
            "gameScore",
            score
        );

        safeText(
            "scoreValue",
            score
        );
    }

    /* ============================================================
       PAUSE KEY
    ============================================================ */

    function setupKeyboard() {
        document.addEventListener(
            "keydown",
            (event) => {
                if (
                    event.key === "Escape"
                ) {
                    if (
                        state.currentGame
                    ) {
                        if (
                            state.paused
                        ) {
                            resumeGame();
                        } else {
                            pauseGame();
                        }
                    }
                }

                if (
                    event.key === "Enter" &&
                    state.currentGame ===
                        "math"
                ) {
                    submitMathAnswer();
                }
            }
        );
    }

    /* ============================================================
       RANDOM UTILITY
    ============================================================ */

    function shuffle(array) {
        const result = [...array];

        for (
            let i = result.length - 1;
            i > 0;
            i--
        ) {
            const j=
                Math.floor(
                    Math.random() *
                        (i + 1)
                );

            [
                result[i],
                result[j]
            ] = [
                result[j],
                result[i]
            ];
        }

        return result;
    }

    function formatTime(seconds) {
        const mins = Math.floor(
            seconds / 60
        );

        const secs =
            seconds % 60;

        return (
            String(mins).padStart(2, "0") +
            ":" +
            String(secs).padStart(2, "0")
        );
    }

    /* ============================================================
       MATH BUTTONS
    ============================================================ */

    function setupMathControls() {
        bind(
            "submitMath",
            submitMathAnswer
        );

        bind(
            "mathSubmit",
            submitMathAnswer
        );
    }

    /* ============================================================
       PAGE VISIBILITY
    ============================================================ */

    function setupVisibility() {
        document.addEventListener(
            "visibilitychange",
            () => {
                if (
                    document.hidden &&
                    state.currentGame
                ) {
                    pauseGame();
                }
            }
        );
    }

    /* ============================================================
       SERVICE WORKER
    ============================================================ */

    function registerServiceWorker() {
        if (
            !("serviceWorker" in navigator)
        ) {
            return;
        }

        window.addEventListener(
            "load",
            () => {
                navigator.serviceWorker
                    .register(
                        "./service-worker.js"
                    )
                    .then(
                        (registration) => {
                            console.log(
                                "MindSpark Service Worker registered:",
                                registration.scope
                            );
                        }
                    )
                    .catch((error) => {
                        console.warn(
                            "MindSpark Service Worker registration failed:",
                            error
                        );
                    });
            }
        );
    }

    /* ============================================================
       INITIALIZATION
    ============================================================ */

    function init() {
        console.log(
            "MindSpark initializing..."
        );

        setupNavigation();
        setupSettings();
        setupKeyboard();
        setupMathControls();
        setupVisibility();

        mfUpdateUI();
        updateHomeStats();

        registerServiceWorker();

        console.log(
            "MindSpark initialized successfully."
        );
    }

    /* ------------------------------------------------------------
       START APP
    ------------------------------------------------------------ */

    if (
        document.readyState ===
        "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            init
        );
    } else {
        init();
    }

})();
