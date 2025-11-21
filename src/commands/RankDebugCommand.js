const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("rankdebug")
    .setDescription("Mostra cálculo de produtividade detalhado de um usuário.")
    .addUserOption(option =>
      option
        .setName("usuario")
        .setDescription("Usuário para analisar")
        .setRequired(true)
    ),

  async execute(interaction, db, client) {
    try {
      await interaction.deferReply();

      const target = interaction.options.getUser("usuario");
      const userId = target.id;

      const GAMMA = parseFloat(process.env.PROD_GAMMA) || 0.5;

      // Buscar usuário no DB
      const all = db.getAllUsers();
      const user = all.find(u => u.id === userId);

      if (!user) {
        return interaction.editReply(`❌ <@${userId}> não possui registros no banco.`);
      }

      // =====================
      //     CÁLCULO
      // =====================
      function calcProductivity(u) {
        const hours = (u.totalTime || 0) / 3600000;
        const streak = u.currentStreak || 0;

        let historyHours = [];

        if (u.history && Array.isArray(u.history)) {
          historyHours = u.history.map(h => (h.ms || 0) / 3600000);
        }

        if (u.dailyTime && u.dailyTime > 0) {
          historyHours.push(u.dailyTime / 3600000);
        }

        const mean =
          historyHours.length > 0
            ? historyHours.reduce((a, b) => a + b, 0) / historyHours.length
            : 0;

        let stdDev = 0;

        if (historyHours.length > 1) {
          stdDev = Math.sqrt(
            historyHours
              .map(v => (v - mean) ** 2)
              .reduce((a, b) => a + b, 0) / historyHours.length
          );
        }

        const CV = mean > 0 ? stdDev / mean : 0;

        const productivity =
          hours * (1 + streak / 7) / (CV + GAMMA);

        return { hours, streak, historyHours, mean, stdDev, CV, productivity };
      }

      const calc = calcProductivity(user);

      // =====================
      //    EMBED FINAL
      // =====================

      const embed = new EmbedBuilder()
        .setTitle(`🛠 Debug de Produtividade — ${target.username}`)
        .setColor("#3498db")
        .addFields({
          name: `📊 Usuário: <@${userId}>`,
          value:
            `**Horas Totais:** ${calc.hours.toFixed(2)}h\n` +
            `**Streak:** ${calc.streak}/7\n\n` +
            `**Histórico (horas):** [${calc.historyHours.map(v => v.toFixed(2)).join(", ")}]\n\n` +
            `**Média:** ${calc.mean.toFixed(3)}h\n` +
            `**Desvio Padrão:** ${calc.stdDev.toFixed(3)}\n` +
            `**CV:** ${(calc.CV * 100).toFixed(1)}%\n\n` +
            `**Produtividade:** ${calc.productivity.toFixed(2)} pts\n\n` +
            `📌 Fórmula: horas × (1 + streak/7) ÷ (CV + ${GAMMA})`,
        })
        .setTimestamp()
        .setFooter({ text: "Debug gerado automaticamente" });

      await interaction.editReply({ embeds: [embed] });

    } catch (err) {
      console.error("Erro no rankdebug:", err);

      // Previne o InteractionAlreadyReplied
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply("❌ Ocorreu um erro ao gerar o debug.");
      }

      return;
    }
  },
};
