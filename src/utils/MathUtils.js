
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

    // Extrai um array de horas (números) a partir do histórico que pode ser
    // um array de números (ms) ou um array de objetos {date, ms}.
    static hoursFromHistory(historyArray) {
        if (!historyArray || historyArray.length === 0) return [];
        const MS_HOUR = 1000 * 60 * 60;
        return historyArray.map(h => {
            if (!h) return 0;
            if (typeof h === 'number') return h / MS_HOUR;
            if (h && typeof h.ms === 'number') return h.ms / MS_HOUR;
            return 0;
        });
    }

    // Retorna estatísticas descritivas (mean, stdDev, cvPercent, sum, min, max)
    static describeHours(hoursArray) {
        if (!hoursArray || hoursArray.length === 0) return { mean: 0, stdDev: 0, cvPercent: 0, sum: 0, min: 0, max: 0 };
        const n = hoursArray.length;
        const sum = hoursArray.reduce((a, b) => a + b, 0);
        const mean = sum / n;
        const variance = hoursArray.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n;
        const stdDev = Math.sqrt(variance);
        const cvPercent = mean === 0 ? 0 : (stdDev / mean) * 100;
        const min = Math.min(...hoursArray);
        const max = Math.max(...hoursArray);
        return { mean, stdDev, cvPercent, sum, min, max };
    }

    // Calcula a consistência textual baseada no Coeficiente de Variação.
    // Aceita historyArray em qualquer dos formatos suportados.
    static calculateConsistency(historyArray) {
        const hours = MathUtils.hoursFromHistory(historyArray);
        if (!hours || hours.length < 2) return "Dados insuficientes para cálculo";
        const { cvPercent } = MathUtils.describeHours(hours);
        if (cvPercent < 15) return "🤖 Máquina de Estudo (Altíssima Constância)";
        if (cvPercent < 40) return "🧠 Consistente";
        if (cvPercent < 70) return "📈 Variável";
        return "📉 Irregular (Surtos de foco)";
    }
}

module.exports = MathUtils;