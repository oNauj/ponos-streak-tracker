const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const StudyTrackerService = require("../services/StudyTrackerService"); 
const MathUtils = require('../utils/MathUtils');

module.exports = {
    // Estrutura do Slash Command
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

    /**
     * Como vai funcionar o comando
     * @param {object} interaction O objeto de interação do Discord.
     * @param {StudyTrackerService} trackerService O serviço de rastreamento (passado pelo cliente).
     */
    async execute(interaction, trackerService) {
        const targetUser = interaction.options.getUser('usuario') || interaction.user;
        const rawStats = trackerService.db.getUser(targetUser.id);
        const range = interaction.options.getString('range');
        
        if (rawStats.totalTime === 0 && targetUser.id === interaction.user.id) {
            return interaction.reply({ content: "Você ainda não tem tempo registrado. Comece a compartilhar sua tela para estudar!", flags: 64 });
        }

        // Se pediu gráfico, gera gráfico dos últimos N dias via QuickChart
        if (range) {
            const days = parseInt(range, 10);
            const labels = [];
            const hours = require('../utils/MathUtils').hoursArrayForRange(rawStats.history, rawStats.lastStudyDate, days);
            // montar labels (últimos dias)
            const dayMs = 24 * 60 * 60 * 1000;
            for (let i = days - 1; i >= 0; i--) {
                const d = new Date((rawStats.lastStudyDate || Date.now()) - (i * dayMs));
                labels.push(`${d.getDate()}/${d.getMonth()+1}`);
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
                const res = await fetch('https://quickchart.io/chart/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chart: chartConfig, backgroundColor: 'white', width: 800, height: 400 })
                });
                const body = await res.json();
                const imageUrl = body.url;

                const embed = new EmbedBuilder()
                    .setTitle(`📈 ${targetUser.username} — Últimos ${days} dias`)
                    .setImage(imageUrl)
                    .setColor(0x0099FF)
                    .setFooter({ text: 'Use /perfil sem range para ver resumo.' });

                // adiciona pequenas estatísticas abaixo
                const consistencyPct = require('../utils/MathUtils').consistencyPercent(rawStats.history, rawStats.lastStudyDate, Math.min(days, 30));
                const stddev = require('../utils/MathUtils').stdDevHours(rawStats.history, rawStats.lastStudyDate, Math.min(days, 30));

                embed.addFields(
                    { name: 'Consistência (%)', value: `${consistencyPct}%`, inline: true },
                    { name: 'Desvio Padrão (h)', value: `${stddev}h`, inline: true }
                );

                return interaction.reply({ embeds: [embed] });
            } catch (err) {
                console.error('Erro ao gerar gráfico:', err);
                return interaction.reply({ content: 'Não foi possível gerar o gráfico no momento.', flags: 64 });
            }
        }

        // Obtém os dados formatados do serviço de lógica de negócios
        const stats = trackerService.getFormattedStats(targetUser.id, rawStats);

        // Cria uma barra de progresso simples
        const progressBarLength = 15;
        const filled = Math.round((stats.progressPercentage / 100) * progressBarLength);
        const empty = progressBarLength - filled;
        const bar = "█".repeat(filled) + "░".repeat(empty);

        // Cálculo de melhoria: compara hoje (rawStats.dailyTime) com ontem (extraído do histórico)
        const todayHours = +( (rawStats.dailyTime || 0) / (1000 * 60 * 60) ).toFixed(2);
        const lastDate = rawStats.lastStudyDate || Date.now();
        const last2 = MathUtils.hoursArrayForRange(rawStats.history, lastDate, 2); // [yesterday, today]
        const yesterdayHours = +(last2[0] || 0).toFixed(2);

        let improvementPctText = 'Dados insuficientes para calcular melhoria.';
        let projectionText = '';
        if (yesterdayHours > 0) {
            const r = (todayHours - yesterdayHours) / yesterdayHours; // razão (p.ex. 0.01 = +1%)
            const rPct = +(r * 100).toFixed(2);
            improvementPctText = `${rPct >= 0 ? '▲' : '▼'} ${Math.abs(rPct)}% (hoje vs ontem)`;

            // Projeção por PG: se mantiver essa melhoria relativa, nextDay = today * (1 + r)
            const daysToProj = 7;
            const proj = [];
            for (let k = 1; k <= daysToProj; k++) {
                const val = +(todayHours * Math.pow(1 + r, k)).toFixed(2);
                const pct = r >= 0 ? +((Math.pow(1 + r, k) - 1) * 100).toFixed(2) : +((1 - Math.pow(1 + r, k)) * 100).toFixed(2);
                proj.push(`Dia +${k}: ${val}h (${r >= 0 ? '+' : '-'}${Math.abs(pct)}% em relação a hoje)`);
            }
            projectionText = proj.join('\n');
        } else if (yesterdayHours === 0 && todayHours > 0) {
            // Caso ontem 0: melhoria indefinida; mostra crescimento absoluto e projeta com um pequeno r padrão (ex: 0.01 = 1%)
            improvementPctText = `▲ Crescimento a partir de 0h — aumento absoluto: ${todayHours}h hoje`;
            const r = 0.01; // default 1% se quiser projetar
            const daysToProj = 7;
            const proj = [];
            for (let k = 1; k <= daysToProj; k++) {
                const val = +(todayHours * Math.pow(1 + r, k)).toFixed(2);
                const pct = +((Math.pow(1 + r, k) - 1) * 100).toFixed(2);
                proj.push(`Dia +${k}: ${val}h (+${pct}% em relação a hoje)`);
            }
            projectionText = proj.join('\n');
        }

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
                { name: "Análise Estatística", value: stats.consistency, inline: false },
                { name: "Melhoria (hoje vs ontem)", value: improvementPctText, inline: false },
                { name: "Projeção (próximos 7 dias se mantiver essa melhoria)", value: projectionText || 'Sem dados para projeção', inline: false }
            )
            .setColor(0x0099FF)
            .setTimestamp()
            .setFooter({ text: 'Mantenha o Foco!' });

        await interaction.reply({ embeds: [embed] });
    }
};