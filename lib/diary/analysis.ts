import { z } from "zod";

export const DiaryAnalysisSchema = z.object({
  summary: z.string().describe("Resumen breve (1-2 frases) en segunda persona, cálido"),
  sentiment: z.number().describe("Ánimo global de -1 (muy negativo) a 1 (muy positivo)"),
  emotions: z.array(z.string()).describe("1-4 emociones en español, minúsculas: alegría, calma, gratitud, orgullo, amor, ilusión, tristeza, ansiedad, estrés, enfado, miedo, cansancio, frustración, soledad"),
  key_events: z.array(z.string()).describe("Hechos importantes del día (máx. 5)"),
  thoughts: z.array(z.string()).describe("Reflexiones o preocupaciones (máx. 5)"),
  tags: z.array(z.string()).describe("Etiquetas cortas en minúsculas (trabajo, familia, salud…), máx. 6"),
});
export type DiaryAnalysis = z.infer<typeof DiaryAnalysisSchema>;

const LEX: Array<[string, RegExp, number]> = [
  ["alegría", /\b(feliz|genial|alegr|content|increible|fenomenal|guay|bien)\w*/g, 0.5],
  ["gratitud", /\b(gracias|agradecid|afortunad)\w*/g, 0.5],
  ["orgullo", /\b(orgullos|consegu|logr|termin[eé]|aprob)\w*/g, 0.5],
  ["amor", /\b(amor|quiero|novi[oa]|pareja|abrazo)\w*/g, 0.4],
  ["calma", /\b(tranquil|relajad|paz|descans)\w*/g, 0.3],
  ["ilusión", /\b(ilusi|emocionad|ganas de)\w*/g, 0.4],
  ["tristeza", /\b(triste|llor|pena|deprim|mal dia|fatal)\w*/g, -0.6],
  ["ansiedad", /\b(ansie|nervios|agobi|preocup|miedo a)\w*/g, -0.5],
  ["estrés", /\b(estres|presion|mucho trabajo|no llego|saturad)\w*/g, -0.4],
  ["enfado", /\b(enfad|cabre|rabia|harto|odio|discut)\w*/g, -0.5],
  ["cansancio", /\b(cansad|agotad|sueño|dormi poco)\w*/g, -0.3],
  ["soledad", /\b(sol[oa] |solitud|nadie|aislad)\w*/g, -0.5],
];

const TAGS: Array<[string, RegExp]> = [
  ["trabajo", /\b(trabajo|oficina|jefe|reuni[oó]n|proyecto|cliente|curro)\b/],
  ["familia", /\b(mam[aá]|pap[aá]|madre|padre|herman[oa]|familia|abuel[oa]|hij[oa])\b/],
  ["amigos", /\b(amig[oa]s?|colegas?|quedada)\b/],
  ["salud", /\b(m[eé]dico|gimnasio|gym|correr|dolor|enferm|salud|dormir)\b/],
  ["dinero", /\b(dinero|pagar|factura|sueldo|banco|ahorr)\w*/],
  ["pareja", /\b(novi[oa]|pareja|cita)\b/],
  ["estudios", /\b(examen|clase|universidad|estudi)\w*/],
];

/** Análisis sin IA (modo simulado o sin clave): léxico de emociones + etiquetas por temas. */
export function heuristicAnalysis(text: string): DiaryAnalysis {
  const t = text.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
  const scores = LEX.map(([emo, re, w]) => [emo, (t.match(re) ?? []).length, w] as const).filter(([, n]) => n > 0);
  const emotions = [...scores].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([e]) => e);
  const raw = scores.reduce((acc, [, n, w]) => acc + n * w, 0);
  const sentiment = Math.max(-1, Math.min(1, Math.round(Math.tanh(raw / 2) * 100) / 100));
  const sentences = text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  const key_events = sentences.filter((s) => /\b(he|hemos|fui|fuimos|termin|empec|conoc|compr|vi |ido)\w*/i.test(s)).slice(0, 5);
  const thoughts = sentences.filter((s) => /\b(creo|pienso|siento|me pregunto|ojal[aá]|deber[ií]a|quiero)\b/i.test(s)).slice(0, 5);
  const tags = TAGS.filter(([, re]) => re.test(t)).map(([tag]) => tag);
  const first = sentences[0] ?? text.slice(0, 120);
  return {
    summary: first.length > 160 ? `${first.slice(0, 157)}…` : first,
    sentiment,
    emotions,
    key_events,
    thoughts,
    tags,
  };
}
