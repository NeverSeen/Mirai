/*
This is a multipurpose bot
Run this with node to run the bot.
//===================================================*/

var commands = require("./bot/commands.js");
var mod = require("./bot/mod.js");
var config = require("./bot/config.json");
var games = require("./bot/games.json").games;
var versioncheck = require("./bot/versioncheck.js");
var discord = require("discord.js");
var cleverbot = require("./bot/cleverbot.js").cleverbot;
var colors = require("./bot/styles.js");
var db = require("./bot/db.js");
checkConfig(); //notify user if they are missing things in the config

var lastExecTime = {}; //for cooldown
commandsProcessed = 0, talkedToTimes = 0;

var bot = new discord.Client();
bot.on("warn", (m) => { if (config.show_warn) { console.log(colors.cWarn(" WARN ") + m); } });
bot.on("debug", (m) => { if (config.debug) { console.log(colors.cDebug(" DEBUG ") + m); } });

bot.on("ready", () => {
	bot.setPlayingGame(games[Math.floor(Math.random() * (games.length))]);
	console.log(colors.cGreen("BrussellBot is ready!") + " Listening to " + bot.channels.length + " channels on " + bot.servers.length + " servers");
	versioncheck.checkForUpdate((resp) => {
		if (resp !== null) { console.log(resp); }
	});
	bot.forceFetchUsers();
});

bot.on("disconnected", () => {
	console.log(colors.cRed("Disconnected") + " from Discord");
	if (!config.is_heroku_version) { process.exit(0);
	} else { //if on heroku try to re-connect
		setTimeout(() => {
			console.log("Attempting to log in...");
			bot.login(process.env.email, process.env.password, function(err, token) {
				if (err) { console.log(err); process.exit(0); }
				if (!token) { console.log(colors.cWarn(" WARN ") + "Failed to re-connect"); process.exit(0); }
			});}, 20000); //waits 20 seconds before doing
	}
});

bot.on("message", (msg) => {
	if (msg.channel.isPrivate && msg.author.id != bot.user.id && (/(^https?:\/\/discord\.gg\/[A-Za-z0-9]+$|^https?:\/\/discordapp\.com\/invite\/[A-Za-z0-9]+$)/.test(msg.content))) { carbonInvite(msg); } //accept invites sent in a DM
	if (msg.author.id == config.admin_id && msg.content.indexOf("(eval) ") > -1 && msg.content.indexOf("(eval) ") <= 1) { evaluateString(msg); return; } //bot owner eval command
	if (msg.mentions.length !== 0 && !msg.channel.isPrivate) {
		if (msg.isMentioned(bot.user) && msg.content.startsWith("<@" + bot.user.id + ">")) {
			if (ServerSettings.hasOwnProperty(msg.channel.server.id)) { if (ServerSettings[msg.channel.server.id].ignored.indexOf(msg.channel.id) === -1) {
				cleverbot(bot, msg); talkedToTimes += 1; if (!msg.channel.isPrivate) {
					console.log(colors.cServer(msg.channel.server.name) + " > " + colors.cGreen(msg.author.username) + " > " + colors.cYellow("@" + bot.user.username) + " " + msg.content.substring(22).replace(/\n/g, " "));
				} else { console.log(colors.cGreen(msg.author.username) + " > " + colors.cYellow("@Bot-chan") + " " + msg.content.substring(22).replace(/\n/g, " ")); }
			} } else {
				cleverbot(bot, msg); talkedToTimes += 1; if (!msg.channel.isPrivate) {
					console.log(colors.cServer(msg.channel.server.name) + " > " + colors.cGreen(msg.author.username) + " > " + colors.cYellow("@" + bot.user.username) + " " + msg.content.substring(22).replace(/\n/g, " "));
				} else { console.log(colors.cGreen(msg.author.username) + " > " + colors.cYellow("@Bot-chan") + " " + msg.content.substring(22).replace(/\n/g, " ")); }
			}
		}
		if (msg.content.indexOf("<@" + config.admin_id + ">") > -1) {
			if (config.send_mentions) {
				var owner = bot.users.get("id", config.admin_id);
				if (owner.status != "online") { bot.sendMessage(owner, msg.channel.server.name + " > " + msg.author.username + ": " + msg.cleanContent); }
			}
		}
	}
	if (!msg.content.startsWith(config.command_prefix) && !msg.content.startsWith(config.mod_command_prefix)) { return; } //if not a command
	if (msg.author.id == bot.user.id) { return; } //stop from replying to itself
	if (msg.content.indexOf(" ") == 1 && msg.content.length > 2) { msg.content = msg.content.replace(" ", ""); }
	if (!msg.channel.isPrivate && !msg.content.startsWith(config.mod_command_prefix) && ServerSettings.hasOwnProperty(msg.channel.server.id)) {
		if (ServerSettings[msg.channel.server.id].ignored.indexOf(msg.channel.id) > -1) { return; }
	}
	var cmd = msg.content.split(" ")[0].replace(/\n/g, " ").substring(1).toLowerCase();
	var suffix = msg.content.replace(/\n/g, " ").substring(cmd.length + 2); //seperate the command and suffix
	if (msg.content.startsWith(config.command_prefix)) { //normal commands
		if (commands.commands.hasOwnProperty(cmd)) { execCommand(msg, cmd, suffix, "normal");
		} else if (commands.aliases.hasOwnProperty(cmd)) {
			msg.content = msg.content.replace(/[^ ]+ /, config.command_prefix + commands.aliases[cmd] + " ");
			execCommand(msg, commands.aliases[cmd], suffix, "normal");
		}
	} else if (msg.content.startsWith(config.mod_command_prefix)) { //mod commands
		if (cmd == "reload" && msg.author.id == config.admin_id) { reload(); bot.deleteMessage(msg); return; } //reload the .json files and modules
		if (mod.commands.hasOwnProperty(cmd)) { execCommand(msg, cmd, suffix, "mod");
		} else if (mod.aliases.hasOwnProperty(cmd)) {
			msg.content = msg.content.replace(/[^ ]+ /, config.mod_command_prefix + mod.aliases[cmd] + " ");
			execCommand(msg, mod.aliases[cmd], suffix, "mod");
		}
	}
});

