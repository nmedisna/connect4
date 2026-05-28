/**
 * Модуль локального AI-анализатора игры Connect Four (AI Coach)
 */
export class AICoach {
    /**
     * Анализирует завершенную партию игры
     * @param {Object[]} moves - Список ходов: [{player, column, row}]
     * @param {number[][][]} boardHistory - Состояние доски после каждого хода
     * @param {number|string} winner - Победитель (1, 2 или 'draw')
     * @returns {Object} - Структурированный анализ для обоих игроков
     */
    static analyzeGame(moves, boardHistory, winner) {
        const rows = 6;
        const cols = 7;
        const emptyBoard = Array(rows).fill(null).map(() => Array(cols).fill(0));

        // Инициализируем структуры анализа для обоих игроков
        const analysis = {
            1: {
                goodMoves: [],
                errors: [],
                stats: { centerMoves: 0, edgeMoves: 0, threatsCreated: 0, blocksMade: 0, missedBlocks: 0, blunders: 0 },
                style: 'Сбалансированный',
                recommendations: []
            },
            2: {
                goodMoves: [],
                errors: [],
                stats: { centerMoves: 0, edgeMoves: 0, threatsCreated: 0, blocksMade: 0, missedBlocks: 0, blunders: 0 },
                style: 'Сбалансированный',
                recommendations: []
            }
        };

        if (!moves || moves.length === 0) return analysis;

        // Пошагово воспроизводим игру
        for (let t = 0; t < moves.length; t++) {
            const move = moves[t];
            const p = move.player;
            const opp = p === 1 ? 2 : 1;
            
            const prevBoard = t === 0 ? emptyBoard : boardHistory[t - 1];
            const currentBoard = boardHistory[t];

            // 1. Определение доступных клеток на данный ход
            const playableCells = [];
            for (let c = 0; c < cols; c++) {
                // Ищем нижнюю свободную ячейку
                let targetRow = -1;
                for (let r = rows - 1; r >= 0; r--) {
                    if (prevBoard[r][c] === 0) {
                        targetRow = r;
                        break;
                    }
                }
                if (targetRow !== -1) {
                    playableCells.push({ r: targetRow, c: c });
                }
            }

            // 2. Поиск выигрышных ходов для текущего игрока и соперника на данной доске
            const winningCellsP = playableCells.filter(cell => this.wouldWin(prevBoard, cell.r, cell.c, p));
            const winningCellsOpp = playableCells.filter(cell => this.wouldWin(prevBoard, cell.r, cell.c, opp));

            const playedCol = move.column;
            const playedRow = move.row;

            // --- АНАЛИЗ ХОДА ---

            // А. Проверка на упущенную победу (Missed Win)
            if (winningCellsP.length > 0) {
                const madeWinningMove = winningCellsP.some(cell => cell.c === playedCol);
                if (!madeWinningMove) {
                    analysis[p].errors.push({
                        moveIndex: t + 1,
                        column: playedCol,
                        type: 'missed_win',
                        desc: `Упущенная победа! Был ход в колонку ${winningCellsP[0].c + 1}, который сразу приносил выигрыш.`
                    });
                    analysis[p].stats.blunders++;
                }
            }

            // Б. Проверка на блокировку победного хода соперника (Missed Block / Successful Block)
            if (winningCellsOpp.length > 0) {
                const blockedWinningMove = winningCellsOpp.some(cell => cell.c === playedCol);
                if (blockedWinningMove) {
                    analysis[p].goodMoves.push({
                        moveIndex: t + 1,
                        column: playedCol,
                        type: 'victory_block',
                        desc: `Критический блок! Вы заблокировали победный ход соперника в колонку ${playedCol + 1}.`
                    });
                    analysis[p].stats.blocksMade++;
                } else {
                    analysis[p].errors.push({
                        moveIndex: t + 1,
                        column: playedCol,
                        type: 'missed_victory_block',
                        desc: `Зевок победы соперника! Нужно было срочно заблокировать колонку ${winningCellsOpp[0].c + 1}.`
                    });
                    analysis[p].stats.missedBlocks++;
                }
            }

            // В. Создание или блокировка обычных угроз 3-в-ряд (без немедленной победы в 1 ход)
            // Посчитаем количество 3-в-ряд с открытыми концами до и после хода
            const threatsBeforeOpp = this.countThreats(prevBoard, opp);
            const threatsAfterOpp = this.countThreats(currentBoard, opp);
            
            // Если количество угроз соперника уменьшилось, значит мы заблокировали его 3-в-ряд
            if (threatsAfterOpp < threatsBeforeOpp && winningCellsOpp.length === 0) {
                analysis[p].goodMoves.push({
                    moveIndex: t + 1,
                    column: playedCol,
                    type: 'threat_block',
                    desc: `Хорошая защита. Вы заблокировали построение 3 в ряд соперника в колонке ${playedCol + 1}.`
                });
                analysis[p].stats.blocksMade++;
            }

            const threatsBeforeP = this.countThreats(prevBoard, p);
            const threatsAfterP = this.countThreats(currentBoard, p);
            
            // Если количество наших угроз увеличилось, значит мы создали угрозу 3-в-ряд
            if (threatsAfterP > threatsBeforeP) {
                analysis[p].goodMoves.push({
                    moveIndex: t + 1,
                    column: playedCol,
                    type: 'threat_created',
                    desc: `Отличный атакующий ход! Создана угроза 3 в ряд в колонке ${playedCol + 1}.`
                });
                analysis[p].stats.threatsCreated++;
            }

            // Г. Проверка на подставу (Blunder Setup)
            // Если текущий ход игрока P позволяет сопернику Opp сходить прямо поверх него и сразу выиграть
            if (playedRow > 0) {
                const cellAbove = { r: playedRow - 1, c: playedCol };
                if (this.wouldWin(currentBoard, cellAbove.r, cellAbove.c, opp)) {
                    analysis[p].errors.push({
                        moveIndex: t + 1,
                        column: playedCol,
                        type: 'blunder_setup',
                        desc: `Критическая ошибка (подстава)! Вы сходили в колонку ${playedCol + 1}, позволив сопернику следующим же ходом выиграть партию прямо над вами.`
                    });
                    analysis[p].stats.blunders++;
                }
            }

            // Д. Контроль центра (Center Control)
            if (playedCol === 3) {
                analysis[p].stats.centerMoves++;
                // Если это ранний ход (первые 8 ходов партии)
                if (t < 8) {
                    analysis[p].goodMoves.push({
                        moveIndex: t + 1,
                        column: playedCol,
                        type: 'center_control',
                        desc: `Контроль центра. Занятие центрального столбца на ранней стадии игры.`
                    });
                }
            } else if (playedCol === 0 || playedCol === 6) {
                analysis[p].stats.edgeMoves++;
                // Если ходов мало, а игрок ходит по самым краям, когда центр пустой
                if (t < 10 && this.getCenterChipsCount(prevBoard) < 3) {
                    analysis[p].errors.push({
                        moveIndex: t + 1,
                        column: playedCol,
                        type: 'weak_edge_play',
                        desc: `Пассивная игра на фланге. Ранние ходы по краям (колонка ${playedCol + 1}) менее эффективны, пока центр свободен.`
                    });
                }
            }
        }

        // --- ОПРЕДЕЛЕНИЕ СТИЛЯ И ФОРМИРОВАНИЕ РЕКОМЕНДАЦИЙ ---
        for (const pKey of [1, 2]) {
            const p = parseInt(pKey);
            const stats = analysis[p].stats;
            const totalMoves = moves.filter(m => m.player === p).length || 1;

            // Классификация стиля игры
            const attackRatio = stats.threatsCreated / totalMoves;
            const totalDefenseScenarios = stats.blocksMade + stats.missedBlocks;
            const defenseRatio = totalDefenseScenarios > 0 ? stats.blocksMade / totalDefenseScenarios : 0.5;

            if (attackRatio > 0.25 && defenseRatio < 0.4) {
                analysis[p].style = 'Агрессивный';
            } else if (defenseRatio > 0.7 && attackRatio < 0.15) {
                analysis[p].style = 'Оборонительный (Пассивный)';
            } else {
                analysis[p].style = 'Сбалансированный';
            }

            // Формирование советов
            const recs = [];
            
            // Анализ критических промахов
            if (stats.blunders > 0) {
                recs.push('**Внимание перед ходом**: Всегда проверяйте, не дает ли ваш ход сопернику возможность сходить прямо над вашей фишкой для победы. Это самая частая тактическая ошибка в игре.');
            }
            
            if (stats.missedBlocks > 0) {
                recs.push('**Фокус на защите**: Вы пропустили прямую победную угрозу соперника. Перед каждым ходом сканируйте доску на наличие линий соперника из 3 фишек.');
            }

            // Анализ центральной линии
            const centerRatio = stats.centerMoves / totalMoves;
            if (centerRatio < 0.15) {
                recs.push('**Захватывайте центр**: Вы мало играли в центральном столбце (4-й столбец). Контроль центра дает возможность строить линии во всех направлениях (горизонталь, вертикаль, обе диагонали).');
            } else if (centerRatio > 0.4) {
                recs.push('**Гибкость на флангах**: Вы очень активно играли в центре. Не забывайте развивать атаки во 2-м, 3-м, 5-м и 6-м столбцах, чтобы растянуть оборону соперника.');
            }

            // Стилевые рекомендации
            if (analysis[p].style === 'Агрессивный') {
                recs.push('**Сбалансируйте риск**: Вы отлично создаете угрозы, но часто забываете про защиту. Замедляйте темп игры, если у соперника назревает контратака.');
            } else if (analysis[p].style === 'Оборонительный (Пассивный)') {
                recs.push('**Проявляйте инициативу**: Вы хорошо защищаетесь, но почти не создаете собственных угроз. Старайтесь строить свои "вилки" (двойные угрозы), вынуждая соперника защищаться.');
            } else {
                if (recs.length < 2) {
                    recs.push('**Создавайте "вилки" (Double Threats)**: Старайтесь выстраивать горизонтальные и диагональные линии так, чтобы у них было два открытых конца. Заблокировать оба конца одним ходом невозможно.');
                }
            }

            // Рекомендация по умолчанию, если советов мало
            if (recs.length < 2) {
                recs.push('**Думайте на ход вперед**: Старайтесь не просто реагировать на последний ход соперника, а предугадывать его ответную реакцию на ваши выпады.');
            }

            analysis[p].recommendations = recs.slice(0, 3); // Выбираем топ-3 рекомендации
        }

        return analysis;
    }

