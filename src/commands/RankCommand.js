const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

// -----------------------------
// CÁLCULO DO CV
// -----------------------------
function calculateStats(values) {
    if (!values || values.length === 0)
        return { mean: 0, stdDev: 0, cv: 0 };

    const n = values.length;
    const mean = values.reduce((a, b) => a + b, 0) / n;

    if (n === 1) return { mean, stdDev: 0, cv: 0 };

    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);

    return { mean, stdDev, cv: mean === 0 ? 0 : stdDev / mean };
}

// -----------------------------
// NORMALIZAÇÃO DO CV
// -----------------------------
function normalizeCV(cv, n, idealN = 14) {
    if (n <= 1) return 0; // CV não confiável — reduz completamente
    const confidence = Math.min(1, n / idealN);
    return cv * confidence;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("rank")
        .setDescription("Exibe o ranking de produtividade baseado em horas, consistência e streak."),

    async execute(interaction, db, client) {
        try { await interaction.deferReply(); }
        catch { return; }

        const users = db.getAllUsers();
        if (!users || users.length === 0)
            return interaction.editReply("Nenhum usuário encontrado para calcular o ranking.");

        const GAMMA = parseFloat(process.env.PROD_GAMMA) || 0.5;
        const RANK_LIMIT = 10;

        const dataset = [];

        for (const u of users) {

            // -----------------------------
            // HORAS TOTAIS
            // -----------------------------
            const totalHours = (u.totalTime || 0) / 3600000;
            if (totalHours <= 0) continue;

            // -----------------------------
            // STREAK (limitado a 7)
            // -----------------------------
            const streak7 = Math.min(7, u.currentStreak || 0);

            // -----------------------------
            // HISTÓRICO PARA CÁLCULO DO CV
            // -----------------------------
            const historyHours = (u.history || []).map(h =>
                h.ms ? h.ms / 3600000 : 0
            );

            if (u.dailyTime && u.dailyTime > 0) {
                historyHours.push(u.dailyTime / 3600000);
            }

            const stats = calculateStats(historyHours);
            const rawCV = stats.cv;

            const n = historyHours.length;
            const CV = normalizeCV(rawCV, n);

            // -----------------------------
            // FÓRMULA FINAL
            // -----------------------------
            const streakFactor = 1 + (streak7 / 7);
            const denominator = (CV + GAMMA) || GAMMA;

            const score = (totalHours * streakFactor) / denominator;

            dataset.push({
                id: u.id,
                score,
                hours: totalHours,
                streak7,
                cv: CV
            });
        }

        // -----------------------------
        // ORDENAR & PEGAR TOP 10
        // -----------------------------
        dataset.sort((a, b) => b.score - a.score);
        const topUsers = dataset.slice(0, RANK_LIMIT);

        let description = "";

        // -----------------------------
        // MONTAR LISTA VISUAL
        // -----------------------------
        for (let i = 0; i < topUsers.length; i++) {
            const d = topUsers[i];
            const rank = i + 1;

            let medal = `#${rank}`;
            if (rank === 1) medal = "🥇";
            if (rank === 2) medal = "🥈";
            if (rank === 3) medal = "🥉";

            let mention = `<@${d.id}>`;

            try {
                const member = await interaction.guild.members.fetch(d.id);
                mention = member.toString();
            } catch {
                try {
                    const user = await client.users.fetch(d.id);
                    mention = `<@${user.id}>`;
                } catch {
                    mention = `Usuário (${d.id})`;
                }
            }

            description +=
`**${medal} ${mention} — ${d.score.toFixed(1)} pts**
🕒 ${Math.round(d.hours)}h  
🔥 Streak: ${d.streak7}/7  
📊 CV (normalizado): ${(d.cv * 100).toFixed(1)}%

`;
        }

        // -----------------------------
        // EMBED FINAL
        // -----------------------------
        const embed = new EmbedBuilder()
            .setTitle("Ranking de Produtividade")
            .setDescription(description)
            .addFields({
                name: "Fórmula",
                value:
`\`\`\`
Produtividade = Horas × (1 + Streak/7) ÷ (CV_normalizado + Gamma)
\`\`\`
• Horas ↑ = mais pontos  
• Streak ↑ = multiplicador  
• CV_normalizado ↓ = mais consistência
• CV é suavizado para usuários com poucos dias de histórico`,
                inline: false
            })
            .setFooter({ text: `Gamma atual: ${GAMMA}` })
            .setTimestamp()
            .setColor("#00FF7F");

        await interaction.editReply({ embeds: [embed] });
    }
};
