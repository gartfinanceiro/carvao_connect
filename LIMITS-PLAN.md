# LIMITS-PLAN — Limites, Arquivamento, Convites e Permissões

> **Status:** Planejamento — NÃO IMPLEMENTADO
> **Data:** 2026-03-19
> **Escopo:** 4 funcionalidades interligadas que completam o sistema de billing

---

## 1. Resumo Executivo

Este documento detalha a implementação de 4 funcionalidades que faltam para que o sistema de billing do Carvão Connect funcione de ponta a ponta:

| # | Funcionalidade | Por que é necessária |
|---|---|---|
| 2.1 | Arquivar e Excluir fornecedores | Usuários não conseguem remover fornecedores; sem isso, atingem o limite do plano sem solução |
| 2.2 | Limites de Fornecedores (fix) | `check_plan_limit` conta TODOS os fornecedores, inclusive inativos/bloqueados — deve contar só ativos |
| 2.3 | Convites de Usuário | Tabela `invites` não existe; sem isso, `max_users` do plano não tem efeito |
| 2.4 | Permissões por Role | Coluna `profiles.role` existe mas não é usada em nenhum lugar da UI |

---

## 2. Diagnóstico Atual (Investigação)

### Estado do Banco

```
supplier_status enum: 'ativo' | 'inativo' | 'bloqueado'
  → NÃO existe 'arquivado'

Fornecedores atuais (org demo):
  ativo:     11
  inativo:    1
  bloqueado:  1

profiles.role: coluna existe com CHECK (admin/member)
  → DEFAULT 'member'
  → NÃO usada em nenhum componente

invites: tabela NÃO existe

check_plan_limit(p_resource):
  → Conta COUNT(*) de suppliers (sem filtro de status)
  → Deveria contar apenas status = 'ativo'
```

### FK Cascades em `suppliers`

| Tabela dependente | ON DELETE |
|---|---|
| interactions | CASCADE |
| alerts | CASCADE |
| supplier_documents | CASCADE |
| discharges | CASCADE |
| queue_entries | CASCADE |
| whatsapp_conversations | NO ACTION (⚠️ bloqueará DELETE) |
| whatsapp_messages | NO ACTION (via conversation) |
| ai_suggestions | NO ACTION (⚠️ bloqueará DELETE) |

### UI Atual

- **supplier-table.tsx**: Dropdown tem apenas "Ver detalhes", "Registrar interação", "Editar" — sem Arquivar/Excluir
- **supplier-detail.tsx**: Botões de "Editar" e "Nova interação" — sem Arquivar/Excluir
- **configuracoes/client.tsx**: Seções de conta, plano, WhatsApp, alertas — sem seção "Equipe"
- **fornecedores/page.tsx**: Já chama `check_plan_limit` antes de abrir o form de novo fornecedor

---

## 2.1 Fornecedores: Arquivar e Excluir

### Conceito

- **Arquivar** = soft-delete reversível (muda status para `'arquivado'`). Fornecedor sai das listagens padrão mas mantém todo o histórico. Pode ser reativado.
- **Excluir** = hard-delete irreversível. Apaga fornecedor e todos os dados vinculados (interações, alertas, documentos, descargas). Requer confirmação forte.

### Alterações necessárias

#### 2.1.1 Migration SQL

```sql
-- 1. Adicionar 'arquivado' ao enum supplier_status
ALTER TYPE supplier_status ADD VALUE IF NOT EXISTS 'arquivado';

-- 2. Corrigir FK que bloqueia DELETE
ALTER TABLE whatsapp_conversations
  DROP CONSTRAINT whatsapp_conversations_supplier_id_fkey,
  ADD CONSTRAINT whatsapp_conversations_supplier_id_fkey
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE;

ALTER TABLE ai_suggestions
  DROP CONSTRAINT ai_suggestions_supplier_id_fkey,
  ADD CONSTRAINT ai_suggestions_supplier_id_fkey
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE;

-- Nota: whatsapp_messages já tem CASCADE via conversation_id → conversations
```

#### 2.1.2 Componentes

**supplier-table.tsx** — Adicionar ao DropdownMenu:
- "Arquivar" (ícone `Archive`) → muda status para `'arquivado'`, toast de confirmação com botão "Desfazer"
- "Excluir" (ícone `Trash2`, vermelho) → Dialog de confirmação com nome do fornecedor digitado

**supplier-detail.tsx** — Adicionar botões na header:
- "Arquivar" (se status ≠ `'arquivado'`)
- "Reativar" (se status = `'arquivado'`) → muda status para `'ativo'`
- "Excluir" (sempre, cor vermelha)

