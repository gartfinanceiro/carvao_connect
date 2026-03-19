# Carvão Connect — Plano de Integração WhatsApp (Z-API + IA)

> **Status:** Documento de planejamento — nenhum código deve ser implementado antes da aprovação.
> **Última atualização:** 2026-03-18

---

## Índice

1. [Arquitetura](#1-arquitetura)
2. [Schema Proposto](#2-schema-proposto)
3. [Integração Z-API](#3-integração-z-api)
4. [Processamento IA (Claude API)](#4-processamento-ia-claude-api)
5. [Componentes UI](#5-componentes-ui)
6. [Variáveis de Ambiente](#6-variáveis-de-ambiente)
7. [Riscos e Decisões em Aberto](#7-riscos-e-decisões-em-aberto)
8. [Estimativa de Esforço](#8-estimativa-de-esforço)

---

## 1. Arquitetura

### 1.1 Diagrama do Fluxo de Dados

```
┌──────────────┐     ┌──────────────┐     ┌─────────────────────────┐
│  WhatsApp    │     │   Z-API      │     │  Supabase Edge Function │
│  (Fornecedor)│────▶│   Cloud      │────▶│  /whatsapp-webhook      │
└──────────────┘     └──────────────┘     └────────┬────────────────┘
                                                   │
                           ┌───────────────────────┘
                           ▼
                    ┌──────────────┐
                    │  PostgreSQL  │
                    │              │
                    │ ┌──────────┐ │
                    │ │ whatsapp │ │    ┌──────────────────────┐
                    │ │ messages │ │    │  Supabase Edge Fn    │
                    │ └──────────┘ │    │  /process-conversation│
                    │ ┌──────────┐ │    │  (Claude Haiku)      │
                    │ │ whatsapp │◀├────│                      │
                    │ │ convers. │ │    └──────────┬───────────┘
                    │ └──────────┘ │               │
                    │ ┌──────────┐ │               ▼
                    │ │ ai_      │◀├───── Resultado estruturado
                    │ │ suggest. │ │      (tool_use JSON)
                    │ └──────────┘ │
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │  Feed UI     │
                    │  (Card de    │
                    │   sugestão)  │
                    │              │
                    │  [Confirmar] │───▶ Cria interaction + alerta
                    │  [Editar]    │     no banco existente
                    │  [Descartar] │
                    └──────────────┘
```

### 1.2 Decisões Arquiteturais

| Componente | Decisão | Justificativa |
|---|---|---|
| **Webhook receiver** | Supabase Edge Function | Sem custo extra, auto-escalável, acessa DB direto. Não requer Node.js server separado. |
| **Processamento IA** | Supabase Edge Function separada | Isolar processamento async do webhook (webhook deve retornar 200 rápido). Chamada via `supabase.functions.invoke()` ou pg_net. |
| **Fila de processamento** | DB-based (tabela `whatsapp_conversations` com status) | Simples, auditável, sem dependência externa (Redis, SQS). Edge Function polls/triggers baseado em status. |
| **Armazenamento de mensagens** | Tabela `whatsapp_messages` | Histórico completo para auditoria, re-processamento, e visualização na UI. |
| **Matching telefone→fornecedor** | Normalização para dígitos puros + busca via `ANY()` no array `suppliers.phones` | Phones já estão em TEXT[] na tabela suppliers. |
| **Áudio no MVP** | Ignorar (salvar referência, não transcrever) | Transcrição adiciona complexidade e custo. Pós-MVP com Whisper API. |

### 1.3 Fluxo Detalhado

1. **Mensagem chega** → Z-API envia POST para Edge Function `/whatsapp-webhook`
2. **Webhook valida** `client-token` header, faz matching do telefone com fornecedor
3. **Salva mensagem** na tabela `whatsapp_messages`
4. **Verifica se conversa está "aberta"** (última mensagem < 30 min atrás) → agrupa na mesma conversa ou cria nova
5. **Após inatividade de 5 min** (via CRON ou trigger de nova mensagem) → marca conversa como `ready_for_processing`
6. **Edge Function `/process-conversation`** busca conversas `ready_for_processing`:
   - Monta transcript da conversa
   - Chama Claude Haiku via tool_use
   - Salva resultado em `ai_suggestions`
   - Marca conversa como `processed`
7. **Feed UI** exibe card de sugestão com dados pré-preenchidos
8. **Usuário confirma** → cria `interaction` no banco (mesmo fluxo que InteractionForm) + marca sugestão como `accepted`

---

## 2. Schema Proposto

### 2.1 Novas Tabelas

#### `whatsapp_connections`

Armazena a conexão Z-API da organização.

```sql
CREATE TABLE whatsapp_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Z-API config
  instance_id TEXT NOT NULL,              -- Z-API instance ID
  instance_token TEXT NOT NULL,           -- Z-API instance token
  client_token TEXT NOT NULL,             -- Token para validar webhooks

  -- Status
  status TEXT NOT NULL DEFAULT 'disconnected'
    CHECK (status IN ('disconnected', 'connecting', 'connected')),
  connected_phone TEXT,                   -- Telefone conectado (ex: 5531999999999)
  connected_at TIMESTAMPTZ,
  disconnected_at TIMESTAMPTZ,

  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE (organization_id)               -- 1 conexão por organização no MVP
);

CREATE INDEX idx_whatsapp_connections_org ON whatsapp_connections(organization_id);
```

#### `whatsapp_messages`

Cada mensagem individual (enviada ou recebida).

```sql
CREATE TABLE whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  conversation_id UUID REFERENCES whatsapp_conversations(id),

  -- Identificação
  zapi_message_id TEXT,                   -- ID da mensagem na Z-API
  phone TEXT NOT NULL,                    -- Telefone (formato: 5531999999999)
  supplier_id UUID REFERENCES suppliers(id), -- NULL se não matchou

  -- Conteúdo
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  message_type TEXT NOT NULL CHECK (message_type IN ('text', 'audio', 'image', 'document', 'location', 'contact', 'sticker', 'other')),
  content TEXT,                           -- Texto da mensagem (ou caption)
  media_url TEXT,                         -- URL do arquivo (áudio, imagem, doc)
  media_mime_type TEXT,
  file_name TEXT,                         -- Nome do arquivo (para documentos)

  -- Metadata Z-API
  sender_name TEXT,                       -- Nome do contato no WhatsApp
  sender_photo_url TEXT,
  is_group BOOLEAN DEFAULT false,
  raw_payload JSONB,                      -- Payload completo da Z-API (debug)

  -- Timestamps
  message_timestamp TIMESTAMPTZ NOT NULL, -- Timestamp da mensagem (da Z-API)
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_wm_org_phone ON whatsapp_messages(organization_id, phone);
CREATE INDEX idx_wm_conversation ON whatsapp_messages(conversation_id);
CREATE INDEX idx_wm_supplier ON whatsapp_messages(supplier_id);
CREATE INDEX idx_wm_timestamp ON whatsapp_messages(organization_id, message_timestamp DESC);
```

#### `whatsapp_conversations`

Agrupa mensagens em "sessões" de conversa (janela de inatividade).

```sql
CREATE TABLE whatsapp_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  supplier_id UUID REFERENCES suppliers(id),
  phone TEXT NOT NULL,

  -- Janela de conversa
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  message_count INTEGER DEFAULT 0,

  -- Processamento IA
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'ready_for_processing', 'processing', 'processed', 'error', 'skipped')),
  transcript TEXT,                        -- Transcript montado para IA
  processed_at TIMESTAMPTZ,
  error_message TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_wc_org_status ON whatsapp_conversations(organization_id, status);
CREATE INDEX idx_wc_supplier ON whatsapp_conversations(supplier_id);
CREATE INDEX idx_wc_last_msg ON whatsapp_conversations(organization_id, last_message_at DESC);
```

#### `ai_suggestions`

Resultado da extração IA — o que o sistema sugere ao usuário.

```sql
CREATE TABLE ai_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  conversation_id UUID NOT NULL REFERENCES whatsapp_conversations(id),
  supplier_id UUID REFERENCES suppliers(id),

  -- Dados extraídos pela IA
  extracted_data JSONB NOT NULL,          -- JSON completo retornado pelo Claude
  confidence TEXT NOT NULL CHECK (confidence IN ('alta', 'media', 'baixa')),

  -- Campos extraídos (desnormalizados para queries)
  contact_result TEXT,                    -- atendeu, nao_atendeu, etc.
  load_promised BOOLEAN,
  promised_volume INTEGER,
  promised_date DATE,
  price_per_mdc NUMERIC(10,2),
  next_step TEXT,
  next_step_date TIMESTAMPTZ,
  summary TEXT,                           -- Resumo da conversa gerado pela IA

  -- Status da sugestão
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'edited', 'dismissed')),
  accepted_by UUID REFERENCES auth.users(id),
  accepted_at TIMESTAMPTZ,
  dismissed_reason TEXT,

  -- Se aceita, referência à interaction criada
  interaction_id UUID REFERENCES interactions(id),

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ais_org_status ON ai_suggestions(organization_id, status);
CREATE INDEX idx_ais_supplier ON ai_suggestions(supplier_id);
CREATE INDEX idx_ais_conversation ON ai_suggestions(conversation_id);
```

### 2.2 RLS Policies

Todas as novas tabelas seguem o padrão existente:

```sql
-- whatsapp_connections
ALTER TABLE whatsapp_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON whatsapp_connections
  FOR ALL USING (organization_id = get_my_org_id());

-- whatsapp_messages
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON whatsapp_messages
  FOR ALL USING (organization_id = get_my_org_id());

-- whatsapp_conversations
ALTER TABLE whatsapp_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON whatsapp_conversations
  FOR ALL USING (organization_id = get_my_org_id());

-- ai_suggestions
ALTER TABLE ai_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON ai_suggestions
  FOR ALL USING (organization_id = get_my_org_id());
```

### 2.3 Triggers e Functions

```sql
-- Timestamp automático
CREATE TRIGGER trg_whatsapp_connections_updated_at
  BEFORE UPDATE ON whatsapp_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_whatsapp_conversations_updated_at
  BEFORE UPDATE ON whatsapp_conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_ai_suggestions_updated_at
  BEFORE UPDATE ON ai_suggestions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Função para normalizar telefone (remover formatação)
CREATE OR REPLACE FUNCTION normalize_phone(phone TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN regexp_replace(phone, '\D', '', 'g');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Função para encontrar fornecedor por telefone
CREATE OR REPLACE FUNCTION find_supplier_by_phone(
  p_org_id UUID,
  p_phone TEXT
) RETURNS UUID AS $$
DECLARE
  v_supplier_id UUID;
  v_normalized TEXT;
BEGIN
  v_normalized := normalize_phone(p_phone);

  -- Busca fornecedor que tenha esse telefone no array phones
  SELECT id INTO v_supplier_id
  FROM suppliers
  WHERE organization_id = p_org_id
    AND status = 'ativo'
    AND EXISTS (
      SELECT 1 FROM unnest(phones) AS p
      WHERE normalize_phone(p) = v_normalized
         OR normalize_phone(p) = RIGHT(v_normalized, 11)
         OR RIGHT(normalize_phone(p), 11) = RIGHT(v_normalized, 11)
    )
  LIMIT 1;

  RETURN v_supplier_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
```

### 2.4 Impacto nas Tabelas Existentes

| Tabela | Alteração | Motivo |
|---|---|---|
| `suppliers` | Nenhuma | Phones já estão em TEXT[], suficiente para matching |
| `interactions` | Nenhuma | Sugestão aceita cria interaction normal |
| `alerts` | Nenhuma | Triggers existentes criam alertas a partir de interactions |

---

## 3. Integração Z-API

### 3.1 Endpoints Utilizados

#### Conexão / QR Code

| Endpoint | Método | Uso |
|---|---|---|
| `/qr-code` | GET | Obter QR code para conexão (base64 PNG) |
| `/status` | GET | Verificar status da conexão |
| `/disconnect` | GET | Desconectar instância |
| `/restart` | GET | Reconectar instância |

**Base URL:** `https://api.z-api.io/instances/{INSTANCE_ID}/token/{INSTANCE_TOKEN}`

**Exemplo — Obter QR Code:**

```
GET https://api.z-api.io/instances/ABC123/token/XYZ789/qr-code
```

Resposta (não conectado):
```json
{
  "connected": false,
  "value": "data:image/png;base64,iVBORw0KGgoAAAANSUh..."
}
```

Resposta (já conectado):
```json
{
  "connected": true,
  "value": null
}
```

**Exemplo — Status da Conexão:**

```
GET .../status
```

```json
{
  "connected": true,
  "smartphoneConnected": true,
  "session": true
}
```

#### Envio de Mensagens (pós-MVP)

| Endpoint | Método | Uso |
|---|---|---|
| `/send-text` | POST | Enviar mensagem de texto |
| `/phone-exists/{phone}` | GET | Verificar se telefone tem WhatsApp |

**Exemplo — Enviar Texto:**

```json
POST .../send-text
{
  "phone": "5531999999999",
  "message": "Bom dia! Confirmando a carga para dia 25/03."
}
```

### 3.2 Webhook — Mensagem Recebida

**URL configurada na Z-API:** `https://<SUPABASE_PROJECT_REF>.supabase.co/functions/v1/whatsapp-webhook`

**Headers que a Z-API envia:**

```
POST /functions/v1/whatsapp-webhook
Content-Type: application/json
client-token: SEU_TOKEN_CONFIGURADO
```

**Payload — Mensagem de Texto:**

```json
{
  "instanceId": "ABC123",
  "phone": "5531999999999",
  "fromMe": false,
  "messageId": "3EB0B430B6F8F1D339",
  "status": "RECEIVED",
  "senderName": "João Fornecedor",
  "senderPhoto": "https://...",
  "isGroup": false,
  "text": {
    "message": "Boa tarde, tenho 5 cargas de eucalipto disponíveis a R$185 o MDC"
  },
  "messageTimestamp": 1678900000
}
```

**Payload — Mensagem de Áudio:**

```json
{
  "instanceId": "ABC123",
  "phone": "5531999999999",
  "fromMe": false,
  "messageId": "3EB0B430B6F8F1D341",
  "status": "RECEIVED",
  "senderName": "João Fornecedor",
  "isGroup": false,
  "audio": {
    "mimeType": "audio/ogg; codecs=opus",
    "audioUrl": "https://...",
    "ptt": true
  },
  "messageTimestamp": 1678900200
}
```

**Payload — Mensagem de Imagem:**

```json
{
  "instanceId": "ABC123",
  "phone": "5531999999999",
  "fromMe": false,
  "messageId": "3EB0B430B6F8F1D340",
  "status": "RECEIVED",
  "senderName": "João Fornecedor",
  "isGroup": false,
  "image": {
    "mimeType": "image/jpeg",
    "imageUrl": "https://...",
    "thumbnailUrl": "https://...",
    "caption": "Foto da carga"
  },
  "messageTimestamp": 1678900100
}
```

**Payload — Documento:**

```json
{
  "instanceId": "ABC123",
  "phone": "5531999999999",
  "fromMe": false,
  "messageId": "3EB0B430B6F8F1D342",
  "status": "RECEIVED",
  "senderName": "João Fornecedor",
  "isGroup": false,
  "document": {
    "mimeType": "application/pdf",
    "fileName": "DCF_2024.pdf",
    "documentUrl": "https://...",
    "caption": null
  },
  "messageTimestamp": 1678900300
}
```

**Payload — Mensagem Enviada (fromMe: true):**

Mesma estrutura, com `"fromMe": true`. Captura as mensagens que o comprador envia pelo WhatsApp.

### 3.3 Matching de Telefone

**Problema:** A Z-API envia telefone no formato `5531999999999` (código país + DDD + número). A tabela `suppliers` armazena em TEXT[] com formato variável: `"(31)99991234"`, `"31999991234"`, `"(31) 99991-2345"`, etc.

**Solução — Normalização:**

```
Z-API envia:     "5531999912345"
                        ↓
Normalizar:      "5531999912345" → remover não-dígitos
                        ↓
Comparar com:    suppliers.phones[] → cada elemento normalizado
                        ↓
Match:           RIGHT(zapi, 11) = RIGHT(supplier_phone, 11)
                 "31999912345"  = "31999912345"
```

A função `find_supplier_by_phone()` (seção 2.3) implementa essa lógica:
- Remove todos os caracteres não-numéricos de ambos os lados
- Compara os últimos 11 dígitos (DDD + 9 dígitos do celular)
- Isso ignora o código do país (+55) e qualquer formatação

**Telefones sem match:** Mensagens de telefones que não correspondem a nenhum fornecedor são salvas com `supplier_id = NULL` e podem ser visualizadas em uma seção "Mensagens não identificadas" na UI.

### 3.4 Mensagens de Áudio

**MVP:** Ignorar conteúdo de áudio, salvar apenas referência.

- Salvar `message_type = 'audio'`, `media_url`, `media_mime_type`
- Na UI, mostrar indicador "[Mensagem de áudio]" com link para ouvir
- O transcript da conversa enviado à IA incluirá: `"[Áudio - não transcrito]"`
- A IA deve ser instruída a ignorar áudios na extração

**Pós-MVP:** Integrar transcrição via Whisper API (OpenAI) ou Deepgram antes de enviar à IA.

### 3.5 Reconexão

**Cenário:** O WhatsApp pode desconectar por vários motivos (telefone offline, mudança de rede, sessão expirada).

**Detecção:** Webhook de desconexão da Z-API:

```json
POST /whatsapp-webhook
{
  "instanceId": "ABC123",
  "connected": false,
  "phone": "5531999999999"
}
```

**Tratamento:**

1. Webhook atualiza `whatsapp_connections.status = 'disconnected'`
2. UI mostra banner de alerta na página de configurações e no feed
3. Tentativa automática de reconexão via `GET .../restart`
4. Se falhar, pedir ao usuário para escanear QR code novamente
5. Registrar evento de desconexão para monitoramento

**Polling de status (fallback):** CRON job a cada 5 minutos verifica `GET .../status`. Se `connected: false` e `whatsapp_connections.status = 'connected'`, atualiza status no banco.

---

## 4. Processamento IA (Claude API)

### 4.1 Modelo Recomendado

**Claude 3.5 Haiku** (`claude-3-5-haiku-20241022`)

| Critério | Haiku | Sonnet |
|---|---|---|
| Custo input | $0.80/1M tokens | $3.00/1M tokens |
| Custo output | $4.00/1M tokens | $15.00/1M tokens |
| Latência (tarefas curtas) | ~0.5-1s | ~1-2s |
| Acurácia para extração estruturada | Boa (suficiente com schema rígido via tool_use) | Excelente |
| **Custo por conversa** | **~$0.001** | **~$0.004** |

**Justificativa:** Para conversas curtas (200-500 tokens) com schema bem definido via tool_use, Haiku oferece qualidade suficiente a 3.75x menos custo. O `tool_choice: {"type": "tool"}` força output JSON válido, reduzindo a necessidade de modelo mais inteligente.

**Estratégia de fallback:** Se `confianca_extracao = "baixa"`, re-processar com Sonnet automaticamente (custo marginal desprezível dado o volume baixo).

### 4.2 Prompt Proposto

**System prompt:**

```
Você é um assistente especializado em extrair dados estruturados de conversas de WhatsApp entre compradores de carvão vegetal (siderúrgicas/guseiras) e fornecedores.

Regras de extração:
1. Extraia SOMENTE informações EXPLICITAMENTE mencionadas na conversa.
2. Para campos não mencionados, retorne null.
3. Preços devem ser em reais (R$) por MDC.
4. Densidade em kg/mdc.
5. Volume em número de cargas (não MDC, a menos que especificado).
6. UF deve ser a sigla de 2 letras.
7. Se o fornecedor mencionar que "tem disponível", "pode entregar", "tem pronto", marque disponibilidade_imediata como true.
8. Se a conversa for muito curta, ambígua, ou apenas cumprimentos sem informação comercial, defina confianca como "baixa".
9. O campo resumo deve ser 1-2 frases descrevendo o resultado da conversa.
10. O campo proximo_passo deve resumir o que foi combinado ao final.
11. Mensagens marcadas como [Áudio - não transcrito] devem ser ignoradas.
12. Identifique o resultado do contato: se houve resposta substantiva = "atendeu", se não respondeu = "nao_atendeu".

Tipos de carvão válidos: eucalipto, tipi, babacu, nativo, misto.
Tipos de contato: whatsapp (sempre, neste contexto).
```

### 4.3 Schema de Output (Tool Use)

```json
{
  "name": "extrair_dados_conversa",
  "description": "Extrai dados estruturados de conversa WhatsApp com fornecedor de carvão",
  "input_schema": {
    "type": "object",
    "properties": {
      "resumo": {
        "type": "string",
        "description": "Resumo de 1-2 frases do resultado da conversa"
      },
      "resultado_contato": {
        "type": "string",
        "enum": ["atendeu", "nao_atendeu"],
        "description": "Se o fornecedor respondeu de forma substantiva"
      },
      "tipo_carvao": {
        "type": ["string", "null"],
        "enum": ["eucalipto", "tipi", "babacu", "nativo", "misto", null]
      },
      "preco_por_mdc": {
        "type": ["number", "null"],
        "description": "Preço por MDC em reais"
      },
      "carga_prometida": {
        "type": "boolean",
        "description": "Se o fornecedor prometeu entregar carga"
      },
      "volume_prometido": {
        "type": ["integer", "null"],
        "description": "Número de cargas prometidas"
      },
      "data_prometida": {
        "type": ["string", "null"],
        "description": "Data prometida para entrega (formato YYYY-MM-DD)"
      },
      "densidade_kg_mdc": {
        "type": ["number", "null"],
        "description": "Densidade mencionada em kg/mdc"
      },
      "disponibilidade_imediata": {
        "type": ["boolean", "null"],
        "description": "Se tem carvão disponível para entrega imediata"
      },
      "proximo_passo": {
        "type": ["string", "null"],
        "description": "Próximo passo acordado (ex: 'retornar amanhã', 'enviar DAP')"
      },
      "proximo_passo_tipo": {
        "type": "string",
        "enum": ["retornar_em", "aguardar_retorno", "nenhum"],
        "description": "Tipo de próximo passo para criar alerta"
      },
      "proximo_passo_data": {
        "type": ["string", "null"],
        "description": "Data do próximo passo (formato YYYY-MM-DD), se mencionada"
      },
      "sentimento": {
        "type": "string",
        "enum": ["positivo", "neutro", "negativo"]
      },
      "confianca": {
        "type": "string",
        "enum": ["alta", "media", "baixa"],
        "description": "Confiança na qualidade da extração"
      },
      "notas_extracao": {
        "type": ["string", "null"],
        "description": "Observações sobre dificuldades ou ambiguidades na extração"
      }
    },
    "required": ["resumo", "resultado_contato", "carga_prometida", "proximo_passo_tipo", "sentimento", "confianca"]
  }
}
```

**Chamada à API:**

```json
{
  "model": "claude-3-5-haiku-20241022",
  "max_tokens": 1024,
  "temperature": 0,
  "system": "...(system prompt acima)...",
  "tools": [{ "name": "extrair_dados_conversa", "input_schema": { ... } }],
  "tool_choice": { "type": "tool", "name": "extrair_dados_conversa" },
  "messages": [
    {
      "role": "user",
      "content": "Conversa WhatsApp entre comprador e fornecedor \"João Silva\" (Sete Lagoas, MG):\n\n[18/03 09:15] Comprador: Bom dia João, tudo bem? Aqui é da Siderúrgica Vale do Aço.\n[18/03 09:18] João: Bom dia! Tudo ótimo, e vocês?\n[18/03 09:20] Comprador: Estamos precisando de eucalipto. Você tem disponível?\n[18/03 09:22] João: Tenho sim! 5 cargas prontas, eucalipto de reflorestamento. R$185 o MDC, densidade tá ficando em 230.\n[18/03 09:25] Comprador: Vou avaliar com a diretoria e retorno até sexta.\n[18/03 09:26] João: Perfeito, fico no aguardo!"
    }
  ]
}
```

**Resposta esperada:**

```json
{
  "content": [{
    "type": "tool_use",
    "name": "extrair_dados_conversa",
    "input": {
      "resumo": "Fornecedor João Silva tem 5 cargas de eucalipto disponíveis a R$185/MDC com densidade de 230 kg/mdc. Comprador vai avaliar e retornar até sexta.",
      "resultado_contato": "atendeu",
      "tipo_carvao": "eucalipto",
      "preco_por_mdc": 185,
      "carga_prometida": false,
      "volume_prometido": 5,
      "data_prometida": null,
      "densidade_kg_mdc": 230,
      "disponibilidade_imediata": true,
      "proximo_passo": "Comprador vai avaliar com diretoria e retornar até sexta",
      "proximo_passo_tipo": "retornar_em",
      "proximo_passo_data": "2026-03-21",
      "sentimento": "positivo",
      "confianca": "alta",
      "notas_extracao": null
    }
  }]
}
```

### 4.4 Conversas Ambíguas ou Muito Curtas

| Cenário | Comportamento |
|---|---|
| Apenas cumprimentos ("Bom dia!", "Oi") | `confianca: "baixa"`, `resultado_contato: "nao_atendeu"`, sem dados comerciais |
| Conversa só com áudios | `confianca: "baixa"`, `notas_extracao: "Conversa contém apenas áudios não transcritos"` |
| Menos de 3 mensagens de texto | Marcar conversa como `skipped`, não chamar IA |
| Mensagem de grupo | Ignorar (`isGroup: true`) — não processar |
| Preço ambíguo ("tá na faixa de 180 a 200") | Extrair como `preco_por_mdc: null`, mencionar em `notas_extracao` |

### 4.5 Estimativa de Custo

**Premissas:**
- 100 fornecedores ativos
- ~4 conversas/semana por fornecedor = 1.600 conversas/mês
- ~600 tokens input por chamada (system prompt 150 + tool schema 200 + conversa 250)
- ~150 tokens output por chamada

| Item | Haiku | Sonnet |
|---|---|---|
| Custo por conversa | $0.00108 | $0.00405 |
| Custo mensal (1.600 conv) | **$1.73** | $6.48 |
| Custo mensal com retries (+15%) | **$1.99** | $7.45 |
| Custo mensal com batch API (-50%) | **$0.86** | $3.24 |
| Custo anual estimado | **$20.76 — $23.88** | $77.76 — $89.40 |

**Conclusão:** Custo da IA é negligível (~R$10/mês com Haiku). Mesmo com Sonnet, seria ~R$35/mês.

### 4.6 Rate Limits

Para o volume de 1.600 chamadas/mês (~53/dia, ~7/hora):

| Tier | Qualificação | Limite RPM | Suficiente? |
|---|---|---|---|
| Free | $0 | 5 RPM | Marginal |
| Tier 1 | $5 crédito | 50 RPM | Sim |
| Tier 2 | $40+ gasto | 1.000 RPM | Sim (folga enorme) |

**Recomendação:** Tier 1 ($5 para ativar) é suficiente. Implementar retry com exponential backoff para segurança.

---

## 5. Componentes UI

### 5.1 Componentes Novos

| Componente | Arquivo | Descrição |
|---|---|---|
| `WhatsAppSetup` | `src/components/whatsapp-setup.tsx` | Card na página de configurações: QR code, status da conexão, botão conectar/desconectar |
| `WhatsAppStatus` | `src/components/whatsapp-status.tsx` | Badge/indicator na KPI bar mostrando status (verde=conectado, vermelho=desconectado) |
| `AiSuggestionCard` | `src/components/ai-suggestion-card.tsx` | Card no feed com sugestão de registro pré-preenchido. Botões: Confirmar, Editar, Descartar |
| `ConversationViewer` | `src/components/conversation-viewer.tsx` | Dialog/sheet mostrando o transcript original da conversa (balões estilo chat) |

### 5.2 Componentes Modificados

| Componente | Modificação |
|---|---|
| `feed.tsx` | Adicionar seção "Sugestões IA" entre KPIs e Alertas. Query `ai_suggestions` com status='pending'. |
| `configuracoes/client.tsx` | Adicionar seção "WhatsApp" com componente `WhatsAppSetup` |
| `kpi-bar.tsx` | Adicionar indicador de status WhatsApp (pequeno dot verde/vermelho) |
| `supplier-detail.tsx` | Adicionar tab/seção "Conversas WhatsApp" mostrando histórico de mensagens do fornecedor |

### 5.3 Fluxo de UX — Conexão WhatsApp

```
Configurações → Seção "WhatsApp"
  │
  ├─ Estado: Não configurado
  │   └─ [Conectar WhatsApp] → Formulário com instance_id + token
  │       └─ Salva na tabela whatsapp_connections
  │
  ├─ Estado: Desconectado
  │   └─ QR Code renderizado (base64 img)
  │   └─ Instrução: "Abra o WhatsApp > Dispositivos conectados > Escanear QR"
  │   └─ Polling a cada 3s verificando status
  │   └─ Ao conectar: toast "WhatsApp conectado!" + status verde
  │
  ├─ Estado: Conectado
  │   └─ ✅ Conectado como (31) 99999-9999
  │   └─ Desde: 18/03/2026, 14:30
  │   └─ [Desconectar]
  │
  └─ Estado: Erro de conexão
      └─ ⚠️ WhatsApp desconectado
      └─ [Reconectar] → tenta restart, se falhar mostra QR code
```

### 5.4 Fluxo de UX — Sugestão de Registro

```
Feed → Seção "Sugestões de registro" (entre KPIs e Alertas)
  │
  └─ AiSuggestionCard
      ┌─────────────────────────────────────────────────┐
      │ 🤖  João Silva — Eucalipto                      │
      │ "5 cargas disponíveis a R$185/MDC, densidade    │
      │  230. Comprador retorna até sexta."              │
      │                                                  │
      │ Preço: R$185/MDC  │  Volume: 5 cargas           │
      │ Densidade: 230    │  Disponível: Sim            │
      │                                                  │
      │ Próximo passo: Retornar em 21/03                │
      │ Confiança: ●●●  Alta                            │
      │                                                  │
      │ [Ver conversa]  [Confirmar ✓]  [Editar]  [✗]   │
      └─────────────────────────────────────────────────┘

  [Confirmar] → Cria interaction no banco (mesmo que InteractionForm submit)
               → Marca ai_suggestion.status = 'accepted'
               → Toast "Interação registrada via IA"
               → Triggers existentes criam alertas automaticamente

  [Editar]    → Abre InteractionForm pré-preenchido com dados da sugestão
               → Usuário ajusta e salva normalmente

  [Descartar] → Dropdown com motivos:
               → "Não relevante" / "Conversa pessoal" / "Dados incorretos"
               → Marca ai_suggestion.status = 'dismissed'

  [Ver conversa] → Abre ConversationViewer com transcript original
```

### 5.5 Visualização de Conversas no Detalhe do Fornecedor

Na página `/fornecedores/{id}`, adicionar seção "Conversas WhatsApp":

```
┌─────────────────────────────────────────────────┐
│ 💬 Conversas WhatsApp                           │
│                                                  │
│ ┌─────────────────────────────────────────────┐ │
│ │ 18/03/2026, 09:15 — 5 mensagens             │ │
│ │ "5 cargas de eucalipto a R$185/MDC..."       │ │
│ │ ● Processado — Sugestão aceita              │ │
│ │                                    [Ver ▶]  │ │
│ └─────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────┐ │
│ │ 15/03/2026, 14:22 — 3 mensagens             │ │
│ │ "Confirma a carga para segunda?"             │ │
│ │ ● Processado — Sugestão descartada          │ │
│ │                                    [Ver ▶]  │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

---

## 6. Variáveis de Ambiente

### Novas variáveis necessárias

```env
# Z-API — Conexão WhatsApp
# Estes valores serão armazenados no banco (whatsapp_connections),
# não em env vars, pois são configurados pelo usuário na UI.
# Porém, o client-token do webhook DEVE ser uma env var do Edge Function.
ZAPI_WEBHOOK_SECRET=token-secreto-para-validar-webhooks

# Anthropic — Claude API (para Edge Functions)
ANTHROPIC_API_KEY=sk-ant-api03-...

# Configuração de processamento
AI_CONVERSATION_GAP_MINUTES=5           # Minutos de inatividade para fechar conversa
AI_MIN_MESSAGES_TO_PROCESS=3            # Mínimo de mensagens de texto para processar
AI_MODEL=claude-3-5-haiku-20241022      # Modelo padrão
AI_FALLBACK_MODEL=claude-3-5-sonnet-20241022  # Modelo fallback para baixa confiança
```

### Variáveis existentes (sem alteração)

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### Secrets do Supabase (para Edge Functions)

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-api03-...
supabase secrets set ZAPI_WEBHOOK_SECRET=token-secreto-...
```

---

## 7. Riscos e Decisões em Aberto

### 7.1 Riscos

| # | Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|---|
| 1 | **Z-API é API não-oficial** — WhatsApp pode bloquear o número | Média | Alto | Usar apenas para receber mensagens (não enviar em massa). Manter WhatsApp Business oficial como fallback. Monitorar status de conexão. |
| 2 | **Banimento do número** por detecção de API não-oficial | Baixa | Alto | Não enviar mensagens automatizadas no MVP. Usar número dedicado (não o pessoal). Ter número backup pronto. |
| 3 | **Falha na extração IA** — dados incorretos aceitos pelo usuário | Média | Médio | Campo `confianca` visível. Sugestões de confiança "baixa" destacadas em amarelo. Sempre permitir edição antes de confirmar. |
| 4 | **Desconexão frequente** do WhatsApp | Média | Baixo | Monitoramento via CRON, reconexão automática, alerta visual para o usuário. |
| 5 | **Custo de Z-API** se precisar de múltiplas instâncias | Baixa | Baixo | MVP com 1 instância por org. R$65-120/mês é aceitável para o plano Professional (R$497/mês). |
| 6 | **Privacidade/LGPD** — armazenar conversas de terceiros | Média | Alto | Documentar política de retenção. Permitir exclusão de conversas. Não armazenar dados pessoais sensíveis além do necessário. Obter consentimento do fornecedor (ex: mensagem automática na primeira interação). |
| 7 | **Volume de mensagens** — spam, grupos, broadcasts | Média | Baixo | Filtrar `isGroup: true`. Ignorar broadcasts. Só processar mensagens de telefones que matcham fornecedores ativos. |

### 7.2 Decisões em Aberto

| # | Questão | Opções | Impacto |
|---|---|---|---|
| 1 | **Usar Z-API ou WhatsApp Business Cloud API (oficial)?** | (a) Z-API: setup rápido, QR code, mas não-oficial. (b) Cloud API: oficial, per-message pricing, requer Meta Business verification. | Alto — determina toda a arquitetura de webhook e custo operacional. |
| 2 | **Instância Z-API provisionada pelo Carvão Connect ou pelo cliente?** | (a) Carvão Connect provê instância (incluso no plano). (b) Cliente cria conta na Z-API e fornece credenciais. | Médio — impacta pricing, suporte, e onboarding. |
| 3 | **Processar mensagens enviadas (fromMe: true)?** | (a) Sim, para ter contexto completo da conversa. (b) Não, apenas mensagens recebidas. | Médio — impacta qualidade da extração IA. Recomendação: processar ambas. |
| 4 | **Enviar mensagens pelo sistema (pós-MVP)?** | (a) Sim, permitir envio de confirmações automáticas. (b) Não, apenas captura passiva. | Médio — risco de banimento se enviar mensagens automatizadas. |
| 5 | **Como lidar com múltiplos números do mesmo fornecedor?** | (a) Matchear qualquer número do array phones[]. (b) Pedir ao usuário para confirmar match na primeira mensagem. | Baixo — a função find_supplier_by_phone já lida com isso. |
| 6 | **Retenção de mensagens** — por quanto tempo manter? | (a) Indefinido. (b) 90 dias. (c) Configurável pelo admin. | Médio — impacta storage, LGPD, e performance de queries. |
| 7 | **Transcrição de áudio no MVP ou pós-MVP?** | (a) MVP com Whisper API (+$0.006/min). (b) Pós-MVP, focar em texto primeiro. | Baixo — áudio é comum no WhatsApp BR, mas texto é suficiente para extração inicial. |

### 7.3 Dependências Externas

| Dependência | Status | Ação Necessária |
|---|---|---|
| Conta Z-API | Não criada | Criar conta em z-api.io, escolher plano, criar instância |
| Conta Anthropic | Não criada | Criar conta em console.anthropic.com, adicionar crédito ($5 mín) |
| Número WhatsApp dedicado | Necessário | Adquirir chip/número exclusivo para a siderúrgica (não usar pessoal) |
| Supabase Edge Functions | Disponível | Já disponível no projeto Supabase |
| Webhook público acessível | Necessário | Edge Function URL é pública por padrão, mas precisa configurar CORS e validação |

---

## 8. Estimativa de Esforço

### Fase 1 — Infraestrutura e Captura de Mensagens

**Escopo:** Webhook recebe mensagens, salva no banco, matcha com fornecedores.

| Tarefa | Complexidade |
|---|---|
| Migration SQL (tabelas, RLS, functions) | Média |
| Edge Function `whatsapp-webhook` (receber, validar, salvar, matchear) | Média |
| Lógica de agrupamento em conversas (janela de inatividade) | Média |
| Página de configurações — seção WhatsApp com QR code | Média |
| Indicador de status na KPI bar | Baixa |
| Testes manuais com Z-API | Baixa |

**Entregável:** Mensagens de WhatsApp sendo capturadas e salvas no banco com matching de fornecedor.

### Fase 2 — Processamento IA

**Escopo:** Claude extrai dados estruturados, cria sugestões.

| Tarefa | Complexidade |
|---|---|
| Edge Function `process-conversation` (montar transcript, chamar Claude, salvar resultado) | Média |
| Trigger/CRON para detectar conversas prontas para processar | Média |
| Lógica de fallback (Haiku → Sonnet se confiança baixa) | Baixa |
| Testes de prompt com conversas reais | Média |

**Entregável:** Conversas processadas, sugestões criadas na tabela `ai_suggestions`.

### Fase 3 — Interface do Usuário

**Escopo:** Feed mostra sugestões, usuário confirma/edita/descarta.

| Tarefa | Complexidade |
|---|---|
| `AiSuggestionCard` no feed | Média |
| `ConversationViewer` (dialog com balões de chat) | Média |
| Fluxo de confirmação (criar interaction a partir de sugestão) | Média |
| Fluxo de edição (pré-preencher InteractionForm) | Baixa |
| Seção "Conversas WhatsApp" no detalhe do fornecedor | Média |
| Seção "Mensagens não identificadas" | Baixa |

**Entregável:** Fluxo completo funcional — da mensagem no WhatsApp até o registro confirmado no sistema.

### Fase 4 — Robustez e Polish (pós-MVP)

| Tarefa | Complexidade |
|---|---|
| Transcrição de áudio (Whisper API) | Alta |
| Envio de mensagens pelo sistema | Média |
| Monitoramento de conexão (CRON + alertas) | Baixa |
| Reprocessamento de conversas com erro | Baixa |
| Métricas de uso (conversas/dia, taxa de aceitação, etc.) | Média |
| Política de retenção e exclusão de dados | Baixa |

---

## Apêndice A — Preços Z-API (verificar em z-api.io/precos)

| Plano | Preço estimado | Instâncias |
|---|---|---|
| Starter | ~R$65/mês | 1 |
| Business | ~R$120/mês | 1 (com suporte prioritário) |
| Enterprise | Sob consulta | Múltiplas |

> ⚠️ Preços baseados em dados de treinamento (até maio 2025). **Verificar preços atuais antes de decidir.**

## Apêndice B — Endpoints Z-API Completos

| Categoria | Endpoint | Método | Uso |
|---|---|---|---|
| Conexão | `/qr-code` | GET | Obter QR code (base64 PNG) |
| Conexão | `/qr-code/image` | GET | QR code como imagem direta |
| Conexão | `/status` | GET | Status da conexão |
| Conexão | `/disconnect` | GET | Desconectar |
| Conexão | `/restart` | GET | Reconectar |
| Envio | `/send-text` | POST | Enviar texto |
| Envio | `/send-image` | POST | Enviar imagem |
| Envio | `/send-document/{ext}` | POST | Enviar documento |
| Envio | `/send-audio` | POST | Enviar áudio |
| Consulta | `/phone-exists/{phone}` | GET | Verificar se tem WhatsApp |
| Consulta | `/chats` | GET | Listar conversas |
| Consulta | `/chat-messages/{phone}` | GET | Mensagens de um chat |
| Ação | `/read-message` | POST | Marcar como lida |

**Base URL:** `https://api.z-api.io/instances/{INSTANCE_ID}/token/{INSTANCE_TOKEN}`

---

*Documento gerado para revisão. Nenhum código deve ser implementado antes da aprovação deste plano.*
