# Discord Bot

A small discord bot for personal use.


Coded using Node.js and the [discord.io library](https://github.com/izy521/discord.io)

Known issues:
	- Multi server problems
		- Eg. !stop will stop audio across servers (not a priority as this is for personal use and only on 1 server)
	
## Getting started

To get started with the bot, clone the repo and then install the needed node modules (assumes node.js already set up):

```
$ npm install
```

Then start the bot:

```
$ node bot.js
```

Or using [Forever](https://github.com/foreverjs/forever) (to keep the bot running):

```
$ forever bot.js
```