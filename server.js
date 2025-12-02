const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

console.log('🚀 SCANNER BETANO - SISTEMA MANUAL');
console.log('✅ 100% funcional sem API externa');

// Arquivo para salvar jogos
const ARQUIVO_DADOS = path.join(__dirname, 'dados.json');

// Dados iniciais (exemplo)
const dadosIniciais = {
    jogos: [
        {
            id: 1,
            horario: '19:30',
            times: 'Chippa United × Kaizer Chiefs',
            campeonato: 'PSL África do Sul',
            oddsOver05: 1.14,
            oddsOver15: 1.62,
            ativo: true
        },
        {
            id: 2,
            horario: '20:00',
            times: 'Real Madrid × Barcelona',
            campeonato: 'La Liga',
            oddsOver05: 1.15,
            oddsOver15: 1.68,
            ativo: true
        },
        {
            id: 3,
            horario: '21:30',
            times: 'Manchester City × Liverpool',
            campeonato: 'Premier League',
            oddsOver05: 1.12,
            oddsOver15: 1.58,
            ativo: true
        }
    ]
};

// Inicializar arquivo de dados
function inicializarDados() {
    if (!fs.existsSync(ARQUIVO_DADOS)) {
        fs.writeFileSync(ARQUIVO_DADOS, JSON.stringify(dadosIniciais, null, 2));
        console.log('📁 Arquivo de dados criado');
    }
}

// Carregar dados
function carregarDados() {
    try {
        const conteudo = fs.readFileSync(ARQUIVO_DADOS, 'utf8');
        return JSON.parse(conteudo);
    } catch (error) {
        console.error('Erro ao carregar dados:', error.message);
        return dadosIniciais;
    }
}

// Salvar dados
function salvarDados(dados) {
    try {
        fs.writeFileSync(ARQUIVO_DADOS, JSON.stringify(dados, null, 2));
        return true;
    } catch (error) {
        console.error('Erro ao salvar dados:', error.message);
        return false;
    }
}

// Inicializar
inicializarDados();

// Rota principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rota para buscar jogos
app.get('/api/jogos', (req, res) => {
    console.log('📡 Buscando jogos cadastrados...');
    
    const dados = carregarDados();
    const jogosAtivos = dados.jogos.filter(jogo => jogo.ativo !== false);
    
    // Separar Over 0.5 e 1.5
    const over05 = jogosAtivos
        .filter(j => j.oddsOver05 >= 1.10)
        .sort((a, b) => b.oddsOver05 - a.oddsOver05)
        .map(j => ({
            horario: j.horario,
            times: j.times,
            campeonato: j.campeonato,
            oddsOver05: j.oddsOver05
        }));
    
    const over15 = jogosAtivos
        .filter(j => j.oddsOver15 >= 1.50)
        .sort((a, b) => b.oddsOver15 - a.oddsOver15)
        .map(j => ({
            horario: j.horario,
            times: j.times,
            campeonato: j.campeonato,
            oddsOver15: j.oddsOver15
        }));
    
    res.json({
        over05: over05,
        over15: over15,
        atualizacao: new Date().toLocaleTimeString('pt-BR'),
        estatisticas: {
            over05: over05.length,
            over15: over15.length,
            totalJogos: jogosAtivos.length,
            fonte: 'manual'
        },
        sucesso: true,
        mensagem: `${jogosAtivos.length} jogos cadastrados`
    });
});

// Rota para ADMIN - Adicionar/Editar jogos
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// API para admin
app.get('/api/admin/jogos', (req, res) => {
    const dados = carregarDados();
    res.json(dados.jogos);
});

app.post('/api/admin/jogos', (req, res) => {
    const dados = carregarDados();
    const novoJogo = {
        id: dados.jogos.length > 0 ? Math.max(...dados.jogos.map(j => j.id)) + 1 : 1,
        horario: req.body.horario,
        times: req.body.times,
        campeonato: req.body.campeonato,
        oddsOver05: parseFloat(req.body.oddsOver05),
        oddsOver15: parseFloat(req.body.oddsOver15),
        ativo: true
    };
    
    dados.jogos.push(novoJogo);
    salvarDados(dados);
    
    res.json({ sucesso: true, mensagem: 'Jogo adicionado!' });
});

app.put('/api/admin/jogos/:id', (req, res) => {
    const dados = carregarDados();
    const id = parseInt(req.params.id);
    const index = dados.jogos.findIndex(j => j.id === id);
    
    if (index !== -1) {
        dados.jogos[index] = {
            ...dados.jogos[index],
            ...req.body,
            oddsOver05: parseFloat(req.body.oddsOver05),
            oddsOver15: parseFloat(req.body.oddsOver15)
        };
        
        salvarDados(dados);
        res.json({ sucesso: true, mensagem: 'Jogo atualizado!' });
    } else {
        res.status(404).json({ sucesso: false, mensagem: 'Jogo não encontrado' });
    }
});

app.delete('/api/admin/jogos/:id', (req, res) => {
    const dados = carregarDados();
    const id = parseInt(req.params.id);
    dados.jogos = dados.jogos.filter(j => j.id !== id);
    salvarDados(dados);
    res.json({ sucesso: true, mensagem: 'Jogo removido!' });
});

// Health check
app.get('/health', (req, res) => {
    const dados = carregarDados();
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        totalJogos: dados.jogos.length,
        jogosAtivos: dados.jogos.filter(j => j.ativo !== false).length,
        mensagem: 'Sistema manual operacional'
    });
});

app.listen(PORT, () => {
    console.log(`\n✅ SISTEMA PRONTO: http://localhost:${PORT}`);
    console.log(`👉 Admin: http://localhost:${PORT}/admin`);
    console.log(`👉 Health: http://localhost:${PORT}/health`);
    console.log('============================================');
    console.log('📋 INSTRUÇÕES:');
    console.log('1. Acesse a página principal para ver jogos');
    console.log('2. Acesse /admin para cadastrar novos jogos');
    console.log('3. Sistema 100% funcional sem APIs externas');
});