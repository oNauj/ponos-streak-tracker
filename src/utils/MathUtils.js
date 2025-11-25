// Arquivo: utils/MathUtils.js

class MathUtils {
    /**
     * Calcula a média de um array de números (horas).
     * @param {number[]} arr - Array de horas.
     * @returns {number} A média.
     */
    static mean(arr) {
        if (!arr || arr.length === 0) return 0;
        const sum = arr.reduce((a, b) => a + b, 0);
        return sum / arr.length;
    }

    /**
     * Calcula o desvio padrão (Standard Deviation) de um array de horas.
     * @param {number[]} arr - Array de horas.
     * @returns {number} O desvio padrão.
     */
    static stdDevHours(arr) {
        // Precisa de pelo menos 2 pontos para cálculo significativo
        if (!arr || arr.length < 2) return 0; 
        
        const m = MathUtils.mean(arr);
        
        // Calcula a variância (média das diferenças ao quadrado)
        const variance = arr.reduce((sum, current) => {
            return sum + Math.pow(current - m, 2);
        }, 0) / arr.length;
        
        // O desvio padrão é a raiz quadrada da variância
        return Math.sqrt(variance);
    }

    /**
     * Calcula a Consistência: % de dias que a meta diária foi batida.
     * @param {number[]} hoursArray - Array de horas estudadas por dia.
     * @param {number} targetHours - A meta mínima em horas (ex: 6).
     * @returns {number} Porcentagem de consistência.
     */
    static consistencyPercent(hoursArray, targetHours) {
        if (!hoursArray || hoursArray.length === 0) return 0;
        
        let daysMetTarget = 0;
        for (const hours of hoursArray) {
            if (hours >= targetHours) {
                daysMetTarget++;
            }
        }
        return (daysMetTarget / hoursArray.length) * 100;
    }
}

module.exports = MathUtils;