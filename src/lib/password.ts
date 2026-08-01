/**
 * Contraseñas provisionales.
 *
 * Pensadas para que la directora se las dicte a la empleada en voz alta sin
 * equivocarse: sílabas pronunciables en vez de caracteres al azar. La
 * empleada la cambia desde su perfil en el primer ingreso.
 *
 * No es criptográficamente fuerte y no pretende serlo: es de un solo uso y
 * de vida corta. Las contraseñas definitivas las elige cada usuaria.
 */
const SILABAS = [
  "ma", "re", "so", "li", "tu", "pa", "ne", "vi",
  "ca", "do", "fe", "gu", "lo", "mi", "ro", "sa",
];

export function generarPasswordProvisional() {
  const silaba = () => SILABAS[Math.floor(Math.random() * SILABAS.length)];
  const parte = () => `${silaba()}${silaba()}`;
  const numero = String(Math.floor(Math.random() * 90) + 10);

  return `${parte()}-${parte()}-${numero}`;
}
