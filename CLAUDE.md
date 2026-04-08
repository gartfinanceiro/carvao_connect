# Carvão Connect — Contexto do Projeto

## O que é

Carvão Connect é um **CRM de compras de carvão vegetal para siderúrgicas e guseiras**. A plataforma centraliza cadastro de fornecedores, registro de interações, agendamento de follow-ups, controle de descargas e análise da carteira de compras, substituindo planilhas Excel e WhatsApp como ferramenta de gestão.

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
| Web app | Next.js 16.1.7 + React 19.2.3 + TypeScript 5 |
| UI | Tailwind CSS v4 + shadcn/ui (@base-ui/react) + Lucide icons |
| Backend | Supabase (Postgres + Auth + Realtime + Edge Functions) |
| Billing | Stripe (checkout, portal, webhooks) |
| WhatsApp | Meta Cloud API (Graph API v21.0, Embedded Signup, webhooks push) |
| PDF | jsPDF + jspdf-autotable |
| Deploy | Vercel |
| Domínio | carvaoconnect.com.br |

## Arquitetura Funcional

O sistema tem **8 módulos**, todos controláveis por permissões:

### Módulo 1 — Fornecedores ✅
Base de dados central com informações de capacidade, documentação e preços.

Campos principais: nome, CPF/CNPJ, pessoa de contato, telefones (múltiplos), cidade/UF, densidade média (kg/mdc), capacidade mensal (cargas), cargas contratadas, status documental (regular/pendente/irregular — calculado automaticamente via trigger), validade DCF, preço última compra, observações, status (ativo/inativo/bloqueado/arquivado).

Funcionalidades: busca por nome/cidade/CPF, filtros por tipo/docs/status/UF/porte, ordenação por colunas, paginação, criar/editar via Dialog, indicador visual de capacidade ociosa, badge de status documental, coluna "último contato" com cores (vermelho > 14 dias, cinza normal).

**Classificação de porte** — 4 quadrantes baseados em capacidade do fornecedor × participação no consumo total da empresa:
- Estratégico (azul): grande capacidade + alta participação → parceiro-chave
- Oportunidade (amber): grande capacidade + baixa participação → potencial de expansão
- Dependência (laranja): pequena capacidade + alta participação → risco de concentração
- Complementar (cinza): pequena capacidade + baixa participação → apoio pontual

Cálculo: `participação = contracted_loads / total_contracted_all × 100`. Limiares: capacidade alta ≥ 8 cargas/mês, participação alta ≥ 15%. Duas métricas visíveis: aproveitamento (quanto da capacidade uso) + participação (quanto do meu consumo depende dele). Coluna na tabela, badge no detalhe, filtro, tooltip com ambas as métricas.

**Upload de documentos** — tabela `supplier_documents` com upload e listagem no detalhe do fornecedor.

### Módulo 2 — Interações ✅
Histórico cronológico de contatos com cada fornecedor.

Cada interação registra: tipo de contato (ligou/recebeu/WhatsApp/presencial), resultado (atendeu/não atendeu/caixa postal/ocupado), notas, próximo passo (retornar em data/aguardar retorno/nenhum), carga prometida (boolean + volume + data prevista).

Fluxo guiado no modal: tipo → resultado → notas (obrigatório se atendeu) → carga prometida → próximo passo. Quando "não atendeu" + "nenhum próximo passo", info box avisa sobre retorno automático em 2h.

Timeline visual vertical por fornecedor com ícones por tipo, badges coloridos por resultado, indicadores de carga e follow-up.

Dropdown de ações rápidas na lista de fornecedores (registrar interação sem navegar).

### Módulo 3 — Alertas e Feed ✅
Motor de lembretes com 5 tipos de alerta:

| Tipo | Gatilho | Prioridade |
|---|---|---|
| Follow-up manual | Usuário agenda ao registrar interação | Alta |
| Retorno automático | "Não atendeu" sem reagendamento → alerta em 2h | Média |
| Vencimento docs | 30 dias antes do vencimento DCF | Alta |
| Confirmação de carga | 7 dias antes da data prevista de entrega | Alta |
| Fornecedor inativo | Sem interação há 14+ dias | Baixa |

Feed de Ações do Dia (tela Home): saudação personalizada, 4 KPI cards, alertas agrupados por seção (Atrasados vermelho / Hoje amarelo / Próximos cinza / Concluídos verde), ações rápidas por card (Registrar contato / Adiar 1 dia / Descartar com motivo).

### Módulo 4 — Descargas ✅
Registro e controle de descargas de carvão.