    /**
     * Проверяет, победит ли игрок, если сделает ход в указанную ячейку
     */
    static wouldWin(board, r, c, player) {
        // Временная копия
        const tempBoard = board.map(row => [...row]);
        tempBoard[r][c] = player;

        const rows = board.length;
        const cols = board[0].length;

        // Встроенный быстрый чек победы для конкретной клетки
        const directions = [
            [[0, 1], [0, -1]], // Горизонталь
            [[1, 0], [-1, 0]], // Вертикаль
            [[1, 1], [-1, -1]], // Диагональ вниз-вправо
            [[1, -1], [-1, 1]]  // Диагональ вверх-вправо
        ];

        for (const dir of directions) {
            let count = 1;
            for (const [dr, dc] of dir) {
                let nr = r + dr;
                let nc = c + dc;
                while (nr >= 0 && nr < rows && nc >= 0 && nc < cols && tempBoard[nr][nc] === player) {
                    count++;
                    nr += dr;
                    nc += dc;
                }
            }
            if (count >= 4) return true;
        }

        return false;
    }

    /**
     * Считает количество "угроз 3 в ряд" (линий из 3 фишек одного цвета, где четвертая ячейка свободна)
     */
    static countThreats(board, player) {
        const rows = board.length;
        const cols = board[0].length;
        let threatsCount = 0;

        // Сканируем все возможные отрезки по 4 клетки на доске
        const checkSegment = (cells) => {
            let pChips = 0;
            let emptyCount = 0;
            let emptyCell = null;

            for (const [r, c] of cells) {
                if (board[r][c] === player) {
                    pChips++;
                } else if (board[r][c] === 0) {
                    emptyCount++;
                    emptyCell = { r, c };
                }
            }

            // Если в сегменте 3 фишки игрока и 1 пустая клетка
            if (pChips === 3 && emptyCount === 1) {
                // Проверим, является ли пустая клетка доступной для хода
                // (клетка на дне или под ней есть фишка)
                const isPlayable = emptyCell.r === rows - 1 || board[emptyCell.r + 1][emptyCell.c] !== 0;
                if (isPlayable) {
                    threatsCount++;
                }
            }
        };

        // Горизонтали
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols - 3; c++) {
                checkSegment([[r, c], [r, c + 1], [r, c + 2], [r, c + 3]]);
            }
        }

        // Вертикали
        for (let r = 0; r < rows - 3; r++) {
            for (let c = 0; c < cols; c++) {
                checkSegment([[r, c], [r + 1, c], [r + 2, c], [r + 3, c]]);
            }
        }

        // Диагонали вниз-вправо
        for (let r = 0; r < rows - 3; r++) {
            for (let c = 0; c < cols - 3; c++) {
                checkSegment([[r, c], [r + 1, c + 1], [r + 2, c + 2], [r + 3, c + 3]]);
            }
        }

        // Диагонали вверх-вправо
        for (let r = 3; r < rows; r++) {
            for (let c = 0; c < cols - 3; c++) {
                checkSegment([[r, c], [r - 1, c + 1], [r - 2, c + 2], [r - 3, c + 3]]);
            }
        }

        return threatsCount;
    }

    /**
     * Считает общее число фишек в центральном столбце (3-й индекс)
     */
    static getCenterChipsCount(board) {
        let count = 0;
        for (let r = 0; r < board.length; r++) {
            if (board[r][3] !== 0) {
                count++;
            }
        }
        return count;
    }
}

