import { Connect4Game } from './game.js';
import { AICoach, Connect4AI } from './ai.js';

// --- СИНТЕЗАТОР ЗВУКОВЫХ ЭФФЕКТОВ (Web Audio API) ---
class SoundEngine {
    constructor() {
        this.ctx = null;
        this.enabled = true;
    }

    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    toggle(state) {
        this.enabled = state !== undefined ? state : !this.enabled;
        localStorage.setItem('c4_sound_enabled', this.enabled);
        return this.enabled;
    }

    playDrop() {
        if (!this.enabled) return;
        try {
            this.init();
            const ctx = this.ctx;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(160, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(55, ctx.currentTime + 0.16);

            gain.gain.setValueAtTime(0.4, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.16);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start();
            osc.stop(ctx.currentTime + 0.17);
        } catch (e) {
            console.error('Audio drop error:', e);
        }
    }

    playWin() {
        if (!this.enabled) return;
        try {
            this.init();
            const ctx = this.ctx;
            const notes = [261.63, 329.63, 392.00, 523.25, 659.25]; // C4, E4, G4, C5, E5
            notes.forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.08);

                gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.08);
                gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + i * 0.08 + 0.04);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.08 + 0.45);

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.start(ctx.currentTime + i * 0.08);
                osc.stop(ctx.currentTime + i * 0.08 + 0.5);
            });
        } catch (e) {
            console.error('Audio win error:', e);
        }
    }

    playDraw() {
        if (!this.enabled) return;
        try {
            this.init();
            const ctx = this.ctx;
            const notes = [392.00, 349.23, 311.13, 261.63]; // G4, F4, Eb4, C4
            notes.forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.1);

                gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.1);
                gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + i * 0.1 + 0.04);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.1 + 0.35);

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.start(ctx.currentTime + i * 0.1);
                osc.stop(ctx.currentTime + i * 0.1 + 0.4);
            });
        } catch (e) {
            console.error('Audio draw error:', e);
        }
    }

    playClick() {
        if (!this.enabled) return;
        try {
            this.init();
            const ctx = this.ctx;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(650, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.04);

            gain.gain.setValueAtTime(0.15, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.04);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start();
            osc.stop(ctx.currentTime + 0.05);
        } catch (e) {
            console.error('Audio click error:', e);
        }
    }
}

// --- УПРАВЛЕНИЕ UI И СВЯЗЬ МОДУЛЕЙ ---
export class Connect4UI {
    constructor() {
        this.game = new Connect4Game();
        this.sounds = new SoundEngine();
        this.isAnimating = false; // Лок кликов во время падения фишки

        // DOM Кэш
        this.boardGrid = document.getElementById('boardGrid');
        this.chipsContainer = document.getElementById('chipsContainer');
        this.previewContainer = document.getElementById('hoverPreview');
        this.columnHighlight = document.getElementById('columnHighlight');
        
        // Инфо табло
        this.p1Card = document.getElementById('p1Card');
        this.p2Card = document.getElementById('p2Card');
        
        // Кнопки основного экрана
        this.restartBtn = document.getElementById('restartBtn');
        this.analyzeBtn = document.getElementById('analyzeBtn');
        this.soundToggleBtn = document.getElementById('soundToggleBtn');
        
        // Панель выбора режима (Overlay)
        this.modeOverlay = document.getElementById('modeOverlay');
        this.modePvPBtn = document.getElementById('modePvPBtn');
        this.modePvAIBtn = document.getElementById('modePvAIBtn');
        this.difficultySection = document.getElementById('difficultySection');
        this.startAIPlayBtn = document.getElementById('startAIPlayBtn');

        // Сидбар Статистики
        this.p1WinsVal = document.getElementById('p1WinsVal');
        this.p2WinsVal = document.getElementById('p2WinsVal');
        this.drawsVal = document.getElementById('drawsVal');
        this.totalGamesVal = document.getElementById('totalGamesVal');
        this.historyList = document.getElementById('historyList');
        
        // Экран результата
        this.resultScreen = document.getElementById('resultScreen');
        this.resultBanner = document.getElementById('resultBanner');
        this.resultSubtitle = document.getElementById('resultSubtitle');
        this.restartResultBtn = document.getElementById('restartResultBtn');
        this.analyzeResultBtn = document.getElementById('analyzeResultBtn');

        // Модалка Анализа
        this.analysisModal = document.getElementById('analysisModal');
        this.modalClose = document.getElementById('modalClose');

        this.init();
    }

