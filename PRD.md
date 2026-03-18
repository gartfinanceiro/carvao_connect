# Carvão Connect — Product Requirements Document (PRD)

**Versão:** 1.0
**Data:** 17 de março de 2026
**Autor:** Gustavo Costa
**Status:** Draft — aguardando validação com design partner

---

## 1. Visão do Produto

### 1.1 Problema

Siderúrgicas e guseiras gerenciam centenas de fornecedores de carvão vegetal usando planilhas Excel e WhatsApp. Uma equipe típica de compras (1–2 pessoas) precisa semanalmente ligar para dezenas de fornecedores, registrar o que foi combinado, lembrar de retornar ligações em datas futuras e cruzar dados de capacidade, densidade e documentação — tudo manualmente.

O resultado: cargas perdidas por esquecimento, fornecedores abandonados, falta de visibilidade sobre a carteira e decisões baseadas em memória ao invés de dados.

**Citação real de uma consultora de siderúrgica (março/2026):**

> "Preciso de uma ferramenta para fazer cadastro, acompanhamento e análise da compra de carvão feita pela siderúrgica. [...] O João falou que tem carga só no dia 27 de março, aí ela consegue colocar lá pra própria ferramenta dar um alerta no dia 20 pra gente entrar em contato com o João de novo pra lembrar ele que a carga do dia 27 é minha."

### 1.2 Solução

O Carvão Connect é um **CRM de compras especializado para o mercado de carvão vegetal**. A plataforma centraliza cadastro de fornecedores, registro de interações, agendamento de follow-ups e análise da carteira de compras em uma interface única, substituindo planilhas e WhatsApp como ferramenta de gestão.

### 1.3 Posicionamento

| Dimensão | Definição |
|---|---|
| **Para quem** | Compradores de carvão em siderúrgicas e guseiras |
| **Que precisam** | Gerenciar centenas de fornecedores com controle de interações, prazos e capacidade |
| **Diferente de** | Planilhas + WhatsApp (descentralizado, sem alertas, sem histórico estruturado) |
| **O Carvão Connect** | Centraliza cadastro, acompanhamento e alertas inteligentes para nunca perder uma carga |

### 1.4 Pivot Context

O Carvão Connect foi originalmente concebido como um marketplace bilateral conectando fornecedores a siderúrgicas. O pivot para CRM de compras é motivado por:

- Demanda real e espontânea de siderúrgicas buscando ferramenta de gestão de compras
- Monetização mais clara (cobra do comprador que tem dor e budget, não do fornecedor pequeno)
- Escopo mais focado e viável para MVP rápido
- Possibilidade futura de reintroduzir o lado do fornecedor como extensão (Portal do Fornecedor)

---

## 2. Público-alvo

### 2.1 Personas

**Persona primária — Comprador(a) de carvão**

- Responsável pelo abastecimento de carvão da siderúrgica
- Gerencia carteira de 100+ fornecedores ativos
- Faz dezenas de ligações por semana
- Hoje usa planilha + WhatsApp + memória
- Dor principal: perder cargas por esquecimento, não ter visibilidade da carteira

**Persona secundária — Auxiliar de documentação**

- Cuida de DAPs, guias florestais (GF) e conformidade ambiental
- Precisa de visão do status documental de cada fornecedor
- Dor principal: documentos vencendo sem aviso, retrabalho por falta de controle

**Persona terciária — Consultor(a) de compras**

- Atende múltiplas siderúrgicas simultaneamente
- Precisa alternar entre organizações com visão consolidada
- Dor principal: escalar operação sem perder controle

### 2.2 Contexto Operacional

| Aspecto | Realidade |
|---|---|
| Equipe de compras típica | 1–2 pessoas (comprador + docs) |
| Fornecedores por siderúrgica | 100–300 ativos |
| Frequência de compra | Semanal por fornecedor |
| Ferramentas atuais | Excel/Google Sheets + WhatsApp + telefone |
| Dados críticos para decisão | Densidade do carvão + documentação ambiental (DAP/GF) |
| Plataforma de trabalho | Desktop (escritório) + celular (campo/deslocamento) |

---

## 3. Arquitetura Funcional

O MVP se organiza em **4 módulos core**:

