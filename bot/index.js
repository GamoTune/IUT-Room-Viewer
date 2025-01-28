const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, GatewayIntentBits, REST, Routes } = require('discord.js');
require('dotenv').config()

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.commands = new Collection();

// IMPORTATION DES COMMANDES ---------------------------------------------------------------------------------------------

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath);

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
        client.commands.set(command.data.name, command);
    } else {
        console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}

// IMPORTATION DES EVENTS ------------------------------------------------------------------------------------------------

const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args));
    }
}

// REFRESH DES COMMANDES -------------------------------------------------------------------------------------------------

const rest = new REST().setToken(process.env.TOKEN);


(async () => {
    try {
        console.log(`Started refreshing ${commands.length} application (/) commands.`);

        const data = await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands },
        );

        console.log(`Successfully reloaded ${data.length} application (/) commands.`);

    } catch (error) {
        console.error(error);
    }
})();

console.log(`Loaded ${client.commands.size} commands.`);

// CONNEXION DU BOT ------------------------------------------------------------------------------------------------------

client.login(process.env.TOKEN);