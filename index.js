require("dotenv").config();
const StudyClient = require("./src/StudyClient");

const client = new StudyClient();
client.start(process.env.DISCORD_TOKEN);