function execCommand(msg, cmd, suffix, type) {
	try {
		commandsProcessed += 1;
		if (type == "normal") {
			if (!msg.channel.isPrivate) { console.log(colors.cServer(msg.channel.server.name) + " > " + colors.cGreen(msg.author.username) + " > " + msg.cleanContent.replace(/\n/g, " ")); } else { console.log(colors.cGreen(msg.author.username) + " > " + msg.cleanContent.replace(/\n/g, " ")); }
			if (commands.commands[cmd].hasOwnProperty("cooldown")) {
				if (lastExecTime.hasOwnProperty(cmd)) {
					var id = msg.author.id;
					if (lastExecTime[cmd][id] != undefined) {
						var cTime = new Date();
						var leTime = new Date(lastExecTime[cmd][id]);
						leTime.setSeconds(leTime.getSeconds() + commands.commands[cmd].cooldown);
						if (cTime < leTime) { //if it is still on cooldown
							var left = (leTime.valueOf() - cTime.valueOf()) / 1000;
							if (msg.author.id != config.admin_id) { //admin bypass
								bot.sendMessage(msg, msg.author.username + ", you need to *cooldown* (" + Math.round(left) + " seconds)", function(erro, message) { bot.deleteMessage(message, {"wait": 6000}); });
								return;
							}
						} else { lastExecTime[cmd][id] = cTime; }
					} else { lastExecTime[cmd][id] = new Date(); }
				} else { lastExecTime[cmd] = {}; }
			}
			commands.commands[cmd].process(bot, msg, suffix);
			if (!msg.channel.isPrivate && commands.commands[cmd].hasOwnProperty("deleteCommand")) {
				if (commands.commands[cmd].deleteCommand === true && ServerSettings.hasOwnProperty(msg.channel.server.id) && ServerSettings[msg.channel.server.id].deletecmds == true) { bot.deleteMessage(msg, {"wait": 10000}); }
			}
		} else if (type == "mod") {
			if (!msg.channel.isPrivate) {
				console.log(colors.cServer(msg.channel.server.name) + " > " + colors.cGreen(msg.author.username) + " > " + colors.cBlue(msg.cleanContent.replace(/\n/g, " ").split(" ")[0]) + msg.cleanContent.replace(/\n/g, " ").substr(msg.cleanContent.replace(/\n/g, " ").split(" ")[0].length));
			} else { console.log(colors.cGreen(msg.author.username) + " > " + colors.cBlue(msg.cleanContent.replace(/\n/g, " ").split(" ")[0]) + msg.cleanContent.replace(/\n/g, " ").substr(msg.cleanContent.replace(/\n/g, " ").split(" ")[0].length)); }
			if (mod.commands[cmd].hasOwnProperty("cooldown")) {
				if (lastExecTime.hasOwnProperty(cmd)) {
					var id = msg.author.id;
					if (lastExecTime[cmd][id] != undefined) {
						var cTime = new Date();
						var leTime = new Date(lastExecTime[cmd][id]);
						leTime.setSeconds(leTime.getSeconds() + mod.commands[cmd].cooldown);
						if (cTime < leTime) { //if it is still on cooldown
							var left = (leTime.valueOf() - cTime.valueOf()) / 1000;
							if (msg.author.id != config.admin_id) { //admin bypass
								bot.sendMessage(msg, msg.author.username + ", you need to *cooldown* (" + Math.round(left) + " seconds)", function(erro, message) { bot.deleteMessage(message, {"wait": 6000}); });
								return;
							}
						} else { lastExecTime[cmd][id] = cTime; }
					} else { lastExecTime[cmd][id] = new Date(); }
				} else { lastExecTime[cmd] = {}; }
			}
			mod.commands[cmd].process(bot, msg, suffix);
			if (!msg.channel.isPrivate && mod.commands[cmd].hasOwnProperty("deleteCommand")) {
				if (mod.commands[cmd].deleteCommand === true && ServerSettings.hasOwnProperty(msg.channel.server.id) && ServerSettings[msg.channel.server.id].deletecmds == true) { bot.deleteMessage(msg, {"wait": 10000}); }
			}
		} else { return; }
	} catch (err) { console.log(err.stack); }
}