    init() {
        this.loadSoundSetting();
        this.setupThemes();
        this.buildBoardGrid();
        
        // Загрузка прошлой сессии
        const hasSession = this.game.loadActiveSession();
        this.renderBoard();
        this.updateScoreboard();
        this.updateProUI(); // PRO статус
        this.updateStatsAndHistory();

        if (hasSession) {
            // Убираем оверлей выбора режима, если сессия есть
            this.modeOverlay.classList.remove('visible');
            
            // Если игра из прошлой сессии уже была завершена
            if (this.game.winner) {
                this.handleGameEnd(false); // Показываем экран окончания
            } else if (this.game.gameMode === 'pvai' && this.game.currentPlayer === 2) {
                // Если ход компьютера в сохраненной игре, запускаем его
                this.triggerAIMove();
            }
        } else {
            // Если сохраненной сессии нет, показываем выбор режима
            this.modeOverlay.classList.add('visible');
            this.difficultySection.style.display = 'none';
        }

        this.bindEvents();
    }

    loadSoundSetting() {
        const stored = localStorage.getItem('c4_sound_enabled');
        if (stored !== null) {
            this.sounds.enabled = stored === 'true';
        }
        this.updateSoundToggleUI();
    }

    updateSoundToggleUI() {
        const enabled = this.sounds.enabled;
        const iconOn = this.soundToggleBtn.querySelector('.icon-sound-on');
        const iconOff = this.soundToggleBtn.querySelector('.icon-sound-off');
        if (enabled) {
            iconOn.style.display = 'block';
            iconOff.style.display = 'none';
            this.soundToggleBtn.title = 'Выключить звук';
        } else {
            iconOn.style.display = 'none';
            iconOff.style.display = 'block';
            this.soundToggleBtn.title = 'Включить звук';
        }
    }

