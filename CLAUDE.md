# Carvão Connect — Contexto do Projeto

## O que é

Carvão Connect é um **CRM de compras de carvão vegetal para siderúrgicas e guseiras**. A plataforma centraliza cadastro de fornecedores, registro de interações, agendamento de follow-ups e análise da carteira de compras, substituindo planilhas Excel e WhatsApp como ferramenta de gestão.

## Posicionamento

| Dimensão | Definição |
|---|---|
| Para quem | Compradores de carvão em siderúrgicas e guseiras |
| Que precisam | Gerenciar centenas de fornecedores com controle de interações, prazos e capacidade |
| Diferente de | Planilhas + WhatsApp (descentralizado, sem alertas, sem histórico estruturado) |
| O Carvão Connect | Centraliza cadastro, acompanhamento e alertas inteligentes para nunca perder uma carga |

## Stack Técnica

| Camada | Tecnologia |
|---|---|
| Web app | Next.js 16 + React + TypeScript |
| UI | Tailwind CSS v4 + shadcn/ui (base-nova) + Radix UI |
| Backend | Supabase (Postgres + Auth + Realtime + Edge Functions) |
| Mobile (futuro) | React Native / Expo |
| Push (futuro) | FCM (Firebase Cloud Messaging) |
| Deploy | Vercel |
| Domínio | carvaoconnect.com.br |
| Supabase MCP | Conectado — Claude Code pode executar SQL diretamente |

## Arquitetura Funcional

O sistema tem **4 módulos core**:

### Módulo 1 — Cadastro de Fornecedores ✅
Base de dados central com informações de capacidade, documentação e preços.

Campos principais: nome, CPF/CNPJ, telefones (múltiplos), cidade/UF, tipo de carvão (eucalipto/tipi/babaçu/nativo/misto), densidade média (kg/mdc), capacidade mensal (cargas), cargas contratadas, status documental (regular/pendente/irregular — calculado automaticamente via trigger), validade DAP, validade GF, preço última compra, observações, status (ativo/inativo/bloqueado).

Funcionalidades: busca por nome/cidade/CPF, filtros por tipo/docs/status/UF, ordenação por colunas, paginação, criar/editar via Dialog, indicador visual de capacidade ociosa, badge de status documental, coluna "último contato" com cores (verde ≤7d, amarelo >7d, vermelho >14d).

### Módulo 2 — Timeline de Interações ✅
Histórico cronológico de contatos com cada fornecedor.

Cada interação registra: tipo de contato (ligou/recebeu/WhatsApp/presencial), resultado (atendeu/não atendeu/caixa postal/ocupado), notas, próximo passo (retornar em data/aguardar retorno/nenhum), carga prometida (boolean + volume + data prevista).

Fluxo guiado no modal: tipo → resultado → notas (obrigatório se atendeu) → carga prometida → próximo passo. Quando "não atendeu" + "nenhum próximo passo", info box avisa sobre retorno automático em 2h.

Timeline visual vertical por fornecedor com ícones por tipo, badges coloridos por resultado, indicadores de carga e follow-up.

Dropdown de ações rápidas na lista de fornecedores (registrar interação sem navegar).

### Módulo 3 — Alertas e Follow-ups ✅
Motor de lembretes com 5 tipos de alerta:

| Tipo | Gatilho | Prioridade |
|---|---|---|
| Follow-up manual | Usuário agenda ao registrar interação | Alta |
| Retorno automático | "Não atendeu" sem reagendamento → alerta em 2h | Média |
| Vencimento DAP/GF | 30 dias antes do vencimento | Alta |
| Confirmação de carga | 7 dias antes da data prevista de entrega | Alta |
| Fornecedor inativo | Sem interação há 14+ dias | Baixa |

Feed de Ações do Dia (tela Home): saudação personalizada, 4 KPI cards, alertas agrupados por seção (Atrasados vermelho / Hoje amarelo / Próximos cinza / Concluídos verde), ações rápidas por card (Registrar contato / Adiar 1 dia / Descartar com motivo).

### Módulo 4 — Dashboard de Compras 🔲 (não implementado)
KPIs básicos existem na KPI bar e no feed. Dashboard completo com gráficos é backlog.

## Modelo de Dados (Supabase)

```
organizations        — Multi-tenant (1 org ativa no MVP)
profiles             — Estende auth.users, vinculado a organization
suppliers            — Fornecedores (vinculados à org via RLS)
interactions         — Registros de contato (FK: supplier, user)
alerts               — Follow-ups e lembretes (FK: supplier, interaction?)
```

### Triggers ativos:
- `recalculate_doc_status` — Recalcula status documental ao alterar DAP/GF
- `update_updated_at` — Atualiza timestamp em todas as tabelas
- `update_supplier_last_contact` — Atualiza last_contact_at ao inserir interação
- `auto_create_return_alert` — Cria alerta 2h quando "não atendeu" + "nenhum"
- `auto_create_load_alert` — Cria alerta 7d antes de carga prometida
- `auto_create_followup_alert` — Cria alerta de follow-up manual

