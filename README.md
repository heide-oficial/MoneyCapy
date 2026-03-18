# MoneyCapy

MoneyCapy é um aplicativo de gerenciamento de finanças pessoais disponível para **desktop (Windows)** e **mobile (Android/iOS)**. Ele permite controlar gastos, receitas, cartões, contas bancárias e muito mais, com suporte a múltiplos perfis de usuário.

---

## O que o app faz

Centraliza toda a vida financeira em um só lugar: registra e categoriza gastos, acompanha receitas recorrentes ou avulsas, monitora faturas de cartões de crédito e saldos de contas bancárias, e gera análises e gráficos por período.

---

## Funcionalidades

### Gastos
- Tipos: **avulso**, **parcelado**, **recorrente (assinatura)** e **empréstimo**
- Marcar como pago por mês
- Antecipar pagamentos ou pausar temporariamente
- Vincular a categoria, tag, loja, conta bancária ou cartão
- Override de valor mensal

### Receitas
- Receitas recorrentes e avulsas
- Marcar como recebida por mês, com data
- Vincular a categorias, tags e lojas
- Override de valor por mês e pausa temporária

### Contas Bancárias
- Registro de contas corrente e poupança
- Registro de saldo mensal
- Visualização de gastos vinculados (parcelados, empréstimos, recorrentes)

### Cartões de Crédito
- Dados criptografados (número, validade, titular)
- Controle de limite disponível/utilizado
- Ciclo de cobrança e vencimento configuráveis
- Pagar fatura completa de um mês com um clique

### Múltiplos Perfis
- Separe as finanças por pessoa dentro do mesmo app
- Troca rápida de perfil

### Categorias, Tags e Lojas
- Organize gastos e receitas com cor e ícone personalizados
- Filtragem cruzada por tipo, período e classificação

### Dashboard
- Visão geral do mês: total de gastos, receitas e saldo
- Widgets configuráveis com drag-and-drop
- Próximos vencimentos, top gastos, resumo de cartões e contas

### Insights (Análises)
- Gráficos temporais: diário, semanal, mensal, anual
- Comparativo entre períodos
- Distribuição por categorias, tags e tipo de receita

### Configurações
- Tema claro/escuro
- Idioma (Português BR e English)
- Formato de data e moeda
- Cores personalizadas por seção
- Dia útil configurável (feriados, finais de semana)
- Proteção por senha
- Inicialização automática e minimizar para bandeja
- Backup/restauração e exportação CSV

---

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Desktop UI | React 18 + TypeScript + Tailwind CSS |
| Desktop App | Electron 33 |
| Mobile | React Native (Expo 54) + TypeScript |
| Banco de dados | SQLite (sql.js no desktop, expo-sqlite no mobile) |
| Gráficos | Recharts |
| Ícones | Lucide React |
| Build/Installer | electron-builder (NSIS) |

---

## Como rodar localmente

```bash
# Instalar dependências
npm install

# Modo desenvolvimento
npm run dev

# Build de produção
npm run build

# Gerar instalador .exe
npm run package
```

O instalador será gerado em `dist/moneycapy-1.0.0-setup.exe`.