/**
 * Класс искусственного интеллекта для ходов в игре Connect Four
 */
export class Connect4AI {
    /**
     * Выбирает ход для ИИ на основе выбранного уровня сложности
     * @param {Connect4Game} game - Объект текущей игры
     * @param {number} player - Игрок ИИ (2)
     * @param {string} difficulty - Сложность: 'easy', 'medium', 'hard'
     * @returns {number} - Номер выбранной колонки
     */
    static getAIMove(game, player, difficulty) {
        const board = game.board;
        const validMoves = game.getValidMoves();
        if (validMoves.length === 0) return -1;

        const opp = player === 1 ? 2 : 1;

        if (difficulty === 'easy') {
            return this.getEasyMove(board, player, opp, validMoves);
        } else if (difficulty === 'medium') {
            return this.getMediumMove(board, player, opp, validMoves);
        } else {
            return this.getHardMove(board, player, opp, validMoves);
        }
    }

    /**
     * Легкий режим:
     * - Если может выиграть в 1 ход — выигрывает.
     * - Если соперник может выиграть в 1 ход — блокирует.
     * - Иначе делает случайный ход.
     */
    static getEasyMove(board, player, opp, validMoves) {
        // 1. Можем ли выиграть сами прямо сейчас?
        for (const col of validMoves) {
            const row = this.getLandingRow(board, col);
            if (AICoach.wouldWin(board, row, col, player)) {
                return col;
            }
        }

        // 2. Может ли выиграть соперник прямо сейчас? Блокируем!
        for (const col of validMoves) {
            const row = this.getLandingRow(board, col);
            if (AICoach.wouldWin(board, row, col, opp)) {
                return col;
            }
        }

        // 3. Случайный ход
        const randIndex = Math.floor(Math.random() * validMoves.length);
        return validMoves[randIndex];
    }

