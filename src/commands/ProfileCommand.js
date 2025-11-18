const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const StudyTrackerService = require("../services/StudyTrackerService"); 

module.exports = {
    // Estrutura do Slash Command
    data: new SlashCommandBuilder()
        .setName('perfil')
        .setDescription('Mostra estatísticas suas ou de um amigo (Tempo, Streak, Consistência).')
        .addUserOption(option => 
            option.setName('usuario')
                .setDescription('O usuário para ver o perfil')
                .setRequired(false)),

    /**
     * Como vai funcionar o comando
     * @param {object} interaction O objeto de interação do Discord.
     * @param {StudyTrackerService} trackerService O serviço de rastreamento (passado pelo cliente).
     */
    async execute(interaction, trackerService) {
        const targetUser = interaction.options.getUser('usuario') || interaction.user;
        const rawStats = trackerService.db.getUser(targetUser.id);
        
        if (rawStats.totalTime === 0 && targetUser.id === interaction.user.id) {
            return interaction.reply({ content: "Você ainda não tem tempo registrado. Comece a compartilhar sua tela para estudar!", ephemeral: true });
        }

        // Obtém os dados formatados do serviço de lógica de negócios
        const stats = trackerService.getFormattedStats(targetUser.id, rawStats);

        // Cria uma barra de progresso simples
        const progressBarLength = 15;
        const filled = Math.round((stats.progressPercentage / 100) * progressBarLength);
        const empty = progressBarLength - filled;
        const bar = "█".repeat(filled) + "░".repeat(empty);

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
                { name: "Análise Estatística", value: stats.consistency, inline: false }
            )
            .setColor(0x0099FF)
            .setTimestamp()
            .setFooter({ text: 'Mantenha o Foco!' });

        await interaction.reply({ embeds: [embed] });
    }
};