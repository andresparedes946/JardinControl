"use client";

import type { Result } from "@vladmandic/human";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { guardarDescriptores } from "@/app/(app)/empleados/acciones";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cargarHuman } from "@/lib/human";
import {
  CALIDAD_MINIMA,
  GIRO_MAXIMO_GRADOS,
  MS_ENTRE_MUESTRAS,
  MUESTRAS_ENROLAMIENTO,
  PROPORCION_MINIMA_ROSTRO,
  REAL_MINIMO_ENROLAMIENTO,
  SIMILITUD_MINIMA_ENTRE_MUESTRAS,
  similitud,
} from "@/lib/rostro";
import type { MuestraFacial } from "@/lib/validaciones";

type Estado = "cargando" | "capturando" | "completo" | "guardando" | "error";

type Props = {
  empleadoId: string;
  /** Se llama al guardar bien: el padre vuelve al resumen y refresca. */
  onGuardado: () => void;
  onCancelar: () => void;
};

/**
 * Consignas que van cambiando a medida que avanzan las capturas. Guían a la
 * empleada para que las diez muestras no sean el mismo gesto repetido: si
 * todas salen de la misma pose, al fichar solo se la reconoce en esa pose.
 */
const CONSIGNAS = [
  { hasta: 4, texto: "Mirá de frente a la cámara" },
  { hasta: 6, texto: "Girá despacio la cabeza hacia tu izquierda" },
  { hasta: 8, texto: "Ahora despacio hacia tu derecha" },
  { hasta: MUESTRAS_ENROLAMIENTO, texto: "Volvé al frente y sonreí" },
];

const consignaPara = (tomadas: number) =>
  CONSIGNAS.find((c) => tomadas < c.hasta)?.texto ?? "";

const grados = (radianes: number) => Math.abs((radianes * 180) / Math.PI);

