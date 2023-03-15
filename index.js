require('dotenv').config();
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const { Client, LocalAuth, LegacySessionAuth, MessageMedia } = require('whatsapp-web.js');
const { Configuration, OpenAIApi } = require("openai");

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);


const client = new Client({
  authStrategy: new LocalAuth(),
})

client.on('authenticated', (session) => {
  console.log(session);
});

client.on('qr', (qr) => {
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  console.log('Client is ready!');
});

client.on('message', async msg => {
  const message = msg.body;
  const chat = await msg.getChat();

  const userId = msg.from;

  fs.readFile("history.json", "utf8", async function (err, data) {
    if (err) throw err;
    const commandHistory = JSON.parse(data);
    const userIndex = commandHistory.findIndex(item => item.userId === userId);
    const userData = commandHistory[userIndex];

    if (userIndex !== -1) {
      const newMessage = {role: "user", content: message};
      const messages = [...userData.commands, newMessage];

      const completion = await openai.createChatCompletion({
        model: "gpt-3.5-turbo",
        messages: [...messages]
      });

      client.sendMessage(msg.from, completion.data.choices[0].message.content);

      commandHistory[userIndex].commands = [...messages, {
        role: "assistant",
        content: completion.data.choices[0].message.content
      }];
    } else {
      const messages = [
        {
          role: "system", 
          content: "You are ChatGPT, a large language model trained by OpenAI. Follow the user's instructions carefully!"
        },
        {role: "user", content: message},
      ]

      const completion = await openai.createChatCompletion({
        model: "gpt-3.5-turbo",
        messages: [...messages]
      });

      client.sendMessage(msg.from, completion.data.choices[0].message.content);

      commandHistory.push({userId: userId, commands: [
        ...messages,
        {
          role: "assistant",
          content: completion.data.choices[0].message.content
        }
      ]});
    }
    fs.writeFile('history.json', JSON.stringify(commandHistory), (err) => {
      if (err) throw err;
      console.log('Command history saved to JSON file');
    });
  });
});

client.initialize();
