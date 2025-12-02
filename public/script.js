document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Scanner Betano iniciado');
    
    // Elementos
    const btnAtualizar = document.getElementById('btnAtualizar');
    const ultimaAtualizacao = document.getElementById('ultimaAtualizacao');
    const loading = document.getElementById('loading');
    const tabButtons = document.querySelectorAll('.tab-button');
    const jogosOver05 = document.getElementById('jogosOver05');
    const jogosOver15 = document.getElementById('jogosOver15');
    
    // Carregar dados ao iniciar
    carregarDados();
    
    // Botão atualizar
    btnAtualizar.addEventListener('click', carregarDados);
    
    // Tabs
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Remover active de todos
            tabButtons.forEach(btn => btn.classList.remove('active'));
            // Adicionar active no clicado
            this.classList.add('active');
            
            // Esconder todos os conteúdos
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            
            // Mostrar conteúdo da tab clicada
            const tabId = this.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');
        });
    });
    
    // Função principal
    async function carregarDados() {
        console.log('🔄 Carregando dados...');
        
        // Mostrar loading
        mostrarLoading(true);
        btnAtualizar.disabled = true;
        btnAtualizar.innerHTML = '🔄 Buscando...';
        ultimaAtualizacao.innerHTML = 'Conectando ao servidor...';
        ultimaAtualizacao.style.color = '#666';
        
        try {
            // Fazer requisição
            const resposta = await fetch('/api/jogos');
            const dados = await resposta.json();
            
            console.log('✅ Dados recebidos:', dados);
            
            // Exibir jogos
            exibirJogos(dados.over05, 'jogosOver05', '0.5');
            exibirJogos(dados.over15, 'jogosOver15', '1.5');
            
            // Atualizar status
            let status = `✅ ${dados.atualizacao}`;
            if (dados.estatisticas) {
                status += ` | ${dados.estatisticas.over05} Over 0.5`;
                status += ` | ${dados.estatisticas.over15} Over 1.5`;
            }
            
            ultimaAtualizacao.innerHTML = status;
            ultimaAtualizacao.style.color = '#00a650';
            
        } catch (erro) {
            console.error('❌ Erro:', erro);
            ultimaAtualizacao.innerHTML = '❌ Erro ao carregar dados';
            ultimaAtualizacao.style.color = '#dc3545';
            
            // Mostrar erro
            jogosOver05.innerHTML = `
                <div class="vazio">
                    <div style="color: #dc3545; font-size: 3rem;">⚠️</div>
                    <p style="color: #dc3545; font-weight: bold;">Erro de conexão</p>
                    <p>Tente novamente</p>
                </div>`;
                
            jogosOver15.innerHTML = `
                <div class="vazio">
                    <div style="color: #dc3545; font-size: 3rem;">⚠️</div>
                    <p style="color: #dc3545; font-weight: bold;">Erro de conexão</p>
                </div>`;
        } finally {
            // Esconder loading
            mostrarLoading(false);
            btnAtualizar.disabled = false;
            btnAtualizar.innerHTML = '🔄 Atualizar Scanner';
        }
    }
    
    // Exibir jogos
    function exibirJogos(jogos, containerId, tipo) {
        const container = document.getElementById(containerId);
        
        if (!jogos || jogos.length === 0) {
            container.innerHTML = `
                <div class="vazio">
                    <div style="font-size: 3rem;">😕</div>
                    <p>Nenhum jogo encontrado</p>
                    <p style="font-size: 0.9rem; margin-top: 10px;">
                        Over ${tipo} | Odds ≥ ${tipo === '0.5' ? '1.10' : '1.50'}
                    </p>
                </div>`;
            return;
        }
        
        // Criar HTML dos jogos
        let html = '';
        jogos.forEach((jogo, index) => {
            const odds = tipo === '0.5' ? jogo.oddsOver05 : jogo.oddsOver15;
            
            html += `
                <div class="jogo-card">
                    <div class="jogo-header">
                        <span class="jogo-horario">${jogo.horario}</span>
                        <span class="jogo-odds">
                            Over ${tipo}: <strong>${odds.toFixed(2)}</strong>
                        </span>
                    </div>
                    <div class="jogo-times">${jogo.times}</div>
                    <div class="jogo-campeonato">${jogo.campeonato}</div>
                    <div class="jogo-info">
                        <span style="color: #00a650;">✓ Betano</span>
                        <span>• Próximas 48h</span>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
    }
    
    // Mostrar/ocultar loading
    function mostrarLoading(mostrar) {
        loading.style.display = mostrar ? 'block' : 'none';
    }
});