    setupThemes() {
        const storedTheme = localStorage.getItem('c4_theme') || 'cyber'; // cyber по умолчанию
        document.documentElement.setAttribute('data-theme', storedTheme);
        
        const buttons = document.querySelectorAll('.theme-btn');
        buttons.forEach(btn => {
            if (btn.dataset.theme === storedTheme) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
            
            btn.addEventListener('click', () => {
                this.sounds.playClick();
                const theme = btn.dataset.theme;
                document.documentElement.setAttribute('data-theme', theme);
                localStorage.setItem('c4_theme', theme);
                
                buttons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
    }

    buildBoardGrid() {
        this.boardGrid.innerHTML = '';
        this.previewContainer.innerHTML = '';
        this.chipsContainer.innerHTML = '';

        for (let r = 0; r < this.game.rows; r++) {
            for (let c = 0; c < this.game.cols; c++) {
                // Строим интерактивные ячейки маски доски
                if (r === 0) {
                    // Создаем ячейку для призрачной фишки (для каждого столбца)
                    const prevSlot = document.createElement('div');
                    prevSlot.className = 'preview-slot';
                    prevSlot.dataset.col = c;
                    
                    const prevChip = document.createElement('div');
                    prevChip.className = 'preview-chip';
                    prevSlot.appendChild(prevChip);
                    this.previewContainer.appendChild(prevSlot);
                }

                const cell = document.createElement('div');
                cell.className = 'board-cell';
                cell.dataset.row = r;
                cell.dataset.col = c;
                this.boardGrid.appendChild(cell);

                // Строим контейнеры под фишки
                const slot = document.createElement('div');
                slot.className = 'chip-slot';
                slot.id = `slot-${r}-${c}`;
                this.chipsContainer.appendChild(slot);
            }
        }
    }

    /**
     * Привязка событий клика и наведения к ячейкам доски.
     * Вызывается при первом создании и после каждого рестарта (buildBoardGrid пересоздает DOM).
     */
    bindBoardEvents() {
        const cells = document.querySelectorAll('.board-cell');
        cells.forEach(cell => {
            cell.addEventListener('mouseenter', () => this.handleMouseEnter(parseInt(cell.dataset.col)));
            cell.addEventListener('click', () => this.handleColumnSelect(parseInt(cell.dataset.col)));
        });
    }

    bindEvents() {
        // Подсвечивание колонок и призрачные фишки
        this.bindBoardEvents();

        this.boardGrid.addEventListener('mouseleave', () => this.handleMouseLeave());

        // Выбор игровых режимов
        this.modePvPBtn.addEventListener('click', () => {
            this.sounds.playClick();
            this.game.gameMode = 'pvp';
            this.modeOverlay.classList.remove('visible');
            this.game.resetGame();
            this.game.saveActiveSession();
            this.updateScoreboard();
            this.updateStatsAndHistory();
        });

        this.modePvAIBtn.addEventListener('click', () => {
            this.sounds.playClick();
            this.modePvPBtn.className = 'btn btn-secondary';
            this.modePvAIBtn.className = 'btn btn-primary';
            this.difficultySection.style.display = 'flex';
        });

        const diffBtns = document.querySelectorAll('.diff-btn');
        diffBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.sounds.playClick();
                diffBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.game.aiDifficulty = btn.dataset.diff;
            });
        });

        this.startAIPlayBtn.addEventListener('click', () => {
            this.sounds.playClick();
            this.game.gameMode = 'pvai';
            this.modeOverlay.classList.remove('visible');
            this.game.resetGame();
            this.game.saveActiveSession();
            this.updateScoreboard();
            this.updateStatsAndHistory();
        });

        // PRO премиум слушатели
        const proUpgradeBtn = document.getElementById('proUpgradeBtn');
        const premiumModal = document.getElementById('premiumModal');
        const premiumModalClose = document.getElementById('premiumModalClose');
        const activateProDemoBtn = document.getElementById('activateProDemoBtn');
        const aiHintBtn = document.getElementById('aiHintBtn');

        if (proUpgradeBtn) {
            proUpgradeBtn.addEventListener('click', () => {
                this.sounds.playClick();
                premiumModal.classList.add('active');
            });
        }

        if (premiumModalClose) {
            premiumModalClose.addEventListener('click', () => {
                this.sounds.playClick();
                premiumModal.classList.remove('active');
            });
        }

        if (premiumModal) {
            premiumModal.addEventListener('click', (e) => {
                if (e.target === premiumModal) {
                    this.sounds.playClick();
                    premiumModal.classList.remove('active');
                }
            });
        }

        if (activateProDemoBtn) {
            activateProDemoBtn.addEventListener('click', () => {
                this.sounds.playWin(); // Триумфальный звук PRO!
                this.game.isProMode = !this.game.isProMode;
                this.game.saveActiveSession();
                this.updateProUI();
                premiumModal.classList.remove('active');
            });
        }

        if (aiHintBtn) {
            aiHintBtn.addEventListener('click', () => {
                this.sounds.playClick();
                if (!this.game.isProMode) {
                    premiumModal.classList.add('active');
                } else {
                    this.triggerAIHint();
                }
            });
        }

        // Кнопки интерфейса
        this.restartBtn.addEventListener('click', () => this.handleRestart());
        this.restartResultBtn.addEventListener('click', () => this.handleRestart());
        
        this.analyzeBtn.addEventListener('click', () => this.handleOpenAnalysis());
        this.analyzeResultBtn.addEventListener('click', () => this.handleOpenAnalysis());
        
        this.modalClose.addEventListener('click', () => {
            this.sounds.playClick();
            this.analysisModal.classList.remove('active');
        });
        
        this.analysisModal.addEventListener('click', (e) => {
            if (e.target === this.analysisModal) {
                this.sounds.playClick();
                this.analysisModal.classList.remove('active');
            }
        });

        this.soundToggleBtn.addEventListener('click', () => {
            const state = this.sounds.toggle();
            this.sounds.playClick();
            this.updateSoundToggleUI();
        });
    }

    triggerHaptic(type) {
        if (!navigator.vibrate) return;
        if (type === 'drop') {
            navigator.vibrate(25); // Мягкий клик
        } else if (type === 'win') {
            navigator.vibrate([100, 50, 100]); // Победный вибро-сигнал
        } else if (type === 'error') {
            navigator.vibrate([60, 40]); // Ошибка / колонка полная
        }
    }

    handleMouseEnter(col) {
        if (this.game.winner || this.isAnimating) return;
        
        // В режиме против ИИ блокируем превью во время хода компьютера
        if (this.game.gameMode === 'pvai' && this.game.currentPlayer === 2) return;

        // Очищаем подсветку подсказки ИИ при наведении
        this.clearAIHintHighlights();
        
        // 1. Позиционируем подсвечиватель колонки
        const firstCell = document.querySelector(`.board-cell[data-col="${col}"]`);
        if (firstCell) {
            const rect = firstCell.getBoundingClientRect();
            const parentRect = this.boardGrid.getBoundingClientRect();
            
            this.columnHighlight.style.left = `${rect.left - parentRect.left + 16}px`;
            this.columnHighlight.classList.add('visible');
        }

        // 2. Отображаем призрачную фишку
        const previewChips = this.previewContainer.querySelectorAll('.preview-chip');
        previewChips.forEach((chip, c) => {
            if (c === col) {
                // Проверим, не заполнена ли колонка
                if (this.game.board[0][col] === 0) {
                    chip.className = `preview-chip visible p${this.game.currentPlayer}`;
                } else {
                    chip.className = 'preview-chip';
                }
            } else {
                chip.className = 'preview-chip';
            }
        });
    }

