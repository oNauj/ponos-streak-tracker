const fs = require("fs");
const path = require("path");

class DatabaseService {
    constructor(filename = "estudos_db.json") {
        this.filePath = path.resolve(__dirname, "../../", filename);
        this.data = { users: {} };
        this.load();
    }

    load() {
        try {
            if (fs.existsSync(this.filePath)) {
                const raw = fs.readFileSync(this.filePath);
                this.data = JSON.parse(raw);
                console.log("📂 Banco de dados carregado com sucesso.");
                // Migrar histórico numérico (legado) para formato { date, ms }
                // Se encontrar history com números, converte para objetos usando lastStudyDate
                for (const [userId, user] of Object.entries(this.data.users || {})) {
                    if (Array.isArray(user.history) && user.history.length > 0 && typeof user.history[0] === 'number') {
                        const lastTs = user.lastStudyDate || Date.now();
                        const days = user.history.length;
                        const migrated = [];
                        // Assumimos que o último elemento do array é o dia mais recente antes do lastStudyDate
                        for (let i = 0; i < days; i++) {
                            // atribui datas retroativas: lastStudyDate - (days - i) dias
                            const dateTs = lastTs - ((days - i) * 24 * 60 * 60 * 1000);
                            const d = new Date(dateTs);
                            const yyyy = d.getFullYear();
                            const mm = String(d.getMonth() + 1).padStart(2, '0');
                            const dd = String(d.getDate()).padStart(2, '0');
                            migrated.push({ date: `${yyyy}-${mm}-${dd}`, ms: user.history[i] });
                        }
                        this.data.users[userId].history = migrated;
                    }
                }
                // Persistir migração imediatamente
                this.save();
            } else {
                this.save(); // Cria o arquivo se não existir
            }
        } catch (error) {
            console.error("Erro ao carregar banco de dados:", error);
        }
    }

    save() {
        try {
            fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
        } catch (error) {
            console.error("Erro ao salvar banco de dados:", error);
        }
    }

    /**
     * Retorna os dados do usuário ou cria um novo template se não existir
     */
    getUser(userId) {
        if (!this.data.users[userId]) {
            this.data.users[userId] = {
                totalTime: 0,
                currentStreak: 0,
                dailyTime: 0,
                lastStudyDate: 0,
                history: []
            };
            this.save();
        }
        return this.data.users[userId];
    }

    updateUser(userId, dataPartial) {
        const user = this.getUser(userId);
        // Mescla os dados atuais com os novos
        this.data.users[userId] = { ...user, ...dataPartial };
        this.save();
    }

    getAllUsers() {
        return Object.entries(this.data.users).map(([id, data]) => ({
            id,
            ...data
        }));
    }
}

module.exports = DatabaseService;
