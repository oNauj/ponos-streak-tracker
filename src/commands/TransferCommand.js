const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const MathUtils = require('../utils/MathUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('transferir')
        .setDescription('Transfere horas de estudo de sua conta para outra conta')
        .addUserOption(opt => opt.setName('usuario').setDescription('Usuário destino').setRequired(true))
        .addNumberOption(opt => opt.setName('horas').setDescription('Quantidade de horas a transferir').setRequired(true)),

    /**
     * Aqui recebemos o StudyTrackerService (via StudyClient, que passa tracker para a maioria dos comandos)
     */
    async execute(interaction, trackerService) {
        const target = interaction.options.getUser('usuario');
        const hours = interaction.options.getNumber('horas');
        const senderId = interaction.user.id;

        if (!target) return interaction.reply({ content: 'Usuário destino inválido.', flags: 64 });
        if (target.id === senderId) return interaction.reply({ content: 'Você não pode transferir para si mesmo.', flags: 64 });
        if (!hours || hours <= 0) return interaction.reply({ content: 'Informe uma quantidade de horas maior que zero.', flags: 64 });

        const ms = Math.round(hours * 60 * 60 * 1000);

        const db = trackerService.db;
        const sender = db.getUser(senderId);
        const receiver = db.getUser(target.id);

        if ((sender.totalTime || 0) < ms) {
            return interaction.reply({ content: `Saldo insuficiente. Você tem ${MathUtils.formatTime(sender.totalTime || 0)} disponíveis.`, flags: 64 });
        }

        // atualiza os totais (não mexemos no dailyTime/history automaticamente)
        sender.totalTime = (sender.totalTime || 0) - ms;
        receiver.totalTime = (receiver.totalTime || 0) + ms;

        // salva
        db.updateUser(senderId, sender);
        db.updateUser(receiver.id, receiver);

        const embed = new EmbedBuilder()
            .setTitle('🔁 Transferência de Tempo Concluída')
            .setColor(0x00AAFF)
            .addFields(
                { name: 'Remetente', value: `${interaction.user.username} (${interaction.user.id})`, inline: true },
                { name: 'Destinatário', value: `${target.username} (${target.id})`, inline: true },
                { name: 'Quantidade', value: `${hours} hora(s) — ${MathUtils.formatTime(ms)}`, inline: false },
                { name: 'Saldo Remetente', value: `${MathUtils.formatTime(sender.totalTime)}`, inline: true },
                { name: 'Saldo Destinatário', value: `${MathUtils.formatTime(receiver.totalTime)}`, inline: true }
            )
            .setTimestamp();

        return interaction.reply({ embeds: [embed] });
    }
};
