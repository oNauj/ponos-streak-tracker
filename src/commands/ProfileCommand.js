const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const MathUtils = require('../utils/MathUtils'); 

/**
 * Função FINAL CORRIGIDA: Garante que um array exato de 'days' dias seja retornado, 
 * com o tempo do dia atual (dailyTime) sendo priorizado.
 * @param {object} rawStats - Dados do usuário (totalTime, dailyTime, history).
 * @param {number} days - Número de dias para analisar (ex: 7 ou 30).
 * @returns {number[]} Array de horas em sequência, do dia mais antigo ao mais recente.
 */
function getDataPointsForRange(rawStats, days) {
    const dataPoints = [];
    
    // Objeto para consolidar dados históricos por data string (YYYY-MM-DD)
    const historyMap = new Map();
    
    // 1. Mapeia dados históricos para fácil acesso
    for (const entry of rawStats.history) {
        // A chave será a data string
        historyMap.set(entry.date, entry.ms);
    }

    // 2. Determina a data de "Hoje" para priorizar dailyTime
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    // Adiciona o dailyTime de hoje ao mapa, sobrescrevendo qualquer histórico se houver bug de log.
    historyMap.set(todayStr, rawStats.dailyTime || 0);

    // 3. Itera o número exato de dias (days) retrocedendo a partir de hoje
    // Percorre do dia mais antigo (days-1) até o dia atual (0)
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i); 
        
        const fullDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        
        const ms = historyMap.get(fullDateStr) || 0;
        
        // Converte milissegundos para horas e adiciona ao array de pontos
        const hours = ms / (1000 * 60 * 60);
        dataPoints.push(+hours.toFixed(2));
    }
    
    return dataPoints;
}


