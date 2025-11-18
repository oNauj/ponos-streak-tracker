const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const MathUtils = require("../utils/MathUtils");
const MS_HOUR = 1000 * 60 * 60;

// lê pesos do env (fallbacks)
function readWeights() {
    const alpha = parseFloat(process.env.PROD_ALPHA) || 0.5;
    const beta = parseFloat(process.env.PROD_BETA) || 0.3;
    const gamma = parseFloat(process.env.PROD_GAMMA) || 0.2;
    const delta = parseFloat(process.env.PROD_DELTA) || 0.1;
    return { alpha, beta, gamma, delta };
}

function minMaxNormalize(arr) {
    if (!arr || arr.length === 0) return [];
    const min = Math.min(...arr);
    const max = Math.max(...arr);
    if (max === min) return arr.map(() => 0.5);
    return arr.map(v => (v - min) / (max - min));
}

module.exports = {
    // 1. Definição do Comando (Estrutura do Slash Command)
    data: new SlashCommandBuilder()
        .setName('rank')
        .setDescription('Mostra o ranking de quem mais estudou por tempo total.'),

    /**
     * 2. Lógica de Execução do Comando
     * @param {object} interaction O objeto de interação do Discord.
     * @param {object} dbService O serviço de banco de dados (passado pelo cliente).
     * @param {object} client O objeto Client do Discord (para buscar nomes).
     */
    async execute(interaction, dbService, client) {
        const users = dbService.getAllUsers();

        // Calcular métricas por usuário
        const rows = users.map(u => {
            const totalHours = (u.totalTime || 0) / MS_HOUR;

            // Extrai horas diárias
            const hoursArr = MathUtils.hoursFromHistory(u.history || []);

            // calcula desvio padrão e média via util
            const desc = MathUtils.describeHours(hoursArr);

            // calcula média de streaks (segmentos de dias consecutivos)
            const streakSegments = [];
            // se history tem objetos com date, usa datas; caso contrário, tenta inferir
            if (Array.isArray(u.history) && u.history.length > 0 && typeof u.history[0] === 'object' && u.history[0].date) {
                const dates = Array.from(new Set(u.history.map(h => h.date))).sort();
                let cur = 0;
                let prev = null;
                for (const d of dates) {
                    const dt = new Date(d + 'T00:00:00');
                    if (prev && (dt.getTime() - prev.getTime()) === 24*60*60*1000) {
                        cur++;
                    } else {
                        if (cur > 0) streakSegments.push(cur);
                        cur = 1; // current day starts new run
                    }
                    prev = dt;
                }
                if (cur > 0) streakSegments.push(cur);
            } else if (Array.isArray(u.history) && u.history.length > 0) {
                // fallback: consider history array entries as consecutive days ending at lastStudyDate
                // treat as one run of length = history.length
                streakSegments.push(u.history.length);
            }

            const avgStreak = streakSegments.length === 0 ? 0 : (streakSegments.reduce((a,b)=>a+b,0)/streakSegments.length);

            // consistência: % de dias com estudo desde o primeiro registro até hoje
            let consistencyPercent = 0;
            try {
                if (Array.isArray(u.history) && u.history.length > 0 && typeof u.history[0] === 'object' && u.history[0].date) {
                    const dates = Array.from(new Set(u.history.map(h => h.date))).sort();
                    const first = new Date(dates[0] + 'T00:00:00');
                    const last = new Date(); last.setHours(0,0,0,0);
                    const totalDays = Math.floor((last.getTime() - first.getTime()) / (24*60*60*1000)) + 1;
                    const studyDays = dates.length;
                    consistencyPercent = totalDays > 0 ? (studyDays / totalDays) * 100 : 0;
                } else {
                    // fallback: percent of days with study in last 30
                    const studyDays = Array.isArray(u.history) ? u.history.length : 0;
                    consistencyPercent = Math.min(100, (studyDays / 30) * 100);
                }
            } catch (e) { consistencyPercent = 0; }

            return {
                id: u.id,
                totalHours,
                avgStreak,
                consistencyPercent,
                stdDev: desc.stdDev,
                desc
            };
        });

        if (rows.length === 0) return interaction.reply({ content: 'Sem usuários no banco.', flags: 64 });

        // Normalizar componentes para combinar
        const Ts = rows.map(r => r.totalHours);
        const Ss = rows.map(r => r.avgStreak);
        const Cs = rows.map(r => r.consistencyPercent);
        const Ds = rows.map(r => r.stdDev);

        const nT = minMaxNormalize(Ts);
        const nS = minMaxNormalize(Ss);
        const nC = minMaxNormalize(Cs);
        const nD = minMaxNormalize(Ds);

        const weights = readWeights();
        const scored = rows.map((r, idx) => {
            const score = weights.alpha * nT[idx] + weights.beta * nS[idx] + weights.gamma * nC[idx] - weights.delta * nD[idx];
            return { ...r, score };
        }).sort((a,b)=>b.score - a.score);

        // Monta tabela de saída (code block com tabs)
        const header = 'Usuário\tTotal (h)\tMédia de Streak\tConsistência (%)\tDesvio Padrão (h)';
        const lines = [header];
        for (const row of scored) {
            let name = row.id;
            try { const user = await client.users.fetch(row.id); name = user.username; } catch(e){}
            lines.push(`${name}\t${row.totalHours.toFixed(1)}\t${row.avgStreak.toFixed(1)}\t${row.consistencyPercent.toFixed(0)}\t${row.stdDev.toFixed(2)}`);
        }

        const formula = `Produtividade = α·T + β·S + γ·C - δ·D\n(α=${weights.alpha}, β=${weights.beta}, γ=${weights.gamma}, δ=${weights.delta})`;

        const embed = new EmbedBuilder()
            .setTitle('🏆 Ranking de Produtividade')
            .setDescription('Tabela ordenada por índice de produtividade (maior → menor)')
            .addFields(
                { name: 'Tabela', value: '```\n' + lines.join('\n') + '\n```' },
                { name: 'Fórmula', value: formula }
            )
            .setColor(0xFFD700)
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};