**fornecedores/page.tsx** — Adicionar filtro de status `'arquivado'`:
- Por padrão, query exclui `'arquivado'` do `WHERE`
- Adicionar opção "Arquivados" no filtro de status para visualizar

#### 2.1.3 Lógica de negócio

- Arquivar um fornecedor **não** conta no limite do plano (ver 2.2)
- Reativar verifica o limite antes de permitir (`check_plan_limit`)
- Excluir requer confirmação com digitação do nome: "Digite `{nome}` para confirmar"
- Alertas pendentes de fornecedor arquivado são automaticamente descartados (trigger ou na própria action)

---

## 2.2 Limites de Fornecedores

### Problema atual

```sql
-- check_plan_limit ATUAL (errado):
SELECT COUNT(*) INTO v_count FROM suppliers WHERE organization_id = v_org_id;

-- CORRETO (contar só ativos):
SELECT COUNT(*) INTO v_count FROM suppliers
WHERE organization_id = v_org_id AND status = 'ativo';
```

Consequência: fornecedores inativos, bloqueados e (futuramente) arquivados consomem a cota do plano sem que o usuário possa liberar espaço.

### Alterações necessárias

#### 2.2.1 Migration SQL

```sql
CREATE OR REPLACE FUNCTION check_plan_limit(p_resource text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_org_id uuid;
  v_limits jsonb;
  v_count int;
  v_max int;
BEGIN
  SELECT organization_id INTO v_org_id
  FROM profiles WHERE id = auth.uid();

  SELECT plan_limits INTO v_limits
  FROM organizations WHERE id = v_org_id;

  IF v_limits IS NULL THEN
    RETURN jsonb_build_object('allowed', true, 'current', 0, 'max', 999);
  END IF;

  IF p_resource = 'suppliers' THEN
    -- Contar apenas fornecedores ATIVOS
    SELECT COUNT(*) INTO v_count
    FROM suppliers
    WHERE organization_id = v_org_id AND status = 'ativo';

    v_max := COALESCE((v_limits->>'max_suppliers')::int, 999);
  ELSIF p_resource = 'users' THEN
    SELECT COUNT(*) INTO v_count
    FROM profiles
    WHERE organization_id = v_org_id;

    v_max := COALESCE((v_limits->>'max_users')::int, 999);
  ELSE
    RETURN jsonb_build_object('allowed', true, 'current', 0, 'max', 999);
  END IF;

  RETURN jsonb_build_object(
    'allowed', v_count < v_max,
    'current', v_count,
    'max', v_max
  );
END;
$$;
```

#### 2.2.2 UI — Feedback de limite

**fornecedores/page.tsx** — Já implementado parcialmente. Ajustar:
- Mostrar contador "X / Y fornecedores" ao lado do botão "Novo fornecedor"
- Quando `current >= max * 0.8` (80%), mostrar badge amarelo "Quase no limite"
- Quando bloqueado, toast com link para `/planos`

**Reativação de arquivado** — Antes de mudar status de `'arquivado'` para `'ativo'`, chamar `check_plan_limit('suppliers')`. Se não permitido, mostrar toast "Limite atingido. Faça upgrade para reativar."

---

## 2.3 Convites de Usuário

### Estado atual

- Coluna `profiles.role` existe (admin/member), default `'member'`
- `handle_new_user` trigger lê `organization_id` dos metadados do usuário
- `max_users` existe em `plan_limits` mas não é verificado em nenhum fluxo de convite
- Não existe tabela `invites` nem UI de equipe

### Alterações necessárias

#### 2.3.1 Migration SQL

```sql
-- Tabela de convites
CREATE TABLE invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  invited_by uuid NOT NULL REFERENCES auth.users(id),
  token uuid NOT NULL DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,

  UNIQUE(organization_id, email)
);

-- RLS
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view invites" ON invites
  FOR SELECT USING (organization_id = get_my_org_id());

CREATE POLICY "Admins can manage invites" ON invites
  FOR ALL USING (
    organization_id = get_my_org_id()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Dar role 'admin' ao criador da organização
-- (já deveria ser feito no /api/register, mas garantir via migration)
```

#### 2.3.2 API Routes

**`/api/invites` (POST)** — Criar convite:
1. Verificar se caller é admin
2. Chamar `check_plan_limit('users')`
3. Verificar se email já tem convite pendente
4. Inserir na tabela `invites`
5. Enviar email com link `{baseUrl}/convite?token={token}` (Supabase Edge Function ou Resend)
6. Retornar convite criado

**`/api/invites` (GET)** — Listar convites da org (admins only)

**`/api/invites` (DELETE)** — Revogar convite (admins only, muda status para `'revoked'`)

