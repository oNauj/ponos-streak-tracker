const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const MathUtils = require('../utils/MathUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rank')
        .setDescription('Mostra o ranking de produtividade entre usuários.'),

    async execute(interaction, db, client) {
        try {
            await interaction.deferReply();
        } catch (err) {
            console.error('Falha ao deferReply em /rank:', err);
            try {
                await interaction.reply({ content: 'Não foi possível iniciar o comando (interação inválida).', flags: 64 });
            } catch (_) {}
            return;
        }

        const users = db.getAllUsers();
        if (!users || users.length === 0) {
            return interaction.editReply('Nenhum dado disponível para ranking.');
        }

        const ALPHA = parseFloat(process.env.PROD_ALPHA) || 0.5;
        const BETA = parseFloat(process.env.PROD_BETA) || 0.3;
        const GAMMA = parseFloat(process.env.PROD_GAMMA) || 0.2;
        const DELTA = parseFloat(process.env.PROD_DELTA) || 0.1;

        const dataset = [];
        for (const u of users) {
            const id = u.id;
            const totalHours = +(((u.totalTime || 0) / (1000 * 60 * 60)).toFixed(1));
            const avgStreak = MathUtils.meanStreakFromHistory(u.history || [], u.lastStudyDate || Date.now(), 365);
            const consistency = MathUtils.consistencyPercent(u.history || [], u.lastStudyDate || Date.now(), 30);
            const stddev = MathUtils.stdDevHours(u.history || [], u.lastStudyDate || Date.now(), 30);

            const score = +(ALPHA * totalHours + BETA * avgStreak + GAMMA * consistency - DELTA * stddev).toFixed(3);
            dataset.push({ id, totalHours, avgStreak, consistency, stddev, score });
        }

        dataset.sort((a, b) => b.score - a.score);

        // --- FORMATO COMPACTO PARA O RANKING ---

        const maxUsers = 10; 
        const topUsers = dataset.slice(0, maxUsers);

        let rankList = '';
        
        // Cabeçalho da "tabela"
        rankList += '`# | Usuário          | Score   | Tempo | Cons. | D.P.`\n';
        rankList += '`----------------------------------------------------`\n';

        for (let i = 0; i < topUsers.length; i++) {
            const row = topUsers[i];
            let name = row.id;
            
            try {
                const user = await client.users.fetch(row.id);
                // Usa um limite no nome para não quebrar a formatação da "tabela"
                if (user && user.username) name = user.username.slice(0, 15); 
            } catch (_) {}

            const rank = i + 1;
            const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `\`${rank}\``;
            
            // Usando espaçamento fixo com crases para simular uma tabela
            rankList += 
                `${medal} ` + 
                `\`${name.padEnd(15, ' ').slice(0, 15)}\` ` + // Nome
                `\`${row.score.toFixed(3).padEnd(6, '0')}\` ` + // Score
                `\`${row.totalHours.toFixed(1).padEnd(4, '0')}h\` ` + // Horas Totais
                `\`${row.consistency.toFixed(0).padStart(2, ' ')}%\` ` + // Consistência
                `\`${row.stddev.toFixed(1).padEnd(3, '0')}h\`` + // Desvio Padrão
                `\n`;
        }

        const rankField = {
            name: '📈 Top Focados (Score | H | Cons. | D.P.)',
            value: rankList || 'Nenhum usuário no ranking ainda.',
            inline: false
        };

        // --- FORMATAÇÃO DA FÓRMULA SEM LATEX ---
        const formulaText = 
            'Esta pontuação de produtividade (P) combina seu tempo total de estudo, a consistência dos seus streaks, sua regularidade e penaliza a irregularidade (Desvio Padrão).\n\n' + 
            '**Fórmula:**\n' + 
            '```\n' + // Código de bloco para clareza
            'P = α * T + β * S + γ * C - δ * D\n' +
            '```\n' +
            '*Onde: T (Horas Totais), S (Streak Médio), C (Consistência), D (Desvio Padrão).*\n' +
            'Os pesos (α, β, γ, δ) são configuráveis via variáveis de ambiente.';

        const embed = new EmbedBuilder()
            .setTitle('🏆 Ranking de Produtividade')
            .setDescription('Aqui está a lista dos usuários mais focados e consistentes!')
            .addFields(rankField)
            .addFields({
                name: 'Detalhes da Pontuação',
                value: formulaText,
                inline: false
            })
            .setColor(0xFFD700)
            .setFooter({ text: `Exibindo os Top ${topUsers.length} de ${dataset.length} usuários. | Pesos: α=${ALPHA}, β=${BETA}, γ=${GAMMA}, δ=${DELTA}` });

        await interaction.editReply({ embeds: [embed] });
    }
};