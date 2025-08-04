import 'dotenv/config';
import express from 'express';
import fetch from 'node-fetch';
import fs from 'fs';

const app = express();
app.use(express.json());

const APIFY_TOKEN = process.env.APIFY_TOKEN;
const ACTOR_ID = process.env.ACTOR_ID;

app.post('/parse', async (req, res) => {
    const { url } = req.body;
    console.log('Запуск парсера на Apify...');

    try {
        // 1. Запуск актора
        const startRun = await fetch(`https://api.apify.com/v2/acts/${ACTOR_ID}/runs?token=${APIFY_TOKEN}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ startUrl: url })
        });
        const startData = await startRun.json();

        if (!startData.data || !startData.data.id) {
            console.error('API не вернул ID запуска:', startData);
            return res.status(500).json({ error: 'Не удалось запустить актор' });
        }

        const runId = startData.data.id;
        console.log('Парсер запущен! Run ID:', runId);

        // 2. Ждём завершения работы
        let status = 'RUNNING';
        while (status === 'RUNNING') {
            await new Promise(r => setTimeout(r, 5000));
            const check = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`);
            const checkData = await check.json();
            status = checkData.data.status;
            console.log('Статус:', status);
        }

        if (status !== 'SUCCEEDED') {
            return res.status(500).json({ error: 'Парсер завершился с ошибкой' });
        }

        // 3. Скачиваем результат
        const datasetId = startData.data.defaultDatasetId;
        const resultUrl = `https://api.apify.com/v2/datasets/${datasetId}/items?format=json&clean=true&token=${APIFY_TOKEN}`;
        const result = await fetch(resultUrl);
        const json = await result.json();

        fs.writeFileSync('result.json', JSON.stringify(json, null, 2), 'utf8');
        console.log('✅ Результат сохранён в result.json');

        res.json({ message: 'Парсинг завершён', data: json });

    } catch (err) {
        console.error('Ошибка сервера:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.listen(3000, () => console.log('Сервер запущен на порту 3000'));
