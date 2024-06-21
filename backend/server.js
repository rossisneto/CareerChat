const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const Sentiment = require('sentiment');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
require('dotenv').config();  // Carrega as variáveis do arquivo .env

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
                sentiment_score INTEGER,
                resume BLOB
            )
        `, (err) => {
            if (err) {
                console.error('Error creating table:', err.message);
            }
        });
    }
});

const apiKey =  process.env.OPENAI_API_KEY;

const stages = [
    [
        "Qual é o seu nome?",
        "Qual é a sua idade?",
        "Qual é o seu sexo?",
        "Qual é o seu cargo atual?"
    ],
    [
        "Como você descreveria sua comunicação?",
        "Você se considera um bom líder? Por quê?",
        "Como você lida com a pressão?",
        "Você prefere trabalhar em equipe ou sozinho?",
        "Qual é a sua maior qualidade?"
    ],
    [
        "Quais são suas habilidades técnicas?",
        "Qual é sua experiência com programação?",
        "Você já trabalhou com metodologias ágeis?",
        "Quais ferramentas você utiliza no seu trabalho diário?",
        "Você possui certificações? Quais?"
    ],
    [
        "Como você descreveria seu estágio atual de desenvolvimento profissional?",
        "Quais são suas ambições de carreira?",
        "Você busca por constante aprendizado?",
        "Quais são seus objetivos a curto prazo?",
        "Quais são seus objetivos a longo prazo?"
    ],
    [
        "Quais são suas preferências de trabalho?",
        "Você tem alguma observação sobre sua carreira?",
        "Quais são seus hobbies?",
        "Como você equilibra trabalho e vida pessoal?",
        "Você gostaria de adicionar alguma informação extra?"
    ]
];

let currentStageIndex = 0;
let currentQuestionIndex = 0;
let interviewData = {};

app.post('/api/message', async (req, res) => {
    const { user, message } = req.body;

    try {
        const chatGPTResponse = await getChatGPTResponse(message);
        const sentimentResult = sentiment.analyze(message);
        const sentimentScore = sentimentResult.score;

        if (!interviewData[user]) {
            interviewData[user] = {};
        }
        interviewData[user][stages[currentStageIndex][currentQuestionIndex - 1]] = message;

        db.run('INSERT INTO interviews (user, message, response, sentiment_score) VALUES (?, ?, ?, ?)', [user, message, chatGPTResponse, sentimentScore], (err) => {
            if (err) {
                console.error('Error inserting data:', err.message);
                res.status(500).send('Internal Server Error');
                return;
            }

            if (currentQuestionIndex < stages[currentStageIndex].length) {
                const nextQuestion = stages[currentStageIndex][currentQuestionIndex++];
                res.json({ response: chatGPTResponse + "\n\n" + nextQuestion });
            } else if (currentStageIndex < stages.length - 1) {
                currentStageIndex++;
                currentQuestionIndex = 0;
                const nextQuestion = stages[currentStageIndex][currentQuestionIndex++];
                res.json({ response: chatGPTResponse + "\n\n" + nextQuestion });
            } else {
                generateRadarChart(interviewData[user], user, (chartPath) => {
                    generatePDF(user, interviewData[user], chartPath, (pdfPath) => {
                        const pdfData = fs.readFileSync(pdfPath);
                        db.run('UPDATE interviews SET resume = ? WHERE user = ?', [pdfData, user], (err) => {
                            if (err) {
                                console.error('Error updating data:', err.message);
                                res.status(500).send('Internal Server Error');
                                return;
                            }
                            res.json({ response: chatGPTResponse + "\n\nTemos informações suficientes para gerar o gráfico.", pdf: pdfPath });
                        });
                    });
                });
            }
        });
    } catch (error) {
        console.error('Error processing request:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/api/next_question', (req, res) => {
    if (currentQuestionIndex < stages[currentStageIndex].length) {
        res.json({ question: stages[currentStageIndex][currentQuestionIndex++] });
    } else if (currentStageIndex < stages.length - 1) {
        currentStageIndex++;
        currentQuestionIndex = 0;
        res.json({ question: stages[currentStageIndex][currentQuestionIndex++] });
    } else {
        res.json({ question: "Temos informações suficientes para gerar o gráfico." });
    }
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

app.get('/api/generate_chart', async (req, res) => {
    const { user } = req.query;
    db.all('SELECT sentiment_score FROM interviews WHERE user = ?', [user], (err, rows) => {
        if (err) {
            console.error('Error fetching data:', err.message);
            res.status(500).send('Internal Server Error');
            return;
        }

        const scores = rows.map(row => row.sentiment_score);

        const pythonProcess = spawn('python', ['generate_radar_chart.py', JSON.stringify(scores), user]);

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

app.get('/api/download_resume', (req, res) => {
    const { user } = req.query;
    db.get('SELECT resume FROM interviews WHERE user = ?', [user], (err, row) => {
        if (err) {
            console.error('Error fetching data:', err.message);
            res.status(500).send('Internal Server Error');
            return;
        }

        if (row && row.resume) {
            res.contentType('application/pdf');
            res.send(row.resume);
        } else {
            res.status(404).send('Resume not found');
        }
    });
});

function generateRadarChart(data, user, callback) {
    const pythonProcess = spawn('python', ['generate_radar_chart.py', JSON.stringify(data), user]);

    pythonProcess.stdout.on('data', (data) => {
        const chartPath = data.toString().trim();
        callback(chartPath);
    });

    pythonProcess.stderr.on('data', (data) => {
        console.error(`Error: ${data}`);
    });
}

function generatePDF(user, data, chartPath, callback) {
    const doc = new PDFDocument();
    const pdfPath = path.join(__dirname, `${user}_resume.pdf`);

    doc.pipe(fs.createWriteStream(pdfPath));
    doc.fontSize(16).text(`Currículo de ${user}`, { align: 'center' });
    doc.moveDown();

    for (const [question, answer] of Object.entries(data)) {
        doc.fontSize(12).text(`${question}`, { bold: true });
        doc.fontSize(12).text(`${answer}`);
        doc.moveDown();
    }

    doc.addPage()
       .image(chartPath, {
           fit: [500, 400],
           align: 'center',
           valign: 'center'
       });

    doc.end();

    callback(pdfPath);
}

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});
