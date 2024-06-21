const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

const app = express();
app.use(bodyParser.json());

// Inicializar e abrir o banco de dados SQLite
let db;
(async () => {
    db = await open({
        filename: './interviews.db',
        driver: sqlite3.Database
    });

    // Criar a tabela se não existir
    await db.exec(`
        CREATE TABLE IF NOT EXISTS interviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user TEXT,
            message TEXT,
            response TEXT
        )
    `);
})();

const apiKey = 'sk-proj-noyRwnJ4ghCW13SEZjUtT3BlbkFJX5FRfSPDC9I1z8TIA3s5';

app.post('/api/message', async (req, res) => {
    const { user, message } = req.body;

    const chatGPTResponse = await getChatGPTResponse(message);

    // Inserir a mensagem e resposta no banco de dados
    await db.run('INSERT INTO interviews (user, message, response) VALUES (?, ?, ?)', [user, message, chatGPTResponse]);

    res.json({ response: chatGPTResponse });
});

async function getChatGPTResponse(message) {
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: 'gpt-4',
        messages: [{ role: 'system', content: 'Você é um especialista em carreira, ajude a pessoa a melhorar suas habilidades e a progredir em sua carreira.' }, { role: 'user', content: message }]
    }, {
        headers: {
            'Authorization': `Bearer ${apiKey}`
        }
    });

    return response.data.choices[0].message.content;
}

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});
