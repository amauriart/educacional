document.addEventListener('DOMContentLoaded', function() {
    const elementos = {
        btnAtualizar: document.getElementById('btnAtualizar'),
        ultimaAtualizacao: document.getElementById('ultimaAtualizacao'),
        loading: document.getElementById('loading'),
        jogosOver05: document.getElementById('jogosOver05'),
        jogosOver15: document.getElementById('jogosOver15'),
        tabButtons: document.querySelectorAll('.tab-button')
    };

    // Iniciar
    setTimeout(carregarJogos, 500);
    
    // Eventos
    elementos.btnAtualizar.addEventListener('click', carregarJogos);
    
    elementos.tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab');
            elementos.tabButtons.forEach(b => b.classList.remove('active'));
            button.classList.add('active');
            
            document.querySelectorAll('.tab-content').forEach(c => {
                c.classList.remove('active');
            });
            document.getElementById(tabId).classList.add('active');
        });
    });
    
    async function carregarJogos() {
        mostrarLoading(true);
        elementos.btnAtualizar.disabled = true;
        elementos.btnAtualizar.textContent = 'Buscando...';
        elementos.ultimaAtualizacao.textContent = 'Conectando...';
        elementos.ultimaAtualizacao.style.color = '#666';
        
        try {
            const inicio = performance.now();
            const resposta = await fetch('/api/jogos');
            const dados = await resposta.json();
            const tempo = Math.round(performance.now() - inicio);
            
            atualizarInterface(dados, tempo);
            
        } catch (erro) {
            console.error('Erro:', erro);
            elementos.ultimaAtualizacao.textContent = '❌ Erro de conexão';
            elementos.ultimaAtualizacao.style.color = '#dc3545';
            mostrarErro();
        } finally {
            mostrarLoading(false);
            elementos.btnAtualizar.disabled = false;
            elementos.btnAtualizar.textContent = '🔄 Atualizar';
        }
    }
    
    function atualizarInterface(dados, tempo) {
        // Exibir jogos
        exibirJogosLista(dados.over05 || [], elementos.jogosOver05, '0.5', dados.erro);
        exibirJogosLista(dados.over15 || [], elementos.jogosOver15, '1.5', dados.erro);
        
        // Atualizar status
        let status = `${dados.erro ? ⚠️' : '✅'} ${dados.atualizacao || new Date().toLocaleTimeString('pt-BR')}`;
        status += ` | ${tempo}ms`;
        
        if (dados.estatisticas) {
            status += ` | ${dados.estatisticas.over05 || 0} Over 0.5`;
            status += ` | ${dados.estatisticas.over15 || 0} Over 1.5`;
            if (dados.estatisticas.cache) status += ' | ⚡Cache';
        }
        
        elementos.ultimaAtualizacao.textContent = status;
        elementos.ultimaAtualizacao.style.color = dados.erro ? '#ff9800' : '#00a650';
    }
    
    function exibirJogosLista(jogos, container, tipo, erro) {
        if (!jogos || jogos.length === 0) {
            container.innerHTML = `
                <div class="vazio">
                    <div style="font-size: 3rem; margin-bottom: 15px;">
                        ${erro ? '⚠️' : '😕'}
                    </div>
                    <p style="font-weight: bold; margin-bottom: 10px;">
                        ${erro ? 'API temporariamente indisponível' : 'Nenhum jogo encontrado'}
                    </p>
                    <p style="color: #666; margin-bottom: 15px;">
                        Over ${tipo} | Odds ≥ ${tipo === '0.5' ? '1.10' : '1.50'} | Betano | 48h
                    </p>
                </div>`;
            return;
        }
        
        container.innerHTML = jogos.map((jogo, i) => `
            <div class="jogo-card" style="animation-delay: ${i * 0.05}s">
                ${erro ? '<div class="badge-fallback">EXEMPLO</div>' : ''}
                <div class="jogo-header">
                    <span class="jogo-horario">${jogo.horario}</span>
                    <span class="jogo-odds">
                        Over ${tipo}: <strong>${jogo['oddsOver' + tipo.replace('.', '')].toFixed(2)}</strong>
                    </span>
                </div>
                <div class="jogo-times">${jogo.times}</div>
                <div class="jogo-campeonato">${jogo.campeonato}</div>
                <div class="jogo-info">
                    <span>${erro ? '⚡' : '✓'} Betano</span>
                    <span>• 48h</span>
                </div>
            </div>
        `).join('');
    }
    
    function mostrarErro() {
        const mensagem = `<div class="vazio">
            <div style="color: #dc3545; font-size: 3rem;">⚠️</div>
            <p style="color: #dc3545; font-weight: bold;">Falha na conexão</p>
            <p>Tente novamente em instantes</p>
        </div>`;
        
        elementos.jogosOver05.innerHTML = mensagem;
        elementos.jogosOver15.innerHTML = mensagem;
    }
    
    function mostrarLoading(mostrar) {
        elementos.loading.style.display = mostrar ? 'block' : 'none';
    }
});