```
┌─────────────────────────────────────────────────────┐
│                   CARVÃO CONNECT                     │
├──────────┬──────────┬──────────┬────────────────────┤
│ CADASTRO │ TIMELINE │ ALERTAS  │    DASHBOARD       │
│          │          │          │                    │
│ Base de  │ Histórico│ Follow-  │ Visão consolidada  │
│ fornece- │ de inter-│ ups e    │ da carteira de     │
│ dores    │ ações    │ lembretes│ compras            │
└──────────┴──────────┴──────────┴────────────────────┘
```

| Módulo | Função | Problema que resolve |
|---|---|---|
| **Cadastro** | Base de fornecedores | Informações espalhadas em planilhas e contatos de celular |
| **Timeline** | Histórico de interações | "Meu funcionário ligou pro João e eu não sei o que foi falado" |
| **Alertas** | Follow-ups programados | "João falou que tem carga dia 27 e eu esqueci de ligar dia 20" |
| **Dashboard** | Visão da carteira | "Compro 3 cargas do João mas ele tem capacidade pra 6" |

---

## 4. Módulo 1 — Cadastro de Fornecedores

### 4.1 Objetivo

Base de dados central com todos os fornecedores da carteira de compras, com informações de capacidade, documentação e histórico de preços.

### 4.2 Campos do Fornecedor

| Campo | Tipo | Obrigatório | Observação |
|---|---|---|---|
| Nome / Razão Social | `text` | Sim | — |
| CPF / CNPJ | `text` | Sim | Validação de formato |
| Telefone(s) | `text[]` | Sim | Múltiplos contatos permitidos |
| Localização | `text` | Sim | Cidade/UF da propriedade |
| Tipo de carvão | `select` | Sim | Eucalipto, Tipi, Babassu, Nativo, Misto |
| Densidade média (kg/mdc) | `number` | Sim | Faixa típica: 180–280 |
| Capacidade mensal (cargas) | `number` | Sim | Quantas cargas o fornecedor PODE entregar/mês |
| Cargas contratadas (atual) | `number` | Não | Quantas a siderúrgica compra HOJE deste fornecedor |
| Status documental | `enum` | Sim | Regular · Pendente · Irregular (baseado em DAP e GF) |
| DAP (validade) | `date` | Não | Documento de Aptidão ao Pronaf. Alerta antes do vencimento |
| GF (Guia Florestal) | `date` | Não | Guia de transporte. Alerta antes do vencimento |
| Preço última compra (R$/mdc) | `currency` | Não | Atualizado automaticamente a cada registro de compra |
| Observações | `textarea` | Não | Notas internas sobre o fornecedor |
| Status | `enum` | Auto | Ativo · Inativo · Bloqueado |

### 4.3 Funcionalidades

- **Busca e filtragem rápida** por nome, cidade, tipo de carvão, status documental
- **Importação em massa via CSV** para migração de planilhas existentes
- **Indicador visual de capacidade ociosa** (capacidade mensal − cargas contratadas)
- **Badge de alerta** quando DAP ou GF estão próximos do vencimento (30 dias)
- **Ordenação** por nome, cidade, capacidade ociosa, último contato, status documental

### 4.4 Regras de Negócio

- `RN-CAD-01`: CPF/CNPJ deve ser único dentro da organização
- `RN-CAD-02`: Status documental é calculado automaticamente — Regular (DAP e GF válidos), Pendente (um dos dois vencendo em 30 dias), Irregular (qualquer um vencido)
- `RN-CAD-03`: Status do fornecedor muda para Inativo automaticamente após 60 dias sem interação
- `RN-CAD-04`: Fornecedores com status Bloqueado não aparecem no feed de ações (mas permanecem no cadastro)

---

## 5. Módulo 2 — Timeline de Interações

### 5.1 Objetivo

Histórico cronológico de todos os contatos com cada fornecedor. Resolve o problema central: "meu funcionário ligou e eu não sei o que aconteceu."

### 5.2 Registro de Interação

