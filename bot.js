//dependencies
var logger = require("winston");
var Discord = require('discord.io');
var http = require('http');
var urban = require("urban");
var ytdl = require('ytdl-core');
var fs = require("fs");
var childProcess = require("child_process");

var spawn = childProcess.spawn;
var volume = 'volume=0.25';

var activeAudio = false;
var activeAudioChannel;   //var to hold the current channel the bot is playing audio in

//load config for auth keys etc.
var config = require('./config');

//Logging settings
logger.remove(logger.transports.Console);
logger.add(logger.transports.Console, {
    colorize : true
});
logger.level = 'debug';

//Exit handler
process.on('SIGINT', function(){
  process.exit()
});

process.on('uncaughtException', function(err){
  logger.info(err.stack);
  process.exit()
});

//bot variable
var bot = new Discord.Client({
        autorun : true,
        token: config.discordtoken
});

var messageHelpArr = ["Command : Description", "---------------------------", "roll : rolls a 6 sided die", "rng : Randomly generates a number", "8ball : Ask me a question",
 "ud : Search Urban Dictionary, or get a random definition", "yt : Play YouTube audio to your current voice channel", "stop : Stop the currently playing audio (In your channel or given the channel id)"];

//Helper function for multiple messages
function sendMessages(ID, messageArr, interval) {
	var resArr = [], len = messageArr.length;
	var callback = typeof(arguments[2]) === 'function' ?  arguments[2] :  arguments[3];
	if (typeof(interval) !== 'number') interval = 1000;

	function _sendMessages() {
		setTimeout(function() {
			if (messageArr[0]) {
				bot.sendMessage({
					to: ID,
					message: '```\n' + messageArr.shift() + '```\n'
				}, function(err, res) {
					resArr.push(err || res);
					if (resArr.length === len) if (typeof(callback) === 'function') callback(resArr);
				});
				_sendMessages();
			}
		}, interval);
	}
	_sendMessages();
}

bot.on("ready", function (rawEvent) {
    logger.info("Connected!");
    logger.info("Logged in as: ");
    logger.info(bot.username + " - (" + bot.id + ")");

});

