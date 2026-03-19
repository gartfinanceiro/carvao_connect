# Carvao Connect — Plano Starter Pronto pra Producao

## 1. Estado Atual do Sistema

### 1.1 Registro (`/registro`)
- Campos: nome, email, senha, confirmar senha
- Usa `supabase.auth.signUp()` com `options.data.name`
- **Nao pede nome da empresa** — nao cria organizacao
- Apos registro, redireciona para `/login` (nao faz login automatico)

### 1.2 Trigger `handle_new_user`
```sql
INSERT INTO profiles (id, organization_id, name)
VALUES (
  NEW.id,
  '00000000-0000-0000-0000-000000000001',  -- HARDCODED
  COALESCE(NEW.raw_user_meta_data->>'name', NEW.email)
);
```
**Problema critico**: Todo novo usuario e atribuido a mesma organizacao demo (`00000000-0000-0000-0000-000000000001`). Nao existe multi-tenancy real — todos os usuarios veem os mesmos dados.

### 1.3 Tabela `organizations`
Estrutura atual (minimalista):
| Coluna | Tipo | Default |
|---|---|---|
| id | uuid | gen_random_uuid() |
| name | text | NOT NULL |
| created_at | timestamptz | now() |
| updated_at | timestamptz | now() |

**Nao tem**: plano, billing, limites, trial, Stripe IDs, status de assinatura.

Dados atuais: 1 org (`Siderurgica Demo`) com 13 fornecedores.

### 1.4 Tabela `profiles`
| Coluna | Tipo |
|---|---|
| id | uuid (FK auth.users) |
| organization_id | uuid (FK organizations) |
| name | text |
| created_at / updated_at | timestamptz |

**Nao tem**: role (admin/member), convite, status.

### 1.5 Middleware de Auth
- Verifica se usuario esta logado via `supabase.auth.getUser()`
- Redireciona para `/login` se nao autenticado
- **Nao verifica**: plano, trial, status de assinatura, limites

### 1.6 Controle de Limites
**Nao existe nenhum**. Qualquer usuario pode criar fornecedores, interacoes e alertas sem limite.

### 1.7 Integracao Stripe
**Nao existe**. Nenhuma dependencia, env var, ou codigo relacionado a Stripe no projeto.

### 1.8 RLS (Row Level Security)
Todas as tabelas usam `get_my_org_id()` ou subquery em `profiles` para isolar por `organization_id`. **O isolamento funciona** — mas como todos estao na mesma org, nao e testado de verdade.

### 1.9 Landing Page
A tela de login (`/login`) serve como "landing page" com painel esquerdo descritivo. Nao existe landing page separada. Deploy e feito na Vercel com dominio `carvaoconnect.com.br`.

### 1.10 Stripe MCP
**Nao configurado**. O `.mcp.json` so tem o Supabase MCP. O Stripe tem MCP oficial disponivel (`@stripe/mcp` no npm) que pode ser adicionado.

---

## 2. Plano de Implementacao

### Fase 1 — Schema de Billing e Onboarding (Backend)

#### 2.1 Alterar tabela `organizations`

```sql
ALTER TABLE organizations ADD COLUMN plan text NOT NULL DEFAULT 'trial';
-- Valores: 'trial', 'starter', 'professional', 'enterprise', 'canceled'

ALTER TABLE organizations ADD COLUMN plan_limits jsonb NOT NULL DEFAULT '{
  "max_suppliers": 200,
  "max_users": 5,
  "whatsapp_enabled": true
}'::jsonb;

ALTER TABLE organizations ADD COLUMN trial_ends_at timestamptz;
ALTER TABLE organizations ADD COLUMN subscription_status text NOT NULL DEFAULT 'trialing';
-- Valores: 'trialing', 'active', 'past_due', 'canceled', 'unpaid'

ALTER TABLE organizations ADD COLUMN stripe_customer_id text;
ALTER TABLE organizations ADD COLUMN stripe_subscription_id text;
ALTER TABLE organizations ADD COLUMN current_period_end timestamptz;
ALTER TABLE organizations ADD COLUMN created_by uuid REFERENCES auth.users(id);
```

Limites por plano (referencia):
| Recurso | Trial (14d) | Starter (R$197) | Professional (R$497) | Enterprise |
|---|---|---|---|---|
| Fornecedores | 200 | 50 | 200 | Ilimitado |
| Usuarios | 5 | 2 | 5 | Ilimitado |
| WhatsApp + IA | Sim | Nao | Sim | Sim |
| Dashboards | Sim | Basico | Completo | Completo |