Campos: fornecedor, data, volume (MDC), pesagem (bruto/tara/líquido — auto), densidade (auto), umidade %, moinha (kg + % auto), preço por MDC, valor bruto (auto), descontos (R$ — com sugestão automática), valor líquido (auto), placa, NF, guia florestal, tipo de carvão, observações.

Trigger `calculate_discharge_fields()` calcula automaticamente: peso líquido, densidade, fines_percent, gross_total, net_total.

Tabela com colunas: Data, Fornecedor, Volume, Densidade, Preço, Umidade, Moinha, Bruto, Descontos, Líquido, Placa. Expand row com detalhes completos.

**Sugestão automática de descontos** — ao preencher umidade e moinha no formulário, o sistema sugere valor de desconto baseado em regras: umidade > 5% e moinha > 3% geram desconto proporcional. O usuário pode aceitar a sugestão ou editar manualmente.

**Toggle de unidade (MDC ↔ Tonelada)** — cada tela tem seu próprio controle. Converte volume e preço usando a densidade de cada descarga. Inputs de formulário sempre em MDC. Funções: `convertVolume()`, `convertPrice()`, `formatVolume()`, `formatPrice()`, `sumConvertedVolume()`.

**Relatório PDF** — modal com filtros (período, fornecedor, colunas selecionáveis). PDF A4 paisagem com header, bloco de resumo KPIs, tabela com colunas escolhidas, agrupamento por fornecedor com subtotais, paginação. Gerado client-side com jsPDF + autotable.

### Módulo 5 — Fila de Descargas ✅
Gerenciamento da fila de chegada de cargas.

Entrada com: fornecedor, tipo (agendada/fila/espontânea), placa, motorista, volume estimado, data/horário agendado. Status: aguardando → descarregando → concluído/cancelado. Posição automática na fila via trigger. Compartilhamento via WhatsApp.

### Módulo 6 — WhatsApp (Meta Cloud API) ✅
Integração com WhatsApp via Meta Cloud API (Graph API v21.0).

Conexão via **Embedded Signup** (OAuth) — sem QR code. Suporte a múltiplos números por organização. Tokens de 60 dias com detecção de expiração.

Tabelas: `whatsapp_connections`, `whatsapp_messages`, `whatsapp_conversations`, `whatsapp_templates`, `ai_suggestions`.

Fluxo: webhook push recebe mensagens → agrupa em conversas (30min gap) → cron processa com GPT-4o mini (function calling) → gera sugestões de interação → usuário confirma/edita/descarta no feed.

API routes: `webhook/` (verificação + recebimento), `embedded-signup/` (OAuth + registro), `status/` (conexões + validação token), `disconnect/` (revogação), `qrcode/` (legacy, redireciona para reconexão).

Frontend: `whatsapp-setup.tsx` carrega Facebook SDK, dispara Embedded Signup, exibe conexões com quality rating (GREEN/YELLOW/RED) e messaging limits.

Envs: `NEXT_PUBLIC_META_APP_ID`, `NEXT_PUBLIC_META_CONFIG_ID`, `META_APP_ID`, `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`.

WhatsApp só disponível no plano Professional.

### Módulo 7 — Configurações ✅
Dados da conta, billing (Stripe portal), equipe (convites, roles, permissões), configuração WhatsApp.

### Módulo 8 — Billing (Stripe) ✅

| Plano | Fornecedores | Usuários | Preço | WhatsApp |
|---|---|---|---|---|
| Starter | Até 50 | Até 2 | R$ 197/mês | Não |
| Professional | Até 200 | Até 5 | R$ 497/mês | Sim |
| Enterprise | Ilimitado | Ilimitado | Sob consulta | Sim |

Trial COM cartão obrigatório. Starter: 7 dias. Professional: 3 dias.

## Sistema de Permissões

**Roles:** admin (master) e member.

**Admin** — acesso total a tudo. Gerencia equipe, billing, permissões dos membros.

**Member** — acesso controlado por 8 módulos (on/off): Fornecedores, Descargas, Financeiro, Relatórios, WhatsApp, Configurações, Feed/Alertas, Fila.

**3 templates pré-definidos:**
- Compras: fornecedores, descargas, WhatsApp, feed, fila (sem financeiro, relatórios, config)
- Financeiro: fornecedores, descargas, financeiro, relatórios (sem WhatsApp, feed, fila, config)
- Completo: tudo exceto configurações

**Módulo Financeiro é transversal** — quando bloqueado, esconde colunas de preço/valor em TODAS as telas.

Permissões salvas como JSONB no `profiles.permissions`. Admin tem `permissions = NULL`. Convites incluem permissões do template escolhido.

Enforcement: AccessGate nas rotas, sidebar/mobile-nav filtrados, colunas condicionais.

