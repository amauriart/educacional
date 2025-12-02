document.addEventListener('DOMContentLoaded', function() {
    const btnAtualizar = document.getElementById('btnAtualizar');
    const ultimaAtualizacao = document.getElementById('ultimaAtualizacao');
    const loading = document.getElementById('loading');
    const tabButtons = document.querySelectorAll('.tab-button');
    
    // Carregar automaticamente
    setTimeout(carregarJogos, 500);
    
    btnAtualizar.addEventListener('click', carregarJogos);
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab');
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(tabId).classList.add('active');
        });
    });
    
    async function carregarJogos() {
        mostrarLoading(true);
        btnAtualizar.disabled = true;
        btnAtualizar.innerHTML = '⏳ Buscando...';
        ultimaAtualizacao.innerHTML = '🔄 Conectando à API...';
        ultimaAtualizacao.style.color = '#666';
        
        try {
            const response = await fetch('/api/jogos');
            const data = await response.json();
            
            if (data.erro) {
                throw new Error(data.mensagem);
            }
            
            exibirJogos(data.over05, 'jogosOver05', '0.5');
            exibirJogos(data.over15, 'jogosOver15', '1.5');
            
            let mensagem = `✅ ${data.atualizacao} | ${data.jogosComBetano} jogos com Betano`;
            if (data.totalJogos) {
                mensagem += ` (${data.totalJogos} total)`;
            }
            
            ultimaAtualizacao.innerHTML = mensagem;
            ultimaAtualizacao.style.color = '#00a650';
            
        } catch (error) {
            console.error('Erro:', error);
            ultimaAtualizacao.innerHTML = `❌ Erro: ${error.message}`;
            ultimaAtualizacao.style.color = '#dc3545';
            
            // Mostrar mensagem de erro nos containers
            document.getElementById('jogosOver05').innerHTML = `
                <div class="vazio">
                    <div style="color: #dc3545; font-size: 3rem; margin-bottom: 15px;">⚠️</div>
                    <p style="color: #dc3545; font-weight: bold;">Erro ao buscar dados</p>
                    <p>${error.message}</p>
                    <p style="margin-top: 15px; font-size: 0.9rem; color: #666;">
                        Verifique sua chave API no Render
                    </p>
                </div>`;
            
            document.getElementById('jogosOver15').innerHTML = `
                <div class="vazio">
                    <div style="color: #dc3545; font-size: 3rem; margin-bottom: 15px;">⚠️</div>
                    <p style="color: #dc3545; font-weight: bold;">Erro ao buscar dados</p>
                    <p>${error.message}</p>
                </div>`;
        } finally {
            mostrarLoading(false);
            btnAtualizar.disabled = false;
            btnAtualizar.innerHTML = '🔄 Atualizar Scanner';
        }
    }
    
    function exibirJogos(jogos, containerId, tipoOver) {
        const container = document.getElementById(containerId);
        
        if (!jogos || jogos.length === 0) {
            container.innerHTML = `
                <div class="vazio">
                    <div style="font-size: 3rem; margin-bottom: 15px;">😕</div>
                    <p>Nenhum jogo encontrado para Over ${tipoOver} gols</p>
                    <p style="margin-top: 10px; font-size: 0.9rem; color: #888;">
                        Critérios: Betano • Próximas 24h • Odds ≥ ${tipoOver === '0.5' ? '1.10' : '1.50'}
                    </p>
                </div>`;
            return;
        }
        
        container.innerHTML = jogos.map(jogo => `
            <div class="jogo-card">
                <div class="jogo-header">
                    <span class="jogo-horario">${jogo.horario}</span>
                    <span class="jogo-odds">
                        Over ${tipoOver}: <strong>${parseFloat(jogo['oddsOver' + tipoOver.replace('.', '')]).toFixed(2)}</strong>
                    </span>
                </div>
                <div class="jogo-times">${jogo.times}</div>
                <div class="jogo-campeonato">${jogo.campeonato}</div>
                <div class="jogo-info">
                    <span style="color: #00a650;">✓ Betano</span>
                    <span>• Próximas 24h</span>
                </div>
            </div>
        `).join('');
    }
    
    function mostrarLoading(mostrar) {
        loading.style.display = mostrar ? 'block' : 'none';
    }
});