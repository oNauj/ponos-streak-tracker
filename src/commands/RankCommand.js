const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const MathUtils = require("../utils/MathUtils");
// Não é necessário importar DatabaseService diretamente, mas sim o MathUtils para formatar o tempo.

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
        // Ordena por tempo total (maior para menor) e pega o top 10
        const sorted = users.sort((a, b) => b.totalTime - a.totalTime).slice(0, 10);

        let description = "";
        
        for (let i = 0; i < sorted.length; i++) {
            const userData = sorted[i];
            let name = userData.id;
            
            // Tenta buscar o nome real (Melhora a UX)
            try {
                const user = await client.users.fetch(userData.id);
                name = user.username;
            } catch (e) { /* Se falhar, usa o ID */ }

            const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `**#${i+1}**`;
            description += `${medal} **${name}**: ${MathUtils.formatTime(userData.totalTime)}\n`;
        }

        const embed = new EmbedBuilder()
            .setTitle("🏆 Ranking de Foco e Produtividade")
            .setDescription(description || "Ninguém estudou o suficiente para entrar no ranking ainda. Comece agora!")
            .setColor(0xFFD700)
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};