| Campo | Tipo | Observação |
|---|---|---|
| Data/hora | `timestamp` | Automático (momento do registro), editável |
| Usuário | `FK → users` | Automático (quem registrou) |
| Tipo de contato | `select` | Ligou · Recebeu ligação · WhatsApp · Presencial |
| Resultado | `select` | Atendeu · Não atendeu · Caixa postal · Ocupado |
| Notas | `textarea` | Texto livre — "João disse que tem 3 cargas dia 27" |
| Próximo passo | `select + date` | Retornar em (data) · Aguardar retorno · Nenhum |
| Carga prometida? | `boolean` | Se sim, abre campos de volume e data prevista |
| Volume prometido (cargas) | `number` | Opcional — quantas cargas foram combinadas |
| Data prevista de entrega | `date` | Opcional — quando o fornecedor disse que entrega |

### 5.3 Fluxo de Registro (UX)

```
Abrir fornecedor → [+ Nova interação]
    ↓
Selecionar tipo: Ligou
    ↓
Selecionar resultado: Não atendeu
    ↓
Sistema sugere: "Deseja agendar retorno?"
    ↓
    ├── Sim → Definir data/hora → Alerta criado automaticamente
    └── Não → Registro salvo sem follow-up
```

```
Abrir fornecedor → [+ Nova interação]
    ↓
Selecionar tipo: Ligou
    ↓
Selecionar resultado: Atendeu
    ↓
Campo de notas (obrigatório quando resultado = Atendeu)
    ↓
"Carga prometida?" → Sim
    ↓
Volume: 3 cargas | Data prevista: 27/03
    ↓
Sistema cria automaticamente alerta de confirmação 7 dias antes
```

### 5.4 Regras de Negócio

- `RN-TL-01`: Quando resultado = "Não atendeu" e nenhum próximo passo definido, sistema sugere retorno em 2h automaticamente
- `RN-TL-02`: Quando resultado = "Atendeu", campo de notas torna-se obrigatório
- `RN-TL-03`: Quando "Carga prometida" = true, sistema cria alerta de confirmação (padrão: 7 dias antes da data prevista)
- `RN-TL-04`: Interações são imutáveis após 24h (auditoria). Dentro de 24h, criador pode editar
- `RN-TL-05`: Cada interação atualiza automaticamente o campo "último contato" do fornecedor

### 5.5 Visualização

- Timeline vertical por fornecedor (mais recente no topo)
- Filtros: por período, tipo de contato, resultado
- Ícones visuais diferenciando ligação/WhatsApp/presencial
- Destaque em amarelo para interações com próximo passo pendente
- Na listagem geral: coluna "Último contato" com tempo relativo ("há 3 dias")

---

## 6. Módulo 3 — Alertas e Follow-ups

### 6.1 Objetivo

Motor de lembretes que garante que nenhuma ação fique sem seguimento. Módulo que mais diretamente atende ao pedido: "quero que a ferramenta me alerte dia 20 pra lembrar que a carga do dia 27 é minha."

### 6.2 Tipos de Alerta

| Tipo | Gatilho | Ação | Prioridade |
|---|---|---|---|
| **Follow-up manual** | Usuário agenda ao registrar interação | Push + card no feed | Alta |
| **Retorno automático** | "Não atendeu" sem reagendamento | Alerta em 2h | Média |
| **Vencimento DAP/GF** | X dias antes do vencimento | Alerta para renovar | Alta |
| **Carga agendada** | X dias antes da data prevista de entrega | Confirmar com fornecedor | Alta |
| **Fornecedor inativo** | Sem interação há X dias | Sugerir contato | Baixa |

### 6.3 Feed de Ações do Dia

Tela inicial do app. Lista priorizada de ações pendentes para o dia:

```
┌─────────────────────────────────────────────┐
│  BOM DIA, MARIA        17 de março, 2026    │
│                                             │
│  🔴 ATRASADOS (3)                           │
│  ├── João Silva — retornar ligação (ontem)  │
│  ├── Pedro Souza — confirmar carga (2 dias) │
│  └── DAP vencida — Fornecedor ABC Ltda      │
│                                             │
│  🟡 HOJE (5)                                │
│  ├── 09:00 — Ligar José Santos             │
│  ├── 10:30 — Confirmar 2 cargas c/ Maria F │
│  ├── 14:00 — Retorno automático (não atend.)│
│  ├── GF vence em 15 dias — Fornecedor XYZ   │
│  └── Revisar fornecedores inativos (3)      │
│                                             │
│  📊 RESUMO                                  │
│  12 cargas previstas esta semana            │
│  3 fornecedores sem contato há 14+ dias     │
│  2 documentos vencendo em 30 dias           │
└─────────────────────────────────────────────┘
```