/* Event Listeners */
bot.on("serverNewMember", (objServer, objUser) => {
	if (config.non_essential_event_listeners && ServerSettings.hasOwnProperty(objServer.id) && ServerSettings[objServer.id].welcomemsg != "false") {
		if (config.debug) { console.log("New member on " + objServer.name + ": " + objUser.username); }
		bot.sendMessage(objServer.defaultChannel, ServerSettings[objServer.id].welcomemsg.replace(/\$USER\$/gi, objUser.username.replace(/@/g, "")).replace(/\$SERVER\$/gi, objServer.name.replace(/@/g, "")));
	}
});

bot.on("channelDeleted", (channel) => {
	if (ServerSettings.hasOwnProperty(channel.server.id)) {
		if (ServerSettings[channel.server.id].ignored.indexOf(channel.id) !== -1) ServerSettings[channel.server.id].ignored = ServerSettings[channel.server.id].ignored.replace("," + channel.server.id, "");
		db.updateServerDB(channel.server.id, () => { console.log("Ignored channel was deleted and removed from DB"); }, () => { console.log("Something went wrong when removing a deleted channel from the database"); });
	}
});

bot.on("userBanned", (objUser, objServer) => {
	if (config.non_essential_event_listeners && ServerSettings.hasOwnProperty(objServer.id) && ServerSettings[objServer.id].banalerts == true) {
		console.log(objUser.username + colors.cRed(" banned on ") + objServer.name);
		bot.sendMessage(objServer.defaultChannel, "⚠ " + objUser.username.replace(/@/g, "@ ") + " was banned");
		bot.sendMessage(objUser, "⚠ You were banned from " + objServer.name);
	}
});

bot.on("userUnbanned", (objUser, objServer) => {
	if (objServer.members.length <= 250 && config.non_essential_event_listeners) { console.log(objUser.username + " unbanned on " + objServer.name); }
});

