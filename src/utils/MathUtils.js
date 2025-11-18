
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