Cada card permite **ação rápida**: "Registrar contato" · "Adiar 1 dia" · "Descartar"

### 6.4 Regras de Negócio

- `RN-AL-01`: Alertas atrasados sempre aparecem no topo, em vermelho, ordenados por antiguidade
- `RN-AL-02`: Alertas do dia são ordenados por horário programado
- `RN-AL-03`: "Adiar" move o alerta para o próximo dia útil (ou data escolhida)
- `RN-AL-04`: "Descartar" requer motivo (resolvido, não relevante, duplicado)
- `RN-AL-05`: Alertas descartados ficam no histórico para auditoria
- `RN-AL-06`: Push notification enviado no horário configurado (padrão 7h) com resumo do dia

### 6.5 Configurações

| Parâmetro | Padrão | Configurável |
|---|---|---|
| Antecedência alerta DAP/GF | 30 dias | Sim |
| Antecedência confirmação de carga | 7 dias antes da entrega | Sim |
| Período de inatividade | 14 dias sem contato | Sim |
| Horário de push diário | 07:00 | Sim |
| Retorno automático (não atendeu) | 2 horas | Sim |

---

## 7. Módulo 4 — Dashboard de Compras

### 7.1 Objetivo

Visão consolidada da carteira de fornecedores e operação de compras. Transforma dados operacionais em inteligência de compra.

### 7.2 KPIs Principais

| KPI | Descrição | Visualização |
|---|---|---|
| **Fornecedores ativos** | Total com interação nos últimos 30 dias | Número grande + tendência |
| **Capacidade total vs. contratada** | Soma de capacidade de todos fornecedores vs. cargas contratadas | Barra de progresso |
| **Cargas previstas (próx. 7 dias)** | Baseado em compromissos registrados | Número + lista |
| **Taxa de contato** | % de ligações atendidas vs. não atendidas | Donut chart |
| **Documentos vencendo** | DAPs e GFs que vencem em 30 dias | Badge com contador |
| **Preço médio (R$/mdc)** | Média ponderada por tipo de carvão | Número + variação |

### 7.3 Visões (MVP)

- **Gráfico de capacidade ociosa** — barras horizontais por fornecedor (contratado vs. capacidade total)
- **Timeline de cargas previstas** — próximos 30 dias, visual tipo calendário
- **Lista de fornecedores com docs vencendo** — ordenada por urgência

### 7.4 Visões (Pós-MVP)

- Mapa geográfico de fornecedores por localização
- Ranking de fornecedores por confiabilidade (entregas cumpridas vs. prometidas)
- Histórico de preço por tipo de carvão e região
- Comparativo mensal de volume comprado

---

## 8. Arquitetura Técnica

### 8.1 Stack

| Camada | Tecnologia | Justificativa |
|---|---|---|
| **Web app (MVP)** | Next.js + React + TypeScript | Prioridade desktop (equipe de compras usa PC) |
| **Mobile** | React Native / Expo | Reutilização de tipos e lógica. Push notifications |
| **UI** | Tailwind CSS + shadcn/ui + Radix UI | Consistência visual, prototipagem rápida |
| **Backend** | Supabase (Postgres + Auth + Realtime + Edge Functions) | Mesma stack do Kinevo — expertise existente |
| **Push** | FCM (Firebase Cloud Messaging) | Já implementado no Kinevo, reutilizável |
| **CRON** | Supabase pg_cron ou Edge Functions scheduled | Alertas automáticos (vencimento, inatividade) |

### 8.2 Modelo de Dados