bot.on("presence", (userOld, userNew) => {
	if (config.log_presence) {
		if (userNew.game === null || userNew.game === undefined) { console.log(colors.cDebug(" PRESENCE ") + userNew.username + " is now " + userNew.status);
		} else { console.log(colors.cDebug(" PRESENCE ") + userNew.username + " is now " + userNew.status + " playing " + userNew.game.name); }
	}
	if (config.non_essential_event_listeners) {
		if (userOld.username != userNew.username) {
			bot.servers.map((ser) => {
				if (ser.members.get("id", userOld.id) && ServerSettings.hasOwnProperty(ser.id) && ServerSettings[ser.id].namechanges == true) {
					bot.sendMessage(ser, "`" + userOld.username.replace(/@/g, "@ ") + "` is now known as `" + userNew.username.replace(/@/g, "@ ")); }
			});
		}
	}
});

bot.on("serverDeleted", (objServer) => {
	console.log(colors.cUYellow("Left server") + " " + objServer.name);
});

/* Login */
console.log("Logging in...");
if (config.is_heroku_version) {
	bot.login(process.env.email, process.env.password, function(err, token) {
		if (err) { console.log(err); setTimeout(() => { process.exit(0); }, 2000); }
		if (!token) { console.log(colors.cWarn(" WARN ") + "failed to connect"); setTimeout(() => { process.exit(0); }, 2000); } //make sure it logged in successfully
	});
} else {
	bot.login(config.email, config.password, function(err, token) {
		if (err) { console.log(err); setTimeout(() => { process.exit(1); }, 2000); }
		if (!token) { console.log(colors.cWarn(" WARN ") + "failed to connect"); setTimeout(() => { process.exit(1); }, 2000); }
	});
}

function carbonInvite(msg) {
	if (msg) {
		try {
			if (config.debug) { console.log(colors.cDebug(" DEBUG ") + "Attempting to join: " + msg.content); }
			var cServers = [];
			bot.servers.map((srvr) => { cServers.push(srvr.id); });
			bot.joinServer(msg.content, function(err, server) {
				if (err) {
					bot.sendMessage(msg, "Failed to join: " + err);
					console.log(colors.cWarn(" WARN ") + err);
				} else if (!server || server.name == undefined || server.roles == undefined || server.channels == undefined || server.members == undefined) { //this problem is a pain in the ass
					console.log(colors.cWarn(" WARN ") + "Error joining server. Didn't receive all data.");
					bot.sendMessage(msg, "Failed to receive all data, please try again.");
					try {
						server.leave();
					} catch (error) { /*how did it get here?*/ }
				} else if (cServers.indexOf(server.id) > -1) {
					console.log("Already in server " + server.name);
					bot.sendMessage(msg, "I'm already in that server!");
				} else {
					if (config.is_heroku_version) {
						if (process.env.banned_server_ids && process.env.banned_server_ids.indexOf(server.id) > -1) {
							console.log(colors.cRed("Joined server but it was on the ban list") + ": " + server.name);
							bot.sendMessage(msg, "This server is on the ban list");
							bot.leaveServer(server); return;
						}
					} else {
						if (config.banned_server_ids && config.banned_server_ids.indexOf(server.id) > -1) {
							console.log(colors.cRed("Joined server but it was on the ban list") + ": " + server.name);
							bot.sendMessage(msg, "This server is on the ban list");
							bot.leaveServer(server); return;
						}
					}
					console.log(colors.cGreen("Joined server: ") + " " + server.name);
					bot.sendMessage(msg, "Successfully joined " + server.name);
					var toSend = [];
					toSend.push("Hi! I'm **" + bot.user.username + "** and I was invited to this server through carbonitex.net.");
					toSend.push("You can use `" + config.command_prefix + "help` to see what I can do. Mods can use `" + config.mod_command_prefix + "help` for mod commands.");
					toSend.push("Mod/Admin commands __including bot settings__ can be viewed with `" + config.mod_command_prefix + "`help ");
					toSend.push("For help / feedback / bugs/ testing / info / changelogs / etc. go to **discord.gg/0kvLlwb7slG3XCCQ**");
					bot.sendMessage(server.defaultChannel, toSend);
				}
			});
		} catch (err) { bot.sendMessage(msg, "Bot encountered an error while joining"); console.log(err); }
	}
}