### Functions (RPC):
- `generate_doc_expiry_alerts()` — Alertas de DAP/GF vencendo em 30 dias
- `generate_inactivity_alerts()` — Alertas de fornecedores inativos (14+ dias)
- `refresh_daily_alerts()` — Executa ambas as functions acima

### RLS:
Isolamento total por organization_id em todas as tabelas.

## O que está implementado ✅

- Autenticação (login/registro com email/senha)
- Middleware protegendo rotas
- Layout com sidebar colapsável (desktop) + bottom nav (mobile)
- KPI bar com dados reais
- CRUD completo de fornecedores com busca, filtros, ordenação, paginação
- Formulário de fornecedor em Dialog (create/edit)
- Página de detalhe do fornecedor com cards de resumo
- Registro de interações com fluxo guiado em modal
- Timeline visual por fornecedor
- Todos os triggers de alertas automáticos
- Feed de Ações do Dia com seções e ações rápidas
- Configurações básicas (nome, logout, atualizar alertas)
- Empty states, loading skeletons, toasts
- Error boundary e página 404
- Seed data com 12 fornecedores e 12 alertas realistas (MG)
- Deploy na Vercel com domínio carvaoconnect.com.br

## Backlog (priorizado)

### Alta prioridade
- Dashboard com gráficos (capacidade ociosa, cargas previstas, taxa de contato)
- Importação CSV de fornecedores (migração de planilhas)
- Push notifications web (FCM)
- CRON real para alertas diários (pg_cron ou Edge Function schedulada)

### Média prioridade
- Mapa geográfico de fornecedores por localização
- Relatórios exportados em PDF
- Multi-org para consultores (1 usuário em várias organizações)
- Histórico de preço por tipo de carvão e região
- App mobile React Native/Expo

### Baixa prioridade
- Integração WhatsApp Business API (registro automático de conversas)
- Portal do Fornecedor (confirmar cargas pelo próprio fornecedor)
- App offline-first (registro sem internet)
- Ranking de fornecedores por confiabilidade

## Princípios de Desenvolvimento

- **Zero erros TypeScript** — `npm run build` deve passar limpo sempre
- **shadcn/ui** para todos os componentes de UI
- **Português brasileiro** em toda a interface (labels, placeholders, mensagens, datas DD/MM/YYYY, moeda R$)
- **Light mode only** com verde escuro (#1B4332) como cor de ação primária
- **Mobile-responsive** desde o início
- **Supabase MCP** conectado — usar para executar migrations e queries SQL
- **Retrocompatibilidade** — não quebrar funcionalidades existentes ao adicionar novas
- **Mudanças cirúrgicas** — preferir edições pontuais a rewrites
- **Fases com validação** — implementar em etapas, testar entre cada uma

## Estrutura de Arquivos

```
src/
├── app/
│   ├── layout.tsx                    — Root layout (metadata, fonts)
│   ├── not-found.tsx                 — 404
│   ├── error.tsx                     — Error boundary
│   ├── login/page.tsx                — Login
│   ├── registro/page.tsx             — Registro
│   ├── auth/callback/route.ts        — Auth callback
│   └── (app)/
│       ├── layout.tsx                — App shell (sidebar + KPI bar)
│       ├── page.tsx                  — Home / Feed de Ações
│       ├── fornecedores/
│       │   ├── page.tsx              — Lista de fornecedores
│       │   └── [id]/page.tsx         — Detalhe do fornecedor
│       └── configuracoes/
│           └── page.tsx              — Configurações
├── components/
│   ├── ui/                           — shadcn components
│   ├── sidebar.tsx
│   ├── mobile-nav.tsx
│   ├── kpi-bar.tsx
│   ├── supplier-table.tsx
│   ├── supplier-filters.tsx
│   ├── supplier-form.tsx
│   ├── supplier-detail.tsx
│   ├── interaction-form.tsx
│   ├── interaction-timeline.tsx
│   ├── alert-card.tsx
│   ├── feed.tsx
│   ├── feed-wrapper.tsx
│   └── empty-state.tsx
├── lib/
│   ├── supabase/
│   │   ├── server.ts
│   │   ├── client.ts
│   │   └── middleware.ts
│   ├── labels.ts                     — Mapas de labels pt-BR para enums
│   └── utils.ts                      — Formatters (moeda, data, telefone)
├── types/
│   └── database.ts                   — Tipos espelhando o schema Supabase
└── middleware.ts                      — Auth middleware

supabase/
├── migration.sql                     — Schema inicial (Dia 1)
├── migration-dia2.sql                — Triggers de interações (Dia 2)
├── migration-dia3.sql                — Functions de alertas automáticos (Dia 3)
├── seed.sql                          — Org demo + trigger auto-profile
└── seed-demo.sql                     — Dados realistas para demo
```

## Modelo de Negócio

Assinatura mensal por organização:

| Plano | Fornecedores | Usuários | Preço |
|---|---|---|---|
| Starter | Até 50 | Até 2 | R$ 197/mês |
| Professional | Até 200 | Até 5 | R$ 497/mês |
| Enterprise | Ilimitado | Ilimitado | Sob consulta |

Trial: 14 dias grátis com funcionalidade completa. Cobrança via Stripe (web).