/**
 * Cerebro SIMULADO (sin claves de IA). Respuestas con la personalidad del hermano
 * mayor para poder probar toda la app en local.
 */
export function mockReply(input: string, ctx: { userName: string; assistantName: string; memories?: string[] }): string {
  const t = input
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
  const h = ctx.userName || "hermano";
  const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

  if (/^(hola|ey|buenas|que tal|hey)\b/.test(t))
    return pick([`Ey, ${h}. Aquí estoy. ¿Qué necesitas?`, `Buenas, hermano. ¿Cómo vamos?`, `Dime, hermano. Te escucho.`]);
  if (/como te llamas|quien eres/.test(t)) return `Soy ${ctx.assistantName}, tu hermano mayor. El que no te deja hacer tonterías.`;
  if (/que hora es/.test(t)) return `Son las ${new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}, hermano.`;
  if (/(estoy|me siento) (mal|triste|fatal|agobiado|cansado)/.test(t))
    return `Oye, para un segundo. Estoy aquí. Cuéntame qué ha pasado, sin prisa.`;
  if (/(voy a|quiero) (dejar|renunciar|comprar|gastar)/.test(t))
    return `Espera, hermano. Antes de lanzarte: ¿lo has pensado en frío o es un calentón? Cuéntame los números.`;
  if (/gracias/.test(t)) return pick([`Para eso estoy, hermano.`, `Siempre. Ya lo sabes.`]);
  if (ctx.memories?.length && /(recuerdas|que te dije|que hicimos)/.test(t))
    return `Esto es lo que tengo, hermano: ${ctx.memories.slice(0, 3).join(" · ")}`;
  return pick([
    `Entendido, hermano. Estoy en modo simulado, así que mi cerebro completo llega cuando pongas las claves. Pero lo apunto.`,
    `Te escucho. Ahora mismo funciono en modo simulado; con la clave de Claude te respondo de verdad.`,
  ]);
}
