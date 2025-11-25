// Arquivo: services/StudyTrackerService.js

class StudyTrackerService {
    constructor(db) {
        this.db = db;
        // Exemplo: 6 horas como meta mínima para manter o streak
        this.MIN_HOURS_FOR_STREAK = 6; 
    }

    /**
     * Processa o fim de uma sessão de estudo.
     * @param {string} userId O ID do usuário.
     * @param {number} duration A duração da sessão em milissegundos.
     */
    processStudySession(userId, duration) {
        const user = this.db.getUser(userId);
        
        const now = new Date();
        const nowTs = now.getTime();
        
        // 1. Normaliza o timestamp atual para 00:00:00 (Início do dia de hoje)
        const todayZero = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        // 2. Normaliza o timestamp do último estudo para 00:00:00
        const lastStudyDateObj = new Date(user.lastStudyDate || nowTs);
        const lastZero = new Date(lastStudyDateObj.getFullYear(), lastStudyDateObj.getMonth(), lastStudyDateObj.getDate());

        // Diferença em dias inteiros no calendário.
        const diffTime = todayZero.getTime() - lastZero.getTime();
        const diffDays = Math.round(diffTime / (1000 * 3600 * 24)); 

        if (diffDays > 0) {
            // A) Salvar o histórico do último dia (antes de zerar o dailyTime)
            if (user.dailyTime > 0) {
                const yyyy = lastZero.getFullYear();
                const mm = String(lastZero.getMonth() + 1).padStart(2, '0');
                const dd = String(lastZero.getDate()).padStart(2, '0');
                const dateStr = `${yyyy}-${mm}-${dd}`; 

                user.history.push({ date: dateStr, ms: user.dailyTime });
            }

            // B) Cálculo do Streak (Com base no dailyTime que ACABOU de ser salvo)
            const msTarget = this.MIN_HOURS_FOR_STREAK * 60 * 60 * 1000;
            
            if (diffDays === 1) {
                if (user.dailyTime >= msTarget) {
                    user.currentStreak += 1;
                } else {
                    user.currentStreak = 0; 
                }
            } else {
                user.currentStreak = 0;
            }

            // C) Resetar o dailyTime para o novo dia (Hoje)
            user.dailyTime = 0;
        }

        // 4. Adicionar o tempo da sessão atual
        user.dailyTime = (user.dailyTime || 0) + duration;
        user.totalTime = (user.totalTime || 0) + duration; 
        user.lastStudyDate = nowTs; 
        
        // ⚠️ IMPORTANTE PARA O CRONOGRAMA: 
        // Você DEVE começar a logar as sessões individuais em 'rawSessions' 
        // para que a análise de intervalo funcione.
        // Se você não logar, esta função retornará um array vazio.
        // Ex:
        // user.rawSessions.push({ startTime_ms: nowTs - duration, duration_ms: duration }); 

        this.db.updateUser(userId, user);
    }
    
    // --------------------------------------------------------------------------
    // ⚠️ NOVO MÉTODO NECESSÁRIO PARA A ANÁLISE DE CRONOGRAMA (AGORA DEFINIDO)
    // --------------------------------------------------------------------------
    
    /**
     * Retorna todas as sessões de estudo registradas (início e duração) para a análise de cronograma.
     * * ATENÇÃO: Se o seu sistema de log de sessões não armazena o histórico 
     * detalhado (startTime_ms, duration_ms), esta função retornará um array vazio, 
     * e o cronograma mostrará "Sem dados de sessões".
     * * @param {string} userId O ID do usuário.
     * @param {number} days O número de dias a serem analisados.
     * @returns {Array<{startTime_ms: number, duration_ms: number}>} Array de todas as sessões no período.
     */
    getStudySessionsForIntervalAnalysis(userId, days) {
        const user = this.db.getUser(userId);
        
        // Se você implementou o log de sessões no objeto user (ex: user.rawSessions), 
        // você o retornaria aqui.
        // Por enquanto, retornamos um array vazio ou o campo de sessões existente:
        
        if (user && user.rawSessions && Array.isArray(user.rawSessions)) {
            // Filtrar sessões apenas dentro do período dos últimos 'days'
            const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
            return user.rawSessions.filter(session => session.startTime_ms >= cutoffTime);
        }
        
        // Retorno padrão se a estrutura não existir ou não estiver logando detalhadamente.
        return []; 
    }

    // --------------------------------------------------------------------------
    
    getFormattedStats(userId, rawStats) {
        const msToHours = (ms) => (ms / (1000 * 60 * 60)).toFixed(2);
        const totalHours = msToHours(rawStats.totalTime);
        const dailyHours = msToHours(rawStats.dailyTime);
        const targetHours = this.MIN_HOURS_FOR_STREAK;
        const progressPercentage = Math.min(100, Math.round((rawStats.dailyTime / (targetHours * 3600 * 1000)) * 100));
        
        return {
            totalTime: `${totalHours}h`,
            dailyTime: `${dailyHours}h`,
            targetHours: targetHours,
            progressPercentage: progressPercentage,
            consistency: `Consistência: N/A%` 
        };
    }
}

module.exports = StudyTrackerService;