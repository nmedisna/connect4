/**
 * Модуль логики игры Connect Four (Четыре в ряд)
 */
export class Connect4Game {
    constructor() {
        this.rows = 6;
        this.cols = 7;
        this.gameMode = 'pvp'; // 'pvp' или 'pvai'
        this.aiDifficulty = 'medium'; // 'easy', 'medium', 'hard'
        this.isProMode = false; // Премиум Pro-режим
        this.resetGame();
    }

    /**
     * Сброс игры к начальному состоянию
     */
    resetGame() {
        this.board = Array(this.rows).fill(null).map(() => Array(this.cols).fill(0));
        this.currentPlayer = 1; // 1 - Игрок 1 (Красный), 2 - Игрок 2 (Желтый / ИИ)
        this.moveHistory = []; // Массив ходов: { player, column, row }
        this.boardHistory = []; // Массив состояний доски после каждого хода
        this.winner = null; // 1, 2, 'draw' или null
        this.winningCoords = []; // Координаты выигрышной комбинации [[r, c], ...]
    }

    /**
     * Попытка сбросить фишку в указанную колонку
     * @param {number} col - Индекс колонки (0-6)
     * @returns {Object|null} - Возвращает ход {player, column, row} или null, если ход невозможен
     */
    dropPiece(col) {
        if (this.winner) return null;
        if (col < 0 || col >= this.cols) return null;

        // Поиск нижней свободной ячейки в колонке
        for (let r = this.rows - 1; r >= 0; r--) {
            if (this.board[r][col] === 0) {
                this.board[r][col] = this.currentPlayer;
                const move = { player: this.currentPlayer, column: col, row: r };
                
                this.moveHistory.push(move);
                this.boardHistory.push(this.board.map(row => [...row]));

                // Проверка победителя
                const winInfo = this.checkWinner(this.board);
                if (winInfo) {
                    this.winner = winInfo.winner;
                    this.winningCoords = winInfo.coords;
                } else if (this.isBoardFull()) {
                    this.winner = 'draw';
                } else {
                    this.switchPlayer();
                }

                this.saveActiveSession();
                return move;
            }
        }

        return null; // Колонка заполнена
    }

    /**
     * Переключение текущего игрока
     */
    switchPlayer() {
        this.currentPlayer = this.currentPlayer === 1 ? 2 : 1;
    }

    /**
     * Проверка, заполнено ли все поле
     */
    isBoardFull() {
        return this.board[0].every(cell => cell !== 0);
    }

