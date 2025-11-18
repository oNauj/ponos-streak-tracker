
class MathUtils {
    
    // Converte milissegundos em string legível (4d 10h...)
    static formatTime(ms) {
        if (!ms) return "0s";
        const seconds = Math.floor((ms / 1000) % 60);
        const minutes = Math.floor((ms / (1000 * 60)) % 60);
        const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
        const days = Math.floor(ms / (1000 * 60 * 60 * 24));

        const parts = [];
        if (days > 0) parts.push(`${days}d`);
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0) parts.push(`${minutes}m`);
        parts.push(`${seconds}s`);

        return parts.join(" ") || "0s";
    }

    // Verifica se a data fornecida é um dia diferente de hoje
    static isNewDay(timestamp) {
        if (!timestamp) return true;
        const lastDate = new Date(timestamp);
        const today = new Date();
        
        return lastDate.getDate() !== today.getDate() || 
               lastDate.getMonth() !== today.getMonth() || 
               lastDate.getFullYear() !== today.getFullYear();
    }

    // Converte timestamp em YYYY-MM-DD
    static dateStringFromTimestamp(timestamp) {
        const d = new Date(timestamp);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }

    // Extrai array de horas (float) para os últimos N dias a partir de lastDate
    // history aceita ambos formatos: [ms,...] (legado) ou [{date, ms}, ...]
    static hoursArrayForRange(historyArray, lastDateTs, days = 7) {
        const dayMs = 24 * 60 * 60 * 1000;
        const result = new Array(days).fill(0);
        if (!historyArray || historyArray.length === 0) return result;

        // Construir um mapa date->ms para entradas do tipo {date, ms}
        const map = new Map();
        if (historyArray.length > 0 && typeof historyArray[0] === 'object') {
            for (const entry of historyArray) {
                if (entry && entry.date) map.set(entry.date, entry.ms || 0);
            }
        } else if (historyArray.length > 0 && typeof historyArray[0] === 'number') {
            // histórico legado: atribuímos datas retroativas terminando em lastDateTs
            const last = lastDateTs || Date.now();
            const len = historyArray.length;
            for (let i = 0; i < len; i++) {
                const dateTs = last - ((len - i) * dayMs);
                const d = new Date(dateTs);
                const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                map.set(key, historyArray[i]);
            }
        }

        for (let i = 0; i < days; i++) {
            const dateTs = (lastDateTs || Date.now()) - ((days - 1 - i) * dayMs);
            const d = new Date(dateTs);
            const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            const ms = map.get(key) || 0;
            result[i] = +(ms / (1000 * 60 * 60)).toFixed(2); // horas com 2 casas
        }
        return result;
    }

    // Percentual de dias com estudo nos últimos N dias
    static consistencyPercent(historyArray, lastDateTs, days = 30) {
        const hours = this.hoursArrayForRange(historyArray, lastDateTs, days);
        const daysWithStudy = hours.filter(h => h > 0).length;
        return Math.round((daysWithStudy / days) * 100);
    }

    // Desvio padrão em horas nos últimos N dias
    static stdDevHours(historyArray, lastDateTs, days = 30) {
        const hours = this.hoursArrayForRange(historyArray, lastDateTs, days);
        const n = hours.length;
        if (n === 0) return 0;
        const mean = hours.reduce((a,b) => a+b, 0) / n;
        const variance = hours.reduce((a,b) => a + Math.pow(b - mean, 2), 0) / n;
        return +(Math.sqrt(variance)).toFixed(2);
    }

    // Calcula média dos comprimentos de streaks presentes no histórico
    static meanStreakFromHistory(historyArray, lastDateTs, days = 365) {
        const hours = this.hoursArrayForRange(historyArray, lastDateTs, days);
        const streaks = [];
        let current = 0;
        for (const h of hours) {
            if (h > 0) current++; else if (current > 0) { streaks.push(current); current = 0; }
        }
        if (current > 0) streaks.push(current);
        if (streaks.length === 0) return 0;
        const mean = streaks.reduce((a,b) => a + b, 0) / streaks.length;
        return +mean.toFixed(1);
    }


    // Calcula a consistência baseada no Coeficiente de Variação
    static calculateConsistency(historyArray) {
        if (!historyArray || historyArray.length < 2) return "Dados insuficientes para cálculo";
        
        const n = historyArray.length;
        // Média Aritmética
        const mean = historyArray.reduce((a, b) => a + b, 0) / n;
        
        // Variância
        const variance = historyArray.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n;
        
        // Desvio Padrão
        const stdDev = Math.sqrt(variance);
        
        // Coeficiente de Variação (CV %)
        // CV baixo = Alta consistência (dados pouco dispersos)
        const cv = (stdDev / mean) * 100;

        if (cv < 15) return "🤖 Máquina de Estudo (Altíssima Constância)";
        if (cv < 40) return "🧠 Consistente";
        if (cv < 70) return "📈 Variável";
        return "📉 Irregular (Surtos de foco)";
    }
}

module.exports = MathUtils;