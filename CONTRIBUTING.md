# Contribuindo para o Projeto

Obrigado por considerar contribuir! Este documento fornece diretrizes para contribuir com o projeto.

## Como Contribuir

### 1. Configurar Ambiente de Desenvolvimento

1. Faça um fork do repositório
2. Clone o fork: `git clone https://github.com/[SEU-USUARIO]/visantlabs-os.git`
3. Instale as dependências: `npm install`
4. Copie `env.example` para `.env.local` e configure as variáveis necessárias
5. Execute `npm run dev:all` para iniciar o servidor de desenvolvimento

### 2. Padrões de Código

- **Formatação**: Use Prettier (`npm run format`)
- **Linting**: Use ESLint (`npm run lint`)
- **TypeScript**: Mantenha tipagem forte, evite `any` quando possível
- **Commits**: Use mensagens descritivas em português ou inglês

### 3. Estrutura do Projeto

- `components/` - Componentes React
- `pages/` - Páginas da aplicação
- `server/` - Backend (Express)
- `services/` - Serviços (AI, storage, payments)
- `hooks/` - React hooks customizados
- `types/` - Definições TypeScript
- `utils/` - Funções utilitárias

### 4. Testando Mudanças

Antes de fazer um pull request:

1. Execute `npm run format` para formatar o código
2. Execute `npm run lint` para verificar erros
3. Teste manualmente as funcionalidades afetadas
4. Certifique-se de que o app inicia sem erros

### 5. Pull Requests

1. Crie uma branch descritiva: `git checkout -b feature/minha-feature`
2. Faça commits pequenos e focados
3. Descreva claramente o que foi alterado no PR
4. Referencie issues relacionadas, se houver

### 6. Serviços Opcionais

Ao adicionar funcionalidades que dependem de serviços pagos (Stripe, Liveblocks, R2, etc.):

- Sempre verifique se o serviço está configurado antes de usar
- Forneça fallbacks quando possível
- Documente a dependência no README e na documentação do serviço

## Dúvidas?

Abra uma issue para discutir mudanças maiores ou entre em contato com os mantenedores.