    /**
     * Средний режим:
     * - Правила легкого режима (выигрыш/блок в 1 ход).
     * - Бонусы за центр (col 3: +10, cols 2/4: +5).
     * - Пенальти за края (col 0/6: -10).
     * - Бонусы за создание 3-в-ряд и 2-в-ряд.
     * - Избегает подстав (ходы, которые позволяют сопернику выиграть следующим ходом).
     */
    static getMediumMove(board, player, opp, validMoves) {
        // 1. Можем ли выиграть сами?
        for (const col of validMoves) {
            const row = this.getLandingRow(board, col);
            if (AICoach.wouldWin(board, row, col, player)) {
                return col;
            }
        }

        // 2. Может ли выиграть соперник? Блокируем!
        for (const col of validMoves) {
            const row = this.getLandingRow(board, col);
            if (AICoach.wouldWin(board, row, col, opp)) {
                return col;
            }
        }

        // 3. Оценка ходов
        let bestScore = -Infinity;
        let bestMoves = [];

        for (const col of validMoves) {
            const row = this.getLandingRow(board, col);
            let score = 0;

            // Веса столбцов
            if (col === 3) score += 10;
            else if (col === 2 || col === 4) score += 5;
            else if (col === 0 || col === 6) score -= 10;

            // Проверка подставы: если наш ход позволит оппоненту выиграть следующим ходом в этой же колонке
            if (row > 0) {
                if (AICoach.wouldWin(board, row - 1, col, opp)) {
                    score -= 50; // Жесткое пенальти!
                }
            }

            // Симулируем ход на временной доске
            const tempBoard = board.map(r => [...r]);
            tempBoard[row][col] = player;

            // Оцениваем количество угроз 3-в-ряд и 2-в-ряд для себя
            const threatsAfter = AICoach.countThreats(tempBoard, player);
            const threatsBefore = AICoach.countThreats(board, player);
            if (threatsAfter > threatsBefore) {
                score += 15; // Создаем 3 в ряд
            }

            // Проверяем 2-в-ряд
            const twoInARowAfter = this.countLinesOfSize(tempBoard, player, 2);
            const twoInARowBefore = this.countLinesOfSize(board, player, 2);
            if (twoInARowAfter > twoInARowBefore) {
                score += 8;
            }

            // Оцениваем блокировку 3-в-ряд оппонента
            const oppThreatsBefore = AICoach.countThreats(board, opp);
            const oppThreatsAfter = AICoach.countThreats(tempBoard, opp);
            if (oppThreatsAfter < oppThreatsBefore) {
                score += 12; // Заблокировали 3 в ряд соперника
            }

            if (score > bestScore) {
                bestScore = score;
                bestMoves = [col];
            } else if (score === bestScore) {
                bestMoves.push(col);
            }
        }

        const randIndex = Math.floor(Math.random() * bestMoves.length);
        return bestMoves[randIndex];
    }