    /**
     * Проверка выигрышной комбинации (4 в ряд)
     * @param {number[][]} board - Состояние доски для проверки
     * @returns {Object|null} - Информация о победителе { winner, coords } или null
     */
    checkWinner(board) {
        // 1. Горизонтали
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols - 3; c++) {
                const val = board[r][c];
                if (val !== 0 && val === board[r][c + 1] && val === board[r][c + 2] && val === board[r][c + 3]) {
                    return { winner: val, coords: [[r, c], [r, c + 1], [r, c + 2], [r, c + 3]] };
                }
            }
        }

        // 2. Вертикали
        for (let r = 0; r < this.rows - 3; r++) {
            for (let c = 0; c < this.cols; c++) {
                const val = board[r][c];
                if (val !== 0 && val === board[r + 1][c] && val === board[r + 2][c] && val === board[r + 3][c]) {
                    return { winner: val, coords: [[r, c], [r + 1, c], [r + 2, c], [r + 3, c]] };
                }
            }
        }

        // 3. Диагонали (вниз-вправо)
        for (let r = 0; r < this.rows - 3; r++) {
            for (let c = 0; c < this.cols - 3; c++) {
                const val = board[r][c];
                if (val !== 0 && val === board[r + 1][c + 1] && val === board[r + 2][c + 2] && val === board[r + 3][c + 3]) {
                    return { winner: val, coords: [[r, c], [r + 1, c + 1], [r + 2, c + 2], [r + 3, c + 3]] };
                }
            }
        }

        // 4. Диагонали (вверх-вправо)
        for (let r = 3; r < this.rows; r++) {
            for (let c = 0; c < this.cols - 3; c++) {
                const val = board[r][c];
                if (val !== 0 && val === board[r - 1][c + 1] && val === board[r - 2][c + 2] && val === board[r - 3][c + 3]) {
                    return { winner: val, coords: [[r, c], [r - 1, c + 1], [r - 2, c + 2], [r - 3, c + 3]] };
                }
            }
        }

        return null;
    }

    /**
     * Получить список возможных ходов (индексы столбцов, которые не заполнены)
     * @returns {number[]} - Свободные колонки
     */
    getValidMoves() {
        const moves = [];
        for (let c = 0; c < this.cols; c++) {
            if (this.board[0][c] === 0) {
                moves.push(c);
            }
        }
        return moves;
    }

    /**
     * Сохранение текущей активной игры в LocalStorage
     */
    saveActiveSession() {
        const sessionData = {
            board: this.board,
            currentPlayer: this.currentPlayer,
            moveHistory: this.moveHistory,
            boardHistory: this.boardHistory,
            winner: this.winner,
            winningCoords: this.winningCoords,
            gameMode: this.gameMode,
            aiDifficulty: this.aiDifficulty,
            isProMode: this.isProMode
        };
        localStorage.setItem('c4_active_session', JSON.stringify(sessionData));
    }

    /**
     * Загрузка активной сессии из LocalStorage
     * @returns {boolean} - Удалось ли загрузить сохраненную игру
     */
    loadActiveSession() {
        try {
            const dataStr = localStorage.getItem('c4_active_session');
            if (!dataStr) return false;
            
            const data = JSON.parse(dataStr);
            if (!data || !data.board) return false;
            
            this.board = data.board;
            this.currentPlayer = data.currentPlayer;
            this.moveHistory = data.moveHistory;
            this.boardHistory = data.boardHistory;
            this.winner = data.winner;
            this.winningCoords = data.winningCoords;
            this.gameMode = data.gameMode || 'pvp';
            this.aiDifficulty = data.aiDifficulty || 'medium';
            this.isProMode = data.isProMode || false;
            return true;
        } catch (e) {
            console.error('Ошибка загрузки сессии игры:', e);
            return false;
        }
    }

    /**
     * Очистка активной сессии из LocalStorage
     */
    clearActiveSession() {
        localStorage.removeItem('c4_active_session');
    }

    /**
     * Сохранить завершенную игру в историю последних 10 игр
     */
    saveGameToHistory() {
        if (!this.winner) return; // Игра еще не завершена
        
        try {
            const historyStr = localStorage.getItem('c4_games_history') || '[]';
            const history = JSON.parse(historyStr);
            
            const gameRecord = {
                id: Date.now(),
                date: new Date().toLocaleString('ru-RU'),
                winner: this.winner,
                movesCount: this.moveHistory.length,
                moveHistory: this.moveHistory,
                boardHistory: this.boardHistory,
                gameMode: this.gameMode,
                aiDifficulty: this.aiDifficulty
            };
            
            history.unshift(gameRecord); // Добавляем в начало
            
            // Хранить только 10 последних игр
            if (history.length > 10) {
                history.pop();
            }
            
            localStorage.setItem('c4_games_history', JSON.stringify(history));
        } catch (e) {
            console.error('Ошибка сохранения игры в историю:', e);
        }
    }

    /**
     * Получить историю прошедших игр
     * @returns {Object[]} - Массив записей игр
     */
    static getGamesHistory() {
        try {
            const historyStr = localStorage.getItem('c4_games_history') || '[]';
            return JSON.parse(historyStr);
        } catch (e) {
            console.error('Ошибка получения истории игр:', e);
            return [];
        }
    }

    /**
     * Очистить историю игр
     */
    static clearGamesHistory() {
        localStorage.removeItem('c4_games_history');
    }
}
