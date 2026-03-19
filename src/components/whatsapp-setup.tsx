"use client"

import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, Wifi, WifiOff, Smartphone } from "lucide-react"
import { toast } from "sonner"

type ConnectionState = "loading" | "not_configured" | "disconnected" | "connecting" | "connected"

interface StatusData {
  configured: boolean
  status: string
  connectedPhone: string | null
  connectedAt: string | null
}

export function WhatsAppSetup() {
  const [state, setState] = useState<ConnectionState>("loading")
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [connectedPhone, setConnectedPhone] = useState<string | null>(null)
  const [connectedAt, setConnectedAt] = useState<string | null>(null)
  const [polling, setPolling] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/whatsapp/status")
      if (!res.ok) return
      const data: StatusData = await res.json()

      if (!data.configured) {
        setState("not_configured")
        return
      }

      if (data.status === "connected") {
        setState("connected")
        setConnectedPhone(data.connectedPhone)
        setConnectedAt(data.connectedAt)
        setQrCode(null)
        setPolling(false)
      } else {
        setState("disconnected")
      }
    } catch {
      setState("disconnected")
    }
  }, [])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  // Poll for connection status when showing QR code
  useEffect(() => {
    if (!polling) return
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/whatsapp/status")
        if (!res.ok) return
        const data: StatusData = await res.json()
        if (data.status === "connected") {
          setState("connected")
          setConnectedPhone(data.connectedPhone)
          setConnectedAt(data.connectedAt)
          setQrCode(null)
          setPolling(false)
          toast.success("WhatsApp conectado!")
        }
      } catch {
        // ignore polling errors
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [polling])

  async function handleConnect() {
    setState("connecting")
    try {
      const res = await fetch("/api/whatsapp/qrcode")
      if (!res.ok) {
        toast.error("Erro ao obter QR code.")
        setState("disconnected")
        return
      }
      const data = await res.json()
      if (data.connected) {
        setState("connected")
        toast.success("WhatsApp já está conectado!")
        return
      }
      setQrCode(data.qrCode)
      setPolling(true)
    } catch {
      toast.error("Erro ao conectar com Z-API.")
      setState("disconnected")
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true)
    try {
      const res = await fetch("/api/whatsapp/disconnect", { method: "POST" })
      if (res.ok) {
        setState("disconnected")
        setConnectedPhone(null)
        setConnectedAt(null)
        toast.success("WhatsApp desconectado.")
      } else {
        toast.error("Erro ao desconectar.")
      }
    } catch {
      toast.error("Erro ao desconectar.")
    }
    setDisconnecting(false)
  }

  if (state === "loading") {
    return (
      <div className="flex items-center gap-2 text-sm text-[#86868B]">
        <Loader2 className="h-4 w-4 animate-spin" />
        Verificando conexão...
      </div>
    )
  }

  if (state === "not_configured") {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <WifiOff className="h-4 w-4 text-[#86868B]" />
          <p className="text-sm text-[#86868B]">
            WhatsApp não configurado. Entre em contato com o suporte para ativar.
          </p>
        </div>
      </div>
    )
  }

  if (state === "connected") {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-[#34C759]" />
          <p className="text-sm font-medium text-[#1D1D1F]">Conectado</p>
        </div>
        {connectedPhone && (
          <div className="flex items-center gap-2 text-sm text-[#6E6E73]">
            <Smartphone className="h-3.5 w-3.5" />
            {connectedPhone}
          </div>
        )}
        {connectedAt && (
          <p className="text-xs text-[#86868B]">
            Desde {new Date(connectedAt).toLocaleDateString("pt-BR")},{" "}
            {new Date(connectedAt).toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        )}
        <Button
          variant="outline"
          size="sm"
          className="text-xs active:scale-[0.98]"
          onClick={handleDisconnect}
          disabled={disconnecting}
        >
          {disconnecting && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
          Desconectar
        </Button>
      </div>
    )
  }

  // Disconnected or Connecting (QR code)
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-[#FF3B30]" />
        <p className="text-sm font-medium text-[#1D1D1F]">Desconectado</p>
      </div>

      {qrCode ? (
        <div className="space-y-3">
          <p className="text-sm text-[#6E6E73]">
            Abra o WhatsApp no celular &rarr; Dispositivos conectados &rarr; Escanear QR Code
          </p>
          <div className="inline-block rounded-xl border border-[#D2D2D7]/50 p-3 bg-white">
            <img
              src={qrCode.startsWith("data:") ? qrCode : `data:image/png;base64,${qrCode}`}
              alt="QR Code WhatsApp"
              className="h-48 w-48"
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-[#86868B]">
            <Loader2 className="h-3 w-3 animate-spin" />
            Aguardando conexão...
          </div>
        </div>
      ) : (
        <Button
          variant="outline"
          className="active:scale-[0.98]"
          onClick={handleConnect}
        >
          <Wifi className="mr-2 h-4 w-4" />
          Conectar WhatsApp
        </Button>
      )}
    </div>
  )
}