```sql
-- Multi-tenancy: cada siderúrgica é uma organização
-- RLS garante isolamento total entre organizações

organizations
├── id (uuid, PK)
├── name (text)                    -- "Siderúrgica Minas Ltda"
├── slug (text, unique)
├── plan (enum)                    -- starter | professional | enterprise
├── settings (jsonb)               -- configurações de alertas
├── created_at (timestamptz)
└── updated_at (timestamptz)

users
├── id (uuid, PK, FK → auth.users)
├── organization_id (uuid, FK → organizations)
├── name (text)
├── role (enum)                    -- admin | buyer | viewer
├── created_at (timestamptz)
└── updated_at (timestamptz)

suppliers
├── id (uuid, PK)
├── organization_id (uuid, FK → organizations)
├── name (text)                    -- Nome / Razão Social
├── document (text)                -- CPF ou CNPJ
├── phones (text[])                -- Múltiplos telefones
├── city (text)
├── state (text)                   -- UF
├── charcoal_type (enum)           -- eucalipto | tipi | babassu | nativo | misto
├── avg_density (numeric)          -- kg/mdc (180–280)
├── monthly_capacity (integer)     -- cargas/mês que PODE entregar
├── contracted_loads (integer)     -- cargas/mês que a siderúrgica compra HOJE
├── doc_status (enum)              -- regular | pending | irregular (computed)
├── dap_expiry (date)              -- validade da DAP
├── gf_expiry (date)               -- validade da GF
├── last_price (numeric)           -- R$/mdc da última compra
├── notes (text)
├── status (enum)                  -- active | inactive | blocked
├── last_contact_at (timestamptz)  -- atualizado por trigger
├── created_at (timestamptz)
└── updated_at (timestamptz)

interactions
├── id (uuid, PK)
├── supplier_id (uuid, FK → suppliers)
├── user_id (uuid, FK → users)
├── organization_id (uuid, FK → organizations)
├── contact_type (enum)            -- called | received_call | whatsapp | in_person
├── result (enum)                  -- answered | no_answer | voicemail | busy
├── notes (text)
├── next_step (enum)               -- return_on | await_return | none
├── next_step_date (timestamptz)
├── load_promised (boolean)
├── promised_volume (integer)      -- cargas prometidas
├── promised_date (date)           -- data prevista de entrega
├── created_at (timestamptz)
└── updated_at (timestamptz)

alerts
├── id (uuid, PK)
├── organization_id (uuid, FK → organizations)
├── supplier_id (uuid, FK → suppliers)
├── interaction_id (uuid, FK → interactions, nullable)
├── type (enum)                    -- follow_up | auto_return | doc_expiry | load_confirm | inactive
├── title (text)
├── description (text)
├── due_at (timestamptz)           -- quando o alerta deve disparar
├── status (enum)                  -- pending | done | dismissed | snoozed
├── dismissed_reason (text)        -- quando status = dismissed
├── snoozed_until (timestamptz)    -- quando status = snoozed
├── priority (enum)                -- high | medium | low
├── created_at (timestamptz)
└── updated_at (timestamptz)

documents
├── id (uuid, PK)
├── supplier_id (uuid, FK → suppliers)
├── organization_id (uuid, FK → organizations)
├── type (enum)                    -- dap | gf | other
├── expiry_date (date)
├── file_url (text)                -- Supabase Storage
├── notes (text)
├── created_at (timestamptz)
└── updated_at (timestamptz)
```

### 8.3 Triggers e Automações

```
trigger: on_interaction_insert
  → Atualiza suppliers.last_contact_at
  → Se result = 'no_answer' AND next_step = 'none'
    → Cria alerta type='auto_return' com due_at = now() + 2h
  → Se load_promised = true
    → Cria alerta type='load_confirm' com due_at = promised_date - 7 dias

cron: daily_alerts (roda às 06:00 UTC-3)
  → Verifica suppliers.dap_expiry e gf_expiry
    → Se vence em <= 30 dias e não existe alerta pendente → cria alerta type='doc_expiry'
  → Verifica suppliers.last_contact_at
    → Se > 14 dias e status = 'active' → cria alerta type='inactive'
  → Recalcula suppliers.doc_status baseado em dap_expiry e gf_expiry
  → Envia push notification com resumo do dia

cron: auto_inactivate (roda às 00:00 UTC-3)
  → Suppliers com last_contact_at > 60 dias → status = 'inactive'
```

### 8.4 Row Level Security (RLS)

