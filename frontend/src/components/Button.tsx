import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

type PropsComunes = {
  variante?: "primario" | "plano";
  icono?: LucideIcon;
  posicionIcono?: "izquierda" | "derecha";
  tamanoIcono?: number;
  children: ReactNode;
};

type PropsBoton = PropsComunes &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> & {
    href?: undefined;
    type?: "button" | "submit" | "reset";
  };

type PropsEnlace = PropsComunes &
  AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
  };

type Props = PropsBoton | PropsEnlace;

// Envuelve las clases Kairos ya existentes (.boton-con-icono / .boton-primario) — no define
// estilos nuevos. Polimórfico entre <button> y <a href> porque las pantallas de Estructura
// Organizacional usan ambos indistintamente para la misma clase visual (alta vs. navegación).
export function Button(props: Props) {
  const {
    variante = "plano",
    icono: Icono,
    posicionIcono = "derecha",
    tamanoIcono = 16,
    className,
    children,
    ...resto
  } = props;

  const clases = ["boton-con-icono", variante === "primario" ? "boton-primario" : "", className]
    .filter(Boolean)
    .join(" ");

  const contenido = (
    <>
      {Icono && posicionIcono === "izquierda" && <Icono size={tamanoIcono} aria-hidden="true" />}
      {children}
      {Icono && posicionIcono === "derecha" && <Icono size={tamanoIcono} aria-hidden="true" />}
    </>
  );

  if (props.href !== undefined) {
    const { href, ...restoEnlace } = resto as Omit<PropsEnlace, keyof PropsComunes | "className">;
    return (
      <a href={href} className={clases} {...restoEnlace}>
        {contenido}
      </a>
    );
  }

  const { type, ...restoBoton } = resto as Omit<PropsBoton, keyof PropsComunes | "className">;
  return (
    <button type={type ?? "button"} className={clases} {...restoBoton}>
      {contenido}
    </button>
  );
}