    handleMouseLeave() {
        this.columnHighlight.classList.remove('visible', 'pro-hint-col');
        const previewChips = this.previewContainer.querySelectorAll('.preview-chip');
        previewChips.forEach(chip => {
            chip.className = 'preview-chip';
            chip.classList.remove('pro-hint');
        });
    }

    handleColumnSelect(col) {
        if (this.game.winner || this.isAnimating) return;
        
        // Если сейчас ход ИИ — игнорируем любые клики
        if (this.game.gameMode === 'pvai' && this.game.currentPlayer === 2) return;

        // Очищаем подсветку PRO при выборе
        this.clearAIHintHighlights();

        // Попытка дропа фишки
        const move = this.game.dropPiece(col);
        
        if (move) {
            this.isAnimating = true;
            this.sounds.playDrop();
            this.triggerHaptic('drop');
            this.handleMouseLeave(); // скрываем превью на время анимации

            this.renderMove(move, () => {
                // Снимаем блокировку анимации СРАЗУ после завершения
                this.isAnimating = false;

                // Проверка завершения игры
                if (this.game.winner) {
                    this.handleGameEnd(true);
                } else {
                    this.updateScoreboard();
                    
                    // Если режим против ИИ, передаем управление ИИ
                    if (this.game.gameMode === 'pvai' && this.game.currentPlayer === 2) {
                        this.triggerAIMove();
                    } else {
                        // Возвращаем призрачную фишку для текущей позиции мыши
                        const hoverElement = document.querySelector('.board-cell:hover');
                        if (hoverElement) {
                            this.handleMouseEnter(parseInt(hoverElement.dataset.col));
                        }
                    }
                }
            });
        } else {
            this.triggerHaptic('error');
        }
    }

    /**
     * Отрисовка падения фишки
     */
    renderMove(move, callback) {
        const slot = document.getElementById(`slot-${move.row}-${move.column}`);
        slot.innerHTML = '';
        
        const chip = document.createElement('div');
        chip.className = `chip p${move.player} falling`;
        slot.appendChild(chip);

        setTimeout(() => {
            chip.classList.remove('falling');
            if (callback) callback();
        }, 550);
    }

    /**
     * Логика хода AI игрока
     */
    triggerAIMove() {
        this.isAnimating = true;
        
        // Добавляем эффект мышления на карточку ИИ
        this.p2Card.classList.add('ai-thinking');
        const statusText = this.p2Card.querySelector('.player-status');
        statusText.textContent = 'ИИ думает...';

        // Естественная задержка ходов ИИ (500–800ms)
        const thinkDelay = Math.floor(Math.random() * 300) + 500;

        setTimeout(() => {
            try {
                const aiCol = Connect4AI.getAIMove(this.game, 2, this.game.aiDifficulty);
                
                if (aiCol !== -1) {
                    const move = this.game.dropPiece(aiCol);
                    
                    if (move) {
                        this.sounds.playDrop();
                        this.triggerHaptic('drop');
                        
                        this.renderMove(move, () => {
                            this.p2Card.classList.remove('ai-thinking');
                            this.isAnimating = false;
                            
                            if (this.game.winner) {
                                this.handleGameEnd(true);
                            } else {
                                this.updateScoreboard();
                                // Проверяем текущее наведение
                                const hoverElement = document.querySelector('.board-cell:hover');
                                if (hoverElement) {
                                    this.handleMouseEnter(parseInt(hoverElement.dataset.col));
                                }
                            }
                        });
                    } else {
                        // Резервный выход, если ИИ выбрал некорректный ход
                        this.p2Card.classList.remove('ai-thinking');
                        this.isAnimating = false;
                        this.updateScoreboard();
                    }
                } else {
                    this.p2Card.classList.remove('ai-thinking');
                    this.isAnimating = false;
                    this.updateScoreboard();
                }
            } catch (e) {
                // Гарантированная разблокировка при любой ошибке AI
                console.error('AI move error:', e);
                this.p2Card.classList.remove('ai-thinking');
                this.isAnimating = false;
                this.updateScoreboard();
            }
        }, thinkDelay);
    }