export function CapturaFacial({ empleadoId, onGuardado, onCancelar }: Props) {
  const [estado, setEstado] = useState<Estado>("cargando");
  const [tomadas, setTomadas] = useState(0);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Verde cuando el frame actual cumple todo y la muestra se está tomando. */
  const [encuadrado, setEncuadrado] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const muestrasRef = useRef<MuestraFacial[]>([]);
  const ultimaRef = useRef(0);
  // El bucle vive fuera de React: cortarlo por estado llegaría un frame tarde
  // y seguiría corriendo sobre una cámara ya apagada.
  const activoRef = useRef(false);

  const apagarCamara = useCallback(() => {
    activoRef.current = false;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setEncuadrado(false);
  }, []);

  /**
   * Decide si el frame sirve. Devuelve el motivo por el que no sirve, o null
   * si el encuadre está bien (haya tomado muestra o esté esperando el turno).
   */
  const evaluar = useCallback(
    (video: HTMLVideoElement, resultado: Result): string | null => {
      const caras = resultado.face;

      if (caras.length === 0) return "Ubicá la cara dentro del óvalo";
      if (caras.length > 1) {
        return "Hay más de una persona en cámara: tiene que quedar sola";
      }

      const cara = caras[0];

      if (cara.score < CALIDAD_MINIMA) return "Quedate quieta un momento";

      if (cara.box[3] / video.videoHeight < PROPORCION_MINIMA_ROSTRO) {
        return "Acercate un poco más a la cámara";
      }

      const angulo = cara.rotation?.angle;
      if (
        angulo &&
        (grados(angulo.yaw) > GIRO_MAXIMO_GRADOS ||
          grados(angulo.pitch) > GIRO_MAXIMO_GRADOS)
      ) {
        return "Girá un poco menos: la cara tiene que verse casi de frente";
      }

      if (
        (cara.real ?? 1) < REAL_MINIMO_ENROLAMIENTO ||
        (cara.live ?? 1) < REAL_MINIMO_ENROLAMIENTO
      ) {
        return "Tiene que ser la persona en vivo, no una foto ni una pantalla";
      }

      const descriptor = cara.embedding;
      if (!descriptor) return "Quedate quieta un momento";

      const previas = muestrasRef.current;
      if (
        previas.length > 0 &&
        similitud(previas[0].descriptor, descriptor) <
          SIMILITUD_MINIMA_ENTRE_MUESTRAS
      ) {
        return "Esta cara no coincide con las capturas anteriores";
      }

      // Cumple todo. Espaciar las tomas es lo que hace que las diez muestras
      // sean distintas entre sí y no diez copias del mismo frame.
      if (performance.now() - ultimaRef.current < MS_ENTRE_MUESTRAS) {
        return null;
      }

      ultimaRef.current = performance.now();
      previas.push({ descriptor, calidad: cara.score });
      setTomadas(previas.length);

      return null;
    },
    [],
  );

  // Arranca al montar: el padre monta este componente recién cuando se
  // aprieta "Registrar rostro", así que no hay nada más que esperar.
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
        ultimaRef.current = performance.now();
        setEstado("capturando");

        const bucle = async () => {
          if (!activoRef.current) return;

          // readyState < 2 es el hueco entre play() y el primer frame: darle
          // eso a detect() devuelve una detección vacía y un aviso falso.
          if (video.readyState >= 2) {
            try {
              const motivo = evaluar(video, await human.detect(video));
              setAviso(motivo);
              setEncuadrado(motivo === null);
            } catch (e) {
              console.error("Falló la detección:", e);
            }
          }

          if (!activoRef.current) return;

          if (muestrasRef.current.length >= MUESTRAS_ENROLAMIENTO) {
            apagarCamara();
            setAviso(null);
            setEstado("completo");
            return;
          }

          requestAnimationFrame(bucle);
        };

        void bucle();
      } catch (e) {
        if (cancelado) return;
        apagarCamara();
        setEstado("error");
        setError(mensajeDeCamara(e));
      }
    })();

    // Salir de la pantalla con la cámara prendida deja la luz encendida y el
    // permiso en uso, así que se apaga sí o sí al desmontar.
    return () => {
      cancelado = true;
      apagarCamara();
    };
  }, [apagarCamara, evaluar]);

  async function guardar() {
    setEstado("guardando");

    const resultado = await guardarDescriptores(empleadoId, {
      muestras: muestrasRef.current,
    });

    if (!resultado.ok) {
      setEstado("completo");
      toast.error(resultado.error);
      return;
    }

    toast.success(resultado.mensaje);
    onGuardado();
  }

  if (estado === "error") {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button variant="outline" onClick={onCancelar}>
          Volver
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-muted relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-xl">
        <video
          ref={videoRef}
          playsInline
          muted
          // Espejado: la gente se acomoda mucho mejor viéndose como en un
          // espejo. Al modelo se le pasa el video sin espejar.
          className="size-full scale-x-[-1] object-cover"
        />

        <div
          // Óvalo vertical, con la proporción de una cara: un círculo invita
          // a alejarse hasta que entren también los hombros.
          className={`pointer-events-none absolute inset-x-[20%] inset-y-[6%] rounded-[50%] border-4 transition-colors ${
            encuadrado ? "border-emerald-500" : "border-white/70"
          }`}
        />

        {estado === "cargando" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 text-center text-sm text-white">
            <Loader2 className="size-6 animate-spin" />
            <p>
              Cargando los modelos…
              <br />
              <span className="text-white/70">
                La primera vez tarda unos segundos.
              </span>
            </p>
          </div>
        )}
      </div>

      <div className="text-center">
        <p className="min-h-6 font-medium">
          {estado === "capturando" && consignaPara(tomadas)}
          {(estado === "completo" || estado === "guardando") &&
            "Capturas completas"}
        </p>
        <p className="text-muted-foreground min-h-5 text-sm">
          {estado === "capturando" && (aviso ?? "Perfecto, no te muevas")}
          {(estado === "completo" || estado === "guardando") &&
            `${MUESTRAS_ENROLAMIENTO} muestras tomadas. Guardá para dejarla habilitada a fichar.`}
        </p>
      </div>

      <div
        className="flex justify-center gap-1.5"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={MUESTRAS_ENROLAMIENTO}
        aria-valuenow={tomadas}
        aria-label="Capturas tomadas"
      >
        {Array.from({ length: MUESTRAS_ENROLAMIENTO }, (_, i) => (
          <span
            key={i}
            className={`h-1.5 w-6 rounded-full transition-colors ${
              i < tomadas ? "bg-emerald-500" : "bg-muted-foreground/25"
            }`}
          />
        ))}
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {(estado === "cargando" || estado === "capturando") && (
          <Button variant="outline" onClick={onCancelar}>
            Cancelar
          </Button>
        )}

        {(estado === "completo" || estado === "guardando") && (
          <>
            <Button onClick={guardar} disabled={estado === "guardando"}>
              {estado === "guardando" && (
                <Loader2 className="size-4 animate-spin" />
              )}
              Guardar registro
            </Button>
            <Button
              variant="outline"
              onClick={onCancelar}
              disabled={estado === "guardando"}
            >
              Descartar y repetir
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

/** getUserMedia distingue los casos por `name`; el `message` no se le muestra
 * a nadie porque viene en inglés y no dice qué hacer. */
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
  return "No se pudo iniciar la cámara ni cargar los modelos. Revisá la conexión y volvé a intentar.";
}
