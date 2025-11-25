// Arquivo: services/StudyTrackerService.js

// Assumindo que StudyTrackerService tem acesso ao objeto 'db' (DatabaseService)
// e à constante MIN_HOURS_FOR_STREAK

class StudyTrackerService {
    constructor(db) {
        this.db = db;
        // Exemplo: 6 horas como meta mínima para manter o streak
        this.MIN_HOURS_FOR_STREAK = 6; 
    }

    /**
     * Processa o fim de uma sessão de estudo.
     * **CORREÇÃO: Lógica robusta de virada de dia (00:00:00) e cálculo de streak.**
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

        // Diferença em dias inteiros no calendário. Math.round é crucial para DSTs.
        const diffTime = todayZero.getTime() - lastZero.getTime();
        const diffDays = Math.round(diffTime / (1000 * 3600 * 24)); 

        console.log(`[DEBUG] User: ${userId} | DiffDays: ${diffDays} | Streak Atual: ${user.currentStreak}`);

        // 3. Lógica de "Fechar o Caixa" do dia anterior (Se o dia virou)
        if (diffDays > 0) {
            // A) Salvar o histórico do último dia (antes de zerar o dailyTime)
            if (user.dailyTime > 0) {
                const yyyy = lastZero.getFullYear();
                const mm = String(lastZero.getMonth() + 1).padStart(2, '0');
                const dd = String(lastZero.getDate()).padStart(2, '0');
                const dateStr = `${yyyy}-${mm}-${dd}`; 

                // Adiciona o dailyTime do dia anterior ao history.
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
                // Se diffDays > 1, pulou dias inteiros
                user.currentStreak = 0;
            }

            // C) Resetar o dailyTime para o novo dia (Hoje)
            user.dailyTime = 0;
        }

        // 4. Adicionar o tempo da sessão atual
        user.dailyTime = (user.dailyTime || 0) + duration;
        user.totalTime = (user.totalTime || 0) + duration; // Garante que o totalTime cresce
        user.lastStudyDate = nowTs; // Atualiza o timestamp da última atividade

        // Salvar no Banco
        this.db.updateUser(userId, user);
    }
    
    // ... (Outros métodos, como getFormattedStats, mantido para o perfil)
    getFormattedStats(userId, rawStats) {
        // Implementação mock para o exemplo
        const msToHours = (ms) => (ms / (1000 * 60 * 60)).toFixed(2);
        const totalHours = msToHours(rawStats.totalTime);
        const dailyHours = msToHours(rawStats.dailyTime);
        const targetHours = this.MIN_HOURS_FOR_STREAK;
        const progressPercentage = Math.min(100, Math.round((rawStats.dailyTime / (targetHours * 3600 * 1000)) * 100));

        // Aqui você pode adicionar o cálculo de consistência para o resumo, se quiser!
        
        return {
            totalTime: `${totalHours}h`,
            dailyTime: `${dailyHours}h`,
            targetHours: targetHours,
            progressPercentage: progressPercentage,
            // Consistency aqui pode ser N/A ou calculada com 30 dias usando MathUtils
            consistency: `Consistência: N/A%` 
        };
    }
}
module.exports = StudyTrackerService;