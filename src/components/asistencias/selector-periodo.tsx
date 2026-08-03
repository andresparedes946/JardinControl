"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { nombreDePeriodo } from "@/components/asistencias/filtros-asistencias";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Selector de mes suelto, para las pantallas que no tienen más filtros. */
export function SelectorPeriodo({
  periodos,
  actual,
}: {
  periodos: string[];
  actual: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function elegir(periodo: string) {
    const params = new URLSearchParams(searchParams);
    params.set("periodo", periodo);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <Select
      items={Object.fromEntries(periodos.map((p) => [p, nombreDePeriodo(p)]))}
      value={actual}
      onValueChange={(v) => elegir(String(v))}
    >
      <SelectTrigger aria-label="Elegir mes" className="w-52">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {periodos.map((p) => (
          <SelectItem key={p} value={p}>
            {nombreDePeriodo(p)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