    /**
     * Сложный режим: Минимакс с Альфа-Бета отсечением
     */
    static getHardMove(board, player, opp, validMoves) {
        let bestScore = -Infinity;
        // Оптимальный порядок перебора столбцов от центра к краям
        const moveOrder = [3, 2, 4, 1, 5, 0, 6];
        const orderedMoves = validMoves.sort((a, b) => moveOrder.indexOf(a) - moveOrder.indexOf(b));
        
        let bestMove = orderedMoves[0];

        // Глубина поиска 5 оптимальна по скорости и силе
        const depth = 5;

        for (const col of orderedMoves) {
            const row = this.getLandingRow(board, col);
            
            // Временная копия
            const tempBoard = board.map(r => [...r]);
            tempBoard[row][col] = player;

            // Сразу проверяем победу
            if (AICoach.wouldWin(board, row, col, player)) {
                return col;
            }

            // Запускаем минимакс для хода оппонента (минимизирующий игрок)
            const score = this.minimax(tempBoard, depth - 1, false, -Infinity, Infinity, player, opp);

            if (score > bestScore) {
                bestScore = score;
                bestMove = col;
            }
        }

        return bestMove;
    }

    static minimax(board, depth, isMaximizing, alpha, beta, player, opp) {
        // Проверяем терминальные состояния
        const winInfo = this.checkBoardWinner(board);
        if (winInfo) {
            if (winInfo === player) return 100000 + depth; // Быстрая победа лучше
            if (winInfo === opp) return -100000 - depth; // Медленное поражение лучше
        }
        if (this.isBoardFull(board)) return 0;
        if (depth === 0) {
            return this.evaluateBoard(board, player, opp);
        }

        const validMoves = [];
        for (let c = 0; c < 7; c++) {
            if (board[0][c] === 0) validMoves.push(c);
        }

        // Упорядочивание ходов для ускорения альфа-бета
        const moveOrder = [3, 2, 4, 1, 5, 0, 6];
        const orderedMoves = validMoves.sort((a, b) => moveOrder.indexOf(a) - moveOrder.indexOf(b));

        if (isMaximizing) {
            let maxEval = -Infinity;
            for (const col of orderedMoves) {
                const row = this.getLandingRow(board, col);
                const tempBoard = board.map(r => [...r]);
                tempBoard[row][col] = player;

                const evaluation = this.minimax(tempBoard, depth - 1, false, alpha, beta, player, opp);
                maxEval = Math.max(maxEval, evaluation);
                alpha = Math.max(alpha, evaluation);
                if (beta <= alpha) break; // Альфа-бета отсечение
            }
            return maxEval;
        } else {
            let minEval = Infinity;
            for (const col of orderedMoves) {
                const row = this.getLandingRow(board, col);
                const tempBoard = board.map(r => [...r]);
                tempBoard[row][col] = opp;

                const evaluation = this.minimax(tempBoard, depth - 1, true, alpha, beta, player, opp);
                minEval = Math.min(minEval, evaluation);
                beta = Math.min(beta, evaluation);
                if (beta <= alpha) break; // Альфа-бета отсечение
            }
            return minEval;
        }
    }