function reload() {
	delete require.cache[require.resolve("./bot/config.json")];
	config = require("./bot/config.json");
	delete require.cache[require.resolve("./bot/games.json")];
	games = require("./bot/games.json").games;
	delete require.cache[require.resolve("./bot/commands.js")];
	try { commands = require("./bot/commands.js");
	} catch (err) { console.log(colors.cError(" ERROR ") + "Problem loading commands.js: " + err); }
	delete require.cache[require.resolve("./bot/mod.js")];
	try {mod = require("./bot/mod.js");
	} catch (err) { console.log(colors.cError(" ERROR ") + "Problem loading mod.js: " + err); }
	delete require.cache[require.resolve("./bot/config.json")];
	delete require.cache[require.resolve("./bot/versioncheck.js")];
	versioncheck = require("./bot/versioncheck.js");
	delete require.cache[require.resolve("./bot/styles.js")];
	colors = require("./bot/styles.js");
	delete require.cache[require.resolve("./bot/cleverbot.js")];
	cleverbot = require("./bot/cleverbot").cleverbot;
	console.log(colors.BgGreen(" Module Reload ") + " Success");
}

function checkConfig() {
	if (config.is_heroku_version) {
		if (process.env.email === null) { console.log(colors.cWarn(" WARN ") + "Email not defined"); }
		if (process.env.password === null) { console.log(colors.cWarn(" WARN ") + "Password not defined"); }
		if (config.command_prefix === null || config.command_prefix.length !== 1) { console.log(colors.cWarn(" WARN ") + "Prefix either not defined or more than one character"); }
		if (config.mod_command_prefix === null || config.mod_command_prefix.length !== 1) { console.log(colors.cWarn(" WARN ") + "Mod prefix either not defined or more than one character"); }
		if (config.admin_id === null) { console.log(colors.cYellow("Admin user's id not defined") + " in process.env"); }
		if (process.env.mal_user === null) { console.log(colors.cYellow("MAL username not defined") + " in process.env"); }
		if (process.env.mal_pass === null) { console.log(colors.cYellow("MAL password not defined") + " in process.env"); }
		if (process.env.weather_api_key === null) { console.log(colors.cYellow("OpenWeatherMap API key not defined") + " in process.env"); }
		if (process.env.osu_api_key === null) { console.log(colors.cYellow("Osu API key not defined") + " in process.env"); }
	} else {
		if (config.email === null) { console.log(colors.cWarn(" WARN ") + "Email not defined"); }
		if (config.password === null) { console.log(colors.cWarn(" WARN ") + "Password not defined"); }
		if (config.command_prefix === null || config.command_prefix.length !== 1) { console.log(colors.cWarn(" WARN ") + "Prefix either not defined or more than one character"); }
		if (config.mod_command_prefix === null || config.mod_command_prefix.length !== 1) { console.log(colors.cWarn(" WARN ") + "Mod prefix either not defined or more than one character"); }
		if (config.admin_id === null) { console.log(colors.cYellow("Admin user's id not defined") + " in config"); }
		if (config.mal_user === null) { console.log(colors.cYellow("MAL username not defined") + " in config"); }
		if (config.mal_pass === null) { console.log(colors.cYellow("MAL password not defined") + " in config"); }
		if (config.weather_api_key === null) { console.log(colors.cYellow("OpenWeatherMap API key not defined") + " in config"); }
		if (config.osu_api_key === null) { console.log(colors.cYellow("Osu API key not defined") + " in config"); }
	}
}

function evaluateString(msg) {
	if (msg.author.id != config.admin_id) { console.log(colors.cWarn(" WARN ") + "Somehow an unauthorized user got into eval!"); return; }
	var timeTaken = new Date();
	console.log("Running eval");
	var result;
	try { result = eval("try{" + msg.content.substring(7).replace(/\n/g, "") + "}catch(err){console.log(colors.cError(\" ERROR \")+err);bot.sendMessage(msg, \"```\"+err+\"```\");}");
	} catch (e) { console.log(colors.cError(" ERROR ") + e); bot.sendMessage(msg, "```" + e + "```"); }
	if (result && typeof result !== "object") {
		bot.sendMessage(msg,  "`Time taken: " + (timeTaken - msg.timestamp) + "ms`\n" + result);
		console.log("Result: " + result);
	}

}

db.fetchServerDB("servers");

setInterval(() => {
	bot.setPlayingGame(games[Math.floor(Math.random() * (games.length))]);
	if (config.debug) { console.log(colors.cDebug(" DEBUG ") + "Updated bot's game"); }
}, 800000); //change playing game every 12 minutes
