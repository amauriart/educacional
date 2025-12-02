document.addEventListener('DOMContentLoaded', function() {
    const btnAtualizar = document.getElementById('btnAtualizar');
    const ultimaAtualizacao = document.getElementById('ultimaAtualizacao');
    const loading = document.getElementById('loading');
    const tabButtons = document.querySelectorAll('.tab-button');
    
    // Carregar automaticamente
    setTimeout(carregarJogos, 1000);
    
    // Event listeners
    btnAtualizar.addEventListener('click', carregarJogos);
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab');
            
            // Atualizar tabs
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(tabId).classList.add('active');
        });
    });
    
    // Função principal
    async function carregarJogos() {
        mostrarLoading(true);
        btnAtualizar.disabled = true;
        btnAtualizar.innerHTML = '⏳ Buscando dados reais...';
        ultimaAtualizacao.innerHTML = '🔗 Conectando à Betano...';
        ultimaAtualizacao.style.color = '#666';
        
        try {
            console.log('🔄 Iniciando busca de jogos...');
            const response = await fetch('/api/jogos');
            const data = await response.json();
            
            console.log('📊 Dados recebidos:', data);
            
            if (data.erro) {
                // Mostrar dados de exemplo com aviso
                exibirJogos(data.over05, 'jogosOver05', '0.5', true);
                exibirJogos(data.over15, 'jogosOver15', '1.5', true);
                
                ultimaAtualizacao.innerHTML = `⚠️ ${data.mensagem}`;
                ultimaAtualizacao.style.color = '#ff9800';
            } else {
                // Dados reais
                exibirJogos(data.over05, 'jogosOver05', '0.5', false);
                exibirJogos(data.over15, 'jogosOver15', '1.5', false);
                
                let mensagem = `✅ ${data.atualizacao}`;
                if (data.jogosComBetano > 0) {
                    mensagem += ` | 🎯 ${data.jogosComBetano} jogos Betano`;
                } else {
                    mensagem += ` | 😕 Nenhum jogo com Betano`;
                }
                
                ultimaAtualizacao.innerHTML = mensagem;
                ultimaAtualizacao.style.color = '#00a650';
            }
            
        } catch (error) {
            console.error('❌ Erro fatal:', error);
            ultimaAtualizacao.innerHTML = '❌ Erro de conexão';
            ultimaAtualizacao.style.color = '#dc3545';
            
            // Mostrar mensagem de erro
            document.getElementById('jogosOver05').innerHTML = `
                <div class="vazio">
                    <div style="color: #dc3545; font-size: 3rem;">⚠️</div>
                    <p style="color: #dc3545; font-weight: bold;">Erro de conexão</p>
                    <p>Tente novamente em alguns instantes</p>
                </div>`;
                
            document.getElementById('jogosOver15').innerHTML = `
                <div class="vazio">
                    <div style="color: #dc3545; font-size: 3rem;">⚠️</div>
                    <p style="color: #dc3545; font-weight: bold;">Erro de conexão</p>
                </div>`;
        } finally {
            mostrarLoading(false);
            btnAtualizar.disabled = false;
            btnAtualizar.innerHTML = '🔄 Atualizar Scanner';
        }
    }
    
    function exibirJogos(jogos, containerId, tipoOver, ehExemplo = false) {
        const container = document.getElementById(containerId);
        
        if (!jogos || jogos.length === 0) {
            container.innerHTML = `
                <div class="vazio">
                    <div style="font-size: 3rem;">😕</div>
                    <p>Nenhum jogo encontrado</p>
                    <p style="font-size: 0.9rem; margin-top: 10px;">
                        Over ${tipoOver} • Odds ≥ ${tipoOver === '0.5' ? '1.10' : '1.50'}
                    </p>
                    ${ehExemplo ? '<p style="color: #ff9800; margin-top: 10px;">⚠️ Dados de exemplo</p>' : ''}
                </div>`;
            return;
        }
        
        container.innerHTML = jogos.map(jogo => `
            <div class="jogo-card">
                ${ehExemplo ? '<div style="background: #ff9800; color: white; padding: 5px 10px; border-radius: 5px; margin-bottom: 10px; font-size: 0.8rem;">EXEMPLO</div>' : ''}
                <div class="jogo-header">
                    <span class="jogo-horario">${jogo.horario}</span>
                    <span class="jogo-odds">
                        Over ${tipoOver}: <strong>${jogo['oddsOver' + tipoOver.replace('.', '')].toFixed(2)}</strong>
                    </span>
                </div>
                <div class="jogo-times">${jogo.times}</div>
                <div class="jogo-campeonato">${jogo.campeonato}</div>
                <div class="jogo-info">
                    <span style="color: #00a650;">${ehExemplo ? '⚡' : '✓'} Betano</span>
                    <span>• Próximas 24h</span>
                </div>
            </div>
        `).join('');
    }
    
    function mostrarLoading(mostrar) {
        loading.style.display = mostrar ? 'block' : 'none';
    }
});