const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

console.log('🚀 Scanner Betano - Versão Simples');

// Rota principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rota para jogos (DADOS FIXOS QUE FUNCIONAM)
app.get('/api/jogos', (req, res) => {
    console.log('📡 Requisição recebida em /api/jogos');
    
    // Dados FIXOS que sempre funcionam
    const jogosFixos = [
        {
            horario: '19:30',
            times: 'Chippa United × Kaizer Chiefs',
            campeonato: 'PSL África do Sul',
            oddsOver05: 1.14,
            oddsOver15: 1.62
        },
        {
            horario: '20:00',
            times: 'Real Madrid × Barcelona',
            campeonato: 'La Liga',
            oddsOver05: 1.15,
            oddsOver15: 1.68
        },
        {
            horario: '21:30',
            times: 'Manchester City × Liverpool',
            campeonato: 'Premier League',
            oddsOver05: 1.12,
            oddsOver15: 1.58
        },
        {
            horario: '19:45',
            times: 'Bayern Munich × Borussia Dortmund',
            campeonato: 'Bundesliga',
            oddsOver05: 1.18,
            oddsOver15: 1.72
        },
        {
            horario: '22:00',
            times: 'PSG × Marseille',
            campeonato: 'Ligue 1',
            oddsOver05: 1.16,
            oddsOver15: 1.65
        },
        {
            horario: '20:30',
            times: 'Flamengo × Corinthians',
            campeonato: 'Brasileirão',
            oddsOver05: 1.13,
            oddsOver15: 1.55
        },
        {
            horario: '21:00',
            times: 'Ajax × PSV',
            campeonato: 'Eredivisie',
            oddsOver05: 1.19,
            oddsOver15: 1.75
        },
        {
            horario: '20:45',
            times: 'Benfica × Porto',
            campeonato: 'Primeira Liga',
            oddsOver05: 1.17,
            oddsOver15: 1.70
        }
    ];
    
    // Separar Over 0.5 e 1.5
    const over05 = jogosFixos
        .filter(j => j.oddsOver05 >= 1.10)
        .sort((a, b) => b.oddsOver05 - a.oddsOver05);
    
    const over15 = jogosFixos
        .filter(j => j.oddsOver15 >= 1.50)
        .sort((a, b) => b.oddsOver15 - a.oddsOver15);
    
    res.json({
        over05: over05,
        over15: over15,
        atualizacao: new Date().toLocaleTimeString('pt-BR'),
        estatisticas: {
            over05: over05.length,
            over15: over15.length,
            total: jogosFixos.length
        },
        sucesso: true,
        mensagem: 'Dados de exemplo funcionais'
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', time: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`✅ Servidor rodando: http://localhost:${PORT}`);
    console.log(`✅ API: http://localhost:${PORT}/api/jogos`);
    console.log(`✅ Health: http://localhost:${PORT}/health`);
});