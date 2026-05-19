const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Succès !' });
});

app.listen(5000, () => {
    console.log('Serveur sur http://localhost:5000');
});