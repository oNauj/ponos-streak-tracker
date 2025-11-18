const MathUtils = require("../utils/MathUtils");

/**
 * Serviço de lógica de negócio central.
 * Gerencia a atualização de estatísticas, streaks e tempo de estudo.
 */
class StudyTrackerService {
    constructor(dbService, minHoursForStreak = 6) {
        this.db = dbService; // Injeção de dependência do DatabaseService
        this.MIN_HOURS_FOR_STREAK = minHoursForStreak;
    }

    /**
     * Processa o fim de uma sessão de estudo.
     * @param {string} userId O ID do usuário.
     * @param {number} duration A duração da sessão em milissegundos.
     */
    processStudySession(userId, duration) {
        const user = this.db.getUser(userId);
        const now = Date.now();

        // 1. Lógica de Virada de Dia e Streak Check
        if (MathUtils.isNewDay(user.lastStudyDate)) {
            // Se o dia anterior foi registrado (dailyTime > 0), salva no histórico com data
            if (user.dailyTime > 0) {
                const prevDate = user.lastStudyDate ? new Date(user.lastStudyDate) : new Date(now);
                prevDate.setHours(0,0,0,0);
                const dateStr = prevDate.toISOString().slice(0,10);
                if (!Array.isArray(user.history)) user.history = [];
                user.history.push({ date: dateStr, ms: user.dailyTime });
            }
            
            // Verifica a meta de streak do dia anterior
            const msTarget = this.MIN_HOURS_FOR_STREAK * 60 * 60 * 1000;
            
            // A regra mais complexa: só verifica se há um histórico para evitar penalizar o primeiro dia.
            if (user.lastStudyDate !== 0) {
                if (user.dailyTime < msTarget) {
                    // Quebra o streak se a meta de 6h não foi batida
                    console.log(`[STREAK BREAK] Usuário ${userId} perdeu o streak (${MathUtils.formatTime(user.dailyTime)} < ${this.MIN_HOURS_FOR_STREAK}h)`);
                    user.currentStreak = 0; 
                } else {
                    // Incrementa o streak se bateu a meta
                    user.currentStreak += 1;
                }
            }

            user.dailyTime = 0; // Reseta o contador diário
        }

        // 2. Atualiza o Tempo da Sessão Atual
        user.totalTime += duration;
        user.dailyTime += duration;
        user.lastStudyDate = now;

        // 3. Salva no Banco de Dados
        this.db.updateUser(userId, user);
        console.log(`[LOG] Usuário ${userId} salvou +${MathUtils.formatTime(duration)}`);
    }

    /**
     * Retorna estatísticas formatadas para exibição no comando /perfil.
     * @param {string} userId ID do usuário.
     * @param {object} userStats Dados brutos do usuário.
     * @returns {object} Objeto com dados formatados.
     */
    getFormattedStats(userId, userStats) {
        const consistency = MathUtils.calculateConsistency(userStats.history);
        const msTarget = this.MIN_HOURS_FOR_STREAK * 60 * 60 * 1000;
        const percentage = Math.min((userStats.dailyTime / msTarget) * 100, 100).toFixed(1);

        return {
            totalTime: MathUtils.formatTime(userStats.totalTime),
            dailyTime: MathUtils.formatTime(userStats.dailyTime),
            streak: userStats.currentStreak,
            consistency: consistency,
            progressPercentage: percentage,
            targetHours: this.MIN_HOURS_FOR_STREAK,
        };
    }
}

module.exports = StudyTrackerService;