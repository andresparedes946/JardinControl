"use client";

import { CheckCircle2, Clock, Loader2, MapPin } from "lucide-react";
import { useState } from "react";

import {
  ficharConQr,
  type RespuestaFichaje,
} from "@/app/f/[token]/acciones";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PIN_LARGO } from "@/lib/validaciones";

/** Espera de la lectura del GPS. Más de esto y el teléfono no va a mejorar. */
const TIMEOUT_GPS = 15_000;

export function FormularioQr({ token }: { token: string }) {
  const [dni, setDni] = useState("");
  const [pin, setPin] = useState("");
  const [estado, setEstado] = useState<"listo" | "ubicando" | "enviando">(
    "listo",
  );
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<
    Extract<RespuestaFichaje, { ok: true }> | null
  >(null);

  const ocupado = estado !== "listo";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!/^\d{7,9}$/.test(dni)) {
      setError("El DNI son 7 a 9 dígitos, sin puntos.");
      return;
    }
    if (pin.length !== PIN_LARGO) {
      setError(`El PIN son ${PIN_LARGO} dígitos.`);
      return;
    }

    setEstado("ubicando");

    let posicion: GeolocationPosition;
    try {
      posicion = await ubicacionActual();
    } catch (e) {
      setEstado("listo");
      setError(mensajeDeGps(e));
      return;
    }

    setEstado("enviando");

    const r = await ficharConQr(token, {
      dni,
      pin,
      lat: posicion.coords.latitude,
      lng: posicion.coords.longitude,
      precisionMetros: posicion.coords.accuracy,
    });

    setEstado("listo");

    if (r.ok) {
      setExito(r);
    } else {
      // El PIN se limpia y el DNI no: si el error fue el PIN, reescribir el
      // documento entero de pie en la puerta es una molestia inútil.
      setPin("");
      setError(r.motivo);
    }
  }

  if (exito) {
    return (
      <div className="space-y-4 text-center">
        <CheckCircle2
          className="mx-auto size-14 text-emerald-600 dark:text-emerald-500"
          aria-hidden
        />
        <div>
          <p className="text-xl font-semibold">{exito.nombre}</p>
          <p className="text-muted-foreground mt-1">
            {exito.tipo === "INGRESO" ? "Entrada" : "Salida"} registrada
          </p>
        </div>

        <p className="text-4xl font-semibold tracking-tight tabular-nums">
          {exito.hora}
        </p>

        {exito.minutosTarde > 0 && (
          <p className="flex items-center justify-center gap-1.5 text-sm text-amber-600 dark:text-amber-500">
            <Clock className="size-4" />
            Llegaste {exito.minutosTarde} minutos tarde
          </p>
        )}

        {exito.trabajadas && (
          <p className="text-muted-foreground text-sm">
            Trabajaste {exito.trabajadas} horas hoy.
          </p>
        )}

        <p className="text-muted-foreground pt-2 text-xs">
          Ya podés cerrar esta página.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="dni">DNI</Label>
        {/* inputMode numeric abre el teclado de números sin bloquear el pegado
            ni los teclados que no traen tipo tel. */}
        <Input
          id="dni"
          inputMode="numeric"
          autoComplete="off"
          placeholder="Sin puntos"
          value={dni}
          onChange={(e) => setDni(e.target.value.replace(/\D/g, ""))}
          disabled={ocupado}
          className="text-lg"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="pin">PIN</Label>
        <Input
          id="pin"
          inputMode="numeric"
          autoComplete="off"
          type="password"
          placeholder={"•".repeat(PIN_LARGO)}
          value={pin}
          onChange={(e) =>
            setPin(e.target.value.replace(/\D/g, "").slice(0, PIN_LARGO))
          }
          disabled={ocupado}
          className="text-lg tracking-[0.4em]"
        />
      </div>

      <Button type="submit" className="h-12 w-full text-base" disabled={ocupado}>
        {ocupado && <Loader2 className="size-4 animate-spin" />}
        {estado === "ubicando"
          ? "Buscando tu ubicación…"
          : estado === "enviando"
            ? "Registrando…"
            : "Fichar"}
      </Button>

      <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
        <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        El teléfono va a pedirte permiso de ubicación. Hace falta para
        comprobar que estás en el jardín.
      </p>
    </form>
  );
}

function ubicacionActual(): Promise<GeolocationPosition> {
  return new Promise((resolver, rechazar) => {
    if (!navigator.geolocation) {
      rechazar(new Error("sin-soporte"));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolver, rechazar, {
      enableHighAccuracy: true,
      timeout: TIMEOUT_GPS,
      // Sin caché: una lectura guardada puede ser de la casa, de esta mañana.
      maximumAge: 0,
    });
  });
}

function mensajeDeGps(e: unknown): string {
  if (e instanceof GeolocationPositionError) {
    if (e.code === e.PERMISSION_DENIED) {
      return "No diste permiso de ubicación. Habilitalo en el navegador y probá de nuevo.";
    }
    if (e.code === e.TIMEOUT) {
      return "El GPS tardó demasiado. Salí al patio o cerca de una ventana y probá de nuevo.";
    }
    return "No se pudo leer tu ubicación. Probá de nuevo en un momento.";
  }

  return "Este teléfono no permite leer la ubicación, así que no puede fichar.";
}