    renderBoard() {
        for (let r = 0; r < this.game.rows; r++) {
            for (let c = 0; c < this.game.cols; c++) {
                const val = this.game.board[r][c];
                const slot = document.getElementById(`slot-${r}-${c}`);
                slot.innerHTML = '';

                if (val !== 0) {
                    const chip = document.createElement('div');
                    chip.className = `chip p${val}`;
                    
                    // Если это выигрышная фишка, подсвечиваем
                    const isWinning = this.game.winningCoords.some(coord => coord[0] === r && coord[1] === c);
                    if (isWinning) {
                        chip.classList.add('winning');
                    }
                    
                    slot.appendChild(chip);
                }
            }
        }
    }

    updateScoreboard() {
        const p2Name = this.p2Card.querySelector('.player-name');
        const p2Status = this.p2Card.querySelector('.player-status');

        if (this.game.gameMode === 'pvai') {
            const diffRussian = this.game.aiDifficulty === 'easy' ? 'Легкий' :
                               this.game.aiDifficulty === 'medium' ? 'Средний' : 'Сложный';
            
            p2Name.textContent = 'Компьютер (ИИ)';
            
            if (this.game.currentPlayer === 2) {
                this.p2Card.classList.add('active');
                this.p1Card.classList.remove('active');
                if (!this.p2Card.classList.contains('ai-thinking')) {
                    p2Status.textContent = 'Ходит... (ИИ)';
                }
            } else {
                this.p1Card.classList.add('active');
                this.p2Card.classList.remove('active');
                p2Status.textContent = `Сложность: ${diffRussian}`;
            }
        } else {
            p2Name.textContent = 'Игрок 2';
            if (this.game.currentPlayer === 1) {
                this.p1Card.classList.add('active');
                this.p2Card.classList.remove('active');
                p2Status.textContent = 'Твой ход';
                
                this.p2Card.querySelector('.player-status').textContent = 'Ожидание';
            } else {
                this.p2Card.classList.add('active');
                this.p1Card.classList.remove('active');
                p2Status.textContent = 'Твой ход';
                
                this.p1Card.querySelector('.player-status').textContent = 'Ожидание';
            }
        }
    }

    handleGameEnd(saveToHistory = true) {
        this.updateScoreboard();
        this.p1Card.classList.remove('active');
        this.p2Card.classList.remove('active');
        this.p2Card.classList.remove('ai-thinking');

        // Подсвечиваем выигрышные фишки
        this.renderBoard();

        // Звук & Вибро
        if (saveToHistory) {
            if (this.game.winner === 'draw') {
                this.sounds.playDraw();
            } else {
                this.sounds.playWin();
                this.triggerHaptic('win');
            }
            this.game.saveGameToHistory();
            this.game.clearActiveSession(); // Очищаем временную сессию, игра закончена
        }

        // Показываем экран результата
        this.resultScreen.classList.add('visible');
        this.analyzeBtn.style.display = 'flex'; // показываем кнопку разбора в основном интерфейсе

        if (this.game.winner === 'draw') {
            this.resultBanner.className = 'result-banner';
            this.resultBanner.textContent = 'Ничья!';
            this.resultSubtitle.textContent = 'Оба игрока показали превосходную тактику! Нажмите кнопку разбора, чтобы посмотреть детальный ИИ-анализ этой партии.';
        } else {
            let winnerText = '';
            if (this.game.gameMode === 'pvai') {
                winnerText = this.game.winner === 1 ? 'Вы (Игрок 1)' : 'Компьютер (ИИ)';
            } else {
                winnerText = this.game.winner === 1 ? 'Игрок 1 (Красный)' : 'Игрок 2 (Желтый)';
            }
            
            this.resultBanner.className = `result-banner p${this.game.winner}-win`;
            this.resultBanner.textContent = `Победа!`;
            this.resultSubtitle.innerHTML = `Поздравляем <strong>${winnerText}</strong> с заслуженной победой в этой упорной битве!<br><br>Хотите узнать свои лучшие ходы и критические ошибки? Запустите ИИ-коуча.`;
        }

        this.updateStatsAndHistory();
    }

