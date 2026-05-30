require('dotenv').config();
const { startBot, client } = require('./bot.js');
const { startServer } = require('./server.js');

console.log('🤖 Initialisation du Discord Welcomer System...');

// 1. Démarrer le Bot Discord
startBot();

// 2. Démarrer le Serveur Web Express Dashboard
// On lui passe l'instance du client Discord pour l'intégration des salons et serveurs
startServer(client);

console.log('✅ Services démarrés avec succès.');