**`/api/invites/accept` (POST)** — Aceitar convite:
1. Verificar token válido e não expirado
2. Criar usuário via Supabase Auth (se não existe)
3. Inserir profile com `organization_id` e `role` do convite
4. Marcar convite como `'accepted'`
5. Redirecionar para `/login`

#### 2.3.3 Página `/convite`

- Página pública (fora do `(app)` layout)
- Recebe `?token=xxx`
- Mostra: nome da org, quem convidou, role
- Formulário: nome, senha (email pré-preenchido do convite)
- Após criar conta → redireciona para `/login`

#### 2.3.4 UI — Seção "Equipe" em Configurações

**configuracoes/client.tsx** — Adicionar nova seção após "Organização e Plano":

```
Equipe (X / Y usuários)
├── Lista de membros atuais
│   ├── Nome | Email | Role (badge) | Ações
│   └── Admin pode: mudar role, remover membro
├── Lista de convites pendentes
│   ├── Email | Role | Enviado em | Status | Ações
│   └── Admin pode: reenviar, revogar
└── Botão "Convidar membro" (disabled se limite atingido)
    └── Dialog: email + role (admin/member) → POST /api/invites
```

Apenas `admin` vê os botões de ação. `member` vê a lista mas sem ações.

#### 2.3.5 Fluxo de registro — ajuste

No `/api/register`, o usuário que cria a organização deve receber `role = 'admin'`:

```typescript
// Já no insert do profile (via handle_new_user trigger)
// Ajustar trigger ou fazer UPDATE após criação:
await supabase.from('profiles').update({ role: 'admin' }).eq('id', userId)
```

Alternativa: passar `role: 'admin'` nos metadados do usuário e ler no trigger.

---

## 2.4 Permissões por Role

### Modelo de permissões

| Ação | Admin | Member |
|---|---|---|
| Ver fornecedores | ✅ | ✅ |
| Criar/editar fornecedores | ✅ | ✅ |
| Arquivar fornecedores | ✅ | ❌ |
| Excluir fornecedores | ✅ | ❌ |
| Registrar interações | ✅ | ✅ |
| Ver/gerenciar alertas | ✅ | ✅ |
| Convidar membros | ✅ | ❌ |
| Remover membros | ✅ | ❌ |
| Mudar roles | ✅ | ❌ |
| Ver configurações de plano | ✅ | ✅ (somente leitura) |
| Gerenciar assinatura (portal Stripe) | ✅ | ❌ |
| Configurar WhatsApp | ✅ | ❌ |
| Ver planos / Upgrade | ✅ | ❌ |

### Alterações necessárias

#### 2.4.1 Hook `useRole()`

Criar hook que lê o role do perfil do usuário logado:

```typescript
// src/hooks/use-role.ts
export function useRole() {
  // Lê de um RoleProvider ou do SubscriptionProvider expandido
  // Retorna: { role: 'admin' | 'member', isAdmin: boolean }
}
```

**Opção recomendada:** Expandir o `SubscriptionProvider` existente para incluir `role` no contexto. O RPC `get_my_subscription()` já poderia retornar o role do usuário, ou fazer um join com `profiles`.

#### 2.4.2 RPC — Incluir role

```sql
CREATE OR REPLACE FUNCTION get_my_subscription()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
  v_role text;
BEGIN
  -- Buscar role do usuário
  SELECT role INTO v_role FROM profiles WHERE id = auth.uid();

  SELECT jsonb_build_object(
    'plan', o.plan,
    'subscription_status', o.subscription_status,
    'trial_ends_at', o.trial_ends_at,
    'current_period_end', o.current_period_end,
    'plan_limits', o.plan_limits,
    'has_stripe', o.stripe_subscription_id IS NOT NULL,
    'is_demo', COALESCE(o.is_demo, false),
    'role', COALESCE(v_role, 'member')  -- NOVO
  ) INTO v_result
  FROM organizations o
  WHERE o.id = get_my_org_id();

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;
```

#### 2.4.3 Enforcement na UI

- Botões de ação destrutiva (Arquivar, Excluir) → `if (!isAdmin) return null`
- Seção "Equipe" em Configurações → botões de ação só para admin
- "Gerenciar assinatura" → só admin
- "Configurar WhatsApp" → só admin
- "Ver planos" → só admin

**NÃO** bloquear via RLS no banco (exceto invites). O enforcement é na UI para manter simplicidade. Ações críticas (delete, archive) podem ter check adicional no lado do servidor se necessário no futuro.

#### 2.4.4 RLS para invites (já coberto em 2.3.1)

Apenas admins podem INSERT/UPDATE/DELETE na tabela `invites`. Todos os membros podem SELECT.