    handleRestart() {
        this.sounds.playClick();
        this.game.resetGame();
        this.game.clearActiveSession();
        
        this.isAnimating = false;
        this.resultScreen.classList.remove('visible');
        this.analyzeBtn.style.display = 'none'; // Скрываем разбор
        
        this.buildBoardGrid();
        this.bindBoardEvents(); // Перепривязка событий к новым ячейкам
        
        // Показываем оверлей выбора режима
        this.modeOverlay.classList.add('visible');
        this.difficultySection.style.display = 'none';
        this.modePvPBtn.className = 'btn btn-primary';
        this.modePvAIBtn.className = 'btn btn-secondary';
        
        this.p1Card.classList.remove('active', 'ai-thinking');
        this.p2Card.classList.remove('active', 'ai-thinking');
        this.p2Card.querySelector('.player-name').textContent = 'Игрок 2';
        this.p2Card.querySelector('.player-status').textContent = 'Ожидание';
        
        this.updateStatsAndHistory();
    }

    updateStatsAndHistory() {
        const history = Connect4Game.getGamesHistory();
        
        // 1. Подсчет винрейта
        let p1Wins = 0;
        let p2Wins = 0;
        let draws = 0;

        history.forEach(game => {
            if (game.winner === 1) p1Wins++;
            else if (game.winner === 2) p2Wins++;
            else if (game.winner === 'draw') draws++;
        });

        this.p1WinsVal.textContent = p1Wins;
        this.p2WinsVal.textContent = p2Wins;
        this.drawsVal.textContent = draws;
        this.totalGamesVal.textContent = history.length;

        // 2. Рендеринг списка истории
        this.historyList.innerHTML = '';
        if (history.length === 0) {
            this.historyList.innerHTML = `
                <div class="empty-history">
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                        <path d="M12 2C6.5 2 2 6.5 2 12S6.5 22 12 22 22 17.5 22 12 17.5 2 12 2M12 20C7.6 20 4 16.4 4 12S7.6 4 12 4 20 7.6 20 12 16.4 20 12 20M12.5 7V12.2L17 14.9L16.2 16.1L11 13V7H12.5Z"/>
                    </svg>
                    <span>История игр пуста</span>
                </div>
            `;
            return;
        }

        history.forEach(game => {
            const item = document.createElement('div');
            item.className = 'history-item';
            
            let outcomeText = 'Ничья';
            let winnerIndicatorClass = '';
            
            if (game.winner === 1) {
                outcomeText = game.gameMode === 'pvai' ? 'Победа Игрока' : 'Победа Игрока 1';
                winnerIndicatorClass = 'p1';
            } else if (game.winner === 2) {
                outcomeText = game.gameMode === 'pvai' ? 'Победа ИИ-Оппонента' : 'Победа Игрока 2';
                winnerIndicatorClass = 'p2';
            }

            const difficultyLabel = game.aiDifficulty === 'easy' ? 'Легкий' :
                                    game.aiDifficulty === 'medium' ? 'Средний' : 'Сложный';
            const modeText = game.gameMode === 'pvai' ? `vs ИИ (${difficultyLabel})` : 'PvP Режим';

            item.innerHTML = `
                <div class="history-meta">
                    <span>${game.date}</span>
                    <span style="font-weight: 600; color: var(--accent);">${modeText}</span>
                    <span class="history-moves">Ходов: ${game.movesCount}</span>
                </div>
                <div class="history-outcome">
                    <div class="history-winner">
                        ${game.winner !== 'draw' ? `<div class="history-winner-indicator ${winnerIndicatorClass}"></div>` : ''}
                        <span>${outcomeText}</span>
                    </div>
                </div>
            `;
            
            // Нажатие на прошедшую игру может загружать ее для детального анализа
            item.addEventListener('click', () => {
                this.sounds.playClick();
                this.openHistoricalAnalysis(game);
            });

            this.historyList.appendChild(item);
        });
    }

    handleOpenAnalysis() {
        this.sounds.playClick();
        const currentAnalysis = AICoach.analyzeGame(this.game.moveHistory, this.game.boardHistory, this.game.winner);
        this.renderAnalysisModal(currentAnalysis, false);
    }

    openHistoricalAnalysis(gameRecord) {
        const historicalAnalysis = AICoach.analyzeGame(gameRecord.moveHistory, gameRecord.boardHistory, gameRecord.winner);
        this.renderAnalysisModal(historicalAnalysis, true, gameRecord.date);
    }

