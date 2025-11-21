const { Client, GatewayIntentBits, REST, Routes, Collection } = require("discord.js");
const DatabaseService = require("./services/DatabaseService");
const StudyTrackerService = require("./services/StudyTrackerService");

// Importa os comandos
const RankCommand = require("./commands/RankCommand");
const ProfileCommand = require("./commands/ProfileCommand");
const RankDebugCommand = require("./commands/RankDebugCommand");

// Classe Principal do Bot - Estendida da classe Client do Discord
class StudyClient extends Client {
    constructor() {
        super({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildVoiceStates,
                GatewayIntentBits.GuildMessages 
            ]
        });

        // Coleção para armazenar comandos, mapeando nome -> objeto de comando
        this.commands = new Collection(); 
        
        // Inicialização dos Serviços (Injeção de Dependência)
        this.db = new DatabaseService();
        this.tracker = new StudyTrackerService(this.db); // TrackerService depende de DatabaseService
        
        // Mapa em memória para sessões ativas (quem está compartilhando tela agora)
        this.activeSessions = new Map();
    }

    // Método principal de inicialização
    async start(token) {
        this.loadCommands();
        this.setupEvents();
        await this.login(token);
    }

    loadCommands() {
        const commandsArray = [RankCommand, ProfileCommand, require('./commands/TransferCommand'), RankDebugCommand];
        
        for (const command of commandsArray) {
            this.commands.set(command.data.name, command);
        }
        console.log(`✅ ${this.commands.size} comandos carregados internamente.`);
    }

    setupEvents() {
        this.once("clientReady", async () => {
            console.log(`🎓 ${this.user.tag} está online e pronto para ensinar!`);
            await this.registerCommands();
        });

        this.on("voiceStateUpdate", (oldState, newState) => this.handleVoiceUpdate(oldState, newState));
        this.on("interactionCreate", (interaction) => this.handleInteraction(interaction));
    }

    // Gerenciador de Comandos Slash (Dispatch)
    async handleInteraction(interaction) {
        if (!interaction.isChatInputCommand()) return;

        const command = this.commands.get(interaction.commandName);

            if (!command) {
            console.error(`Comando não encontrado: ${interaction.commandName}`);
            return interaction.reply({ content: 'Comando inválido!', flags: 64 });
        }

        try {
            // Despacha a execução do comando, injetando as dependências necessárias
            if (interaction.commandName === 'rank') {
                // O RankCommand precisa do DB e do Client (para buscar nomes)
                await command.execute(interaction, this.db, this);
            } else if (interaction.commandName === 'perfil') {
                // O ProfileCommand precisa apenas do TrackerService
                await command.execute(interaction, this.tracker);
            } else if (interaction.commandName === 'transferir') {
                // TransferCommand usa o trackerService (tem acesso ao DB)
                await command.execute(interaction, this.tracker);
            } else if (interaction.commandName === 'rankdebug') {
                // RankDebugCommand precisa do DB e do Client
                await command.execute(interaction, this.db, this);
            }
            else {
                // Fallback: tente executar passando tracker (compatível com maioria)
                await command.execute(interaction, this.tracker);
            }
        } catch (error) {
            console.error(`Erro ao executar comando ${interaction.commandName}:`, error);
            await interaction.reply({ content: 'Houve um erro ao executar este comando!', flags: 64 });
        }
    }

    // Lógica de Estado de Voz (Tracking Dispatcher)
    handleVoiceUpdate(oldState, newState) {
        const userId = newState.member.id;
        const now = Date.now();

        // Condições: 1. Começou a compartilhar tela
        if (!oldState.streaming && newState.streaming) {
            this.activeSessions.set(userId, now);
            console.log(`[TRACKER] ${userId} começou a transmitir.`);
        }
        
        // Condições: 2. Parou de compartilhar
        else if (oldState.streaming && (!newState.streaming || !newState.channel)) {
            if (this.activeSessions.has(userId)) {
                const startTime = this.activeSessions.get(userId);
                const duration = now - startTime;
                this.activeSessions.delete(userId);

                // Delega toda a lógica de persistência e streak para o serviço StudyTrackerService
                this.tracker.processStudySession(userId, duration);
            }
        }
    }

    // Registro dos Comandos no Discord API
    async registerCommands() {
        // Converte os dados estruturais de todos os comandos para o formato da API
        const commandsData = Array.from(this.commands.values()).map(command => command.data.toJSON());

        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

        // Verifica se as variáveis de ambiente necessárias para o registro da Guilda estão presentes
        if (!process.env.CLIENT_ID || !process.env.GUILD_ID) {
            console.error("ERRO: CLIENT_ID e GUILD_ID devem estar definidos no .env para forçar o registro de comandos na Guilda.");
            return;
        }
        
        const guildRoute = Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID);

        try {
            console.log(`Debug: Tentando deletar/registrar comandos na Guilda ID: ${process.env.GUILD_ID}`); 
            console.log('Iniciando **DELEÇÃO FORÇADA** dos Slash Commands antigos na Guilda...');
            
            // 1. DELETA TODOS OS COMANDOS DA GUILDA
            await rest.put(
                guildRoute,
                { body: [] }, // Array vazio deleta todos os comandos existentes
            );
            console.log('✅ Comandos antigos deletados com sucesso.');
            
            // 2. REGISTRA OS NOVOS COMANDOS
            console.log('Iniciando **REGISTRO** dos Slash Commands novos...');
            await rest.put(
                guildRoute,
                { body: commandsData },
            );

            console.log('✅ Slash Commands registrados com sucesso! (Ação Imediata)');
        } catch (error) {
            console.error("Erro ao registrar comandos:", error);
        }
    }
}

module.exports = StudyClient;