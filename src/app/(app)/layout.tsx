import { BarraLateral } from "@/components/barra-lateral";
import { CambiarTema } from "@/components/cambiar-tema";
import { requerirSesion } from "@/lib/session";

export default async function LayoutApp({
  children,
}: {
  children: React.ReactNode;
}) {
  const sesion = await requerirSesion();
  const { name, email } = sesion.user;

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <BarraLateral nombre={name ?? ""} email={email ?? ""} />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="no-imprimir flex justify-end p-2 md:p-3">
          <CambiarTema />
        </div>
        <main className="min-w-0 flex-1 p-4 pt-0 md:p-6 md:pt-0">
          {children}
        </main>
      </div>
    </div>
  );
}