    renderAnalysisModal(analysisData, isHistorical = false, recordDate = '') {
        const titleText = isHistorical ? `ИИ-Анализ партии (${recordDate})` : 'ИИ-Разбор текущего матча';
        document.getElementById('analysisModalTitle').innerHTML = `
            <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.5 2 2 6.5 2 12S6.5 22 12 22 22 17.5 22 12 17.5 2 12 2M12 4C14 4 15.6 5.6 15.6 7.6S14 11.2 12 11.2 8.4 9.6 8.4 7.6 10 4 12 4M12 20C9.3 20 6.9 18.6 5.6 16.4C5.6 14.3 9.9 13.1 12 13.1S18.4 14.3 18.4 16.4C17.1 18.6 14.7 20 12 20Z"/>
            </svg>
            ${titleText}
        `;

        const renderPlayerColumn = (playerNum, data) => {
            const containerId = `analysisP${playerNum}`;
            const container = document.getElementById(containerId);
            container.innerHTML = '';

            const stats = data.stats;
            const styleClass = data.style.includes('Агрессивный') ? 'aggressive' : 
                               (data.style.includes('Оборонительный') ? 'defensive' : 'balanced');
            
            const playerLabel = this.game.gameMode === 'pvai' && playerNum === 2 ? 'Компьютер (ИИ)' : `Игрок ${playerNum}`;

            // 1. Шапка игрока
            const header = document.createElement('div');
            header.className = 'analysis-player-header';
            header.innerHTML = `
                <div class="analysis-player-name">
                    <div class="player-indicator p${playerNum}"></div>
                    <span>${playerLabel}</span>
                </div>
                <div class="analysis-style-badge ${styleClass}">${data.style}</div>
            `;
            container.appendChild(header);

            // 2. Сетка микрометрик
            const miniStats = document.createElement('div');
            miniStats.className = 'analysis-stats-mini';
            miniStats.innerHTML = `
                <div class="stat-mini-box">
                    <span class="stat-mini-num good">${stats.threatsCreated}</span>
                    <span class="stat-mini-label">Угроз 3 в ряд</span>
                </div>
                <div class="stat-mini-box">
                    <span class="stat-mini-num neutral">${stats.blocksMade}</span>
                    <span class="stat-mini-label">Защит линий</span>
                </div>
                <div class="stat-mini-box">
                    <span class="stat-mini-num bad">${stats.blunders}</span>
                    <span class="stat-mini-label">Грубых ошибок</span>
                </div>
            `;
            container.appendChild(miniStats);

            // 3. Список ключевых ходов
            const moveListTitle = document.createElement('h4');
            moveListTitle.style.fontSize = '14px';
            moveListTitle.style.fontWeight = '700';
            moveListTitle.style.marginTop = '12px';
            moveListTitle.textContent = 'Ключевые события матча:';
            container.appendChild(moveListTitle);

            const moveList = document.createElement('div');
            moveList.className = 'analysis-move-list';

            const events = [];
            // Соединяем хорошие ходы и ошибки в один массив, сортируя по ходу
            data.goodMoves.forEach(m => events.push({ ...m, isGood: true }));
            data.errors.forEach(m => events.push({ ...m, isGood: false }));
            events.sort((a, b) => a.moveIndex - b.moveIndex);

            if (events.length === 0) {
                moveList.innerHTML = `<div class="analysis-move-empty">Внимательная игра. Критических ошибок или блоков не зафиксировано.</div>`;
            } else {
                events.forEach(evt => {
                    const item = document.createElement('div');
                    item.className = `analysis-move-item ${evt.isGood ? 'good' : 'error'}`;
                    
                    // Переименовываем описание на ИИ, если применимо
                    let desc = evt.desc;
                    if (this.game.gameMode === 'pvai') {
                        desc = desc.replace('соперника', 'Игрока 1');
                        if (playerNum === 2) {
                            desc = desc.replace('Вы ', 'ИИ ').replace('Вы ', 'ИИ ');
                        }
                    }

                    item.innerHTML = `
                        <strong>Х${evt.moveIndex}:</strong>
                        <span>${desc}</span>
                    `;
                    moveList.appendChild(item);
                });
            }
            container.appendChild(moveList);
        };

        // Заполняем колонки игроков
        renderPlayerColumn(1, analysisData[1]);
        renderPlayerColumn(2, analysisData[2]);

        // Рендерим персональные рекомендации
        const recsBox = document.getElementById('analysisRecs');
        
        const labelP1 = this.game.gameMode === 'pvai' ? 'Для Вас (Игрок 1):' : 'Для Игрока 1:';
        const labelP2 = this.game.gameMode === 'pvai' ? 'Для Компьютера (ИИ):' : 'Для Игрока 2:';

        recsBox.innerHTML = `
            <div class="rec-title">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                    <path d="M12,2A10,10,0,1,0,22,12,10,10,0,0,0,12,2Zm1,15H11V11h2Zm0-8H11V7h2Z"/>
                </svg>
                <span>Персональные рекомендации тренера</span>
            </div>
            <div class="recs-container">
                <div class="rec-column">
                    <div class="rec-column-title" style="color: var(--chip-p1)">${labelP1}</div>
                    ${analysisData[1].recommendations.map(r => `<div class="rec-item">${r}</div>`).join('')}
                </div>
                <div class="rec-column">
                    <div class="rec-column-title" style="color: var(--chip-p2)">${labelP2}</div>
                    ${analysisData[2].recommendations.map(r => `<div class="rec-item">${r}</div>`).join('')}
                </div>
            </div>
        `;

        // Открываем модалку
        this.analysisModal.classList.add('active');
    }