## Modelo de Dados (Supabase)

### Tabelas (13)
```
organizations        — Multi-tenant, billing (13 cols)
profiles             — Extends auth.users, role, permissions (8 cols)
suppliers            — Fornecedores (22 cols)
interactions         — Registros de contato (14 cols)
alerts               — Follow-ups e lembretes (14 cols)
discharges           — Descargas de carvão (25 cols)
queue_entries        — Fila de descarregamento (18 cols)
invites              — Convites de equipe (12 cols)
supplier_documents   — Documentos de fornecedores (11 cols)
whatsapp_connections — Conexão Z-API (12 cols)
whatsapp_messages    — Mensagens individuais (18 cols)
whatsapp_conversations — Conversas agrupadas (14 cols)
ai_suggestions       — Sugestões IA para interações (21 cols)
```

### Functions / RPCs (22)
Helpers: `get_my_org_id()`, `check_plan_limit()`, `get_my_subscription()`, `normalize_phone()`, `find_supplier_by_phone()`

Alertas: `refresh_daily_alerts()`, `generate_doc_expiry_alerts()`, `generate_inactivity_alerts()`

Triggers (em 8 tabelas, 25 eventos): cálculos automáticos de discharge, alertas de interação, status documental, posição de fila, densidade, preço, timestamps.

### RLS
Isolamento total por `organization_id = get_my_org_id()` em todas as tabelas.

## Estrutura de Arquivos

```
src/
├── app/
│   ├── layout.tsx, page.tsx, login/, registro/, onboarding/, convite/
│   ├── auth/callback/route.ts
│   ├── api/ (14 routes: register, checkout, verify-checkout, portal, webhooks/stripe,
│   │         team/members, invites, invites/accept, invites/info,
│   │         whatsapp/webhook, whatsapp/embedded-signup, whatsapp/status,
│   │         whatsapp/disconnect, whatsapp/qrcode (legacy),
│   │         cron/process-conversations)
│   └── (app)/
│       ├── layout.tsx, page.tsx (Feed)
│       ├── dashboard/, fornecedores/, descargas/, fila/, configuracoes/, planos/
├── components/ (28 feature + 19 UI shadcn)
│   ├── access-gate, feed, alert-card, interaction-form, interaction-timeline
│   ├── supplier-table, supplier-form, supplier-detail, supplier-filters, supplier-documents
│   ├── discharge-form, discharge-list, discharge-report-dialog
│   ├── queue-form, unit-toggle, kpi-bar, sidebar, mobile-nav, app-header
│   ├── subscription-provider, trial-banner, landing-page, empty-state
│   ├── ai-suggestion-card, conversation-viewer, whatsapp-setup, quick-interaction, activity-feed
├── lib/
│   ├── classification.ts, permissions.ts, labels.ts, utils.ts, stripe.ts, meta-whatsapp.ts
│   ├── generate-discharge-report.ts
│   └── supabase/ (admin, client, middleware, server)
├── types/database.ts
└── middleware.ts
```

## Variáveis de Ambiente

```
NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
STRIPE_STARTER_PRICE_ID=price_1TCkfM0Lp3rgiKT40WBqH058
STRIPE_PROFESSIONAL_PRICE_ID=price_1TCkfe0Lp3rgiKT4lzXvj2K7
NEXT_PUBLIC_SITE_URL=https://carvaoconnect.com.br
NEXT_PUBLIC_META_APP_ID, NEXT_PUBLIC_META_CONFIG_ID
META_APP_ID, META_APP_SECRET, META_WEBHOOK_VERIFY_TOKEN
CRON_SECRET
```

## Princípios de Desenvolvimento

- **Zero erros TypeScript** — `npm run build` deve passar limpo sempre
- **shadcn/ui** para todos os componentes de UI
- **Português brasileiro** em toda a interface
- **Light mode only** com verde escuro (#1B4332) como cor de ação primária
- **Estilo minimalista** referência Supabase Dashboard
- **Mobile-responsive** desde o início
- **Supabase MCP** conectado — usar para executar migrations e queries SQL
- **Retrocompatibilidade** — não quebrar funcionalidades existentes
- **Mudanças cirúrgicas** — preferir edições pontuais a rewrites
- **Fases com validação** — implementar em etapas, testar entre cada uma

## Pendências

- Testar fluxo completo de registro Stripe (cartão teste 4242 4242 4242 4242)
- Diagnóstico WhatsApp Meta Cloud API + IA (webhook em produção, Embedded Signup, captura de mensagens)
- Deploy produção com todas as variáveis configuradas
- Contato com Rúvia (design partner) para demo