---

## 2.5 Estrutura de Arquivos

### Arquivos novos

```
src/
├── hooks/
│   └── use-role.ts                    — Hook useRole() (ou expandir SubscriptionProvider)
├── app/
│   ├── convite/
│   │   └── page.tsx                   — Página de aceitar convite
│   └── api/
│       └── invites/
│           ├── route.ts               — GET (listar) + POST (criar) + DELETE (revogar)
│           └── accept/
│               └── route.ts           — POST (aceitar convite)
```

### Arquivos modificados

```
src/
├── components/
│   ├── supplier-table.tsx             — Dropdown: +Arquivar, +Excluir
│   ├── supplier-detail.tsx            — Header: +Arquivar/Reativar, +Excluir
│   └── subscription-provider.tsx      — Incluir role no contexto
├── app/
│   ├── (app)/
│   │   ├── fornecedores/page.tsx      — Filtro excluir arquivados, contador de limite
│   │   └── configuracoes/client.tsx   — Seção "Equipe", gates de permissão
│   └── api/
│       └── register/route.ts          — Definir role='admin' para criador
├── lib/
│   └── supabase/middleware.ts         — Adicionar /convite como rota pública
├── types/
│   └── database.ts                    — Tipo Invite, atualizar SubscriptionInfo
```

### Migrations SQL (Supabase MCP)

```
1. add_archived_status          — Enum + FK fixes
2. fix_check_plan_limit         — Contar só ativos
3. create_invites_table         — Tabela + RLS
4. update_get_my_subscription   — Incluir role no retorno
```

---

## 2.6 Estimativa de Esforço

### Ordem de implementação recomendada

| Fase | Funcionalidade | Complexidade | Dependências |
|---|---|---|---|
| **Fase A** | 2.2 Fix `check_plan_limit` | Baixa | Nenhuma — é um fix de 1 linha SQL |
| **Fase B** | 2.1 Arquivar e Excluir | Média | Fase A (limite corrigido para reativação) |
| **Fase C** | 2.4 Permissões por Role | Média | Nenhuma (role já existe no banco) |
| **Fase D** | 2.3 Convites de Usuário | Alta | Fase C (precisa de role enforcement) |

### Detalhamento por fase

**Fase A — Fix check_plan_limit** (1 migration)
- 1 migration SQL: `CREATE OR REPLACE FUNCTION`
- Testar com org demo (11 ativos, 1 inativo, 1 bloqueado → deve retornar 11, não 13)

**Fase B — Arquivar e Excluir** (1 migration + 3 componentes)
- 1 migration SQL: enum + FK fixes
- Editar: supplier-table.tsx, supplier-detail.tsx, fornecedores/page.tsx
- Dialog de confirmação para exclusão
- Toast com "Desfazer" para arquivamento

**Fase C — Permissões por Role** (1 migration + 3 componentes)
- 1 migration SQL: update `get_my_subscription` para incluir role
- Expandir SubscriptionProvider com `role` e `isAdmin`
- Editar: supplier-table.tsx, supplier-detail.tsx, configuracoes/client.tsx
- Esconder/desabilitar ações conforme role

**Fase D — Convites de Usuário** (1 migration + 4 arquivos novos + 2 edições)
- 1 migration SQL: tabela invites + RLS
- Criar: /api/invites (route.ts + accept/route.ts), /convite/page.tsx
- Editar: configuracoes/client.tsx (seção Equipe), register/route.ts (role=admin)
- Editar: middleware.ts (rota /convite pública)
- Envio de email (Resend ou Supabase Edge Function)

---

## Notas adicionais

1. **Email de convite**: Avaliar usar Supabase Auth `inviteUserByEmail()` vs flow customizado. O `inviteUserByEmail` já cria o usuário e envia email, mas dá menos controle sobre a UI. Recomendação: flow customizado com Resend para manter o branding.

2. **Remoção de membros**: Quando um admin remove um membro, o profile é deletado mas o auth.user permanece (Supabase não permite deletar auth users via client). Usar admin client com `auth.admin.deleteUser()`.

3. **Último admin**: Impedir que o último admin da org mude seu próprio role para member ou se remova. Check: `SELECT COUNT(*) FROM profiles WHERE organization_id = X AND role = 'admin'`.

4. **Arquivamento em massa**: Considerar no futuro um checkbox de seleção na tabela para arquivar/excluir múltiplos fornecedores de uma vez. Não incluído nesta fase.

5. **Audit log**: Ações destrutivas (excluir fornecedor, remover membro) poderiam ser registradas em uma tabela `audit_log`. Considerar para fase futura.