    /**
     * Обновляет состояние интерфейса в зависимости от активации PRO-режима
     */
    updateProUI() {
        const isPro = this.game.isProMode;
        const proPanel = document.getElementById('proPanel');
        const proBtn = document.getElementById('proUpgradeBtn');
        const hintBtn = document.getElementById('aiHintBtn');
        const hintLock = document.getElementById('aiHintLock');

        if (isPro) {
            if (proBtn) {
                proBtn.className = 'btn btn-pro-active';
                proBtn.innerHTML = '👑 PRO Режим Активен';
            }
            if (proPanel) {
                proPanel.style.background = 'linear-gradient(135deg, var(--card-bg), rgba(255, 215, 0, 0.08))';
                proPanel.style.borderColor = '#ffd700';
            }
            if (hintBtn) {
                hintBtn.className = 'btn btn-secondary pro-active-btn';
            }
            if (hintLock) {
                hintLock.style.display = 'none';
            }
        } else {
            if (proBtn) {
                proBtn.className = 'btn btn-primary';
                proBtn.style.background = 'linear-gradient(135deg, #ffd700, #ffaa00)';
                proBtn.innerHTML = '👑 Upgrade to Pro';
            }
            if (proPanel) {
                proPanel.style.background = 'linear-gradient(135deg, var(--card-bg), rgba(255, 215, 0, 0.04))';
                proPanel.style.borderColor = 'rgba(255, 215, 0, 0.15)';
            }
            if (hintBtn) {
                hintBtn.className = 'btn btn-secondary';
            }
            if (hintLock) {
                hintLock.style.display = 'inline';
            }
        }
    }

    /**
     * Логика расчета и отображения подсказки хода по ИИ
     */
    triggerAIHint() {
        if (this.game.winner || this.isAnimating) return;
        
        // В режиме против ИИ подсказка полезна только во время хода человека!
        if (this.game.gameMode === 'pvai' && this.game.currentPlayer === 2) return;

        // Расчет лучшего хода текущего игрока с помощью Hard AI
        const bestCol = Connect4AI.getAIMove(this.game, this.game.currentPlayer, 'hard');
        
        if (bestCol !== -1) {
            this.sounds.playClick();
            this.highlightRecommendedColumn(bestCol);
        }
    }

    /**
     * Подсвечивает рекомендованную ИИ колонку
     */
    highlightRecommendedColumn(col) {
        this.clearAIHintHighlights();

        const firstCell = document.querySelector(`.board-cell[data-col="${col}"]`);
        if (firstCell) {
            const rect = firstCell.getBoundingClientRect();
            const parentRect = this.boardGrid.getBoundingClientRect();
            
            // Золотая подсветка колонки
            this.columnHighlight.style.left = `${rect.left - parentRect.left + 16}px`;
            this.columnHighlight.className = 'column-highlight visible pro-hint-col';
        }

        // Золотая пульсирующая призрачная фишка
        const previewChips = this.previewContainer.querySelectorAll('.preview-chip');
        previewChips.forEach((chip, c) => {
            if (c === col) {
                chip.className = 'preview-chip visible pro-hint';
            }
        });
        
        this.triggerHaptic('drop');
    }

    /**
     * Очищает подсветку ходов-подсказок
     */
    clearAIHintHighlights() {
        this.columnHighlight.classList.remove('pro-hint-col');
        const previewChips = this.previewContainer.querySelectorAll('.preview-chip');
        previewChips.forEach(chip => {
            chip.classList.remove('pro-hint');
        });
    }
}