#### 2.2 Alterar tabela `profiles`

```sql
ALTER TABLE profiles ADD COLUMN role text NOT NULL DEFAULT 'admin';
-- Valores: 'admin', 'member'
-- Primeiro usuario da org e sempre 'admin'
```

#### 2.3 Substituir trigger `handle_new_user`

O trigger atual hardcoda a org. Novo fluxo:

**Opcao escolhida**: Manter trigger simples, criar org no app antes do signUp.

Novo trigger:
```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Se org_id veio no metadata, usar. Senao, criar nova org.
  IF NEW.raw_user_meta_data->>'organization_id' IS NOT NULL THEN
    INSERT INTO profiles (id, organization_id, name, role)
    VALUES (
      NEW.id,
      (NEW.raw_user_meta_data->>'organization_id')::uuid,
      COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
      COALESCE(NEW.raw_user_meta_data->>'role', 'admin')
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Fluxo de registro** (no app):
1. Frontend coleta: nome, email, senha, **nome da empresa**
2. Frontend chama `POST /api/register`
3. API route:
   a. Cria org no Supabase (service role) → gera `org_id`
   b. Chama `supabase.auth.admin.createUser()` com `raw_user_meta_data.organization_id = org_id`
   c. Seta `trial_ends_at = now() + 14 days`
   d. Retorna sucesso → frontend faz login automatico

Por que API route e nao client-side:
- Precisa de `service_role_key` pra criar org (RLS nao permite user sem perfil inserir na tabela organizations)
- Controle de race conditions
- Rate limiting server-side

#### 2.4 Tabela de auditoria (opcional, baixa prioridade)

```sql
CREATE TABLE billing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) NOT NULL,
  event_type text NOT NULL,
  -- Valores: 'trial_started', 'subscription_created', 'subscription_updated',
  --          'subscription_canceled', 'payment_failed', 'plan_changed'
  stripe_event_id text,
  details jsonb,
  created_at timestamptz DEFAULT now()
);
```

---

### Fase 2 — Integracao Stripe

#### 2.5 Criar Products e Prices no Stripe

Usar Stripe Dashboard ou Stripe MCP:

**Produto 1: Starter**
- Nome: `Carvao Connect — Starter`
- Preco: R$ 197,00/mes (`unit_amount: 19700`, `currency: 'brl'`)
- Metadata: `{ plan: 'starter', max_suppliers: '50', max_users: '2' }`

**Produto 2: Professional**
- Nome: `Carvao Connect — Professional`
- Preco: R$ 497,00/mes (`unit_amount: 49700`, `currency: 'brl'`)
- Metadata: `{ plan: 'professional', max_suppliers: '200', max_users: '5' }`

**Enterprise**: Sem checkout. Contato comercial.

#### 2.6 API Route: Criar Checkout Session

`POST /api/checkout`

```typescript
// Recebe: { priceId: string }
// Cria Stripe Checkout Session com:
//   - mode: 'subscription'
//   - payment_method_types: ['card'] (Pix e boleto futuramente)
//   - subscription_data.trial_period_days: 14 (se novo)
//   - metadata.organization_id
//   - success_url / cancel_url
// Retorna: { url: string } → frontend redireciona
```

#### 2.7 API Route: Webhook Stripe

`POST /api/webhooks/stripe`

Eventos a escutar:

| Evento | Acao |
|---|---|
| `checkout.session.completed` | Salvar `stripe_customer_id`, `stripe_subscription_id`, atualizar `subscription_status` para `trialing` ou `active`, setar `plan` e `plan_limits` |
| `customer.subscription.updated` | Atualizar `subscription_status`, `current_period_end`. Se mudou de plano, atualizar `plan` e `plan_limits` |
| `customer.subscription.deleted` | Setar `subscription_status = 'canceled'`, `plan = 'canceled'` |
| `invoice.payment_failed` | Setar `subscription_status = 'past_due'`. Enviar email (futuro) |

Seguranca:
- Verificar assinatura com `stripe.webhooks.constructEvent(body, signature, webhookSecret)`
- Usar `req.text()` (nao `req.json()`) para body raw
- Usar `SUPABASE_SERVICE_ROLE_KEY` para bypass RLS

#### 2.8 API Route: Customer Portal

`POST /api/portal`

```typescript
// Busca stripe_customer_id da org do usuario
// Cria billingPortal.sessions.create()
// Retorna { url: string } → frontend redireciona
```

#### 2.9 Configuracao do Customer Portal (Dashboard Stripe)

Habilitar:
- Cancelar assinatura (com motivo)
- Trocar plano (Starter ↔ Professional, com proration)
- Atualizar metodo de pagamento
- Ver historico de faturas

#### 2.10 Metodos de Pagamento

**MVP**: Cartao de credito apenas (cobertura imediata, sem complexidade).

**Fase futura**:
- Pix (disponivel via Stripe no Brasil, suporte a recorrencia via Pix Automatico desde 2025)
- Boleto bancario (Stripe suporta, mas tem delay de 1-3 dias uteis)

---

### Fase 3 — Controle de Limites (Enforcement)

#### 2.11 Onde verificar limites

**Abordagem**: Verificar no server-side antes de operacoes criticas.

| Operacao | Onde verificar | O que verificar |
|---|---|---|
| Criar fornecedor | `supplier-form.tsx` submit → server | COUNT(suppliers) < plan_limits.max_suppliers |
| Convidar usuario | Tela de convite (nova) | COUNT(profiles na org) < plan_limits.max_users |
| Usar WhatsApp | `whatsapp-setup.tsx` / webhook | plan_limits.whatsapp_enabled = true |

**Implementacao**: Criar function RPC `check_plan_limit(resource text)` que retorna `{ allowed: boolean, current: number, limit: number }`.

```sql
CREATE OR REPLACE FUNCTION check_plan_limit(p_resource text)
RETURNS jsonb AS $$
DECLARE
  v_org_id uuid;
  v_limits jsonb;
  v_current int;
  v_limit int;