```sql
-- Padrão para todas as tabelas com organization_id
CREATE POLICY "org_isolation" ON suppliers
  USING (organization_id = (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

-- Users só veem membros da mesma org
CREATE POLICY "org_members" ON users
  USING (organization_id = (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

-- Admin-only para gerenciar organização
CREATE POLICY "admin_org" ON organizations
  USING (id = (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ))
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );
```

### 8.5 Segurança

- Autenticação via Supabase Auth (email/senha + magic link)
- RLS em 100% das tabelas — usuário só vê dados da sua organização
- Roles: `admin` (gerencia usuários e org), `buyer` (operação plena), `viewer` (somente leitura)
- Auditoria: todas as tabelas com `created_at`, `updated_at`, `user_id` (quem criou)
- Consultor multi-org: um user pode ser membro de múltiplas organizations (via tabela intermediária, pós-MVP)

---

## 9. Plataforma e UX

### 9.1 Prioridade

1. **Web app (MVP)** — equipe de compras trabalha em desktop no escritório
2. **Mobile (Fase 4)** — registro rápido de interações em campo/deslocamento

### 9.2 Telas Principais (Web)

| Tela | Função | Prioridade |
|---|---|---|
| **Feed / Home** | Alertas do dia + ações pendentes + resumo | P0 |
| **Lista de Fornecedores** | Tabela com busca, filtros, ordenação, badges | P0 |
| **Detalhe do Fornecedor** | Dados cadastrais + timeline de interações + alertas | P0 |
| **Nova Interação** | Modal/drawer com fluxo guiado de registro | P0 |
| **Dashboard** | KPIs + gráficos da carteira | P1 |
| **Configurações** | Parâmetros de alertas, dados da org, usuários | P1 |
| **Importação CSV** | Upload + mapeamento de colunas + preview | P1 |

### 9.3 Princípios de Design

- **Velocidade > Estética** — a equipe de compras faz dezenas de registros por dia; cada clique importa
- **Progressive disclosure** — tela de fornecedor mostra resumo; detalhes expandem sob demanda
- **Ação no contexto** — botão "+ Interação" sempre visível no perfil do fornecedor
- **Zero treinamento** — linguagem do setor (carga, mdc, DAP, GF), não jargão de software
- **Mobile-friendly** — web app responsiva desde o MVP, mesmo que mobile nativo venha depois

---

## 10. Modelo de Negócio

### 10.1 Precificação

Assinatura mensal por organização (não por usuário):

| Plano | Fornecedores | Usuários | Preço |
|---|---|---|---|
| **Starter** | Até 50 | Até 2 | R$ 197/mês |
| **Professional** | Até 200 | Até 5 | R$ 497/mês |
| **Enterprise** | Ilimitado | Ilimitado | Sob consulta |

**Racional:** o preço antigo (R$ 29,90/mês por usuário) era de marketplace consumer. O novo modelo cobra por organização e reflete o valor B2B — uma única carga de carvão perdida por esquecimento custa mais que a assinatura anual.

### 10.2 Trial

- 14 dias grátis com funcionalidade completa (plano Professional)
- Sem cartão de crédito para iniciar
- Dados mantidos após conversão
- Após trial: acesso somente-leitura até assinar

### 10.3 Cobrança

- Stripe (web) ou assinatura in-app (mobile, pós-MVP)
- Ciclo mensal ou anual (desconto de 2 meses no anual)

---

## 11. Estratégia de Go-to-Market

| Fase | Ação | Timeline |
|---|---|---|
| **1. Design Partner** | Fechar com Rúvia e sua siderúrgica como piloto | Semana 1 |
| **2. Build MVP** | Desenvolver web app com os 4 módulos | Semanas 1–6 |
| **3. Validação** | 30–60 dias de uso real, iteração semanal | Semanas 7–14 |
| **4. Case Study** | Documentar resultados (cargas salvas, tempo economizado) | Semana 15 |
| **5. Expansão** | Prospectar siderúrgicas da região (Sete Lagoas, Divinópolis, Itaúna) | Semanas 16+ |
| **6. Canal** | Visitas presenciais + indicação + LinkedIn B2B | Contínuo |

---

## 12. Roadmap de Implementação

### Fase 1 — Fundamentos (Semanas 1–2)

