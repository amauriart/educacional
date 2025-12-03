# Scanner Bet365 - Over de Gols ⚽

Scanner automático de apostas para a casa **Bet365**, focado em mercados de **Over de Gols** (0.5 e 1.5).

## 📋 Características

- ⚽ Busca jogos de futebol nas próximas 24 horas
- 🎯 Filtra apenas odds da casa **Bet365**
- 📊 Mercados: Over 0.5 (odds ≥ 1.10) e Over 1.5 (odds ≥ 1.50)
- 🔄 Ordenação por odds (maior para menor)
- 📱 Interface responsiva e moderna
- 🚀 Pronto para deploy no Render

## 🚀 Deploy no Render

### Passo 1: Preparar o Repositório GitHub

1. Crie um novo repositório no GitHub
2. Faça upload de todos os arquivos deste projeto
3. Commit e push para o GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/seu-usuario/seu-repositorio.git
git push -u origin main
```

### Passo 2: Configurar no Render

1. Acesse [render.com](https://render.com) e faça login
2. Clique em **"New +"** → **"Web Service"**
3. Conecte seu repositório GitHub
4. Configure o serviço:
   - **Name**: bet365-scanner (ou nome de sua escolha)
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free (ou conforme necessário)
5. Clique em **"Create Web Service"**

O Render fará o deploy automaticamente!

## 💻 Executar Localmente

### Pré-requisitos

- Node.js 14 ou superior
- npm ou yarn

### Instalação

```bash
# Instalar dependências
npm install

# Iniciar servidor
npm start
```

Acesse: `http://localhost:3000`

## 📁 Estrutura do Projeto

```
bet365-scanner/
├── server.js           # Servidor Node.js + Express
├── package.json        # Dependências do projeto
├── README.md          # Este arquivo
├── .gitignore         # Arquivos ignorados pelo Git
└── public/            # Arquivos estáticos
    ├── index.html     # Interface principal
    ├── styles.css     # Estilos
    └── script.js      # Lógica do frontend
```

## 🔧 Tecnologias Utilizadas

- **Backend**: Node.js + Express
- **API**: SoccersAPI (v2.2)
- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Deploy**: Render

## 📊 Dados Exibidos

Para cada jogo encontrado, o scanner mostra:

1. **Horário** - Data e hora do início do jogo
2. **Times** - Nome dos times (Casa vs Visitante)
3. **Campeonato** - Nome da liga e país
4. **Odds** - Valor da odd para Over de gols

## ⚙️ Configuração da API

As credenciais da API SoccersAPI estão configuradas no arquivo `server.js`:

```javascript
const API_CONFIG = {
  baseUrl: 'https://api.soccersapi.com/v2.2',
  user: '0x3YU',
  token: 'UVZnFqmGWH',
  bet365Id: 2,
  marketOverUnder: 2
};
```

## 📝 Notas Importantes

- O scanner busca jogos com início nas próximas 24 horas
- Apenas jogos de futebol são considerados
- Somente odds da casa Bet365 são exibidas
- A atualização dos dados depende da disponibilidade da API SoccersAPI

## 🆘 Suporte

Em caso de problemas:

1. Verifique se as dependências foram instaladas corretamente
2. Confirme que a porta 3000 está disponível
3. Verifique os logs do servidor para erros da API

## 📄 Licença

MIT License - Livre para uso pessoal e comercial.
