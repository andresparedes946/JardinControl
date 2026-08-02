"use client";

import type { Result } from "@vladmandic/human";
import { Loader2, MapPin } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  registrarFichaje,
  type RespuestaFichaje,
} from "@/app/(app)/fichar/acciones";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cargarHuman } from "@/lib/human";
import {
  CALIDAD_MINIMA,
  GIRO_MAXIMO_GRADOS,
  PROPORCION_MINIMA_ROSTRO,
} from "@/lib/rostro";

type Estado = "preparando" | "buscando" | "enviando" | "error";

type Props = {
  /** Texto del encabezado: "Registrar entrada" o "Registrar salida". */
  accion: string;
  onResultado: (respuesta: RespuestaFichaje) => void;
  onCancelar: () => void;
};

type Ubicacion = { lat: number; lng: number; precisionMetros: number };

const grados = (radianes: number) => Math.abs((radianes * 180) / Math.PI);

export function CapturaFichaje({ accion, onResultado, onCancelar }: Props) {
  const [estado, setEstado] = useState<Estado>("preparando");
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [encuadrado, setEncuadrado] = useState(false);
  const [ubicacion, setUbicacion] = useState<Ubicacion | null>(null);
  const [errorGps, setErrorGps] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const activoRef = useRef(false);
  // La ubicación se lee en un watch aparte y cambia sola; el bucle de
  // detección necesita el último valor sin re-suscribirse en cada lectura.
  const ubicacionRef = useRef<Ubicacion | null>(null);
  const enviandoRef = useRef(false);
  // El callback no puede estar en las dependencias del efecto: si el padre lo
  // define inline, cambiaría en cada render y reiniciaría la cámara.
  const onResultadoRef = useRef(onResultado);
  onResultadoRef.current = onResultado;

  const apagar = useCallback(() => {
    activoRef.current = false;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setEncuadrado(false);
  }, []);

  // El GPS se sigue con watchPosition y no con getCurrentPosition: la primera
  // lectura de un celular suele venir con ±100 m y afinarse en unos segundos.
  // Quedarse con la primera rechazaría fichajes legítimos por imprecisión.
  useEffect(() => {
    if (!navigator.geolocation) {
      setErrorGps("Este dispositivo no puede informar su ubicación.");
      return;
    }

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setErrorGps(null);
        const lectura = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          precisionMetros: pos.coords.accuracy,
        };
        ubicacionRef.current = lectura;
        setUbicacion(lectura);
      },
      (e) => {
        setErrorGps(
          e.code === e.PERMISSION_DENIED
            ? "Necesitás permitir el acceso a tu ubicación para fichar."
            : "No se pudo obtener tu ubicación. Probá al aire libre.",
        );
      },
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 },
    );

    return () => navigator.geolocation.clearWatch(id);
  }, []);

  /** Motivo por el que el frame no sirve, o null si está listo para enviar. */
  const evaluar = useCallback(
    (video: HTMLVideoElement, resultado: Result): string | null => {
      const caras = resultado.face;

      if (caras.length === 0) return "Ubicá tu cara dentro del óvalo";
      if (caras.length > 1) return "Tiene que verse una sola cara";

      const cara = caras[0];

      if (Math.min(cara.boxScore, cara.faceScore) < CALIDAD_MINIMA) {
        return "Quedate quieta un momento";
      }

      if (cara.box[3] / video.videoHeight < PROPORCION_MINIMA_ROSTRO) {
        return "Acercate un poco más a la cámara";
      }

      const angulo = cara.rotation?.angle;
      if (
        angulo &&
        (grados(angulo.yaw) > GIRO_MAXIMO_GRADOS ||
          grados(angulo.pitch) > GIRO_MAXIMO_GRADOS)
      ) {
        return "Mirá de frente a la cámara";
      }

      if (!cara.embedding) return "Quedate quieta un momento";

      // La ubicación se exige antes de enviar y no después: sin ella el
      // servidor rechazaría igual, pero la empleada se habría quedado
      // mirando la cámara sin entender qué falta.
      if (!ubicacionRef.current) return "Buscando señal GPS…";

      return null;
    },
    [],
  );

  useEffect(() => {
    let cancelado = false;

    (async () => {
      try {
        const [human, stream] = await Promise.all([
          cargarHuman(),
          navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: "user",
              width: { ideal: 640 },
              height: { ideal: 640 },
            },
            audio: false,
          }),
        ]);

        const video = videoRef.current;
        if (cancelado || !video) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        video.srcObject = stream;
        await video.play();

        activoRef.current = true;
        setEstado("buscando");

        const bucle = async () => {
          if (!activoRef.current) return;

          if (video.readyState >= 2) {
            try {
              const resultado = await human.detect(video);
              const motivo = evaluar(video, resultado);
              setAviso(motivo);
              setEncuadrado(motivo === null);

              const cara = resultado.face[0];
              const lectura = ubicacionRef.current;

              if (
                motivo === null &&
                cara?.embedding &&
                lectura &&
                !enviandoRef.current
              ) {
                enviandoRef.current = true;
                apagar();
                setEstado("enviando");

                onResultadoRef.current(
                  await registrarFichaje({
                    descriptor: cara.embedding,
                    calidad: Math.min(cara.boxScore, cara.faceScore),
                    // Human solo devuelve estos cuando corren sus modelos; si
                    // faltaran, mandar 0 hace que el servidor rechace, que es
                    // lo correcto: no se puede dar por viva una cara que nadie
                    // comprobó.
                    scoreLiveness: cara.live ?? 0,
                    scoreAntispoof: cara.real ?? 0,
                    ...lectura,
                  }),
                );
                return;
              }
            } catch (e) {
              console.error("Falló la detección:", e);
            }
          }

          if (activoRef.current) requestAnimationFrame(bucle);
        };

        void bucle();
      } catch (e) {
        if (cancelado) return;
        apagar();
        setEstado("error");
        setError(mensajeDeCamara(e));
      }
    })();

    return () => {
      cancelado = true;
      apagar();
    };
  }, [apagar, evaluar]);

  if (estado === "error") {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button variant="outline" className="w-full" onClick={onCancelar}>
          Volver
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-center font-medium">{accion}</p>

      <div className="bg-muted relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-xl">
        <video
          ref={videoRef}
          playsInline
          muted
          className="size-full scale-x-[-1] object-cover"
        />

        <div
          className={`pointer-events-none absolute inset-x-[20%] inset-y-[6%] rounded-[50%] border-4 transition-colors ${
            encuadrado ? "border-emerald-500" : "border-white/70"
          }`}
        />

        {(estado === "preparando" || estado === "enviando") && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 text-center text-sm text-white">
            <Loader2 className="size-6 animate-spin" />
            <p>
              {estado === "preparando"
                ? "Preparando la cámara…"
                : "Registrando…"}
            </p>
          </div>
        )}
      </div>

      <p className="text-muted-foreground min-h-5 text-center text-sm">
        {estado === "buscando" && (aviso ?? "Listo, no te muevas")}
      </p>

      {/* La precisión se muestra siempre: es lo que explica un rechazo por
          ubicación antes de que ocurra. */}
      <div className="text-muted-foreground flex items-center justify-center gap-2 text-xs">
        <MapPin className="size-3.5 shrink-0" />
        {errorGps ? (
          <span className="text-destructive">{errorGps}</span>
        ) : ubicacion ? (
          <span>Ubicación ±{Math.round(ubicacion.precisionMetros)} m</span>
        ) : (
          <span>Buscando señal GPS…</span>
        )}
      </div>

      <Button
        variant="outline"
        className="w-full"
        onClick={onCancelar}
        disabled={estado === "enviando"}
      >
        Cancelar
      </Button>
    </div>
  );
}

function mensajeDeCamara(e: unknown): string {
  const nombre = e instanceof Error ? e.name : "";

  if (nombre === "NotAllowedError" || nombre === "SecurityError") {
    return "El navegador bloqueó la cámara. Habilitala para este sitio y volvé a intentar.";
  }
  if (nombre === "NotFoundError" || nombre === "OverconstrainedError") {
    return "No se encontró ninguna cámara en este dispositivo.";
  }
  if (nombre === "NotReadableError") {
    return "La cámara está siendo usada por otro programa. Cerralo y volvé a intentar.";
  }

  console.error("No se pudo iniciar la cámara ni cargar los modelos:", e);
  return "No se pudo iniciar la cámara. Revisá la conexión y volvé a intentar.";
}
