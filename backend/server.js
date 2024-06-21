const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const Sentiment = require('sentiment');

const app = express();
app.use(bodyParser.json());

const sentiment = new Sentiment();

const db = new sqlite3.Database('./interviews.db', (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        db.run(`
            CREATE TABLE IF NOT EXISTS interviews (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user TEXT,
                message TEXT,
                response TEXT,
                sentiment_score INTEGER
            );
        `, (err) => {
            if (err) {
                console.error('Error creating table:', err.message);
            }
        });
    }
});

const apiKey = 'sk-proj-noyRwnJ4ghCW13SEZjUtT3BlbkFJX5FRfSPDC9I1z8TIA3s5';

app.post('/api/message', async (req, res) => {
    const { user, message } = req.body;

    const chatGPTResponse = await getChatGPTResponse(message);
    const sentimentResult = sentiment.analyze(message);
    const sentimentScore = sentimentResult.score;

    db.run('INSERT INTO interviews (user, message, response, sentiment_score) VALUES (?, ?, ?, ?)', [user, message, chatGPTResponse, sentimentScore], (err) => {
        if (err) {
            console.error('Error inserting data:', err.message);
        }
    });

    res.json({ response: chatGPTResponse });
});

app.get('/api/generate_chart', async (req, res) => {
    const { user } = req.query;
    db.all('SELECT sentiment_score FROM interviews WHERE user = ?', [user], (err, rows) => {
        if (err) {
            console.error('Error fetching data:', err.message);
            res.status(500).send('Internal Server Error');
            return;
        }

        const scores = rows.map(row => row.sentiment_score);

        // Gerar o gráfico usando Python
        const { spawn } = require('child_process');
        const pythonProcess = spawn('python', ['generate_chart.py', JSON.stringify(scores)]);

        pythonProcess.stdout.on('data', (data) => {
            res.contentType('image/png');
            res.send(data);
        });

        pythonProcess.stderr.on('data', (data) => {
            console.error(`Error: ${data}`);
            res.status(500).send('Internal Server Error');
        });
    });
});


async function getChatGPTResponse(message) {
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: 'gpt-4',
        messages: [
            { role: 'system', content: 'Você é um especialista em carreira. Inicie e conduza uma entrevista de forma livre, interpretando os sentimentos das respostas.' },
            { role: 'user', content: message }
        ]
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