- [ ] Setup do projeto Next.js + Supabase (schema, RLS, auth)
- [ ] Multi-tenancy básico (organizations + users)
- [ ] CRUD completo de fornecedores com todos os campos
- [ ] Lista de fornecedores com busca, filtros e ordenação
- [ ] Importação CSV com mapeamento de colunas
- [ ] Deploy web (Vercel)

### Fase 2 — Timeline + Alertas (Semanas 3–4)

- [ ] Registro de interações com fluxo guiado
- [ ] Timeline visual por fornecedor
- [ ] Motor de alertas (triggers + cron jobs)
- [ ] Feed de ações do dia (tela Home)
- [ ] Push notifications web (FCM)

### Fase 3 — Dashboard + Polish (Semanas 5–6)

- [ ] Dashboard com KPIs principais
- [ ] Gráfico de capacidade ociosa
- [ ] Responsividade mobile da web app
- [ ] Tela de configurações (parâmetros de alertas)
- [ ] Onboarding guiado (primeiro acesso)
- [ ] Teste com design partner (Rúvia)

### Fase 4 — App Mobile (Semanas 7–8)

- [ ] App React Native/Expo
- [ ] Registro rápido de interações (otimizado para campo)
- [ ] Push notifications nativas
- [ ] Sincronização via Supabase Realtime

### Backlog Pós-MVP (priorizado)

| Feature | Valor | Esforço |
|---|---|---|
| Integração WhatsApp Business API | Alto | Alto |
| Mapa geográfico de fornecedores | Médio | Médio |
| Relatórios exportados em PDF | Médio | Baixo |
| Portal do Fornecedor (confirmar cargas) | Alto | Alto |
| Inteligência de preço (histórico + tendência) | Alto | Médio |
| Multi-org para consultores | Médio | Médio |
| App offline-first (registro sem internet) | Médio | Alto |

---

## 13. Métricas de Sucesso

### MVP (primeiros 90 dias)

| Métrica | Meta | Como medir |
|---|---|---|
| **Adoção** | 1 siderúrgica usando diariamente | DAU no Supabase |
| **Engajamento** | 50+ interações/semana registradas | `COUNT` na tabela `interactions` |
| **Retenção** | Uso contínuo após 30 dias | Login semanal consistente |
| **Valor percebido** | NPS ≥ 8 com design partner | Feedback qualitativo semanal |
| **Conversão** | Design partner converte em pagante | Assinatura ativa |

### 6 meses

| Métrica | Meta |
|---|---|
| Clientes pagantes | 3–5 siderúrgicas |
| MRR | R$ 1.500+ |
| Churn | < 10% mensal |
| Fornecedores cadastrados (total) | 500+ |

---

## 14. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Equipe de compras não adota (prefere planilha) | Média | Alto | Importação CSV transparente + onboarding presencial |
| Escopo cresce durante validação | Alta | Médio | Manter scope freeze no MVP; backlog priorizado |
| Concorrente genérico (CRM tipo Pipedrive) | Baixa | Médio | Especialização no vocabulário e fluxos do setor |
| Fornecedor com múltiplas siderúrgicas (conflito) | Baixa | Baixo | Cada org vê apenas seus dados (RLS) |
| Dependência de um design partner | Média | Médio | Buscar 2º piloto em paralelo na fase de validação |

---

## 15. Decisões em Aberto

| # | Questão | Opções | Deadline |
|---|---|---|---|
| 1 | Manter app mobile atual nas lojas ou despublicar durante pivot? | (a) Despublicar (b) Manter com aviso "nova versão em breve" | Antes do launch web |
| 2 | Domínio: manter carvaoconnect.com.br ou criar algo novo? | (a) Manter (b) Novo domínio mais "enterprise" | Semana 1 |
| 3 | Rúvia como piloto gratuito ou já com trial formal? | (a) Grátis durante validação (b) Trial de 14 dias (c) Desconto de design partner | Semana 1 |
| 4 | Aceitar fornecedores de carvão mineral ou só vegetal? | (a) Só vegetal (b) Ambos | Validar com Rúvia |
| 5 | Consultor multi-org no MVP ou pós-MVP? | (a) MVP (b) Pós-MVP | Semana 2 |

---

*Documento vivo — será atualizado conforme validação com design partner.*