//Commands
bot.on("message", function (user, userID, channelID, message, rawEvent) {
    if (message.substring(0, 1) == "!") {
        var arguments = message.substring(1).split(" ");
        var command = arguments[0];
        arguments = arguments.splice(1);

        //find the current server the message was sent in
        for (var server in bot.servers){
          for (var channel in bot.servers[server].channels){
            if (channel == channelID){
              var messageServer = server;
              break
            }
          }
        }

        //Set the voice channel id as the current voice channel of the user
        var VCID = bot.servers[messageServer].members[userID].voice_channel_id;

        switch(command){
          case "help":
            help();
            break;
          case "goodshit":
            goodshit();
            break;
          case "roll":
            roll();
            break;
          case "rng":
            rng(arguments);
            break;
          case "8ball":
            eightBall(arguments);
            break;
          case "rule34":
            rule34(arguments);
            break;
          case "ud":
            ud(arguments);
            break;
          case "yt":
            yt(arguments);
            break;
          case "stop":
            stopAudio(arguments);
            break;
          case "volume":
            changeVolume(arguments)
            break;
          case "dog":
            dog();
            break;
        }

        function help(){
          var sendMsg = '```\n'
          for (var i in messageHelpArr) {
            sendMsg += messageHelpArr[i] + '\n'
          }
          sendMsg += '\n```'
          bot.sendMessage({
            to : channelID,
            message : sendMsg});
          return;
        }

        function roll(){
          rng([6]);
          return;
        }

        function rng(arguments) {
          if (arguments.length != 1){
            sendMessages(channelID, ["Command: Random Number Generator\n\nUsage: !rng [number]"])
            return
          }
          var number = Math.floor((Math.random() * arguments[0]) + 1);
          bot.sendMessage({
            to : channelID,
            message : "You have rolled a " + number.toString()
          })
          return;
        }

        function eightBall(arguments) {
          if (arguments.length == 0){
            sendMessages(channelID, ["Command: Magic 8 Ball \n\nUsage: !8ball [Question]"])
            return;
          }
          var answers = ['Maybe.', 'Certainly not.', 'I hope so.', 'Not in your wildest dreams.',
                        'There is a good chance.', 'Quite likely.', 'I think so.', 'I hope not.',
                        'I hope so.', 'Never!', 'Fuhgeddaboudit.', 'Ahaha! Really?!?', 'Pfft.',
                        'Sorry, bucko.', 'Hell, yes.', 'Hell to the no.', 'The future is bleak.',
                        'The future is uncertain.', 'I would rather not say.', 'Who cares?',
                        'Possibly.', 'Never, ever, ever.', 'There is a small chance.', 'Yes!'];
          sendMessages(channelID, [answers[(Math.floor(Math.random() * answers.length))]])
          return;
        }

          function ud(arguments){
            if (arguments.length >= 1){   //search mode
              argumentsStr = (arguments.toString()).replace(/,/g, " ")
              result = urban(argumentsStr);
              result.first(function(json) {
                try{
                  messagesArrUD = [argumentsStr + ":", json.definition, "Examples: ", json.example, ("Author: " + json.author)];
                  var sendMsg = '```\n'
                  for (var i in messagesArrUD) {
                    sendMsg += messagesArrUD[i] + '\n'
                  }
                  sendMsg += '\n```'
                  bot.sendMessage({
                    to : channelID,
                    message : sendMsg});
                }
                catch(err){
                  sendMessages(channelID, ["No entry found on Urban Dictionary for " + argumentsStr])
                }
            });
            return;
          }
          else{
            urban.random().first(function(json) {
              messagesArrUD = [json.word + ":", json.definition, "Examples: ", json.example, ("Author: " + json.author)];
              var sendMsg = '```\n'
              for (var i in messagesArrUD) {
                sendMsg += messagesArrUD[i] + '\n'
              }
              sendMsg += '\n```'
              bot.sendMessage({
                to : channelID,
                message : sendMsg});
            });
          }
          return;
        }

        function yt(arguments){
          if (VCID == null){
            sendMessages(channelID, ["Join a voice channel to play YouTube audio"])
            return
          }
          if (activeAudio == true){
            sendMessages(channelID, ["Bot is already playing audio"])
            return;
          }
          var url = arguments[0];

          var audioOutput = (__dirname + '/sound.mp4');
          ytdl(url, { filter: function(f) {
            return f.container === 'mp4' && !f.encoding; } })
            // Write audio to file since ffmpeg supports only one input stream.
            .pipe(fs.createWriteStream(audioOutput))
            .on('finish', function() {
              logger.info("finished downloading audio")
              bot.joinVoiceChannel(VCID, function(err, events) {
              if (err) return console.error(err);
              events.on('speaking', function(userID, SSRC, speakingBool) {
                  console.log("%s is " + (speakingBool ? "now speaking" : "done speaking"), userID );
              });
              activeAudio = true;
              activeAudioChannel = VCID;
              bot.getAudioContext(VCID, function(err, stream) {
                if (err) return console.error(err);
                  var ffmpeg = spawn('ffmpeg', [
                    '-i', audioOutput,
                    '-af', volume,
                    '-f', 's16le',
                    '-ar', '48000',
                    '-ac', '2', //If you want one audio channel (mono), you can omit `stereo: true` in `getAudioContext`
                    'pipe:1'
                    ], {
                      stdio: ['pipe', 'pipe', 'ignore']
                    });
                  ffmpeg.stdout.once('readable', function() {
                    stream.send(ffmpeg.stdout);
                  });
                  ffmpeg.stdout.once('end', function() {
                    bot.leaveVoiceChannel(VCID);
                    activeAudio = false;
                  });
                });
              });
            });
            return;
        }

        function stopAudio(arguments){ //stop audio command
          if (!activeAudio){
            sendMessages(channelID, ["Bot is not currently playing audio"])
            return;
          }
          if(arguments.length == 1){
            bot.leaveVoiceChannel(arguments[0])
            activeAudio = false;
            return;
          }
          bot.leaveVoiceChannel(activeAudioChannel);
          activeAudio = false;
          activeAudioChannel = null;
          return;
        }

        function changeVolume(arguments){
          if (arguments.length == 0){
            sendMessages(channelID, [("Current volume: " + volume), "Use !volume [0-1] to change the volume"])
            return
          }
          else{
            try{
              var new_vol = parseFloat(arguments[0])
              if (new_vol <=1 && new_vol >=0){
                volume = "volume=" + new_vol.toString();
                logger.info(volume)
              }
              else{
                sendMessages(channelID, [("Current volume: " + volume), "Use !volume [0-1] to change the volume"])
                return
              }
            }
            catch(err){
              sendMessages(channelID, [("Current volume: " + volume), "Use !volume [0-1] to change the volume"])
              return
            }
          }
        }

      }
    })
