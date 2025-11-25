// Arquivo: utils/TimeIntervalUtils.js

class TimeIntervalUtils {
    /**
     * Analisa o array de sessões para encontrar os blocos de tempo mais estudados
     * e os formata em intervalos.
     * * @param {Array<{startTime_ms: number, duration_ms: number}>} sessionsData Array de todas as sessões dos últimos 30 dias.
     * @param {number} totalDays O número total de dias neste período (normalmente 30).
     * @returns {string} Uma string formatada com os blocos de estudo mais ativos.
     */
    static analyzeBusiestIntervals(sessionsData, totalDays) {
        if (!sessionsData || sessionsData.length === 0) {
            return "Sem dados de sessões para análise de cronograma. (Necessário 30 dias de log).";
        }

        // 1. Agrega o tempo estudado por HORA do dia (0 a 23)
        const hourlyMinutes = new Array(24).fill(0);

        for (const session of sessionsData) {
            let currentMs = session.startTime_ms;
            const endTimeMs = session.startTime_ms + session.duration_ms;

            // Itera minuto a minuto para garantir que o tempo seja contabilizado na hora correta
            while (currentMs < endTimeMs) {
                const date = new Date(currentMs);
                const hour = date.getHours();
                
                // Calcula o tempo em minutos até o final da sessão ou até a virada da próxima hora
                const minutesToEndOfHour = 60 - date.getMinutes();
                const minutesRemainingInSession = (endTimeMs - currentMs) / (1000 * 60);
                
                const minutesToAdd = Math.min(minutesToEndOfHour, minutesRemainingInSession);
                
                // Adiciona os minutos
                hourlyMinutes[hour] += minutesToAdd;
                
                // Avança para o final da hora ou final da sessão
                currentMs += minutesToAdd * 60 * 1000;
            }
        }
        
        // 2. Converte para Média Diária (em Minutos) por Hora
        const averageHourlyMinutes = hourlyMinutes.map(totalMinutes => totalMinutes / totalDays);

        // 3. Encontra os Blocos Ativos (Threshold: 30 min/dia)
        let busiestIntervals = [];
        let inInterval = false;
        let startHour = -1;
        const thresholdMinutes = 30; // Média de 30 minutos/dia naquela hora = intervalo ativo
        
        for (let hour = 0; hour < 24; hour++) {
            const averageMinutes = averageHourlyMinutes[hour];
            
            if (averageMinutes >= thresholdMinutes) {
                if (!inInterval) {
                    inInterval = true;
                    startHour = hour;
                }
            } else {
                if (inInterval) {
                    // Intervalo ativo termina
                    const endHour = hour - 1;
                    busiestIntervals.push({ start: startHour, end: endHour });
                    inInterval = false;
                }
            }
        }
        // Trata o caso do último intervalo que termina em 23:59
        if (inInterval) {
            busiestIntervals.push({ start: startHour, end: 23 });
        }
        
        // 4. Formata e filtra os intervalos
        const formattedIntervals = busiestIntervals
            .filter(interval => (interval.end - interval.start) >= 0) // Garante que a duração seja de pelo menos 1h
            .map(interval => {
                const start = String(interval.start).padStart(2, '0');
                const end = String((interval.end + 1) % 24).padStart(2, '0'); // O fim é a hora seguinte
                return `${start}:00h - ${end}:00h`;
            });
            
        if (formattedIntervals.length === 0) {
             return `A média por hora de estudo nos últimos ${totalDays} dias foi inferior a ${thresholdMinutes} minutos.`;
        }

        // 5. Concatena os resultados
        return formattedIntervals.join(', ');
    }
}

module.exports = TimeIntervalUtils;