    /**
     * Эвристическая оценка состояния доски для Hard AI
     */
    static evaluateBoard(board, player, opp) {
        let score = 0;

        // 1. Оценка фишек в центральном столбце (важнейший элемент дебюта/миттельшпиля)
        for (let r = 0; r < 6; r++) {
            if (board[r][3] === player) score += 4;
            else if (board[r][3] === opp) score -= 4;
        }

        // 2. Сканируем все сегменты по 4 клетки на доске
        const rows = 6;
        const cols = 7;

        const evaluateSegment = (cells) => {
            let pCount = 0;
            let oppCount = 0;
            let emptyCount = 0;

            for (const [r, c] of cells) {
                if (board[r][c] === player) pCount++;
                else if (board[r][c] === opp) oppCount++;
                else emptyCount++;
            }

            if (pCount === 4) return 10000;
            if (pCount === 3 && emptyCount === 1) return 100;
            if (pCount === 2 && emptyCount === 2) return 10;

            if (oppCount === 4) return -10000;
            if (oppCount === 3 && emptyCount === 1) return -100;
            if (oppCount === 2 && emptyCount === 2) return -10;

            return 0;
        };

        // Горизонтали
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols - 3; c++) {
                score += evaluateSegment([[r, c], [r, c + 1], [r, c + 2], [r, c + 3]]);
            }
        }

        // Вертикали
        for (let r = 0; r < rows - 3; r++) {
            for (let c = 0; c < cols; c++) {
                score += evaluateSegment([[r, c], [r + 1, c], [r + 2, c], [r + 3, c]]);
            }
        }

        // Диагонали вниз-вправо
        for (let r = 0; r < rows - 3; r++) {
            for (let c = 0; c < cols - 3; c++) {
                score += evaluateSegment([[r, c], [r + 1, c + 1], [r + 2, c + 2], [r + 3, c + 3]]);
            }
        }

        // Диагонали вверх-вправо
        for (let r = 3; r < rows; r++) {
            for (let c = 0; c < cols - 3; c++) {
                score += evaluateSegment([[r, c], [r - 1, c + 1], [r - 2, c + 2], [r - 3, c + 3]]);
            }
        }

        return score;
    }

    // --- ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ДЛЯ AI ---

    static getLandingRow(board, col) {
        for (let r = 5; r >= 0; r--) {
            if (board[r][col] === 0) return r;
        }
        return -1;
    }

    static isBoardFull(board) {
        return board[0].every(cell => cell !== 0);
    }

    static checkBoardWinner(board) {
        const rows = 6;
        const cols = 7;
        
        // Горизонтали
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols - 3; c++) {
                const val = board[r][c];
                if (val !== 0 && val === board[r][c + 1] && val === board[r][c + 2] && val === board[r][c + 3]) {
                    return val;
                }
            }
        }
        // Вертикали
        for (let r = 0; r < rows - 3; r++) {
            for (let c = 0; c < cols; c++) {
                const val = board[r][c];
                if (val !== 0 && val === board[r + 1][c] && val === board[r + 2][c] && val === board[r + 3][c]) {
                    return val;
                }
            }
        }
        // Диагональ вниз-вправо
        for (let r = 0; r < rows - 3; r++) {
            for (let c = 0; c < cols - 3; c++) {
                const val = board[r][c];
                if (val !== 0 && val === board[r + 1][c + 1] && val === board[r + 2][c + 2] && val === board[r + 3][c + 3]) {
                    return val;
                }
            }
        }
        // Диагональ вверх-вправо
        for (let r = 3; r < rows; r++) {
            for (let c = 0; c < cols - 3; c++) {
                const val = board[r][c];
                if (val !== 0 && val === board[r - 1][c + 1] && val === board[r - 2][c + 2] && val === board[r - 3][c + 3]) {
                    return val;
                }
            }
        }
        return null;
    }

    /**
     * Считает количество линий определенного размера для игрока (для среднего уровня сложности)
     */
    static countLinesOfSize(board, player, size) {
        const rows = 6;
        const cols = 7;
        let count = 0;

        const checkSegment = (cells) => {
            let pCount = 0;
            let emptyCount = 0;
            for (const [r, c] of cells) {
                if (board[r][c] === player) pCount++;
                else if (board[r][c] === 0) emptyCount++;
            }
            if (pCount === size && emptyCount === (4 - size)) {
                count++;
            }
        };

        // Горизонтали, вертикали, диагонали...
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols - 3; c++) {
                checkSegment([[r, c], [r, c + 1], [r, c + 2], [r, c + 3]]);
            }
        }
        for (let r = 0; r < rows - 3; r++) {
            for (let c = 0; c < cols; c++) {
                checkSegment([[r, c], [r + 1, c], [r + 2, c], [r + 3, c]]);
            }
        }
        for (let r = 0; r < rows - 3; r++) {
            for (let c = 0; c < cols - 3; c++) {
                checkSegment([[r, c], [r + 1, c + 1], [r + 2, c + 2], [r + 3, c + 3]]);
            }
        }
        for (let r = 3; r < rows; r++) {
            for (let c = 0; c < cols - 3; c++) {
                checkSegment([[r, c], [r - 1, c + 1], [r - 2, c + 2], [r - 3, c + 3]]);
            }
        }
        return count;
    }
}

