"use client"

import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Loader2,
  Wifi,
  WifiOff,
  Smartphone,
  Plus,
  Trash2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Shield,
} from "lucide-react"
import { toast } from "sonner"

// ─── Types ───────────────────────────────────────────────────────────────────

interface ConnectionInfo {
  id: string
  status: string
  phone: string | null
  verifiedName: string | null
  qualityRating: string
  messagingLimit: string | null
  label: string
  connectedAt: string | null
  disconnectedAt: string | null
  webhookVerified: boolean
  tokenExpired: boolean
  apiError: boolean
}

interface StatusResponse {
  configured: boolean
  connections: ConnectionInfo[]
}

type ViewState = "loading" | "not_configured" | "ready"

declare global {
  interface Window {
    fbAsyncInit?: () => void
    FB?: {
      init: (params: Record<string, unknown>) => void
      login: (
        callback: (response: { authResponse?: { code?: string } }) => void,
        params: Record<string, unknown>
      ) => void
    }
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export function WhatsAppSetup() {
  const [viewState, setViewState] = useState<ViewState>("loading")
  const [connections, setConnections] = useState<ConnectionInfo[]>([])
  const [connecting, setConnecting] = useState(false)
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null)
  const [fbSdkReady, setFbSdkReady] = useState(false)

  // Carregar Facebook SDK
  useEffect(() => {
    if (window.FB) {
      setFbSdkReady(true)
      return
    }

    window.fbAsyncInit = function () {
      window.FB?.init({
        appId: process.env.NEXT_PUBLIC_META_APP_ID,
        cookie: true,
        xfbml: true,
        version: "v21.0",
      })
      setFbSdkReady(true)
    }

    // Carregar SDK
    if (!document.getElementById("facebook-jssdk")) {
      const script = document.createElement("script")
      script.id = "facebook-jssdk"
      script.src = "https://connect.facebook.net/pt_BR/sdk.js"
      script.async = true
      script.defer = true
      document.head.appendChild(script)
    }
  }, [])

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/whatsapp/status")
      if (!res.ok) return
      const data: StatusResponse = await res.json()

      if (!data.configured) {
        setViewState("not_configured")
        setConnections([])
      } else {
        setViewState("ready")
        setConnections(data.connections)
      }
    } catch {
      setViewState("not_configured")
    }
  }, [])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  // ─── Embedded Signup ─────────────────────────────────────────────────

  async function handleConnect() {
    if (!window.FB) {
      toast.error("Facebook SDK não carregado. Recarregue a página.")
      return
    }

    setConnecting(true)

    window.FB.login(
      async (response) => {
        const code = response.authResponse?.code

        if (!code) {
          toast.error("Conexão cancelada ou falhou.")
          setConnecting(false)
          return
        }

        try {
          const res = await fetch("/api/whatsapp/embedded-signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code }),
          })

          if (!res.ok) {
            const data = await res.json()
            toast.error(data.error || "Erro ao conectar WhatsApp.")
            setConnecting(false)
            return
          }

          const data = await res.json()
          toast.success(
            `WhatsApp conectado! ${data.connections?.length ?? 0} número(s) configurado(s).`
          )

          // Recarregar status
          await fetchStatus()
        } catch {
          toast.error("Erro ao processar conexão.")
        }

        setConnecting(false)
      },
      {
        config_id: process.env.NEXT_PUBLIC_META_CONFIG_ID,
        response_type: "code",
        override_default_response_type: true,
        extras: {
          setup: {
            // Pré-preencher informações se possível
          },
          featureType: "",
          sessionInfoVersion: "3",
        },
      }
    )
  }

  // ─── Disconnect ──────────────────────────────────────────────────────

  async function handleDisconnect(connectionId: string) {
    setDisconnectingId(connectionId)
    try {
      const res = await fetch("/api/whatsapp/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId }),
      })

      if (res.ok) {
        toast.success("WhatsApp desconectado.")
        await fetchStatus()
      } else {
        toast.error("Erro ao desconectar.")
      }
    } catch {
      toast.error("Erro ao desconectar.")
    }
    setDisconnectingId(null)
  }

  // ─── Render ──────────────────────────────────────────────────────────

  if (viewState === "loading") {
    return (
      <div className="flex items-center gap-2 text-sm text-[#86868B]">
        <Loader2 className="h-4 w-4 animate-spin" />
        Verificando conexão...
      </div>
    )
  }

  const activeConnections = connections.filter((c) => c.status === "connected")
  const inactiveConnections = connections.filter((c) => c.status !== "connected")

  return (
    <div className="space-y-4">
      {/* Conexões ativas */}
      {activeConnections.map((conn) => (
        <ConnectionCard
          key={conn.id}
          connection={conn}
          onDisconnect={handleDisconnect}
          disconnecting={disconnectingId === conn.id}
        />
      ))}

      {/* Conexões inativas (colapsadas) */}
      {inactiveConnections.length > 0 && (
        <div className="space-y-2">
          {inactiveConnections.map((conn) => (
            <div
              key={conn.id}
              className="flex items-center gap-3 rounded-lg border border-dashed border-[#D2D2D7]/50 px-3 py-2"
            >
              <div className="h-2 w-2 rounded-full bg-[#86868B]" />
              <span className="text-sm text-[#86868B]">
                {conn.phone || conn.label} — Desconectado
              </span>
              {conn.tokenExpired && (
                <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-200">
                  Token expirado
                </Badge>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Nenhuma conexão */}
      {connections.length === 0 && (
        <div className="flex items-center gap-2">
          <WifiOff className="h-4 w-4 text-[#86868B]" />
          <p className="text-sm text-[#86868B]">Nenhum número WhatsApp conectado.</p>
        </div>
      )}

      {/* Botão de conectar */}
      <Button
        variant="outline"
        className="active:scale-[0.98]"
        onClick={handleConnect}
        disabled={connecting || !fbSdkReady}
      >
        {connecting ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Plus className="mr-2 h-4 w-4" />
        )}
        {connections.length === 0 ? "Conectar WhatsApp" : "Adicionar número"}
      </Button>

      {!fbSdkReady && (
        <p className="text-xs text-[#86868B]">Carregando Facebook SDK...</p>
      )}
    </div>
  )
}

// ─── ConnectionCard ──────────────────────────────────────────────────────────

function ConnectionCard({
  connection,
  onDisconnect,
  disconnecting,
}: {
  connection: ConnectionInfo
  onDisconnect: (id: string) => void
  disconnecting: boolean
}) {
  const qualityColor =
    connection.qualityRating === "GREEN"
      ? "text-emerald-600"
      : connection.qualityRating === "YELLOW"
        ? "text-amber-600"
        : "text-red-600"

  const qualityBg =
    connection.qualityRating === "GREEN"
      ? "bg-emerald-50"
      : connection.qualityRating === "YELLOW"
        ? "bg-amber-50"
        : "bg-red-50"

  return (
    <div className="rounded-xl border border-[#D2D2D7]/50 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-[#34C759]" />
          <p className="text-sm font-medium text-[#1D1D1F]">Conectado</p>
          {connection.label && (
            <Badge variant="outline" className="text-[10px]">
              {connection.label}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {connection.webhookVerified ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          ) : (
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
          )}
          <span className="text-[10px] text-[#86868B]">
            {connection.webhookVerified ? "Webhook ativo" : "Webhook pendente"}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {connection.phone && (
          <div className="flex items-center gap-1.5 text-sm text-[#6E6E73]">
            <Smartphone className="h-3.5 w-3.5" />
            {connection.phone}
          </div>
        )}
        {connection.verifiedName && (
          <div className="flex items-center gap-1.5 text-sm text-[#6E6E73]">
            <Shield className="h-3.5 w-3.5" />
            {connection.verifiedName}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Badge variant="outline" className={`text-[10px] ${qualityColor} ${qualityBg} border-0`}>
          Qualidade: {connection.qualityRating}
        </Badge>
        {connection.messagingLimit && (
          <span className="text-[10px] text-[#86868B]">
            Limite: {connection.messagingLimit} msg/dia
          </span>
        )}
        {connection.connectedAt && (
          <span className="text-[10px] text-[#86868B]">
            Desde{" "}
            {new Date(connection.connectedAt).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "short",
            })}
          </span>
        )}
      </div>

      {connection.tokenExpired && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <p className="text-xs text-amber-700">
            Token expirado. Reconecte para continuar recebendo mensagens.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto text-xs"
            onClick={() => {
              // TODO: implementar reconexão via FB.login
            }}
          >
            <RefreshCw className="mr-1 h-3 w-3" />
            Reconectar
          </Button>
        </div>
      )}

      <Button
        variant="ghost"
        size="sm"
        className="text-xs text-[#86868B] hover:text-red-600 active:scale-[0.98]"
        onClick={() => onDisconnect(connection.id)}
        disabled={disconnecting}
      >
        {disconnecting ? (
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
        ) : (
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
        )}
        Desconectar
      </Button>
    </div>
  )
}