BEGIN
  SELECT organization_id INTO v_org_id FROM profiles WHERE id = auth.uid();
  SELECT plan_limits INTO v_limits FROM organizations WHERE id = v_org_id;

  IF p_resource = 'suppliers' THEN
    SELECT COUNT(*) INTO v_current FROM suppliers WHERE organization_id = v_org_id;
    v_limit := (v_limits->>'max_suppliers')::int;
  ELSIF p_resource = 'users' THEN
    SELECT COUNT(*) INTO v_current FROM profiles WHERE organization_id = v_org_id;
    v_limit := (v_limits->>'max_users')::int;
  END IF;

  RETURN jsonb_build_object(
    'allowed', v_current < v_limit,
    'current', v_current,
    'limit', v_limit
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### 2.12 UX quando atinge limite

- **Fornecedores**: Botao "Novo fornecedor" mostra toast: "Limite de {limit} fornecedores atingido. Faca upgrade para o plano Professional." com botao "Ver planos".
- **Usuarios**: Botao "Convidar" desabilitado com tooltip.
- **WhatsApp**: Secao WhatsApp nas configuracoes mostra badge "Disponivel no Professional" em vez do setup.

#### 2.13 O que acontece quando trial expira

**Comportamento**: Acesso somente-leitura.
- Pode fazer login e ver dados
- Nao pode criar/editar fornecedores, interacoes, alertas
- Banner persistente no topo: "Seu trial expirou. Assine para continuar usando o Carvao Connect."
- Botao "Assinar agora" → Checkout Stripe

**Verificacao**: No middleware ou no layout `(app)`, consultar `organizations` e verificar:
```
SE subscription_status = 'trialing' E trial_ends_at < now() → trial expirado
SE subscription_status = 'canceled' → assinatura cancelada
SE subscription_status = 'past_due' → pagamento pendente (dar grace period de 7 dias)
SE subscription_status IN ('active', 'trialing' com trial valido) → acesso completo
```

---

### Fase 4 — UI de Billing e Paywall

#### 2.14 Banner de Trial

Componente `TrialBanner` no layout `(app)`:
- Aparece durante trial: "Voce tem {dias} dias restantes no trial gratuito. [Assinar agora]"
- Ultimos 3 dias: Banner amarelo com urgencia
- Trial expirado: Banner vermelho bloqueante

#### 2.15 Tela de Paywall

Nova rota `/(app)/planos` (ou modal):
- Comparativo de planos (Starter vs Professional)
- Destaque no Professional como "Mais popular"
- CTA → Stripe Checkout
- FAQ basico (cancelamento, trial, etc.)

#### 2.16 Secao de Billing nas Configuracoes

Adicionar ao `configuracoes/client.tsx`:
- Plano atual com badge
- Uso atual: "12/50 fornecedores" com barra de progresso
- Proximo pagamento: data e valor
- Botoes: "Mudar plano" (Portal Stripe), "Gerenciar assinatura" (Portal Stripe)
- Status da assinatura com cores (ativo=verde, trial=azul, past_due=amarelo, cancelado=vermelho)

#### 2.17 Pagina de Registro atualizada

Adicionar campo "Nome da empresa" obrigatorio:
```
Nome completo: [____________]
Nome da empresa: [____________]  ← NOVO
Email: [____________]
Senha: [____________]
Confirmar senha: [____________]
[Criar conta e comecar trial gratuito]

Ao criar sua conta voce concorda com os Termos de Uso e Politica de Privacidade.
```

---

### Fase 5 — Infraestrutura Multi-Tenant Real

#### 2.18 Org demo e dados de seed

- Manter org demo (`00000000-...0001`) para testes internos
- Adicionar coluna `is_demo boolean DEFAULT false` na tabela organizations
- Dados de seed permanecem na org demo
- Novas contas criam org nova e limpa

#### 2.19 Convites de usuario

**MVP simplificado** (sem email de convite):
1. Admin vai em Configuracoes → Equipe → Convidar
2. Insere email do novo membro
3. Sistema cria um "pending invite" na tabela `invites`
4. Novo usuario faz registro com aquele email → trigger detecta invite e vincula a org existente

Tabela:
```sql
CREATE TABLE invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) NOT NULL,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'member',
  invited_by uuid REFERENCES auth.users(id),
  accepted_at timestamptz,
  expires_at timestamptz DEFAULT now() + interval '7 days',
  created_at timestamptz DEFAULT now()
);
```

Alteracao no trigger `handle_new_user`:
```sql
-- Verifica se existe convite pendente pro email
-- Se sim: vincula a org do convite com role 'member'
-- Se nao: cria nova org (fluxo normal via API route)
```

#### 2.20 RLS confirmacao

O RLS atual ja isola por `organization_id` em todas as tabelas. Pontos de atencao:
- Tabela `organizations`: policy SELECT via subquery em profiles ✓
- Tabela `profiles`: permite SELECT do proprio perfil OU da mesma org ✓
- **Adicionar**: Policy de INSERT em `organizations` (somente via service role, sem acesso client)
- **Adicionar**: Policy de SELECT em `invites` (admin da org ou email do convidado)

---

### Fase 6 — Seguranca e Producao

#### 2.21 Rate Limiting no Registro

- Opcao 1: Vercel Edge Middleware com `@vercel/rate-limit` (mais simples)
- Opcao 2: Supabase Edge Function com rate limit em Redis/KV
- **Recomendacao**: Rate limit no API route de registro — max 5 contas por IP por hora

#### 2.22 Confirmacao de Email

Supabase Auth ja suporta confirmacao de email:
1. Ativar em Supabase Dashboard → Auth → Settings → Email confirmations
2. Apos signUp, usuario recebe email com link de confirmacao
3. Middleware verifica `user.email_confirmed_at` — se null, redireciona pra tela "Confirme seu email"

**Atencao**: No MVP atual a confirmacao esta desabilitada. Ativar antes de ir pra producao.

#### 2.23 Termos de Uso e Privacidade

- Criar paginas `/termos` e `/privacidade` (conteudo estatico)
- Checkbox na tela de registro: "Li e concordo com os Termos de Uso e Politica de Privacidade"
- Armazenar `accepted_terms_at` na tabela profiles

#### 2.24 LGPD

- Politica de retencao: dados mantidos enquanto assinatura ativa + 30 dias apos cancelamento
- Direito de exclusao: Botao "Excluir minha conta" nas configuracoes → apaga usuario, perfil e org (cascade)
- Exportacao de dados: Botao "Exportar meus dados" → gera CSV com fornecedores e interacoes

#### 2.25 Monitoramento

| Ferramenta | Finalidade | Prioridade |
|---|---|---|
| Supabase Dashboard | Logs de queries, auth, edge functions | Ja existe |
| Vercel Analytics | Performance web, Core Web Vitals | Gratuito, ativar |
| Sentry | Erros de runtime no frontend e API | Alta |
| Stripe Dashboard | Receita, churn, MRR | Ja vem com Stripe |
| Uptime monitoring | Verifica se o site esta no ar | Betterstack (free tier) |

---

## 3. Variaveis de Ambiente Necessarias

### Novas env vars (Vercel + .env.local)
```
STRIPE_SECRET_KEY=sk_live_xxx           # Chave secreta do Stripe
STRIPE_PUBLISHABLE_KEY=pk_live_xxx      # Chave publica do Stripe (frontend)
STRIPE_WEBHOOK_SECRET=whsec_xxx         # Secret do webhook Stripe
STRIPE_STARTER_PRICE_ID=price_xxx       # Price ID do plano Starter
STRIPE_PROFESSIONAL_PRICE_ID=price_xxx  # Price ID do plano Professional
NEXT_PUBLIC_SITE_URL=https://carvaoconnect.com.br
```

### Env vars existentes (manter)
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY              # Necessario para API routes de registro e webhook
```

### Supabase Secrets (Edge Functions)
```
OPENAI_API_KEY                         # Ja configurado
ZAPI_WEBHOOK_SECRET                    # Ja configurado
```

---

## 4. Stripe MCP

O Stripe tem MCP oficial (`@stripe/mcp`). Para configurar, adicionar ao `.mcp.json`:

```json
{
  "mcpServers": {
    "supabase": {
      "type": "http",
      "url": "https://mcp.supabase.com/mcp?project_ref=pyipqqjiiatjxsrrrsxx"
    },
    "stripe": {
      "command": "npx",
      "args": ["-y", "@stripe/mcp", "--api-key=sk_test_xxx"]
    }
  }
}
```

Com o Stripe MCP conectado, pode-se criar Products, Prices e Customers diretamente do Claude Code, sem precisar do Dashboard.

**Seguranca**: Usar Restricted API Key com permissoes limitadas (Products: write, Prices: write, Customers: write, Subscriptions: read). Nunca usar a secret key completa no MCP.

---

## 5. Estimativa de Esforço por Fase

| Fase | Descricao | Complexidade | Dependencias |
|---|---|---|---|
| **Fase 1** | Schema de billing + trigger de onboarding | Media | Nenhuma |
| **Fase 2** | Integracao Stripe (Checkout, Webhook, Portal) | Alta | Fase 1 + conta Stripe ativa |
| **Fase 3** | Controle de limites (enforcement) | Media | Fase 1 |
| **Fase 4** | UI de billing e paywall | Media | Fase 2 + Fase 3 |
| **Fase 5** | Multi-tenant real (convites, org isolada) | Media | Fase 1 |
| **Fase 6** | Seguranca e producao | Baixa-Media | Todas anteriores |

### Ordem recomendada de implementacao

```
Fase 1 (Schema) → Fase 5 (Multi-tenant) → Fase 3 (Limites) → Fase 2 (Stripe) → Fase 4 (UI) → Fase 6 (Seguranca)
```

**Justificativa**: Schema e multi-tenant sao pre-requisitos para tudo. Limites podem ser enforced antes de ter cobranca (graceful). Stripe e UI de billing vem juntos. Seguranca e o polish final.

---

## 6. Decisoes Pendentes

Antes de implementar, validar com o stakeholder:

1. **Trial sem cartao?** — O Stripe permite trial sem coletar cartao (mais conversao, mais churn) ou com cartao (menos conversao, menos churn). Recomendacao: **com cartao** para B2B.

2. **O que acontece ao cancelar?** — Acesso ate fim do periodo pago? Ou imediato? Recomendacao: ate fim do periodo (`cancel_at_period_end`).

3. **Grace period pra pagamento falho?** — Quantos dias antes de bloquear? Recomendacao: 7 dias com 3 tentativas automaticas (Stripe Smart Retries).

4. **Downgrade Starter → Free?** — Existe plano free? Ou so trial → pago → cancelado? Recomendacao: nao ter plano free. Trial → pago ou bloqueado.

5. **Preco anual?** — Oferecer desconto anual (ex: 2 meses gratis)? Pode ser adicionado depois como Price adicional no mesmo Product.

6. **Landing page separada?** — Criar `/` como landing publica e mover app pra `/app`? Ou manter login como entrada? Recomendacao: manter login como entrada no MVP, landing page separada e backlog.