module.exports = {
    data: new SlashCommandBuilder()
        .setName('perfil')
        .setDescription('Mostra estatísticas suas ou de um amigo (Tempo, Streak, Consistência).')
        .addUserOption(option => 
            option.setName('usuario')
                .setDescription('O usuário para ver o perfil')
                .setRequired(false))
        .addStringOption(option => 
            option.setName('range')
                .setDescription('Mostrar gráfico dos últimos dias')
                .addChoices(
                    { name: 'Últimos 7 dias', value: '7' },
                    { name: 'Últimos 30 dias', value: '30' }
                ).setRequired(false)
        ),

    async execute(interaction, trackerService) {
        const targetUser = interaction.options.getUser('usuario') || interaction.user;
        const rawStats = trackerService.db.getUser(targetUser.id);
        const range = interaction.options.getString('range');
        
        if (!rawStats || rawStats.totalTime === 0 && targetUser.id === interaction.user.id) {
            return interaction.reply({ content: "Você ainda não tem tempo registrado. Comece a compartilhar sua tela para estudar!", ephemeral: true });
        }

        const stats = trackerService.getFormattedStats(targetUser.id, rawStats); 
        
        // --- SEÇÃO DO GRÁFICO (if (range)) ---
        if (range) {
            const days = parseInt(range, 10);
            const labels = [];
            const hours = getDataPointsForRange(rawStats, days); // Usa a função CORRIGIDA

            for (let i = days - 1; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                labels.push(`${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`);
            }

            const chartConfig = {
                type: 'line',
                data: {
                    labels,
                    datasets: [{
                        label: 'Horas por dia',
                        data: hours,
                        fill: true,
                        backgroundColor: 'rgba(0,153,255,0.1)',
                        borderColor: 'rgba(0,153,255,1)'
                    }]
                },
                options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
            };

            try {
                // ... (código QuickChart) ...
                const res = await fetch('https://quickchart.io/chart/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chart: chartConfig, backgroundColor: 'white', width: 800, height: 400 })
                });
                const body = await res.json();
                const imageUrl = body.url;

                // CÁLCULOS REAIS: Usamos 30 dias de dados para as métricas.
                const hoursForMetrics = getDataPointsForRange(rawStats, 30); 

                const consistencyPct = MathUtils.consistencyPercent(hoursForMetrics, trackerService.MIN_HOURS_FOR_STREAK).toFixed(1);
                const stddev = MathUtils.stdDevHours(hoursForMetrics).toFixed(2);

                const consistencyDescription = `mede a % de dias (últimos 30) que você bateu a meta de ${trackerService.MIN_HOURS_FOR_STREAK}h.`;
                const stddevDescription = `mede a variabilidade de seu estudo (quanto maior, menos consistente).`;
                
                const embed = new EmbedBuilder()
                    .setTitle(`📈 ${targetUser.username} — Últimos ${days} dias`)
                    .setImage(imageUrl)
                    .setColor(0x0099FF)
                    .addFields(
                        { name: `Consistência (%) - ${consistencyDescription}`, value: `${consistencyPct}%`, inline: true },
                        { name: `Desvio Padrão (h) - ${stddevDescription}`, value: `${stddev}h`, inline: true }
                    )
                    .setFooter({ text: 'Use /perfil sem range para ver resumo.' });

                return interaction.reply({ embeds: [embed] });
            } catch (err) {
                console.error('Erro ao gerar gráfico:', err);
                return interaction.reply({ content: 'Não foi possível gerar o gráfico no momento.', ephemeral: true });
            }
        }

        // --- SEÇÃO DO RESUMO (sem range) ---
        
        // Barra de progresso
        const progressBarLength = 15;
        const filled = Math.round((stats.progressPercentage / 100) * progressBarLength);
        const empty = progressBarLength - filled;
        const bar = "█".repeat(filled) + "░".repeat(empty);

        // Busca dos últimos 30 dias para cálculo (Usa a função CORRIGIDA)
        const hoursInHistory = getDataPointsForRange(rawStats, 30); 
        
        // Cálculo da Média 7d e Análise Recente...
        const last7DaysHours = hoursInHistory.slice(-7); 
        const totalLast7 = last7DaysHours.reduce((a, b) => a + b, 0);
        const avgLast7 = last7DaysHours.length > 0 ? (totalLast7 / last7DaysHours.length).toFixed(2) : 0;
        const todayHours = +( (rawStats.dailyTime || 0) / (1000 * 60 * 60) ).toFixed(2);
        let improvementText = 'Estude mais um pouco para calcular a média semanal!';
        const avgLast6Days = last7DaysHours.length > 6 ? last7DaysHours.slice(0, 6).reduce((a, b) => a + b, 0) / 6 : 0;

        if (avgLast6Days > 0) {
            const diff = todayHours - avgLast6Days;
            const diffPct = (diff / avgLast6Days * 100).toFixed(2);
            const symbol = diff >= 0 ? '▲' : '▼';
            improvementText = `${symbol} ${Math.abs(diffPct)}% (hoje vs média dos últimos 6 dias)`;
        } 

        // Projeção...
        const daysToProj = 7;
        let projectionText = 'Sem dados de histórico para projeção.';
        if (avgLast7 > 0) {
            const projectedHours = +(avgLast7 * daysToProj).toFixed(2);
            const totalHours = +(rawStats.totalTime / (1000 * 60 * 60)).toFixed(2);
            const totalProjected = +(totalHours + projectedHours).toFixed(2);

            projectionText = 
                `**Média Diária (7d):** ${avgLast7}h\n` +
                `**Previsão ${daysToProj} dias:** ${projectedHours}h adicionais\n` +
                `**Total Projetado:** ${totalProjected}h`;
        }
        
        // Métrica de consistência no resumo (30 dias)
        const consistencyPctSummary = MathUtils.consistencyPercent(hoursInHistory, trackerService.MIN_HOURS_FOR_STREAK).toFixed(1);
        
        // Campo com explicação detalhada
        const consistencyValue = `**${consistencyPctSummary}%**\n*Mede a % de dias (últimos 30) em que você atingiu ou superou a meta de ${stats.targetHours}h, focando na disciplina regular.*`;

        const embed = new EmbedBuilder()
            .setTitle(`📊 Estatísticas de ${targetUser.username}`)
            .setDescription(`Seja bem-vindo(a), Professor(a) ${targetUser.username}!`)
            .addFields(
                { name: "Tempo Total Acumulado", value: stats.totalTime, inline: true },
                { name: "Tempo Estudado Hoje", value: stats.dailyTime, inline: true },
                { name: "🔥 Streak Atual (Dias)", value: `${rawStats.currentStreak} dia(s)`, inline: true },
                { 
                    name: `Meta Diária (${stats.targetHours}h)`, 
                    value: `${bar} ${stats.progressPercentage}% concluído`, 
                    inline: false 
                },
                { name: "Análise de Desempenho (Consistência)", value: consistencyValue, inline: false },
                { name: "Análise Recente", value: improvementText, inline: false },
                { name: `Projeção (Baseada na Média de 7 dias)`, value: projectionText, inline: false }
            )
            .setColor(0x0099FF)
            .setTimestamp()
            .setFooter({ text: 'Use /perfil range:[7|30] para ver gráficos.' });

        await interaction.reply({ embeds: [embed] });
    }
};