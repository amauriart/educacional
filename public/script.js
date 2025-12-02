document.addEventListener('DOMContentLoaded', function() {
    const btnAtualizar = document.getElementById('btnAtualizar');
    const ultimaAtualizacao = document.getElementById('ultimaAtualizacao');
    const loading = document.getElementById('loading');
    const tabButtons = document.querySelectorAll('.tab-button');
    
    // Carregar automaticamente
    setTimeout(carregarJogos, 800);
    
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
        btnAtualizar.innerHTML = '🔍 Varrendo Betano...';
        ultimaAtualizacao.innerHTML = '🔄 Conectando à SoccerAPI...';
        ultimaAtualizacao.style.color = '#666';
        
        try {
            const inicio = Date.now();
            const response = await fetch('/api/jogos');
            const data = await response.json();
            
            const tempoTotal = Date.now() - inicio;
            
            if (data.erro) {
                // Modo fallback
                exibirJogos(data.over05, 'jogosOver05', '0.5', true, data.mensagem);
                exibirJogos(data.over15, 'jogosOver15', '1.5', true, data.mensagem);
                
                ultimaAtualizacao.innerHTML = `⚠️ ${data.mensagem} (${tempoTotal}ms)`;
                ultimaAtualizacao.style.color = '#ff9800';
                
            } else {
                // Dados reais
                exibirJogos(data.over05, 'jogosOver05', '0.5', false);
                exibirJogos(data.over15, 'jogosOver15', '1.5', false);
                
                let mensagem = `✅ ${data.atualizacao} | ${tempoTotal}ms`;
                
                if (data.estatisticas) {
                    const stats = data.estatisticas;
                    mensagem += ` | 🎯 ${stats.over05} Over 0.5`;
                    mensagem += ` | ${stats.over15} Over 1.5`;
                    
                    if (stats.totalJogos) {
                        mensagem += ` | 📊 ${stats.totalJogos} jogos analisados`;
                    }
                    
                    mensagem += ` | 🔍 ${stats.fonte}`;
                }
                
                ultimaAtualizacao.innerHTML = mensagem;
                ultimaAtualizacao.style.color = '#00a650';
            }
            
        } catch (error) {
            console.error('Erro:', error);
            ultimaAtualizacao.innerHTML = '❌ Erro de conexão com o servidor';
            ultimaAtualizacao.style.color = '#dc3545';
            
            exibirErro('jogosOver05', 'Falha na conexão');
            exibirErro('jogosOver15', 'Verifique sua internet');
        } finally {
            mostrarLoading(false);
            btnAtualizar.disabled = false;
            btnAtualizar.innerHTML = '🔄 Atualizar Scanner';
        }
    }
    
    function exibirJogos(jogos, containerId, tipoOver, ehFallback = false, mensagemErro = '') {
        const container = document.getElementById(containerId);
        const oddsMinimas = tipoOver === '0.5' ? '1.10' : '1.50';
        
        if (!jogos || jogos.length === 0) {
            container.innerHTML = `
                <div class="vazio">
                    <div style="font-size: 3rem; margin-bottom: 15px;">
                        ${ehFallback ? '⚠️' : '😕'}
                    </div>
                    <p style="font-weight: bold; margin-bottom: 10px;">
                        ${ehFallback ? 'API temporariamente indisponível' : 'Nenhum jogo encontrado'}
                    </p>
                    ${mensagemErro ? `<p style="color: #666; margin-bottom: 15px;">${mensagemErro}</p>` : ''}
                    <p style="margin-bottom: 5px;">Critérios de busca:</p>
                    <ul style="text-align: left; display: inline-block; margin: 0 auto 20px;">
                        <li>⚽ Over ${tipoOver} gols</li>
                        <li>📈 Odds ≥ ${oddsMinimas}</li>
                        <li>🏠 Apenas Betano</li>
                        <li>⏰ Próximas 48 horas</li>
                    </ul>
                    ${ehFallback ? 
                        '<p style="padding: 12px; background: #fff3cd; border-radius: 8px; color: #856404; max-width: 500px; margin: 0 auto;">⚠️ Dados simulados - A API SoccerAPI retornou sem dados. Configure suas credenciais no Render.</p>' : 
                        '<p style="color: #666;">Verifique se há jogos no site oficial da Betano</p>'
                    }
                </div>`;
            return;
        }
        
        container.innerHTML = jogos.map((jogo, index) => `
            <div class="jogo-card" style="animation-delay: ${index * 0.1}s;">
                ${ehFallback ? 
                    '<div class="badge-fallback">EXEMPLO</div>' : 
                    '<div class="badge-real">REAL</div>'
                }
                <div class="jogo-header">
                    <span class="jogo-horario">🕒 ${jogo.horario}</span>
                    <span class="jogo-info-badge">
                        ${tipoOver === '0.5' ? '⚽' : '⚽⚽'} Over ${tipoOver}
                    </span>
                </div>
                <div class="jogo-times">${jogo.times}</div>
                <div class="jogo-campeonato">🏆 ${jogo.campeonato}</div>
                <div class="jogo-detalhes">
                    <div class="odds-display">
                        <span class="odds-value">${parseFloat(jogo['oddsOver' + tipoOver.replace('.', '')]).toFixed(2)}</span>
                        <span class="odds-label">ODDS</span>
                    </div>
                    <div class="casa-info">
                        <span class="casa-badge">Betano</span>
                        <span class="tempo-badge">48h</span>
                    </div>
                </div>
                ${index === 0 && jogos.length > 1 ? 
                    '<div class="melhor-aposta">🎯 MELHOR ODDS</div>' : ''
                }
            </div>
        `).join('');
    }
    
    function exibirErro(containerId, mensagem) {
        const container = document.getElementById(containerId);
        container.innerHTML = `
            <div class="vazio">
                <div style="color: #dc3545; font-size: 3rem; margin-bottom: 15px;">⚠️</div>
                <p style="color: #dc3545; font-weight: bold;">${mensagem}</p>
                <p style="margin-top: 15px; color: #666;">
                    Tente novamente em alguns instantes
                </p>
            </div>`;
    }
    
    function mostrarLoading(mostrar) {
        loading.style.display = mostrar ? 'block' : 'none';
    }
});