const path = require("path");
const { ServiceBroker } = require("moleculer");
//const options = require("./moleculer.config");
const broker = new ServiceBroker();
broker.loadServices(path.join(__dirname, "../services/wallet.service.js"));
broker.start().catch((e) => console.error(e));
